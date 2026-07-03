/**
 * App Open Manager - Independent Lifecycle
 *
 * Lifecycle: Idle → Loading → Loaded → Showing → Closed → (repeats)
 *
 * @module AppOpenManager
 */

import { AppOpenService } from '../services/AppOpenService';
import { AppOpenState, AppOpenManagerCallbacks } from '../types/AdsTypes';
import Logger from '../utils/Logger';

const TAG = 'AppOpenManager';

/**
 * App Open Manager - Independent
 */
export class AppOpenManager {
  private _state: AppOpenState = 'idle';
  private _isPaused: boolean = false;
  private _service: AppOpenService;
  private _callbacks: AppOpenManagerCallbacks | null = null;
  private _instanceId: number;
  private static _counter: number = 0;
  private _isLoading: boolean = false;

  constructor() {
    AppOpenManager._counter++;
    this._instanceId = AppOpenManager._counter;
    Logger.debug(TAG, `🔵 Creating #${this._instanceId}`);

    this._service = new AppOpenService();
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
        this._state = 'closed';
        this._isLoading = false;
        this._callbacks?.onClosed();
        // ✅ CRITICAL FIX: NO auto-reload on close
        Logger.debug(
          TAG,
          `#${this._instanceId} ⏸️ Waiting for REAL foreground to reload`,
        );
      },
    });
  }

  public setCallbacks(callbacks: AppOpenManagerCallbacks): void {
    this._callbacks = callbacks;
  }

  public getService(): AppOpenService {
    return this._service;
  }

  // ✅ NEW: Reset state to idle (for REAL foreground)
  public resetState(): void {
    Logger.debug(
      TAG,
      `#${this._instanceId} 🔄 Resetting state from ${this._state} to idle`,
    );
    this._state = 'idle';
    this._isLoading = false;
  }

  public async startLoading(): Promise<void> {
    if (this._isPaused) {
      Logger.debug(TAG, `#${this._instanceId} ⏸️ Paused, not loading`);
      return;
    }

    if (this._isLoading) {
      Logger.debug(TAG, `#${this._instanceId} ⏳ Already loading, skipping`);
      return;
    }

    const stateStr = this._state as string;

    if (stateStr === 'loaded') {
      Logger.debug(TAG, `#${this._instanceId} ✅ Already loaded, skipping`);
      return;
    }

    // ✅ If state is 'closed', reset to idle first
    if (stateStr === 'closed') {
      Logger.debug(
        TAG,
        `#${this._instanceId} 🔄 State is 'closed', resetting to idle`,
      );
      this._state = 'idle';
    }

    if (stateStr === 'loading') {
      Logger.debug(
        TAG,
        `#${this._instanceId} 🔄 State stuck in loading, resetting`,
      );
      this._state = 'idle';
      this._isLoading = false;
    }

    const canLoad = this._state === 'idle' || this._state === 'failed';
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

    const stateStr = this._state as string;

    if (stateStr !== 'loaded') {
      Logger.debug(TAG, `#${this._instanceId} ❌ Not loaded (${this._state})`);

      if (stateStr === 'loading') {
        Logger.debug(TAG, `#${this._instanceId} ⏳ Waiting for load...`);
        let waitCount = 0;
        while (this._state === 'loading' && waitCount < 50) {
          await new Promise<void>(resolve => {
            setTimeout(() => {
              resolve();
            }, 100);
          });
          waitCount++;
        }
        if (this._state !== 'loaded') {
          Logger.debug(TAG, `#${this._instanceId} ❌ Load timeout`);
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

  public getState(): AppOpenState {
    return this._state;
  }

  public pause(): void {
    Logger.debug(TAG, `#${this._instanceId} ⏸️ Paused`);
    this._isPaused = true;
  }

  public resume(): void {
    Logger.debug(TAG, `#${this._instanceId} ▶️ Resumed`);
    this._isPaused = false;

    const stateStr = this._state as string;

    if (stateStr === 'loading' && !this._isLoading) {
      this._state = 'idle';
    }

    // ✅ CRITICAL FIX: If state is 'closed', DON'T reload
    // Wait for REAL foreground to trigger load
    if (stateStr === 'closed') {
      Logger.debug(
        TAG,
        `#${this._instanceId} ⏸️ State is 'closed', waiting for REAL foreground`,
      );
      return;
    }

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
    this._isLoading = false;
    this._callbacks = null;
  }
}

export default AppOpenManager;
