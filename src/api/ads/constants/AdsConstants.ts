/**
 * Ads Constants
 *
 * @module AdsConstants
 */

export const AdsConstants = {
  // Timeouts
  AD_LOAD_TIMEOUT_MS: 10000,

  // Cooldown (default, overridden by config)
  DEFAULT_COOLDOWN_MS: 30000,

  // Background duration to consider a "real" background
  MIN_BACKGROUND_DURATION_MS: 500,

  // Ignore AppState events after ad close (milliseconds)
  IGNORE_AFTER_AD_CLOSE_MS: 1500,

  // Max retries for ad loading
  MAX_LOAD_RETRIES: 3,

  // Retry delay multiplier
  RETRY_DELAY_MS: 1000,

  // Maximum retry delay
  MAX_RETRY_DELAY_MS: 16000,
} as const;
