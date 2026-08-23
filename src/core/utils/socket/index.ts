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

/**
 * Register all socket handlers
 * Safe to call multiple times - prevents duplicate registration
 */
export const registerSocketHandlers = (): void => {
  if (isRegistered) {
    console.log('[Socket] Handlers already registered, skipping');
    return;
  }

  console.log('[Socket] 📡 Registering all socket handlers...');

  // Ensure socket is connected
  if (!socketService.isSocketConnected()) {
    console.log('[Socket] ⚠️ Socket not connected, attempting to connect...');
    socketService.connect().catch((err) => {
      console.error('[Socket] ❌ Failed to connect socket:', err);
    });
  }

  // Register all domain handlers
  driverSocketHandler.register();
  rideRequestSocketHandler.register();
  rideStatusSocketHandler.register();
  rideLiveTrackingHandler.register();

  isRegistered = true;
  console.log('[Socket] ✅ All socket handlers registered');
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