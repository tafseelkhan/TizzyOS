/**
 * Interstitial Service - GMA SDK Wrapper
 *
 * Only handles loading, showing, and reporting events.
 * No business logic.
 *
 * @module InterstitialService
 */

import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import AdsConfig from '../config/AdsConfig';
import { InterstitialServiceCallbacks } from '../types/AdsTypes';
import { AdsConstants } from '../constants/AdsConstants';
import Logger from '../utils/Logger';
import { Platform } from 'react-native';

type AdError = any;

const TAG = 'InterstitialService';

/**
 * Interstitial Service - Pure service wrapper
 */
export class InterstitialService {
  private _adInstance: InterstitialAd | null = null;
  private _isLoading: boolean = false;
  private _isDestroyed: boolean = false;
  private _callbacks: InterstitialServiceCallbacks | null = null;
  private _cooldownTimerId: ReturnType<typeof setTimeout> | null = null;
  private _isCooldownActive: boolean = false;
  private _instanceId: number;
  private static _counter: number = 0;

  constructor() {
    InterstitialService._counter++;
    this._instanceId = InterstitialService._counter;
    Logger.debug(TAG, `🔵 Creating instance #${this._instanceId}`);
  }

  public setCallbacks(callbacks: InterstitialServiceCallbacks): void {
    this._callbacks = callbacks;
  }

  public async loadAd(): Promise<void> {
    if (this._isLoading || this._isDestroyed) {
      Logger.debug(
        TAG,
        `#${this._instanceId} Load skipped (loading: ${this._isLoading}, destroyed: ${this._isDestroyed})`,
      );
      return;
    }

    Logger.debug(TAG, `#${this._instanceId} Loading ad...`);
    this._isLoading = true;

    return new Promise((resolve, reject) => {
      try {
        this._cleanupAdInstance();

        const adUnitId = this._getAdUnitId();
        Logger.debug(TAG, `#${this._instanceId} Ad unit: ${adUnitId}`);

        this._adInstance = InterstitialAd.createForAdRequest(adUnitId, {
          requestNonPersonalizedAdsOnly: !AdsConfig.productionMode,
          keywords: ['interstitial'],
        });

        if (!this._adInstance) {
          throw new Error('Failed to create InterstitialAd instance');
        }

        this._setupEventListeners();

        // Timeout
        setTimeout(() => {
          if (this._isLoading) {
            this._isLoading = false;
            const error = new Error('Ad load timeout exceeded');
            Logger.error(TAG, `#${this._instanceId} ⏰ Load timeout`);
            this._callbacks?.onFailed(error);
            reject(error);
          }
        }, AdsConstants.AD_LOAD_TIMEOUT_MS);

        this._adInstance.load();
        Logger.debug(TAG, `#${this._instanceId} load() called`);
        resolve();
      } catch (error) {
        this._isLoading = false;
        Logger.error(TAG, `#${this._instanceId} loadAd error:`, error);
        this._callbacks?.onFailed(error as Error);
        reject(error);
      }
    });
  }

  private _setupEventListeners(): void {
    if (!this._adInstance) return;

    this._adInstance.addAdEventListener(AdEventType.LOADED, () => {
      Logger.debug(TAG, `#${this._instanceId} ✅ Ad loaded`);
      this._isLoading = false;
      this._callbacks?.onLoaded();
    });

    this._adInstance.addAdEventListener(AdEventType.ERROR, (error: AdError) => {
      Logger.error(TAG, `#${this._instanceId} ❌ Ad error:`, error);
      this._isLoading = false;
      this._callbacks?.onFailed(error);
    });

    this._adInstance.addAdEventListener(AdEventType.OPENED, () => {
      Logger.debug(TAG, `#${this._instanceId} 👁️ Ad opened`);
      this._callbacks?.onOpened();
    });

    this._adInstance.addAdEventListener(AdEventType.CLOSED, () => {
      Logger.debug(TAG, `#${this._instanceId} 🚪 Ad closed`);
      this._startCooldown();
      this._callbacks?.onClosed();
      this._cleanupAdInstance();
    });
  }

