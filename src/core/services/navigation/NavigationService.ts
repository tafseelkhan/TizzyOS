// src/core/services/navigation/NavigationService.ts

import { NavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigations/index';

class NavigationServiceClass {
  private static instance: NavigationServiceClass;
  private navigator: NavigationContainerRef<RootStackParamList> | null = null;
  private pendingNavigations: Array<{
    name: keyof RootStackParamList;
    params?: any;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private isReady = false;

  static getInstance(): NavigationServiceClass {
    if (!NavigationServiceClass.instance) {
      NavigationServiceClass.instance = new NavigationServiceClass();
    }
    return NavigationServiceClass.instance;
  }

  /**
   * ✅ Set navigator reference when container is ready
   */
  setNavigator(
    navigatorRef: NavigationContainerRef<RootStackParamList> | null,
  ): void {
    console.log('[NavigationService] setNavigator called, ref:', !!navigatorRef);
    if (navigatorRef) {
      this.navigator = navigatorRef;
      this.isReady = true;
      console.log('[NavigationService] ✅ Navigator ready, processing pending navigations:', this.pendingNavigations.length);
      this.processPendingNavigations();
    }
  }

  /**
   * ✅ Check if navigation is ready
   */
  isNavigatorReady(): boolean {
    return this.isReady && this.navigator !== null;
  }

  /**
   * ✅ Navigate - queues if not ready
   */
  navigate<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[NavigationService] navigate called: ${String(name)}`, params);

      if (this.isReady && this.navigator) {
        try {
          if (params !== undefined) {
            this.navigator.navigate(name as any, params as any);
          } else {
            this.navigator.navigate(name as any);
          }
          console.log(`[NavigationService] ✅ Navigated to ${String(name)}`);
          resolve();
        } catch (error) {
          console.error(`[NavigationService] ❌ Navigation failed:`, error);
          reject(error);
        }
      } else {
        console.log(`[NavigationService] ⏳ Queuing navigation to ${String(name)}`);
        this.pendingNavigations.push({
          name,
          params,
          resolve,
          reject,
        });
      }
    });
  }

  /**
   * ✅ Process pending navigations
   */
  private processPendingNavigations(): void {
    const pending = [...this.pendingNavigations];
    this.pendingNavigations = [];

    for (const nav of pending) {
      try {
        if (this.navigator) {
          // cast to any to satisfy overloaded navigate signature expecting specific tuple types
          this.navigator.navigate(nav.name as any, nav.params as any);
          console.log(`[NavigationService] ✅ Processed pending: ${String(nav.name)}`);
          nav.resolve();
        } else {
          nav.reject(new Error('Navigator not available'));
        }
      } catch (error) {
        console.error(`[NavigationService] ❌ Failed pending navigation:`, error);
        nav.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * ✅ Clear pending navigations (on app cleanup)
   */
  clearPending(): void {
    this.pendingNavigations = [];
  }

  /**
   * ✅ Reset navigation state
   */
  reset(): void {
    this.navigator = null;
    this.isReady = false;
    this.clearPending();
  }
}

export const NavigationService = NavigationServiceClass.getInstance();