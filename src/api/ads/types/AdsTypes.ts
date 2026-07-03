/**
 * Ads Types - All TypeScript definitions
 *
 * @module AdsTypes
 */

/**
 * Ad types
 */
export type AdType = 'appOpen' | 'interstitial' | null;

/**
 * Ad states
 */
export type AppOpenState =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'showing'
  | 'closed'
  | 'failed';
export type InterstitialState =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'showing'
  | 'cooldown'
  | 'failed';

/**
 * App State FSM types
 */
export type AppStateValue = 'foreground' | 'background';
export type AppStateTransition = 'foreground' | 'background' | 'none';

/**
 * Navigation events
 */
export type NavigationEvent =
  | 'NAVIGATION_OCCURRED'
  | 'THRESHOLD_REACHED'
  | 'COUNT_RESET';

/**
 * Ad events
 */
export type AdEvent =
  | 'AD_LOADED'
  | 'AD_FAILED'
  | 'AD_OPENED'
  | 'AD_CLOSED'
  | 'AD_COOLDOWN_ENDED';

/**
 * AppState FSM result
 */
export interface AppStateFSMResult {
  transition: AppStateTransition;
  isReal: boolean;
  previousState: AppStateValue;
  newState: AppStateValue;
  isAdTransition: boolean; // ✅ Added to fix TypeScript error
}

/**
 * Ad status
 */
export interface AdStatus {
  isAdShowing: boolean;
  currentAdType: AdType;
  isForeground: boolean;
  appOpen: {
    state: AppOpenState;
    isLoaded: boolean;
  };
  interstitial: {
    state: InterstitialState;
    isLoaded: boolean;
    hasPendingTrigger: boolean;
  };
  navigationCount: number;
}

/**
 * Interstitial show options (manual trigger)
 */
export interface InterstitialShowOptions {
  /** Force show even if cooldown active (ignores cooldown) */
  force?: boolean;
  /** Priority: if set to 'high', tries harder to show */
  priority?: 'normal' | 'high';
}

/**
 * Callbacks for services
 */
export interface AppOpenServiceCallbacks {
  onLoaded: () => void;
  onFailed: (error: Error) => void;
  onOpened: () => void;
  onClosed: () => void;
}

export interface InterstitialServiceCallbacks {
  onLoaded: () => void;
  onFailed: (error: Error) => void;
  onOpened: () => void;
  onClosed: () => void;
  onCooldownEnded: () => void;
}

/**
 * Manager callbacks
 */
export interface AppOpenManagerCallbacks {
  onLoaded: () => void;
  onFailed: (error: Error) => void;
  onOpened: () => void;
  onClosed: () => void;
}

export interface InterstitialManagerCallbacks {
  onLoaded: () => void;
  onFailed: (error: Error) => void;
  onOpened: () => void;
  onClosed: () => void;
  onCooldownEnded: () => void;
}