  private _startCooldown(): void {
    this._isCooldownActive = true;
    Logger.debug(
      TAG,
      `#${this._instanceId} 🧊 Cooldown started (${AdsConfig.interstitialCooldownMs}ms)`,
    );

    if (this._cooldownTimerId) {
      clearTimeout(this._cooldownTimerId);
    }

    this._cooldownTimerId = setTimeout(() => {
      this._isCooldownActive = false;
      this._cooldownTimerId = null;
      Logger.debug(TAG, `#${this._instanceId} ✅ Cooldown ended`);
      this._callbacks?.onCooldownEnded();
    }, AdsConfig.interstitialCooldownMs);
  }

  public resetCooldown(): void {
    if (this._cooldownTimerId) {
      clearTimeout(this._cooldownTimerId);
      this._cooldownTimerId = null;
    }
    this._isCooldownActive = false;
    Logger.debug(TAG, `#${this._instanceId} Cooldown reset`);
  }

  private _cleanupAdInstance(): void {
    if (this._adInstance) {
      this._adInstance.removeAllListeners();
      this._adInstance = null;
      Logger.debug(TAG, `#${this._instanceId} adInstance cleaned`);
    }
  }

  public async showAd(): Promise<boolean> {
    Logger.debug(TAG, `#${this._instanceId} showAd() called`);
    Logger.debug(TAG, `#${this._instanceId} adInstance: ${!!this._adInstance}`);
    Logger.debug(
      TAG,
      `#${this._instanceId} isCooldownActive: ${this._isCooldownActive}`,
    );

    if (!this._adInstance) {
      Logger.debug(TAG, `#${this._instanceId} ❌ No ad instance`);
      return false;
    }

    if (this._isCooldownActive) {
      Logger.debug(TAG, `#${this._instanceId} ❌ Cooldown active, cannot show`);
      return false;
    }

    try {
      Logger.debug(TAG, `#${this._instanceId} ✅ Showing ad...`);
      await this._adInstance.show();
      Logger.debug(TAG, `#${this._instanceId} ✅ Show succeeded`);
      return true;
    } catch (error) {
      Logger.error(TAG, `#${this._instanceId} ❌ Show failed:`, error);
      return false;
    }
  }

  public isAvailable(): boolean {
    const available =
      !!this._adInstance && !this._isLoading && !this._isCooldownActive;
    Logger.debug(
      TAG,
      `#${this._instanceId} isAvailable(): ${available} (adInstance: ${!!this._adInstance}, isLoading: ${this._isLoading}, isCooldownActive: ${this._isCooldownActive})`,
    );
    return available;
  }

  public isCooldownActive(): boolean {
    return this._isCooldownActive;
  }

  public cleanUp(): void {
    Logger.debug(TAG, `#${this._instanceId} Cleaning up`);
    this._isDestroyed = true;
    if (this._cooldownTimerId) {
      clearTimeout(this._cooldownTimerId);
      this._cooldownTimerId = null;
    }
    this._cleanupAdInstance();
    this._callbacks = null;
  }

  private _getAdUnitId(): string {
    if (__DEV__ && !AdsConfig.productionMode) {
      return TestIds.INTERSTITIAL;
    }
    return Platform.OS === 'android'
      ? AdsConfig.androidInterstitialAdUnitId
      : AdsConfig.iosInterstitialAdUnitId;
  }

  public getStatus(): {
    isLoading: boolean;
    isAvailable: boolean;
    isCooldownActive: boolean;
  } {
    return {
      isLoading: this._isLoading,
      isAvailable: this.isAvailable(),
      isCooldownActive: this._isCooldownActive,
    };
  }

  public getInstanceId(): number {
    return this._instanceId;
  }
}

export default InterstitialService;
