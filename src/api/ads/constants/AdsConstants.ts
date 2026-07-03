/**
 * Ads Constants
 *
 * @module AdsConstants
 */

export const AdsConstants = {
  // Timeouts
  AD_LOAD_TIMEOUT_MS: 10000,
  // ✅ Minimum background duration for REAL foreground
  MIN_BACKGROUND_DURATION_MS: 500,

  // ✅ Ignore AppState events after ad close
  IGNORE_AFTER_AD_CLOSE_MS: 1500,

  // ✅ Grace period for ad-induced background
  BACKGROUND_GRACE_PERIOD_MS: 500,
  // Cooldown (default, overridden by config)
  DEFAULT_COOLDOWN_MS: 0,

  // Max retries for ad loading
  MAX_LOAD_RETRIES: 3,

  // Retry delay multiplier
  RETRY_DELAY_MS: 1000,

  // Maximum retry delay
  MAX_RETRY_DELAY_MS: 16000,
  // ✅ Pending trigger TTL (15 seconds)
  PENDING_TRIGGER_TTL_MS: 15000,

  // ✅ Pending retry interval (2 seconds)
  PENDING_RETRY_INTERVAL_MS: 2000,

  // ✅ Pending max retries
  PENDING_MAX_RETRIES: 3,
} as const;
