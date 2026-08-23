// src/core/hooks/cab/useSocketBootstrap.ts

import { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/auth/UserContext';
import { socketService } from '../../utils/socket/socketUtils';
import { registerSocketHandlers, unregisterSocketHandlers } from '../../utils/socket';
import { rideRequestHandler } from '../../utils/socket/rideRequestHandler';
import { tripSocketHandler } from '../../utils/socket/TripSocketHandler';

/**
 * useSocketBootstrap - Single hook to manage socket lifecycle
 * 
 * ✅ NOW USING registerSocketHandlers() for all handlers
 */
export const useSocketBootstrap = (): void => {
  const { user, loading } = useAuth();
  const socketInitialized = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (user) {
      // Only initialize once
      if (!socketInitialized.current) {
        console.log('[useSocketBootstrap] Initializing socket connection...');
        socketInitialized.current = true;

        // ✅ Connect socket
        socketService.connect().catch(error => {
          console.error('[useSocketBootstrap] Socket connection failed:', error);
        });

        // ✅ Register ALL handlers via central registration
        registerSocketHandlers();

        // ✅ Start legacy domain handlers (if still needed)
        rideRequestHandler.startListening();
        tripSocketHandler.startListening();
      }
    } else {
      // User is not authenticated - clean up
      if (socketInitialized.current) {
        console.log('[useSocketBootstrap] Cleaning up socket...');
        socketInitialized.current = false;

        // ✅ Unregister ALL handlers
        unregisterSocketHandlers();

        // Stop legacy handlers
        rideRequestHandler.stopListening();
        tripSocketHandler.stopListening();

        // Disconnect socket
        socketService.disconnect();
      }
    }

    // Cleanup on unmount
    return () => {
      if (socketInitialized.current) {
        unregisterSocketHandlers();
        rideRequestHandler.stopListening();
        tripSocketHandler.stopListening();
        socketService.disconnect();
        socketInitialized.current = false;
      }
    };
  }, [user, loading]);
};