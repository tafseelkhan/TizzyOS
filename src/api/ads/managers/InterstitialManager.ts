/**
 * Interstitial Manager - Independent Lifecycle
 *
 * Lifecycle: Idle → Loading → Loaded → Showing → Cooldown → (repeats)
 *
 * @module InterstitialManager
 */

import { InterstitialService } from '../services/InterstitialService';
import {
  InterstitialState,
  InterstitialManagerCallbacks,
} from '../types/AdsTypes';
import AdsConfig from '../config/AdsConfig';
import Logger from '../utils/Logger';

const TAG = 'InterstitialManager';

/**
 * Interstitial Manager - Independent
 */
export class InterstitialManager {
  private _state: InterstitialState = 'idle';
  private _isPaused: boolean = false;
  private _service: InterstitialService;
  private _callbacks: InterstitialManagerCallbacks | null = null;
  private _pendingTrigger: boolean = false;
  private _instanceId: number;
  private static _counter: number = 0;
  private _isLoading: boolean = false;

  constructor() {
    InterstitialManager._counter++;
    this._instanceId = InterstitialManager._counter;
    Logger.debug(TAG, `🔵 Creating #${this._instanceId}`);

    this._service = new InterstitialService();
    this._service.setCallbacks({
      onLoaded: () => {
        Logger.debug(TAG, `#${this._instanceId} ✅ Service loaded`);
        this._state = 'loaded';
        this._isLoading = false;
        this._callbacks?.onLoaded();
      },
      onFailed: error => {
        Logger.error(TAG, `#${this._instanceId} ❌ Service failed:`, error);
        this._state = 'idle';
        this._isLoading = false;
        this._callbacks?.onFailed(error);
      },
      onOpened: () => {
        Logger.debug(TAG, `#${this._instanceId} 👁️ Service opened`);
        this._state = 'showing';
        this._isLoading = false;
        this._callbacks?.onOpened();
      },
      onClosed: () => {
        Logger.debug(TAG, `#${this._instanceId} 🚪 Service closed`);
        this._state = 'cooldown';
        this._isLoading = false;
        this._callbacks?.onClosed();
        // Auto-reload after cooldown
        setTimeout(() => {
          if (!this._isPaused) {
            Logger.debug(
              TAG,
              `#${this._instanceId} 🔄 Auto-reloading after cooldown`,
            );
            this.startLoading();
          }
        }, AdsConfig.interstitialCooldownMs || 30000);
      },
      onCooldownEnded: () => {
        Logger.debug(TAG, `#${this._instanceId} 🔥 Cooldown ended`);
        this._state = 'idle';
        this._isLoading = false;
        this._callbacks?.onCooldownEnded();
        // If we have a pending trigger, try to show
        if (this._pendingTrigger && !this._isPaused) {
          Logger.debug(TAG, `#${this._instanceId} 🎯 Pending exists, showing`);
          this.show();
        } else if (!this._isPaused) {
          // Auto-load next ad
          Logger.debug(TAG, `#${this._instanceId} 📦 Auto-loading next ad`);
          this.startLoading();
        }
      },
    });
  }

  public setCallbacks(callbacks: InterstitialManagerCallbacks): void {
    this._callbacks = callbacks;
  }

  public getService(): InterstitialService {
    return this._service;
  }

  public async startLoading(): Promise<void> {
    // ✅ Check if paused
    if (this._isPaused) {
      Logger.debug(TAG, `#${this._instanceId} ⏸️ Paused, not loading`);
      return;
    }

    // ✅ Check if already loading
    if (this._isLoading) {
      Logger.debug(TAG, `#${this._instanceId} ⏳ Already loading, skipping`);
      return;
    }

    // ✅ Fix: Use string comparison with type assertion
    const stateStr = this._state as string;

    // ✅ Check if already loaded
    if (stateStr === 'loaded') {
      Logger.debug(TAG, `#${this._instanceId} ✅ Already loaded, skipping`);
      return;
    }

    // ✅ Reset stuck states
    if (stateStr === 'loading') {
      Logger.debug(
        TAG,
        `#${this._instanceId} 🔄 State stuck in loading, resetting to idle`,
      );
      this._state = 'idle';
      this._isLoading = false;
    }

    // ✅ Only load if state allows
    const canLoad =
      stateStr === 'idle' ||
      stateStr === 'failed' ||
      stateStr === 'cooldown' ||
      stateStr === 'closed';
    if (!canLoad) {
      Logger.debug(
        TAG,
        `#${this._instanceId} ⏸️ Cannot load in state: ${this._state}`,
      );
      return;
    }

    Logger.debug(
      TAG,
      `#${this._instanceId} 📥 Loading... (${this._state} → loading)`,
    );
    this._state = 'loading';
    this._isLoading = true;

    try {
      await this._service.loadAd();
    } catch (error) {
      Logger.error(TAG, `#${this._instanceId} ❌ Load error:`, error);
      this._state = 'idle';
      this._isLoading = false;
      this._callbacks?.onFailed(error as Error);
    }
  }

