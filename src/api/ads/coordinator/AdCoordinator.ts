/**
 * Ad Coordinator - Central Orchestrator
 *
 * Receives events, decides which ad to show, prevents race conditions.
 * No loading logic, only orchestration.
 *
 * @module AdCoordinator
 */

import { AppState, AppStateStatus } from 'react-native';
import { AppOpenManager } from '../managers/AppOpenManager';
import { InterstitialManager } from '../managers/InterstitialManager';
import { AppStateFSM } from '../fsm/AppStateFSM';
import { NavigationFSM } from '../fsm/NavigationFSM';
import { AdStatus, AdType } from '../types/AdsTypes';
import { AdsEventEmitter } from '../events/AdsEventEmitter';
import AdsConfig from '../config/AdsConfig';
import Logger from '../utils/Logger';
import {
  getCurrentRouteName,
  registerNavigationCallback,
} from '../../../navigations/navigation';

const TAG = 'AdCoordinator';

/**
 * Ad Coordinator - Singleton
 */
export class AdCoordinator {
  private static _instance: AdCoordinator | null = null;

  private _appOpenManager: AppOpenManager;
  private _interstitialManager: InterstitialManager;
  private _appStateFSM: AppStateFSM;
  private _navigationFSM: NavigationFSM;

  private _isAdShowing: boolean = false;
  private _currentAdType: AdType = null;
  private _isForeground: boolean = false;
  private _isInitialized: boolean = false;

  // ✅ App Open flag - only one per REAL foreground session
  private _appOpenShownOnForeground: boolean = false;

  // ✅ Track if we've already processed a foreground event
  private _foregroundProcessed: boolean = false;

  private _appStateSubscription: any = null;
  private _navigationUnsubscribe: (() => void) | null = null;
  private _appStateListenerUnsubscribe: (() => void) | null = null;

  private constructor() {
    Logger.debug(TAG, '🔄 Initializing AdCoordinator...');

    this._appOpenManager = new AppOpenManager();
    this._interstitialManager = new InterstitialManager();
    this._appStateFSM = new AppStateFSM();
    this._navigationFSM = new NavigationFSM();

    this._setupManagerCallbacks();

    this._isForeground = AppState.currentState === 'active';
    this._appStateFSM.initialize(this._isForeground);

    Logger.debug(
      TAG,
      `📱 Initial foreground state: ${this._isForeground ? 'FOREGROUND' : 'BACKGROUND'}`,
    );

    this._setupAppStateListener();
    this._setupNavigationListener();

    Logger.debug(TAG, '✅ AdCoordinator initialized');
  }

  public static getInstance(): AdCoordinator {
    if (!AdCoordinator._instance) {
      AdCoordinator._instance = new AdCoordinator();
    }
    return AdCoordinator._instance;
  }

  private _setupManagerCallbacks(): void {
    this._appOpenManager.setCallbacks({
      onLoaded: () => this._onAppOpenLoaded(),
      onFailed: error => this._onAppOpenFailed(error),
      onOpened: () => this._onAppOpenOpened(),
      onClosed: () => this._onAppOpenClosed(),
    });

    this._interstitialManager.setCallbacks({
      onLoaded: () => this._onInterstitialLoaded(),
      onFailed: error => this._onInterstitialFailed(error),
      onOpened: () => this._onInterstitialOpened(),
      onClosed: () => this._onInterstitialClosed(),
      onCooldownEnded: () => this._onInterstitialCooldownEnded(), // ✅ ADDED
    });
  }

