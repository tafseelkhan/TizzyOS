/**
 * AppState FSM - Tracks app lifecycle with ad-aware state detection
 *
 * State Machine:
 * FOREGROUND → BACKGROUND_PENDING → REAL_BACKGROUND or AD_BACKGROUND
 *
 * States:
 * - FOREGROUND: App is visible to user
 * - BACKGROUND_PENDING: AppState reported background, waiting for grace period
 * - REAL_BACKGROUND: User actually left the app (no ad opened)
 * - AD_BACKGROUND: Background was caused by ad overlay
 *
 * @module AppStateFSM
 */

import { AppStateValue, AppStateFSMResult } from '../types/AdsTypes';
import { AdsConstants } from '../constants/AdsConstants';
import Logger from '../utils/Logger';

const TAG = 'AppStateFSM';

type FSMState =
  | 'foreground'
  | 'background_pending'
  | 'real_background'
  | 'ad_background';

/**
 * AppState FSM - Pure state machine with ad-aware detection
 */
export class AppStateFSM {
  private _state: FSMState = 'foreground';
  private _lastTransitionTime: number = 0;
  private _adShowing: boolean = false;
  private _adJustClosed: boolean = false;
  private _adClosedTime: number = 0;
  private _pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private _isPending: boolean = false;
  private _listeners: ((event: string, data: any) => void)[] = [];
  private _adOpenedDuringPending: boolean = false;

  // Configuration
  private _gracePeriodMs: number =
    AdsConstants.BACKGROUND_GRACE_PERIOD_MS || 500;

  constructor() {
    Logger.debug(
      TAG,
      'Initialized with grace period: ' + this._gracePeriodMs + 'ms',
    );
  }

  /**
   * Initialize with current state
   */
  public initialize(isForeground: boolean): void {
    this._state = isForeground ? 'foreground' : 'real_background';
    this._lastTransitionTime = Date.now();
    Logger.debug(TAG, `Initialized to: ${this._state}`);
  }

