/**
 * AppState FSM - Only tracks app lifecycle
 *
 * Emits events: APP_FOREGROUND, APP_BACKGROUND, AD_OPENED, AD_CLOSED
 *
 * @module AppStateFSM
 */

import { AppStateValue, AppStateFSMResult } from '../types/AdsTypes';
import { AdsConstants } from '../constants/AdsConstants';
import Logger from '../utils/Logger';

const TAG = 'AppStateFSM';

/**
 * AppState FSM - Pure state machine
 */
export class AppStateFSM {
  private _state: AppStateValue = 'foreground';
  private _lastTransitionTime: number = 0;
  private _adShowing: boolean = false;
  private _adJustClosed: boolean = false;
  private _adClosedTime: number = 0;
  private _listeners: ((event: string, data: any) => void)[] = [];

  constructor() {
    Logger.debug(TAG, 'Initialized');
  }

  /**
   * Initialize with current state
   */
  public initialize(isForeground: boolean): void {
    this._state = isForeground ? 'foreground' : 'background';
    this._lastTransitionTime = Date.now();
    Logger.debug(TAG, `Initialized to: ${this._state}`);
  }

  /**
   * Handle AppState change
   */
  public handleAppStateChange(nextAppState: string): AppStateFSMResult {
    const now = Date.now();
    const isNowForeground = nextAppState === 'active';
    const previousState = this._state;
    const wasForeground = previousState === 'foreground';

    Logger.debug(
      TAG,
      `handleAppStateChange: ${nextAppState}, wasForeground: ${wasForeground}, adShowing: ${this._adShowing}, adJustClosed: ${this._adJustClosed}`,
    );

    // If ad is showing, ignore and DON'T update state
    if (this._adShowing) {
      Logger.debug(TAG, `⛔ Ad is showing, keeping state: ${this._state}`);
      return {
        transition: 'none',
        isReal: false,
        previousState,
        newState: this._state,
      };
    }

    // ✅ CRITICAL: ALWAYS update internal state to match actual app state
    // This prevents the FSM from getting stuck in background
    const newState = isNowForeground ? 'foreground' : 'background';
    const stateChanged = this._state !== newState;
    this._state = newState;
    Logger.debug(TAG, `State updated to: ${this._state}`);

    // ✅ NOTIFY listeners about state change even if suppressed
    // This ensures AdCoordinator knows the actual foreground state
    if (stateChanged) {
      if (this._state === 'foreground') {
        this._notify('APP_FOREGROUND', {
          previousState,
          newState: this._state,
          suppressed: this._adJustClosed,
        });
      } else {
        this._notify('APP_BACKGROUND', {
          previousState,
          newState: this._state,
          suppressed: this._adJustClosed,
        });
      }
    }

    // If ad just closed, suppress callbacks but state is already updated
    if (
      this._adJustClosed &&
      now - this._adClosedTime < AdsConstants.IGNORE_AFTER_AD_CLOSE_MS
    ) {
      Logger.debug(
        TAG,
        `⛔ Ad just closed, suppressing callbacks, state: ${this._state}`,
      );
      return {
        transition: 'none',
        isReal: false,
        previousState,
        newState: this._state,
      };
    }

    // Now process REAL transitions with callbacks
    if (wasForeground && !isNowForeground) {
      Logger.debug(TAG, `🔴 Real background detected`);
      this._lastTransitionTime = now;
      this._notify('REAL_APP_BACKGROUND', {
        previousState,
        newState: this._state,
      });
      return {
        transition: 'background',
        isReal: true,
        previousState,
        newState: this._state,
      };
    }

    if (!wasForeground && isNowForeground) {
      const bgDuration = now - this._lastTransitionTime;
      if (bgDuration >= AdsConstants.MIN_BACKGROUND_DURATION_MS) {
        Logger.debug(TAG, `🟢 Real foreground detected (bg: ${bgDuration}ms)`);
        this._lastTransitionTime = now;
        this._notify('REAL_APP_FOREGROUND', {
          previousState,
          newState: this._state,
        });
        return {
          transition: 'foreground',
          isReal: true,
          previousState,
          newState: this._state,
        };
      } else {
        Logger.debug(TAG, `⛔ Too short background (${bgDuration}ms)`);
        return {
          transition: 'none',
          isReal: false,
          previousState,
          newState: this._state,
        };
      }
    }

    return {
      transition: 'none',
      isReal: false,
      previousState,
      newState: this._state,
    };
  }

  public setAdShowing(showing: boolean): void {
    Logger.debug(TAG, `setAdShowing: ${showing}`);
    this._adShowing = showing;
    if (showing) {
      this._notify('AD_OPENED', {});
    }
  }

  public setAdJustClosed(): void {
    Logger.debug(TAG, `setAdJustClosed at ${Date.now()}`);
    this._adJustClosed = true;
    this._adClosedTime = Date.now();
    this._notify('AD_CLOSED', {});

    setTimeout(() => {
      this._adJustClosed = false;
      Logger.debug(TAG, `Auto-reset adJustClosed`);
    }, AdsConstants.IGNORE_AFTER_AD_CLOSE_MS);
  }

  public getState(): AppStateValue {
    return this._state;
  }

  public isForeground(): boolean {
    return this._state === 'foreground';
  }

  public addListener(listener: (event: string, data: any) => void): () => void {
    this._listeners.push(listener);
    return () => {
      const index = this._listeners.indexOf(listener);
      if (index > -1) {
        this._listeners.splice(index, 1);
      }
    };
  }

  private _notify(event: string, data: any): void {
    this._listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        Logger.error(TAG, `Listener error:`, error);
      }
    });
  }

  public reset(): void {
    this._state = 'foreground';
    this._lastTransitionTime = 0;
    this._adShowing = false;
    this._adJustClosed = false;
    this._adClosedTime = 0;
    this._listeners = [];
    Logger.debug(TAG, `Reset`);
  }
}

export default AppStateFSM;