  private _setupAppStateListener(): void {
    Logger.debug(TAG, '📡 Setting up AppState listener...');

    const listener = (nextAppState: AppStateStatus) => {
      const result = this._appStateFSM.handleAppStateChange(nextAppState);

      const wasForeground = this._isForeground;
      const wasAppOpenShown = this._appOpenShownOnForeground;

      // Always update foreground state
      this._isForeground = result.newState === 'foreground';

      Logger.debug(
        TAG,
        `📱 AppState: ${nextAppState} | Transition: ${result.transition} | IsReal: ${result.isReal}`,
      );
      Logger.debug(
        TAG,
        `📊 State before: FG=${wasForeground}, AppOpenShown=${wasAppOpenShown}`,
      );
      Logger.debug(
        TAG,
        `📊 State after: FG=${this._isForeground}, AppOpenShown=${this._appOpenShownOnForeground}`,
      );

      // ✅ Reset flag on REAL background
      if (result.transition === 'background' && result.isReal) {
        this._appOpenShownOnForeground = false;
        this._foregroundProcessed = false;
        Logger.debug(TAG, '🔴 REAL BACKGROUND: Reset flags');
      }

      // ✅ Only process REAL foreground
      if (result.transition === 'foreground' && result.isReal) {
        this._appOpenShownOnForeground = false;
        this._foregroundProcessed = false;
        Logger.debug(TAG, '🟢 REAL FOREGROUND: Reset flags');
        this._onForeground();
      }

      // ✅ Handle suppressed foreground (ad closing)
      if (
        result.transition === 'none' &&
        !result.isReal &&
        this._isForeground &&
        !wasForeground
      ) {
        Logger.debug(TAG, '⚠️ SUPPRESSED FOREGROUND: NOT showing App Open');
        this._appOpenManager.resume();
        this._interstitialManager.resume();
        Logger.debug(TAG, '✅ Managers resumed after suppressed foreground');
      }
    };

    this._appStateSubscription = AppState.addEventListener('change', listener);
    Logger.debug(TAG, '✅ AppState listener registered');
  }

