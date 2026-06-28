/**
 * Ads Configuration - Centralized config
 * Developer only edits this file
 *
 * @module AdsConfig
 */

import Config from 'react-native-config';

export interface AdsConfigType {
  // Ad Unit IDs
  androidAppOpenAdUnitId: string;
  iosAppOpenAdUnitId: string;
  androidInterstitialAdUnitId: string;
  iosInterstitialAdUnitId: string;
  androidAppId: string;
  iosAppId: string;

  // Test Devices
  testDeviceIds: string[];

  // Navigation
  navigationThreshold: number;

  // Cooldowns (milliseconds)
  interstitialCooldownMs: number;

  // Production Mode
  productionMode: boolean;

  // Excluded Screens
  excludedInterstitialScreens: string[];
  excludedAppOpenScreens: string[];

  // Timer Interval for screen-based interstitials
  interstitialTimerIntervalMs: number;

  // Debug
  debug: boolean;
}

/**
 * Load configuration from environment variables
 */
export const AdsConfig: AdsConfigType = {
  androidAppOpenAdUnitId: Config.ANDROID_APP_OPEN_AD_UNIT_ID || '',
  iosAppOpenAdUnitId: Config.IOS_APP_OPEN_AD_UNIT_ID || '',
  androidInterstitialAdUnitId: Config.ANDROID_INTERSTITIAL_AD_UNIT_ID || '',
  iosInterstitialAdUnitId: Config.IOS_INTERSTITIAL_AD_UNIT_ID || '',
  androidAppId: Config.ANDROID_ADMOB_APP_ID || '',
  iosAppId: Config.IOS_ADMOB_APP_ID || '',

  testDeviceIds: (Config.TEST_DEVICE_IDS || '')
    .split(',')
    .filter(id => id.trim() !== ''),

  navigationThreshold: parseInt(
    Config.INTERSTITIAL_NAVIGATION_THRESHOLD || '1',
    10,
  ),
  interstitialCooldownMs: parseInt(Config.ADS_COOLDOWN_MS || '30000', 10),

  productionMode: Config.ADS_PRODUCTION_MODE === 'true',

  excludedInterstitialScreens: (Config.EXCLUDED_INTERSTITIAL_SCREENS || '')
    .split(',')
    .filter(s => s.trim() !== ''),
  excludedAppOpenScreens: (Config.EXCLUDED_APP_OPEN_SCREENS || '')
    .split(',')
    .filter(s => s.trim() !== ''),

  interstitialTimerIntervalMs: parseInt(
    Config.INTERSTITIAL_TIMER_INTERVAL_MS || '120000',
    10,
  ),

  debug: true,
};

/**
 * Validate configuration
 */
export const validateConfig = (): string[] => {
  const errors: string[] = [];

  if (!AdsConfig.androidAppId && !AdsConfig.iosAppId) {
    errors.push('No AdMob App ID configured');
  }

  if (!AdsConfig.androidAppOpenAdUnitId && !AdsConfig.iosAppOpenAdUnitId) {
    errors.push('No App Open Ad Unit ID configured');
  }

  if (
    !AdsConfig.androidInterstitialAdUnitId &&
    !AdsConfig.iosInterstitialAdUnitId
  ) {
    errors.push('No Interstitial Ad Unit ID configured');
  }

  if (AdsConfig.navigationThreshold < 1) {
    errors.push('Navigation threshold must be at least 1');
  }

  if (AdsConfig.interstitialCooldownMs < 1000) {
    errors.push('Cooldown must be at least 1000ms');
  }

  return errors;
};

export default AdsConfig;