  /**
   * Handle AppState change from React Native
   */
  public handleAppStateChange(nextAppState: string): AppStateFSMResult {
    const now = Date.now();
    const isNowForeground = nextAppState === 'active';
    const previousState = this._state;

    Logger.debug(
      TAG,
      `handleAppStateChange: ${nextAppState}, current state: ${this._state}, adShowing: ${this._adShowing}, adJustClosed: ${this._adJustClosed}`,
    );

    // ============================================================
    // If ad is actively showing, ignore ALL AppState changes
    // ============================================================
    if (this._adShowing) {
      Logger.debug(TAG, `⛔ Ad is showing, keeping state: ${this._state}`);
      return {
        transition: 'none',
        isReal: false,
        previousState: this._mapState(previousState),
        newState: this._mapState(this._state),
        isAdTransition: true,
      };
    }

    // ============================================================
    // If ad just closed, suppress callbacks
    // ============================================================
    if (
      this._adJustClosed &&
      now - this._adClosedTime < AdsConstants.IGNORE_AFTER_AD_CLOSE_MS
    ) {
      Logger.debug(
        TAG,
        `⛔ Ad just closed, suppressing callbacks, state: ${this._state}`,
      );

      if (isNowForeground && this._state !== 'foreground') {
        this._state = 'foreground';
        this._clearPendingTimer();
      } else if (!isNowForeground && this._state === 'foreground') {
        this._transitionToBackgroundPending();
      }

      return {
        transition: 'none',
        isReal: false,
        previousState: this._mapState(previousState),
        newState: this._mapState(this._state),
        isAdTransition: true,
      };
    }

    // ============================================================
    // Handle FOREGROUND → BACKGROUND transition
    // ============================================================
    if (!isNowForeground && this._state === 'foreground') {
      Logger.debug(
        TAG,
        `🔽 FOREGROUND → BACKGROUND_PENDING (waiting for ad event)`,
      );
      this._adOpenedDuringPending = false;
      this._transitionToBackgroundPending();

      return {
        transition: 'background',
        isReal: false,
        previousState: this._mapState(previousState),
        newState: this._mapState(this._state),
        isAdTransition: false,
      };
    }

    // ============================================================
    // Handle BACKGROUND → FOREGROUND transition
    // ============================================================
    if (isNowForeground && this._state !== 'foreground') {
      this._clearPendingTimer();

      const wasRealBackground = this._state === 'real_background';
      const wasAdBackground = this._state === 'ad_background';
      const wasPending = this._state === 'background_pending';

      Logger.debug(
        TAG,
        `🔼 ${this._state} → FOREGROUND (wasReal: ${wasRealBackground}, wasAd: ${wasAdBackground}, wasPending: ${wasPending})`,
      );

      this._state = 'foreground';
      this._lastTransitionTime = now;

      // ✅ CASE 1: REAL_BACKGROUND → FOREGROUND = REAL
      if (wasRealBackground) {
        const bgDuration = now - this._lastTransitionTime;
        Logger.debug(TAG, `🟢 REAL FOREGROUND detected (bg: ${bgDuration}ms)`);
        this._notify('REAL_APP_FOREGROUND', {
          previousState: 'background',
          newState: 'foreground',
        });
        return {
          transition: 'foreground',
          isReal: true,
          previousState: 'background',
          newState: 'foreground',
          isAdTransition: false,
        };
      }

      // ✅ CASE 2: AD_BACKGROUND → FOREGROUND = SUPPRESSED
      if (wasAdBackground) {
        Logger.debug(TAG, `⏭️ SUPPRESSED FOREGROUND (was ad background)`);
        return {
          transition: 'none',
          isReal: false,
          previousState: this._mapState(previousState),
          newState: 'foreground',
          isAdTransition: true,
        };
      }

      // ✅ CASE 3: BACKGROUND_PENDING → FOREGROUND
      if (wasPending) {
        if (this._adOpenedDuringPending) {
          Logger.debug(
            TAG,
            `⏭️ SUPPRESSED FOREGROUND (ad opened during pending)`,
          );
          return {
            transition: 'none',
            isReal: false,
            previousState: this._mapState(previousState),
            newState: 'foreground',
            isAdTransition: true,
          };
        } else {
          Logger.debug(TAG, `🟢 REAL FOREGROUND from pending (no ad opened)`);
          this._notify('REAL_APP_FOREGROUND', {
            previousState: 'background',
            newState: 'foreground',
          });
          return {
            transition: 'foreground',
            isReal: true,
            previousState: 'background',
            newState: 'foreground',
            isAdTransition: false,
          };
        }
      }

      // Fallback
      Logger.debug(
        TAG,
        `⏭️ SUPPRESSED FOREGROUND (unknown state: ${this._state})`,
      );
      return {
        transition: 'none',
        isReal: false,
        previousState: this._mapState(previousState),
        newState: 'foreground',
        isAdTransition: true,
      };
    }

    // No state change
    return {
      transition: 'none',
      isReal: false,
      previousState: this._mapState(previousState),
      newState: this._mapState(this._state),
      isAdTransition: false,
    };
  }

  /**
   * Transition to BACKGROUND_PENDING state with grace period
   */
  private _transitionToBackgroundPending(): void {
    this._clearPendingTimer();

    this._state = 'background_pending';
    this._isPending = true;
    this._lastTransitionTime = Date.now();
    this._adOpenedDuringPending = false;

    Logger.debug(
      TAG,
      `⏳ BACKGROUND_PENDING: Waiting ${this._gracePeriodMs}ms for AD_OPENED event`,
    );

    this._pendingTimer = setTimeout(() => {
      if (this._state === 'background_pending' && this._isPending) {
        Logger.debug(
          TAG,
          `⏰ Grace period expired, transitioning to REAL_BACKGROUND`,
        );
        this._transitionToRealBackground();
      }
    }, this._gracePeriodMs);
  }

  /**
   * Transition to REAL_BACKGROUND (user actually left the app)
   */
  private _transitionToRealBackground(): void {
    if (this._state !== 'background_pending') {
      Logger.debug(
        TAG,
        `⚠️ Cannot transition to REAL_BACKGROUND from ${this._state}`,
      );
      return;
    }

    this._state = 'real_background';
    this._isPending = false;
    this._clearPendingTimer();

    Logger.debug(TAG, `🔴 REAL_BACKGROUND detected (user left the app)`);

    this._notify('REAL_APP_BACKGROUND', {
      previousState: 'background',
      newState: 'background',
    });
  }

