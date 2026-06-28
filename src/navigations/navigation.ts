/**
 * Navigation Integration Module - SINGLE SOURCE OF TRUTH
 *
 * Provides navigation tracking for ad triggering.
 * All navigation state is managed centrally.
 *
 * @module navigation
 */

import {
  NavigationContainerRef,
  NavigationState,
  PartialState,
} from '@react-navigation/native';
import { RootStackParamList } from './index';
import AdsConfig from '../api/ads/config/AdsConfig';
import Logger from '../api/ads/utils/Logger';

const TAG = 'Navigation';

/**
 * Navigation reference for accessing navigation state
 */
let navigationRef: NavigationContainerRef<RootStackParamList> | null = null;

/**
 * SINGLE SOURCE OF TRUTH for navigation state
 */
let navState = {
  currentRoute: '',
  previousRoute: '',
  count: 0,
  history: [] as string[],
};

/**
 * ✅ FIX: SINGLE navigation callback - only ONE allowed
 */
type NavigationCallback = (routeName: string) => void;
let navigationCallback: NavigationCallback | null = null;
let callbackId = 0;

/**
 * Set the navigation reference
 */
export const setNavigationRef = (
  ref: NavigationContainerRef<RootStackParamList> | null,
): void => {
  navigationRef = ref;
  Logger.debug(TAG, `Ref set: ${!!ref}`);
};

/**
 * Get the navigation reference
 */
export const getNavigationRef =
  (): NavigationContainerRef<RootStackParamList> | null => {
    return navigationRef;
  };

/**
 * Get current route name
 */
export const getCurrentRouteName = (): string => {
  return navState.currentRoute;
};

/**
 * Get previous route name
 */
export const getPreviousRouteName = (): string => {
  return navState.previousRoute;
};

/**
 * Get navigation count
 */
export const getNavigationCount = (): number => {
  Logger.debug(TAG, `getNavigationCount(): ${navState.count}`);
  return navState.count;
};

/**
 * Reset navigation count
 */
export const resetNavigationCount = (): void => {
  Logger.debug(TAG, `🔄 Count reset from ${navState.count} to 0`);
  navState.count = 0;
};

/**
 * Get navigation history
 */
export const getNavigationHistory = (): string[] => {
  return [...navState.history];
};

/**
 * Check if screen is excluded for interstitial ads
 */
export const isScreenExcludedForInterstitial = (routeName: string): boolean => {
  const excluded = AdsConfig.excludedInterstitialScreens.includes(routeName);
  Logger.debug(
    TAG,
    `isScreenExcludedForInterstitial(${routeName}): ${excluded}`,
  );
  return excluded;
};

/**
 * Check if screen is excluded for app open ads
 */
export const isScreenExcludedForAppOpen = (routeName: string): boolean => {
  return AdsConfig.excludedAppOpenScreens.includes(routeName);
};

/**
 * Get route name from navigation state
 */
const getRouteNameFromState = (
  state: NavigationState | PartialState<NavigationState> | undefined,
): string => {
  if (!state) return '';

  try {
    const routes = state.routes;
    if (!routes || routes.length === 0) return '';

    let currentState: NavigationState | PartialState<NavigationState> = state;
    let routeName = '';
    let maxDepth = 0;

    while (
      currentState.routes &&
      currentState.routes.length > 0 &&
      maxDepth < 10
    ) {
      const index = currentState.index ?? currentState.routes.length - 1;
      const route = currentState.routes[index];

      if (route) {
        routeName = route.name;
        if (route.state) {
          currentState = route.state as NavigationState;
          maxDepth++;
          continue;
        }
      }
      break;
    }

    return routeName || (state.routes[0]?.name ?? '');
  } catch (error) {
    Logger.error(TAG, 'Error getting route name:', error);
    return '';
  }
};

/**
 * ✅ FIX: REGISTER SINGLE NAVIGATION CALLBACK
 * Only ONE callback can be registered at a time
 */
export const registerNavigationCallback = (
  callback: NavigationCallback,
): (() => void) => {
  // If a callback already exists, remove it first
  if (navigationCallback) {
    Logger.warn(TAG, '🔄 Replacing existing callback');
    navigationCallback = null;
  }

  navigationCallback = callback;
  callbackId++;

  Logger.debug(TAG, `✅ Callback registered (id: ${callbackId})`);

  // Return unsubscribe function
  return () => {
    if (navigationCallback === callback) {
      navigationCallback = null;
      Logger.debug(TAG, `🗑️ Callback removed (id: ${callbackId})`);
    }
  };
};

