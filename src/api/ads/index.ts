/**
 * Ads SDK - Public API
 *
 * @module Ads
 */

// Export main SDK
export { AdsSDK } from './utils/AdsSDK';
export { initializeAds, showInterstitialAds, destroyAds } from './utils/AdsSDK';

// Export types (for TypeScript users)
export type {
  AdStatus,
  AdType,
  AppOpenState,
  InterstitialState,
} from './types/AdsTypes';

// Export hooks
export { useInterstitialTimer } from './hooks/useInterstitialTimer';

// Export event emitter for advanced use
export { AdsEventEmitter } from './events/AdsEventEmitter';

// Export configuration
export { AdsConfig, validateConfig } from './config/AdsConfig';
