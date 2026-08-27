// src/utils/socket/index.ts

import { socketService } from './socketUtils';
import { driverSocketHandler } from '../../../api/connections/handlers/sockets/driverSocketHandler';
import { rideRequestSocketHandler } from '../../../api/connections/handlers/sockets/rideRequestSocketHandler';
import { rideStatusSocketHandler } from '../../../api/connections/handlers/sockets/rideStatusSocketHandler';
import { rideLiveTrackingHandler } from '../../../api/connections/handlers/sockets/rideLiveTrackingHandler';

// ============================================================
// CENTRAL SOCKET REGISTRATION
// ============================================================

let isRegistered = false;
let registrationPromise: Promise<void> | null = null;

/**
 * Register all socket handlers
 * Safe to call multiple times - prevents duplicate registration
 */
export const registerSocketHandlers = (): Promise<void> | void => {
  if (isRegistered) {
    console.log('[Socket] Handlers already registered, skipping');
    return;
  }

  // Prevent concurrent registration
  if (registrationPromise) {
    console.log('[Socket] Registration already in progress, waiting...');
    return registrationPromise;
  }

  console.log('[Socket] 📡 Registering all socket handlers...');

  registrationPromise = (async () => {
    try {
      // Ensure socket is connected
      if (!socketService.isSocketConnected()) {
        console.log('[Socket] ⚠️ Socket not connected, attempting to connect...');
        await socketService.connect();
        console.log('[Socket] ✅ Socket connected successfully');
      }

      // Register all domain handlers
      driverSocketHandler.register();
      rideRequestSocketHandler.register();
      rideStatusSocketHandler.register();
      rideLiveTrackingHandler.register();

      isRegistered = true;
      console.log('[Socket] ✅ All socket handlers registered');
    } catch (error) {
      console.error('[Socket] ❌ Failed to register socket handlers:', error);
      throw error;
    } finally {
      registrationPromise = null;
    }
  })();

  return registrationPromise;
};

/**
 * Unregister all socket handlers
 */
export const unregisterSocketHandlers = (): void => {
  if (!isRegistered) {
    console.log('[Socket] No handlers registered, skipping unregister');
    return;
  }

  console.log('[Socket] 📡 Unregistering all socket handlers...');

  driverSocketHandler.unregister();
  rideRequestSocketHandler.unregister();
  rideStatusSocketHandler.unregister();
  rideLiveTrackingHandler.unregister();

  isRegistered = false;
  console.log('[Socket] ✅ All socket handlers unregistered');
};

// Export core service and all handlers
export { socketService } from './socketUtils';
export { driverSocketHandler } from '../../../api/connections/handlers/sockets/driverSocketHandler';
export { rideRequestSocketHandler } from '../../../api/connections/handlers/sockets/rideRequestSocketHandler';
export { rideStatusSocketHandler } from '../../../api/connections/handlers/sockets/rideStatusSocketHandler';
export { rideLiveTrackingHandler } from '../../../api/connections/handlers/sockets/rideLiveTrackingHandler';