  private _setupNavigationListener(): void {
    Logger.debug(TAG, '📡 Setting up Navigation listener...');

    this._navigationUnsubscribe = registerNavigationCallback(
      (routeName: string) => {
        Logger.debug(TAG, `📍 Navigation event: ${routeName}`);
        this._navigationFSM.handleNavigation(routeName);
      },
    );

    this._navigationFSM.addListener((event, data) => {
      Logger.debug(TAG, `🚦 Navigation FSM event: ${event}`, data);
      if (event === 'THRESHOLD_REACHED') {
        Logger.debug(TAG, `🎯 THRESHOLD_REACHED with count: ${data.count}`);
        this._onNavigationThresholdReached();
      }
    });

    this._appStateListenerUnsubscribe = this._appStateFSM.addListener(
      (event, data) => {
        Logger.debug(TAG, `⚡ AppState FSM event: ${event}`, data);
      },
    );

    Logger.debug(TAG, '✅ Navigation listener registered');
  }

  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      Logger.debug(TAG, '⚠️ Already initialized, skipping');
      return;
    }

    Logger.debug(TAG, '🚀 Starting initialization...');

    const { validateConfig } = require('../config/AdsConfig');
    const errors = validateConfig();
    if (errors.length > 0) {
      Logger.error(TAG, '⚠️ Configuration errors:', errors);
    }

    Logger.debug(TAG, '📦 Loading App Open and Interstitial...');
    await Promise.all([
      this._appOpenManager.startLoading(),
      this._interstitialManager.startLoading(),
    ]);

    this._isInitialized = true;
    AdsEventEmitter.emit('ADS_INITIALIZED', { success: true });

    Logger.debug(TAG, '✅ Initialized successfully');
    Logger.debug(TAG, `📊 App Open state: ${this._appOpenManager.getState()}`);
    Logger.debug(
      TAG,
      `📊 Interstitial state: ${this._interstitialManager.getState()}`,
    );
    Logger.debug(TAG, `📊 isForeground: ${this._isForeground}`);
  }

  // ============ APP OPEN EVENTS ============

  private _onAppOpenLoaded(): void {
    Logger.debug(TAG, '📦 App Open loaded');
    AdsEventEmitter.emit('APP_OPEN_LOADED', {});

    Logger.debug(
      TAG,
      `🔍 Checking App Open: isForeground=${this._isForeground}, isAdShowing=${this._isAdShowing}, alreadyShown=${this._appOpenShownOnForeground}`,
    );

    if (
      this._isForeground &&
      !this._isAdShowing &&
      !this._appOpenShownOnForeground
    ) {
      Logger.debug(TAG, '✅ App Open loaded, showing');
      this._showAppOpen();
    } else {
      Logger.debug(TAG, '❌ App Open loaded but NOT showing');
    }
  }

  private _onAppOpenFailed(error: Error): void {
    Logger.error(TAG, '❌ App Open failed:', error);
    AdsEventEmitter.emit('APP_OPEN_FAILED', { error });
  }

  private _onAppOpenOpened(): void {
    Logger.debug(TAG, '👁️ App Open opened');
    this._isAdShowing = true;
    this._currentAdType = 'appOpen';
    this._appStateFSM.setAdShowing(true);
    this._appOpenShownOnForeground = true;
    Logger.debug(TAG, '✅ App Open shown, flag set to true');
    AdsEventEmitter.emit('APP_OPEN_OPENED', {});
    this._interstitialManager.pause();
    Logger.debug(TAG, '⏸️ Interstitial paused');
  }

  private _onAppOpenClosed(): void {
    Logger.debug(TAG, '🚪 App Open closed');
    Logger.debug(TAG, `📊 Before close: isAdShowing=${this._isAdShowing}`);

    this._isAdShowing = false;
    this._currentAdType = null;
    this._appStateFSM.setAdShowing(false);
    this._appStateFSM.setAdJustClosed();

    Logger.debug(TAG, `📊 After close: isAdShowing=${this._isAdShowing}`);

    AdsEventEmitter.emit('APP_OPEN_CLOSED', {});

    this._interstitialManager.resume();
    Logger.debug(TAG, '▶️ Interstitial resumed');

    // ✅ Try pending interstitial after App Open closes
    if (this._isForeground && !this._isAdShowing) {
      Logger.debug(
        TAG,
        '🔍 After App Open close, checking pending interstitial',
      );
      this._tryShowPendingInterstitial();
    }
  }

  // ============ INTERSTITIAL EVENTS ============

  private _onInterstitialLoaded(): void {
    Logger.debug(TAG, '📦 Interstitial loaded successfully');
    AdsEventEmitter.emit('INTERSTITIAL_LOADED', {});

    Logger.debug(
      TAG,
      `🔍 Checking interstitial: hasPending=${this._interstitialManager.hasPendingTrigger()}, isForeground=${this._isForeground}, isAdShowing=${this._isAdShowing}`,
    );

    // ✅ If pending trigger exists and foreground, show immediately
    if (
      this._interstitialManager.hasPendingTrigger() &&
      this._isForeground &&
      !this._isAdShowing
    ) {
      Logger.debug(TAG, '✅ Pending trigger exists, showing interstitial');
      this._tryShowPendingInterstitial();
    } else if (
      this._interstitialManager.hasPendingTrigger() &&
      this._isForeground &&
      !this._isAdShowing
    ) {
      Logger.debug(TAG, '⏭️ Not showing interstitial');
    }
  }

  // ✅ NEW: Cooldown ended callback
  private _onInterstitialCooldownEnded(): void {
    Logger.debug(TAG, '🔥 Interstitial cooldown ended');

    // ✅ If we have a pending trigger, show immediately
    if (this._interstitialManager.hasPendingTrigger()) {
      Logger.debug(
        TAG,
        '🎯 Pending trigger exists after cooldown, showing now',
      );
      this._tryShowPendingInterstitial();
    } else {
      Logger.debug(TAG, '📝 No pending trigger after cooldown');
    }
  }

  private _onInterstitialFailed(error: Error): void {
    Logger.error(TAG, '❌ Interstitial failed:', error);
    AdsEventEmitter.emit('INTERSTITIAL_FAILED', { error });
    this._interstitialManager.clearPendingTrigger();
    Logger.debug(TAG, '🧹 Pending trigger cleared after failure');
  }

  private _onInterstitialOpened(): void {
    Logger.debug(TAG, '👁️ Interstitial opened');
    Logger.debug(TAG, `📊 Before open: isAdShowing=${this._isAdShowing}`);

    this._isAdShowing = true;
    this._currentAdType = 'interstitial';
    this._appStateFSM.setAdShowing(true);

    Logger.debug(
      TAG,
      `📊 After open: isAdShowing=${this._isAdShowing}, currentAdType=${this._currentAdType}`,
    );

    AdsEventEmitter.emit('INTERSTITIAL_OPENED', {});
    this._appOpenManager.pause();
    Logger.debug(TAG, '⏸️ App Open paused');
  }

  private _onInterstitialClosed(): void {
    Logger.debug(TAG, '🚪 Interstitial closed');
    Logger.debug(TAG, `📊 Before close: isAdShowing=${this._isAdShowing}`);

    this._isAdShowing = false;
    this._currentAdType = null;
    this._appStateFSM.setAdShowing(false);
    this._appStateFSM.setAdJustClosed();

    Logger.debug(TAG, `📊 After close: isAdShowing=${this._isAdShowing}`);

    AdsEventEmitter.emit('INTERSTITIAL_CLOSED', {});
    this._appOpenManager.resume();
    Logger.debug(TAG, '▶️ App Open resumed');

    // ✅ Start preloading next interstitial
    this._interstitialManager.startLoading().catch(error => {
      Logger.error(TAG, '❌ Failed to preload interstitial:', error);
    });
  }

  // ============ APP STATE EVENTS ============

  private _onForeground(): void {
    Logger.debug(TAG, '🟢 REAL Foreground callback');
    Logger.debug(
      TAG,
      `📊 Before: appOpenShownOnForeground=${this._appOpenShownOnForeground}`,
    );

    // ✅ Reset flags - this is a real user returning
    this._appOpenShownOnForeground = false;
    this._foregroundProcessed = false;

    this._appOpenManager.resume();
    this._interstitialManager.resume();
    AdsEventEmitter.emit('APP_FOREGROUND', {});

    Logger.debug(
      TAG,
      `📊 After reset: appOpenShownOnForeground=${this._appOpenShownOnForeground}`,
    );

    // ✅ Show App Open
    if (
      !this._appOpenShownOnForeground &&
      !this._isAdShowing &&
      this._appOpenManager.isLoaded()
    ) {
      Logger.debug(TAG, '✅ Real foreground, showing App Open');
      this._showAppOpen();
    }
  }

  private _onBackground(): void {
    Logger.debug(TAG, '🔴 REAL Background callback');
    Logger.debug(
      TAG,
      `📊 appOpenShownOnForeground before: ${this._appOpenShownOnForeground}`,
    );

    this._appOpenManager.pause();
    this._interstitialManager.pause();
    AdsEventEmitter.emit('APP_BACKGROUND', {});
  }

  // ============ NAVIGATION EVENTS ============

  private _onNavigationThresholdReached(): void {
    Logger.debug(
      TAG,
      `🎯 Navigation threshold reached (isForeground: ${this._isForeground})`,
    );
    Logger.debug(
      TAG,
      `📊 State: isAdShowing=${this._isAdShowing}, currentAdType=${this._currentAdType}`,
    );

    AdsEventEmitter.emit('NAVIGATION_THRESHOLD_REACHED', {
      count: this._navigationFSM.getCount(),
    });

    if (!this._isForeground) {
      Logger.debug(TAG, '❌ Interstitial: not foreground, storing pending');
      this._interstitialManager.setPendingTrigger();
      return;
    }

    if (this._isAdShowing && this._currentAdType === 'appOpen') {
      Logger.debug(TAG, '⏸️ App Open showing, storing interstitial pending');
      this._interstitialManager.setPendingTrigger();
      return;
    }

    const isLoaded = this._interstitialManager.isLoaded();
    Logger.debug(TAG, `📊 Interstitial isLoaded: ${isLoaded}`);

    if (isLoaded) {
      Logger.debug(TAG, '✅ Interstitial loaded, showing immediately');
      this._tryShowPendingInterstitial();
    } else {
      Logger.debug(
        TAG,
        '⚠️ Interstitial NOT loaded, storing pending and starting load',
      );
      this._interstitialManager.setPendingTrigger();
      this._interstitialManager.startLoading().catch(error => {
        Logger.error(TAG, '❌ Failed to start interstitial loading:', error);
      });
    }
  }

  // ============ SHOW LOGIC ============

  private async _showAppOpen(): Promise<boolean> {
    Logger.debug(TAG, '🔍 _showAppOpen() called');

    if (this._appOpenShownOnForeground) {
      Logger.debug(TAG, '❌ App Open: already shown this session');
      return false;
    }

    if (!this._isForeground) {
      Logger.debug(TAG, '❌ App Open: not foreground');
      return false;
    }

    if (this._isAdShowing) {
      Logger.debug(TAG, '❌ App Open: ad already showing');
      return false;
    }

    if (this._appOpenManager.isPaused()) {
      Logger.debug(TAG, '❌ App Open: paused');
      return false;
    }

    if (!this._appOpenManager.isLoaded()) {
      Logger.debug(TAG, '❌ App Open: not loaded');
      return false;
    }

    Logger.debug(TAG, '✅ All conditions met, showing App Open');
    const result = await this._appOpenManager.show();

    if (result) {
      this._appOpenShownOnForeground = true;
      Logger.debug(TAG, '✅ App Open shown successfully');
    } else {
      Logger.debug(TAG, '❌ App Open show failed');
    }

    AdsEventEmitter.emit('APP_OPEN_SHOWN', { success: result });
    return result;
  }

  private async _tryShowPendingInterstitial(): Promise<boolean> {
    Logger.debug(
      TAG,
      `🔍 _tryShowPendingInterstitial() called (isForeground: ${this._isForeground})`,
    );
    Logger.debug(
      TAG,
      `📊 State: isAdShowing=${this._isAdShowing}, isPaused=${this._interstitialManager.isPaused()}, isLoaded=${this._interstitialManager.isLoaded()}, hasPending=${this._interstitialManager.hasPendingTrigger()}`,
    );

    if (!this._isForeground) {
      Logger.debug(TAG, '❌ Interstitial: not foreground');
      return false;
    }

    if (this._isAdShowing) {
      Logger.debug(TAG, '❌ Interstitial: ad already showing');
      return false;
    }

    if (this._interstitialManager.isPaused()) {
      Logger.debug(TAG, '❌ Interstitial: paused');
      return false;
    }

    if (!this._interstitialManager.isLoaded()) {
      Logger.debug(TAG, '❌ Interstitial: not loaded');
      if (!this._interstitialManager.hasPendingTrigger()) {
        Logger.debug(TAG, '📝 No pending trigger, setting one');
        this._interstitialManager.setPendingTrigger();
      }
      this._interstitialManager.startLoading().catch(error => {
        Logger.error(TAG, '❌ Failed to start interstitial loading:', error);
      });
      return false;
    }

    // ✅ Set pending trigger if not already
    if (!this._interstitialManager.hasPendingTrigger()) {
      Logger.debug(TAG, '📝 No pending trigger, setting one to show');
      this._interstitialManager.setPendingTrigger();
    }

    Logger.debug(TAG, '✅ All conditions met, showing Interstitial');
    const result = await this._interstitialManager.show();

    if (result) {
      Logger.debug(TAG, '✅ Interstitial shown successfully');
    } else {
      Logger.debug(TAG, '❌ Interstitial show failed');
    }

    AdsEventEmitter.emit('INTERSTITIAL_SHOWN', { success: result });
    return result;
  }

  public async showInterstitial(): Promise<boolean> {
    Logger.debug(
      TAG,
      `🔍 Manual interstitial request (isForeground: ${this._isForeground})`,
    );

    if (!this._isForeground) {
      Logger.debug(TAG, '❌ Manual interstitial: not foreground');
      return false;
    }

    if (this._isAdShowing) {
      Logger.debug(TAG, '❌ Manual interstitial: ad already showing');
      return false;
    }

    if (this._interstitialManager.isPaused()) {
      Logger.debug(TAG, '❌ Manual interstitial: paused');
      return false;
    }

    if (!this._interstitialManager.isLoaded()) {
      Logger.debug(TAG, '📝 Manual: not loaded, storing pending');
      this._interstitialManager.setPendingTrigger();
      this._interstitialManager.startLoading().catch(error => {
        Logger.error(TAG, '❌ Failed to start interstitial loading:', error);
      });
      return false;
    }

    Logger.debug(TAG, '✅ All conditions met, showing Interstitial (manual)');
    const result = await this._interstitialManager.show();

    if (result) {
      Logger.debug(TAG, '✅ Manual interstitial shown successfully');
    } else {
      Logger.debug(TAG, '❌ Manual interstitial show failed');
    }

    AdsEventEmitter.emit('INTERSTITIAL_SHOWN', {
      success: result,
      source: 'manual',
    });
    return result;
  }

  // ============ PUBLIC API ============

  public getState(): {
    isAdShowing: boolean;
    currentAdType: AdType;
    isForeground: boolean;
  } {
    return {
      isAdShowing: this._isAdShowing,
      currentAdType: this._currentAdType,
      isForeground: this._isForeground,
    };
  }

  public getAppOpenManager(): AppOpenManager {
    return this._appOpenManager;
  }

  public getInterstitialManager(): InterstitialManager {
    return this._interstitialManager;
  }

  public getNavigationFSM(): NavigationFSM {
    return this._navigationFSM;
  }

  public getStatus(): AdStatus {
    return {
      isAdShowing: this._isAdShowing,
      currentAdType: this._currentAdType,
      isForeground: this._isForeground,
      appOpen: {
        state: this._appOpenManager.getState(),
        isLoaded: this._appOpenManager.isLoaded(),
      },
      interstitial: {
        state: this._interstitialManager.getState(),
        isLoaded: this._interstitialManager.isLoaded(),
        hasPendingTrigger: this._interstitialManager.hasPendingTrigger(),
      },
      navigationCount: this._navigationFSM.getCount(),
    };
  }

  public cleanUp(): void {
    Logger.debug(TAG, '🧹 Cleaning up AdCoordinator...');

    if (this._appStateSubscription) {
      this._appStateSubscription.remove();
      this._appStateSubscription = null;
      Logger.debug(TAG, '✅ AppState subscription removed');
    }

    if (this._navigationUnsubscribe) {
      this._navigationUnsubscribe();
      this._navigationUnsubscribe = null;
      Logger.debug(TAG, '✅ Navigation subscription removed');
    }

    if (this._appStateListenerUnsubscribe) {
      this._appStateListenerUnsubscribe();
      this._appStateListenerUnsubscribe = null;
      Logger.debug(TAG, '✅ AppState FSM listener removed');
    }

    this._appOpenManager.cleanUp();
    this._interstitialManager.cleanUp();
    this._appStateFSM.reset();

    this._isInitialized = false;
    this._isAdShowing = false;
    this._currentAdType = null;
    this._appOpenShownOnForeground = false;
    this._foregroundProcessed = false;

    AdsEventEmitter.removeAllListeners();

    Logger.debug(TAG, '✅ Cleanup complete');
  }
}

export default AdCoordinator;