  /**
   * Transition to AD_BACKGROUND (background was caused by ad)
   */
  private _transitionToAdBackground(): void {
    if (this._state !== 'background_pending' && this._state !== 'foreground') {
      Logger.debug(
        TAG,
        `⚠️ Cannot transition to AD_BACKGROUND from ${this._state}`,
      );
      return;
    }

    this._state = 'ad_background';
    this._isPending = false;
    this._clearPendingTimer();
    this._adOpenedDuringPending = true;

    Logger.debug(TAG, `🟣 AD_BACKGROUND: Background caused by ad overlay`);

    this._notify('AD_BACKGROUND', {
      previousState: 'background',
      newState: 'background',
    });
  }

  /**
   * Clear pending timer
   */
  private _clearPendingTimer(): void {
    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
    this._isPending = false;
  }

  /**
   * Set ad showing state
   */
  public setAdShowing(showing: boolean): void {
    Logger.debug(
      TAG,
      `setAdShowing: ${showing}, current state: ${this._state}`,
    );

    this._adShowing = showing;

    if (showing) {
      this._notify('AD_OPENED', {});

      if (this._state === 'background_pending' && this._isPending) {
        Logger.debug(
          TAG,
          `🎯 AD_OPENED received during pending period → AD_BACKGROUND`,
        );
        this._adOpenedDuringPending = true;
        this._transitionToAdBackground();
      }
    } else {
      this._notify('AD_CLOSED', {});
    }
  }

  /**
   * Set ad just closed (call after setAdShowing(false))
   */
  public setAdJustClosed(): void {
    Logger.debug(TAG, `setAdJustClosed at ${Date.now()}`);
    this._adJustClosed = true;
    this._adClosedTime = Date.now();

    if (this._state === 'ad_background') {
      Logger.debug(TAG, `🔄 AD_BACKGROUND → FOREGROUND (ad closed)`);
      this._state = 'foreground';
      this._clearPendingTimer();
    }

    setTimeout(() => {
      this._adJustClosed = false;
      Logger.debug(TAG, `Auto-reset adJustClosed`);
    }, AdsConstants.IGNORE_AFTER_AD_CLOSE_MS);
  }

  /**
   * Map internal FSM state to external AppStateValue
   */
  private _mapState(state: FSMState): 'foreground' | 'background' {
    if (state === 'foreground') {
      return 'foreground';
    }
    return 'background';
  }

  /**
   * Get current state (external view)
   */
  public getState(): AppStateValue {
    return this._mapState(this._state);
  }

  /**
   * Get internal FSM state (for debugging)
   */
  public getInternalState(): FSMState {
    return this._state;
  }

  /**
   * Check if currently in foreground
   */
  public isForeground(): boolean {
    return this._state === 'foreground';
  }

  /**
   * Check if this is a real background (user left app)
   */
  public isRealBackground(): boolean {
    return this._state === 'real_background';
  }

  /**
   * Check if background was caused by ad
   */
  public isAdBackground(): boolean {
    return this._state === 'ad_background';
  }

  /**
   * Check if currently in pending state
   */
  public isPending(): boolean {
    return this._state === 'background_pending';
  }

  /**
   * Add event listener
   */
  public addListener(listener: (event: string, data: any) => void): () => void {
    this._listeners.push(listener);
    return () => {
      const index = this._listeners.indexOf(listener);
      if (index > -1) {
        this._listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify listeners of event
   */
  private _notify(event: string, data: any): void {
    this._listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        Logger.error(TAG, `Listener error:`, error);
      }
    });
  }

  /**
   * Reset FSM to initial state
   */
  public reset(): void {
    this._clearPendingTimer();
    this._state = 'foreground';
    this._lastTransitionTime = 0;
    this._adShowing = false;
    this._adJustClosed = false;
    this._adClosedTime = 0;
    this._isPending = false;
    this._adOpenedDuringPending = false;
    this._listeners = [];
    Logger.debug(TAG, `Reset to: ${this._state}`);
  }

  /**
   * Update grace period (for testing)
   */
  public setGracePeriod(ms: number): void {
    this._gracePeriodMs = ms;
    Logger.debug(TAG, `Grace period updated to: ${ms}ms`);
  }
}

export default AppStateFSM;
