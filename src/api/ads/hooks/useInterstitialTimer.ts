/**
 * useInterstitialTimer Hook
 *
 * For screens that want timer-based interstitial ads
 *
 * @module useInterstitialTimer
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { showInterstitialAds } from '../utils/AdsSDK';
import AdsConfig from '../config/AdsConfig';
import Logger from '../utils/Logger';

const TAG = 'useInterstitialTimer';

export interface UseInterstitialTimerOptions {
  /** Interval in milliseconds */
  intervalMs?: number;
  /** Auto-start on mount (default: true) */
  startOnMount?: boolean;
  /** Show on first interval (default: false) */
  showOnFirstInterval?: boolean;
  /** Callback when ad is shown */
  onAdShown?: () => void;
  /** Callback when ad is skipped */
  onAdSkipped?: () => void;
}

/**
 * Hook for timer-based interstitial ads
 * Automatically shows interstitial at configured intervals
 *
 * @example
 * useInterstitialTimer(); // One line, SDK handles everything
 */
export const useInterstitialTimer = (
  options: UseInterstitialTimerOptions = {},
): void => {
  const {
    intervalMs = AdsConfig.interstitialTimerIntervalMs,
    startOnMount = true,
    showOnFirstInterval = false,
    onAdShown,
    onAdSkipped,
  } = options;

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const timerStartedRef = useRef<boolean>(false);

  // Clean up timer
  const clearTimer = useCallback(() => {
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
  }, []);

  // Show ad
  const showAd = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    Logger.debug(TAG, 'Timer triggered, showing interstitial');

    try {
      const shown = await showInterstitialAds();
      if (shown) {
        onAdShown?.();
        // Reset timer after showing
        clearTimer();
        if (isMountedRef.current && timerStartedRef.current) {
          timerIdRef.current = setTimeout(() => {
            showAd();
          }, intervalMs);
        }
      } else {
        onAdSkipped?.();
        // If not shown, wait and try again
        if (isMountedRef.current && timerStartedRef.current) {
          timerIdRef.current = setTimeout(() => {
            showAd();
          }, intervalMs);
        }
      }
    } catch (error) {
      Logger.error(TAG, 'Error showing ad:', error);
      onAdSkipped?.();
      if (isMountedRef.current && timerStartedRef.current) {
        timerIdRef.current = setTimeout(() => {
          showAd();
        }, intervalMs);
      }
    }
  }, [intervalMs, onAdShown, onAdSkipped, clearTimer]);

  // Start timer
  const startTimer = useCallback(() => {
    if (timerStartedRef.current) {
      return;
    }

    timerStartedRef.current = true;
    setIsRunning(true);

    if (showOnFirstInterval) {
      showAd();
    } else {
      timerIdRef.current = setTimeout(() => {
        showAd();
      }, intervalMs);
    }
  }, [showOnFirstInterval, showAd, intervalMs]);

  // Stop timer
  const stopTimer = useCallback(() => {
    timerStartedRef.current = false;
    setIsRunning(false);
    clearTimer();
  }, [clearTimer]);

  // Lifecycle
  useEffect(() => {
    isMountedRef.current = true;

    if (startOnMount) {
      startTimer();
    }

    return () => {
      isMountedRef.current = false;
      stopTimer();
    };
  }, [startOnMount, startTimer, stopTimer]);

  // Handle screen focus/blur
  useFocusEffect(
    useCallback(() => {
      // On focus, resume timer if it was running
      if (timerStartedRef.current && !isRunning) {
        setIsRunning(true);
        timerIdRef.current = setTimeout(() => {
          showAd();
        }, intervalMs);
      }

      return () => {
        // On blur, pause timer
        if (timerStartedRef.current && isRunning) {
          setIsRunning(false);
          clearTimer();
        }
      };
    }, [isRunning, showAd, intervalMs, clearTimer]),
  );
};

export default useInterstitialTimer;
