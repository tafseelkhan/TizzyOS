/**
 * Ad Coordinator - With Minimal Pending Support
 *
 * Rules:
 * 1. App Open = ONLY on REAL foreground (background → foreground)
 * 2. Interstitial = Navigation trigger, shows immediately if loaded,
 *    otherwise loads and shows when ready
 * 3. Minimal pending trigger for reliability
 */

import { AppState, AppStateStatus } from 'react-native';
import { AppOpenManager } from '../managers/AppOpenManager';
import { InterstitialManager } from '../managers/InterstitialManager';
import { AppStateFSM } from '../fsm/AppStateFSM';
import { NavigationFSM } from '../fsm/NavigationFSM';
import { AdStatus, AdType } from '../types/AdsTypes';
import { AdsEventEmitter } from '../events/AdsEventEmitter';
import Logger from '../utils/Logger';
import {
  getCurrentRouteName,
  registerNavigationCallback,
} from '../../../navigations/navigation';

const TAG = 'AdCoordinator';

interface PendingTrigger {
  id: string;
  type: 'navigation' | 'manual';
  routeName?: string;
  createdAt: number;
}

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

  private _appOpenShownOnForeground: boolean = false;
  private _pendingTrigger: PendingTrigger | null = null;

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
      onCooldownEnded: () => this._onInterstitialCooldownEnded(),
    });
  }

  private _setupAppStateListener(): void {
    Logger.debug(TAG, '📡 Setting up AppState listener...');

    const listener = (nextAppState: AppStateStatus) => {
      const result = this._appStateFSM.handleAppStateChange(nextAppState);

      const wasForeground = this._isForeground;
      this._isForeground = result.newState === 'foreground';

      Logger.debug(
        TAG,
        `📱 AppState: ${nextAppState} | Transition: ${result.transition} | IsReal: ${result.isReal}`,
      );

      // ✅ REAL BACKGROUND: Reset App Open flag, clear pending
      if (result.transition === 'background' && result.isReal) {
        this._appOpenShownOnForeground = false;
        this._pendingTrigger = null;
        Logger.debug(TAG, '🔴 REAL BACKGROUND: Reset flags');
        this._appOpenManager.pause();
        this._interstitialManager.pause();
      }

      // ✅ REAL FOREGROUND: Show App Open ONLY here
      if (result.transition === 'foreground' && result.isReal) {
        Logger.debug(TAG, `🟢 REAL FOREGROUND`);
        this._appOpenManager.resume();
        this._interstitialManager.resume();

        // ✅ FIX: If state is 'closed', force reset to 'idle' before checking
        if (this._appOpenManager.getState() === 'closed') {
          Logger.debug(TAG, '🔄 App Open state is "closed", resetting to idle');
          this._appOpenManager.resetState();
        }

        if (
          !this._appOpenShownOnForeground &&
          this._appOpenManager.isLoaded()
        ) {
          Logger.debug(TAG, '✅ REAL FOREGROUND: Showing App Open');
          this._showAppOpen();
        } else {
          // ✅ If not loaded, start loading on REAL foreground
          if (!this._appOpenManager.isLoaded()) {
            Logger.debug(
              TAG,
              '⏳ App Open not loaded, starting load on REAL foreground',
            );
            this._appOpenManager.startLoading();
          }
        }
      }

      // ✅ SUPPRESSED FOREGROUND (ad closed): Just resume
      if (
        result.transition === 'none' &&
        !result.isReal &&
        this._isForeground &&
        !wasForeground
      ) {
        Logger.debug(TAG, `⚠️ SUPPRESSED FOREGROUND: No App Open, just resume`);
        this._appOpenManager.resume();
        this._interstitialManager.resume();

        // ✅ Check pending after suppressed foreground
        if (this._pendingTrigger) {
          Logger.debug(
            TAG,
            `🔄 PENDING EXISTS: Checking after suppressed foreground`,
          );
          this._showWithPending();
        }
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
        Logger.debug(TAG, `🎯 THRESHOLD_REACHED - Showing Interstitial`);
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

  // ============ APP OPEN EVENTS ============

  private _onAppOpenLoaded(): void {
    Logger.debug(TAG, '📦 App Open loaded');
    Logger.debug(
      TAG,
      `📊 isForeground: ${this._isForeground}, isAdShowing: ${this._isAdShowing}`,
    );
    AdsEventEmitter.emit('APP_OPEN_LOADED', {});

    // ✅ FIX: Only check foreground and ad showing
    if (this._isForeground && !this._isAdShowing) {
      Logger.debug(TAG, '✅ App Open loaded, showing on foreground');
      this._showAppOpen();
    } else {
      Logger.debug(TAG, `⏭️ App Open loaded but conditions not met`);
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
    Logger.debug(
      TAG,
      `✅ App Open shown, flag set to: ${this._appOpenShownOnForeground}`,
    );
    AdsEventEmitter.emit('APP_OPEN_OPENED', {});
    this._interstitialManager.pause();
  }

  private _onAppOpenClosed(): void {
    Logger.debug(TAG, '🚪 App Open closed');

    // ✅ CRITICAL FIX: Reset flag when ad closes
    this._appOpenShownOnForeground = false;
    Logger.debug(
      TAG,
      `🔄 App Open flag reset to: ${this._appOpenShownOnForeground}`,
    );

    this._isAdShowing = false;
    this._currentAdType = null;
    this._appStateFSM.setAdShowing(false);
    this._appStateFSM.setAdJustClosed();
    AdsEventEmitter.emit('APP_OPEN_CLOSED', {});
    this._interstitialManager.resume();
  }

  // ============ INTERSTITIAL EVENTS (NO CHANGES) ============

  private _onInterstitialLoaded(): void {
    Logger.debug(TAG, '📦 Interstitial loaded');
    AdsEventEmitter.emit('INTERSTITIAL_LOADED', {});

    // ✅ Check if pending trigger exists
    if (this._pendingTrigger && !this._isAdShowing && this._isForeground) {
      Logger.debug(TAG, `🎯 PENDING EXISTS: Showing interstitial immediately`);
      this._showWithPending();
      return;
    }

    Logger.debug(TAG, `⏸️ Interstitial preloaded, waiting for trigger`);
  }

  private _onInterstitialCooldownEnded(): void {
    Logger.debug(TAG, '🔥 Interstitial cooldown ended - Preloading...');
    this._interstitialManager.startLoading().catch(error => {
      Logger.error(TAG, '❌ Failed to preload:', error);
    });
  }

  private _onInterstitialFailed(error: Error): void {
    Logger.error(TAG, '❌ Interstitial failed:', error);
    AdsEventEmitter.emit('INTERSTITIAL_FAILED', { error });
    this._pendingTrigger = null; // Clear pending on failure
  }

  private _onInterstitialOpened(): void {
    Logger.debug(TAG, '👁️ Interstitial opened');
    this._isAdShowing = true;
    this._currentAdType = 'interstitial';
    this._appStateFSM.setAdShowing(true);
    AdsEventEmitter.emit('INTERSTITIAL_OPENED', {});
    this._appOpenManager.pause();
  }

  private _onInterstitialClosed(): void {
    Logger.debug(TAG, '🚪 Interstitial closed');
    this._isAdShowing = false;
    this._currentAdType = null;
    this._appStateFSM.setAdShowing(false);
    this._appStateFSM.setAdJustClosed();
    AdsEventEmitter.emit('INTERSTITIAL_CLOSED', {});
    this._appOpenManager.resume();

    // ✅ Clear any stale pending
    this._pendingTrigger = null;

    // ✅ Preload next
    this._interstitialManager.startLoading().catch(error => {
      Logger.error(TAG, '❌ Failed to preload:', error);
    });
  }

  // ============ NAVIGATION EVENTS (NO CHANGES) ============

  private _onNavigationThresholdReached(): void {
    Logger.debug(TAG, `🎯 Navigation threshold reached`);

    if (this._isAdShowing) {
      Logger.debug(TAG, `⏸️ Ad already showing, skipping`);
      return;
    }

    if (!this._isForeground) {
      Logger.debug(TAG, `❌ Not foreground, skipping`);
      return;
    }

    // ✅ Create pending trigger
    this._pendingTrigger = {
      id: `pending_${Date.now()}`,
      type: 'navigation',
      routeName: getCurrentRouteName() || 'unknown',
      createdAt: Date.now(),
    };
    Logger.debug(TAG, `📝 PENDING CREATED: ${this._pendingTrigger.id}`);

    // ✅ If loaded, show immediately
    if (this._interstitialManager.isLoaded()) {
      Logger.debug(TAG, '✅ Interstitial loaded, showing IMMEDIATELY');
      this._showWithPending();
      return;
    }

    // ✅ Not loaded, start loading
    Logger.debug(TAG, `⚠️ Interstitial NOT loaded, loading...`);
    this._interstitialManager.startLoading().catch(error => {
      Logger.error(TAG, '❌ Failed to load interstitial:', error);
    });
  }

  // ============ SHOW WITH PENDING (NO CHANGES) ============

  private _showWithPending(): void {
    if (!this._pendingTrigger) {
      Logger.debug(TAG, '❌ No pending trigger');
      return;
    }

    if (!this._interstitialManager.isLoaded()) {
      Logger.debug(TAG, '❌ Interstitial not loaded');
      return;
    }

    if (this._isAdShowing) {
      Logger.debug(TAG, '❌ Ad already showing');
      return;
    }

    if (!this._isForeground) {
      Logger.debug(TAG, '❌ Not foreground');
      return;
    }

    const pendingId = this._pendingTrigger.id;
    Logger.debug(TAG, `✅ Showing interstitial (pending: ${pendingId})`);

    this._interstitialManager.show().then(result => {
      if (result) {
        Logger.debug(TAG, '✅ Interstitial shown successfully');
        AdsEventEmitter.emit('INTERSTITIAL_SHOWN', { success: true });
      } else {
        Logger.debug(TAG, '❌ Interstitial show failed');
        AdsEventEmitter.emit('INTERSTITIAL_SHOWN', { success: false });
      }
      // ✅ Clear pending after show attempt
      this._pendingTrigger = null;
    });
  }

  // ============ SHOW APP OPEN ============

  private async _showAppOpen(): Promise<boolean> {
    Logger.debug(TAG, '🔍 _showAppOpen() called');
    Logger.debug(
      TAG,
      `📊 appOpenShownOnForeground: ${this._appOpenShownOnForeground}`,
    );
    Logger.debug(TAG, `📊 isForeground: ${this._isForeground}`);
    Logger.debug(TAG, `📊 isAdShowing: ${this._isAdShowing}`);
    Logger.debug(TAG, `📊 isLoaded: ${this._appOpenManager.isLoaded()}`);

    if (this._appOpenShownOnForeground) {
      Logger.debug(TAG, '❌ App Open: already shown this session');
      return false;
    }

    if (!this._isForeground) {
      Logger.debug(TAG, '❌ App Open: not foreground');
      return false;
    }

    if (this._isAdShowing) {
      Logger.debug(
        TAG,
        `❌ App Open: ad already showing (${this._currentAdType})`,
      );
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
      Logger.debug(
        TAG,
        `✅ App Open shown, flag set to: ${this._appOpenShownOnForeground}`,
      );
    } else {
      Logger.debug(TAG, '❌ App Open show failed');
    }

    AdsEventEmitter.emit('APP_OPEN_SHOWN', { success: result });
    return result;
  }

  // ============ PUBLIC API ============

  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      Logger.debug(TAG, '⚠️ Already initialized');
      return;
    }

    Logger.debug(TAG, '🚀 Starting initialization...');

    await Promise.all([
      this._appOpenManager.startLoading(),
      this._interstitialManager.startLoading(),
    ]);

    this._isInitialized = true;
    AdsEventEmitter.emit('ADS_INITIALIZED', { success: true });
    Logger.debug(TAG, '✅ Initialized');
  }

  public async showInterstitial(): Promise<boolean> {
    Logger.debug(TAG, `🔍 Manual interstitial request`);

    if (!this._isForeground) {
      Logger.debug(TAG, '❌ Manual: not foreground');
      return false;
    }

    if (this._isAdShowing) {
      Logger.debug(TAG, `❌ Manual: ad showing`);
      return false;
    }

    if (!this._interstitialManager.isLoaded()) {
      Logger.debug(TAG, '📝 Manual: not loaded, loading...');
      await this._interstitialManager.startLoading();
      return false;
    }

    Logger.debug(TAG, '✅ Manual: showing interstitial');
    const result = await this._interstitialManager.show();
    AdsEventEmitter.emit('INTERSTITIAL_SHOWN', {
      success: result,
      source: 'manual',
    });
    return result;
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
        hasPendingTrigger: !!this._pendingTrigger,
      },
      navigationCount: this._navigationFSM.getCount(),
    };
  }

  public cleanUp(): void {
    Logger.debug(TAG, '🧹 Cleaning up...');

    if (this._appStateSubscription) {
      this._appStateSubscription.remove();
      this._appStateSubscription = null;
    }

    if (this._navigationUnsubscribe) {
      this._navigationUnsubscribe();
      this._navigationUnsubscribe = null;
    }

    if (this._appStateListenerUnsubscribe) {
      this._appStateListenerUnsubscribe();
      this._appStateListenerUnsubscribe = null;
    }

    this._appOpenManager.cleanUp();
    this._interstitialManager.cleanUp();
    this._appStateFSM.reset();

    this._isInitialized = false;
    this._isAdShowing = false;
    this._currentAdType = null;
    this._appOpenShownOnForeground = false;
    this._pendingTrigger = null;

    AdsEventEmitter.removeAllListeners();
    Logger.debug(TAG, '✅ Cleanup complete');
  }
}

export default AdCoordinator;