/**
 * HANDLE NAVIGATION STATE CHANGE - SINGLE ENTRY POINT
 */
export const handleNavigationStateChange = (
  state: NavigationState | PartialState<NavigationState> | undefined,
): void => {
  if (!state) {
    Logger.warn(TAG, 'State is undefined, skipping');
    return;
  }

  const newRouteName = getRouteNameFromState(state);

  if (!newRouteName || newRouteName === navState.currentRoute) {
    Logger.debug(
      TAG,
      `No change (current: ${navState.currentRoute}, new: ${newRouteName})`,
    );
    return;
  }

  Logger.debug(TAG, `📍 Route changed: ${newRouteName}`);

  // Update state
  navState.previousRoute = navState.currentRoute;
  navState.currentRoute = newRouteName;

  if (navState.currentRoute) {
    navState.history.push(navState.currentRoute);
    if (navState.history.length > 50) {
      navState.history.shift();
    }
  }

  // ✅ Increment count ONLY if not excluded
  const shouldTrack = !isScreenExcludedForInterstitial(newRouteName);
  if (shouldTrack) {
    navState.count++;
    Logger.debug(TAG, `➕ Count: ${navState.count}`);
  } else {
    navState.count = 0;
    Logger.debug(TAG, `🚫 Excluded screen, count reset to 0`);
  }

  // Call the single callback
  if (navigationCallback) {
    try {
      Logger.debug(TAG, `🔔 Firing callback for: ${navState.currentRoute}`);
      navigationCallback(navState.currentRoute);
    } catch (error) {
      Logger.error(TAG, 'Callback error:', error);
    }
  } else {
    Logger.warn(TAG, '⚠️ No callback registered!');
  }
};

/**
 * Navigate to a screen
 */
export const navigateToScreen = (
  screenName: keyof RootStackParamList,
  params?: RootStackParamList[keyof RootStackParamList],
): void => {
  if (navigationRef) {
    navigationRef.navigate(screenName as any, params);
  } else {
    Logger.warn(TAG, 'Navigation ref not set');
  }
};

/**
 * Go back
 */
export const goBack = (): void => {
  if (navigationRef) {
    if (navigationRef.canGoBack()) {
      navigationRef.goBack();
    } else {
      Logger.warn(TAG, 'Cannot go back');
    }
  } else {
    Logger.warn(TAG, 'Navigation ref not set');
  }
};

/**
 * Reset navigation
 */
export const resetNavigation = (
  routeName: keyof RootStackParamList,
  params?: RootStackParamList[keyof RootStackParamList],
): void => {
  if (navigationRef) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: routeName as any, params }],
    });
  } else {
    Logger.warn(TAG, 'Navigation ref not set');
  }
};

/**
 * Get navigation state
 */
export const getNavigationState = (): NavigationState | null => {
  if (navigationRef) {
    return navigationRef.getRootState();
  }
  return null;
};

/**
 * Check if route is active
 */
export const isRouteActive = (routeName: string): boolean => {
  return navState.currentRoute === routeName;
};

/**
 * Clear navigation history
 */
export const clearNavigationHistory = (): void => {
  navState.history = [];
};

/**
 * Reset ALL navigation state
 */
export const resetNavigationState = (): void => {
  Logger.debug(TAG, '🔄 Full state reset');
  navState = {
    currentRoute: '',
    previousRoute: '',
    count: 0,
    history: [],
  };
  navigationCallback = null;
};

export default {
  setNavigationRef,
  getNavigationRef,
  getCurrentRouteName,
  getPreviousRouteName,
  getNavigationCount,
  resetNavigationCount,
  getNavigationHistory,
  isScreenExcludedForInterstitial,
  isScreenExcludedForAppOpen,
  registerNavigationCallback,
  handleNavigationStateChange,
  navigateToScreen,
  goBack,
  resetNavigation,
  getNavigationState,
  isRouteActive,
  clearNavigationHistory,
  resetNavigationState,
};