  public async show(): Promise<boolean> {
    if (this._isPaused) {
      Logger.debug(TAG, `#${this._instanceId} ⏸️ Paused, cannot show`);
      return false;
    }

    // ✅ Fix: Use string comparison with type assertion
    const stateStr = this._state as string;

    if (stateStr !== 'loaded') {
      Logger.debug(TAG, `#${this._instanceId} ❌ Not loaded (${this._state})`);
      // ✅ If state is loading but not loaded, wait
      if (stateStr === 'loading') {
        Logger.debug(
          TAG,
          `#${this._instanceId} ⏳ Waiting for load to complete...`,
        );
        // Wait for load to complete (max 5 seconds)
        let waitCount = 0;
        // ✅ Fix: Use proper Promise<void> typing
        while (this._state === 'loading' && waitCount < 50) {
          await new Promise<void>(resolve => {
            setTimeout(() => {
              resolve();
            }, 100);
          });
          waitCount++;
        }
        if (this._state === 'loaded') {
          Logger.debug(
            TAG,
            `#${this._instanceId} ✅ Load completed, showing now`,
          );
        } else {
          Logger.debug(
            TAG,
            `#${this._instanceId} ❌ Load still not complete after waiting`,
          );
          return false;
        }
      } else {
        return false;
      }
    }

    Logger.debug(TAG, `#${this._instanceId} 🎯 Showing`);
    const result = await this._service.showAd();
    if (result) {
      this._state = 'showing';
      this._pendingTrigger = false;
      this._isLoading = false;
      Logger.debug(TAG, `#${this._instanceId} ✅ Show succeeded`);
    } else {
      this._state = 'idle';
      this._isLoading = false;
      Logger.debug(TAG, `#${this._instanceId} ❌ Show failed`);
    }
    return result;
  }

  public isLoaded(): boolean {
    return this._state === 'loaded';
  }

  public getState(): InterstitialState {
    return this._state;
  }

  public setPendingTrigger(): void {
    Logger.debug(TAG, `#${this._instanceId} 📝 Pending trigger set`);
    this._pendingTrigger = true;
  }

  public hasPendingTrigger(): boolean {
    return this._pendingTrigger;
  }

  public clearPendingTrigger(): void {
    Logger.debug(TAG, `#${this._instanceId} 🧹 Pending trigger cleared`);
    this._pendingTrigger = false;
  }

  public pause(): void {
    Logger.debug(TAG, `#${this._instanceId} ⏸️ Paused`);
    this._isPaused = true;
  }

  public resume(): void {
    Logger.debug(TAG, `#${this._instanceId} ▶️ Resumed`);
    this._isPaused = false;

    // ✅ Fix: Use string comparison with type assertion
    const stateStr = this._state as string;

    // ✅ Reset stuck state on resume
    if (stateStr === 'loading' && !this._isLoading) {
      this._state = 'idle';
    }

    // ✅ Reload if needed
    const isLoadedState = stateStr === 'loaded';
    const isLoadingState = stateStr === 'loading';
    if (!isLoadedState && !isLoadingState) {
      Logger.debug(TAG, `#${this._instanceId} 🔄 Reloading on resume`);
      this.startLoading();
    }
  }

  public isPaused(): boolean {
    return this._isPaused;
  }

  public cleanUp(): void {
    Logger.debug(TAG, `#${this._instanceId} 🧹 Cleaning up`);
    this._service.cleanUp();
    this._state = 'idle';
    this._pendingTrigger = false;
    this._isLoading = false;
    this._callbacks = null;
  }
}

export default InterstitialManager;
