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

  constructor() {
    InterstitialManager._counter++;
    this._instanceId = InterstitialManager._counter;
    Logger.debug(TAG, `🔵 Creating #${this._instanceId}`);

    this._service = new InterstitialService();
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
        this._state = 'cooldown';
        this._callbacks?.onClosed();
        // Auto-reload after cooldown
        setTimeout(() => {
          if (!this._isPaused) {
            this.startLoading();
          }
        }, AdsConfig.interstitialCooldownMs);
      },
      onCooldownEnded: () => {
        Logger.debug(TAG, `#${this._instanceId} Cooldown ended`);
        this._state = 'idle';
        // If we have a pending trigger, try to show
        if (this._pendingTrigger && !this._isPaused) {
          this.show();
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
      this._pendingTrigger = false;
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
    Logger.debug(TAG, `#${this._instanceId} Pending trigger set`);
    this._pendingTrigger = true;
  }

  public hasPendingTrigger(): boolean {
    return this._pendingTrigger;
  }

  public clearPendingTrigger(): void {
    Logger.debug(TAG, `#${this._instanceId} Pending trigger cleared`);
    this._pendingTrigger = false;
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
    this._pendingTrigger = false;
    this._callbacks = null;
  }
}

export default InterstitialManager;
