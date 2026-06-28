/**
 * App Open Service - GMA SDK Wrapper
 *
 * Only handles loading, showing, and reporting events.
 * No business logic.
 *
 * @module AppOpenService
 */

import {
  AppOpenAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import AdsConfig from '../config/AdsConfig';
import { AppOpenServiceCallbacks } from '../types/AdsTypes';
import { AdsConstants } from '../constants/AdsConstants';
import Logger from '../utils/Logger';
import { Platform } from 'react-native';

type AdError = any;

const TAG = 'AppOpenService';

/**
 * App Open Service - Pure service wrapper
 */
export class AppOpenService {
  private _adInstance: AppOpenAd | null = null;
  private _isLoading: boolean = false;
  private _isDestroyed: boolean = false;
  private _callbacks: AppOpenServiceCallbacks | null = null;
  private _instanceId: number;
  private static _counter: number = 0;

  constructor() {
    AppOpenService._counter++;
    this._instanceId = AppOpenService._counter;
    Logger.debug(TAG, `🔵 Creating instance #${this._instanceId}`);
  }

  public setCallbacks(callbacks: AppOpenServiceCallbacks): void {
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

        this._adInstance = AppOpenAd.createForAdRequest(adUnitId, {
          requestNonPersonalizedAdsOnly: !AdsConfig.productionMode,
          keywords: ['app-open'],
        });

        if (!this._adInstance) {
          throw new Error('Failed to create AppOpenAd instance');
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
      this._callbacks?.onClosed();
      this._cleanupAdInstance();
    });
  }

  private _cleanupAdInstance(): void {
    if (this._adInstance) {
      this._adInstance.removeAllListeners();
      this._adInstance = null;
      Logger.debug(TAG, `#${this._instanceId} adInstance cleaned`);
    }
  }

  public async showAd(): Promise<boolean> {
    if (!this._adInstance) {
      Logger.debug(TAG, `#${this._instanceId} No ad instance`);
      return false;
    }

    try {
      Logger.debug(TAG, `#${this._instanceId} Showing ad...`);
      await this._adInstance.show();
      Logger.debug(TAG, `#${this._instanceId} ✅ Show succeeded`);
      return true;
    } catch (error) {
      Logger.error(TAG, `#${this._instanceId} Show failed:`, error);
      return false;
    }
  }

  public isAvailable(): boolean {
    return !!this._adInstance && !this._isLoading;
  }

  public cleanUp(): void {
    Logger.debug(TAG, `#${this._instanceId} Cleaning up`);
    this._isDestroyed = true;
    this._cleanupAdInstance();
    this._callbacks = null;
  }

  private _getAdUnitId(): string {
    if (__DEV__ && !AdsConfig.productionMode) {
      return TestIds.APP_OPEN;
    }
    return Platform.OS === 'android'
      ? AdsConfig.androidAppOpenAdUnitId
      : AdsConfig.iosAppOpenAdUnitId;
  }

  public getStatus(): { isLoading: boolean; isAvailable: boolean } {
    return {
      isLoading: this._isLoading,
      isAvailable: this.isAvailable(),
    };
  }

  public getInstanceId(): number {
    return this._instanceId;
  }
}

export default AppOpenService;
