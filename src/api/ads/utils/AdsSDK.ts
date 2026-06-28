/**
 * Ads SDK - Main entry point for the application
 *
 * Simple public API for developers:
 * - initializeAds()
 * - showInterstitialAds()
 * - destroyAds()
 *
 * @module AdsSDK
 */

import { AdCoordinator } from '../coordinator/AdCoordinator';
import { NavigationContainerRef } from '@react-navigation/native';
import { setNavigationRef } from '../../../navigations/navigation';
import Logger from './Logger';
import { RootStackParamList } from '../../../navigations';

const TAG = 'AdsSDK';

/**
 * Ads SDK - Main class
 */
class AdsSDKClass {
  private static _instance: AdsSDKClass | null = null;
  private _coordinator: AdCoordinator | null = null;
  private _isInitialized: boolean = false;

  private constructor() {
    Logger.debug(TAG, 'SDK instance created');
  }

  public static getInstance(): AdsSDKClass {
    if (!AdsSDKClass._instance) {
      AdsSDKClass._instance = new AdsSDKClass();
    }
    return AdsSDKClass._instance;
  }

  /**
   * Initialize the Ads SDK
   * Call this once at app startup
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      Logger.debug(TAG, 'Already initialized');
      return;
    }

    Logger.debug(TAG, 'Initializing Ads SDK...');

    try {
      this._coordinator = AdCoordinator.getInstance();
      await this._coordinator.initialize();
      this._isInitialized = true;
      Logger.debug(TAG, '✅ Ads SDK initialized successfully');
    } catch (error) {
      Logger.error(TAG, '❌ Failed to initialize Ads SDK:', error);
      throw error;
    }
  }

  /**
   * Register Navigation Container
   * Required for automatic navigation tracking
   */
  public registerNavigationContainer(
    ref: NavigationContainerRef<RootStackParamList> | null,
  ): void {
    setNavigationRef(ref);
    Logger.debug(TAG, `Navigation ref registered: ${!!ref}`);
  }

  /**
   * Show Interstitial Ad (Manual Trigger)
   * Use this in screens where users spend a long time
   *
   * @example
   * showInterstitialAds(); // Just call this, SDK handles everything
   */
  public async showInterstitial(): Promise<boolean> {
    if (!this._isInitialized || !this._coordinator) {
      Logger.debug(TAG, 'SDK not initialized, cannot show interstitial');
      return false;
    }

    Logger.debug(TAG, 'showInterstitial() called');
    return this._coordinator.showInterstitial();
  }

  /**
   * Get current ad status
   */
  public getStatus() {
    if (!this._isInitialized || !this._coordinator) {
      return { isInitialized: false };
    }
    return {
      isInitialized: this._isInitialized,
      ...this._coordinator.getStatus(),
    };
  }

  /**
   * Destroy Ads SDK
   * Clean up all resources
   */
  public destroy(): void {
    Logger.debug(TAG, 'Destroying Ads SDK...');

    if (this._coordinator) {
      this._coordinator.cleanUp();
      this._coordinator = null;
    }

    this._isInitialized = false;
    Logger.debug(TAG, '✅ Ads SDK destroyed');
  }
}

// Export singleton instance
export const AdsSDK = AdsSDKClass.getInstance();

// Simplified public functions
export const initializeAds = (): Promise<void> => AdsSDK.initialize();
export const showInterstitialAds = (): Promise<boolean> =>
  AdsSDK.showInterstitial();
export const destroyAds = (): void => AdsSDK.destroy();

export default AdsSDK;
