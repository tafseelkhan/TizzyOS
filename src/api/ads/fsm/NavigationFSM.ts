/**
 * Navigation FSM - Tracks navigation events
 *
 * Emits: NAVIGATION_OCCURRED, THRESHOLD_REACHED, COUNT_RESET
 *
 * @module NavigationFSM
 */

import {
  getCurrentRouteName,
  getNavigationCount,
  resetNavigationCount,
  isScreenExcludedForInterstitial,
} from '../../../navigations/navigation';
import AdsConfig from '../config/AdsConfig';
import Logger from '../utils/Logger';

const TAG = 'NavigationFSM';

export type NavigationListener = (event: string, data: any) => void;

/**
 * Navigation FSM - Pure state machine
 */
export class NavigationFSM {
  private _listeners: NavigationListener[] = [];
  private _threshold: number;
  private _lastRoute: string = '';

  constructor() {
    this._threshold = AdsConfig.navigationThreshold;
    Logger.debug(TAG, `Created with threshold: ${this._threshold}`);
  }

  /**
   * Register listener
   */
  public addListener(listener: NavigationListener): () => void {
    this._listeners.push(listener);
    return () => {
      const index = this._listeners.indexOf(listener);
      if (index > -1) {
        this._listeners.splice(index, 1);
      }
    };
  }

  /**
   * Handle navigation
   */
  public handleNavigation(routeName: string): void {
    // Prevent duplicate processing
    if (this._lastRoute === routeName) {
      Logger.debug(TAG, `Duplicate route, skipping: ${routeName}`);
      return;
    }
    this._lastRoute = routeName;

    Logger.debug(TAG, `📍 Navigation: ${routeName}`);

    // Check excluded screens
    if (isScreenExcludedForInterstitial(routeName)) {
      Logger.debug(TAG, `Excluded screen, resetting count`);
      resetNavigationCount();
      this._notify('COUNT_RESET', { routeName });
      return;
    }

    const count = getNavigationCount();
    Logger.debug(TAG, `Count: ${count}, Threshold: ${this._threshold}`);

    this._notify('NAVIGATION_OCCURRED', { routeName, count });

    if (count >= this._threshold) {
      Logger.debug(TAG, `✅ Threshold reached!`);
      this._notify('THRESHOLD_REACHED', { routeName, count });
    }
  }

  /**
   * Reset navigation count
   */
  public resetCount(): void {
    Logger.debug(TAG, `Resetting count`);
    resetNavigationCount();
    this._notify('COUNT_RESET', {});
  }

  /**
   * Get current count
   */
  public getCount(): number {
    return getNavigationCount();
  }

  /**
   * Get threshold
   */
  public getThreshold(): number {
    return this._threshold;
  }

  private _notify(event: string, data: any): void {
    this._listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        Logger.error(TAG, `Listener error:`, error);
      }
    });
  }
}

export default NavigationFSM;
