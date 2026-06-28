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

  constructor() {
    AppOpenManager._counter++;
    this._instanceId = AppOpenManager._counter;
    Logger.debug(TAG, `🔵 Creating #${this._instanceId}`);

    this._service = new AppOpenService();
    this._service.setCallbacks({
      onLoaded: () => {
        Logger.debug(TAG, `#${this._instanceId} Service loaded`);
        this._state = 'loaded';
        this._callbacks?.onLoaded();
      },
      onFailed: error => {
        Logger.error(TAG, `#${this._instanceId} Service failed:`, error);
        this._state = 'failed';
        this._callbacks?.onFailed(error);
      },
      onOpened: () => {
        Logger.debug(TAG, `#${this._instanceId} Service opened`);
        this._state = 'showing';
        this._callbacks?.onOpened();
      },
      onClosed: () => {
        Logger.debug(TAG, `#${this._instanceId} Service closed`);
        this._state = 'closed';
        this._callbacks?.onClosed();
        // Auto-reload
        if (!this._isPaused) {
          this.startLoading();
        }
      },
    });
  }

  public setCallbacks(callbacks: AppOpenManagerCallbacks): void {
    this._callbacks = callbacks;
  }

  public getService(): AppOpenService {
    return this._service;
  }

  public async startLoading(): Promise<void> {
    if (this._isPaused) {
      Logger.debug(TAG, `#${this._instanceId} Paused, not loading`);
      return;
    }

    if (this._state === 'loading' || this._state === 'loaded') {
      Logger.debug(TAG, `#${this._instanceId} Already loading/loaded`);
      return;
    }

    Logger.debug(TAG, `#${this._instanceId} Loading...`);
    this._state = 'loading';
    await this._service.loadAd();
  }

  public async show(): Promise<boolean> {
    if (this._isPaused) {
      Logger.debug(TAG, `#${this._instanceId} Paused, cannot show`);
      return false;
    }

    if (this._state !== 'loaded') {
      Logger.debug(TAG, `#${this._instanceId} Not loaded (${this._state})`);
      return false;
    }

    Logger.debug(TAG, `#${this._instanceId} Showing`);
    const result = await this._service.showAd();
    if (result) {
      this._state = 'showing';
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
    Logger.debug(TAG, `#${this._instanceId} Paused`);
    this._isPaused = true;
  }

  public resume(): void {
    Logger.debug(TAG, `#${this._instanceId} Resumed`);
    this._isPaused = false;
    if (this._state !== 'loaded' && this._state !== 'loading') {
      this.startLoading();
    }
  }

  public isPaused(): boolean {
    return this._isPaused;
  }

  public cleanUp(): void {
    Logger.debug(TAG, `#${this._instanceId} Cleaning up`);
    this._service.cleanUp();
    this._state = 'idle';
    this._callbacks = null;
  }
}

export default AppOpenManager;
