// src/core/hooks/cab/useSocketBootstrap.ts
import { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/auth/UserContext';
import { socketService } from '../../utils/socket/socketUtils';
import { rideRequestHandler } from '../../utils/socket/rideRequestHandler';
import { tripSocketHandler } from '../../utils/socket/TripSocketHandler';

/**
 * useSocketBootstrap - Single hook to manage socket lifecycle
 * 
 * This hook handles:
 * - Socket connection when user authenticates
 * - Starting/stopping domain handlers
 * - Cleanup on logout
 * - Prevention of duplicate initialization
 * 
 * ✅ Must be used inside AuthProvider
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

        // Connect socket
        socketService.connect().catch(error => {
          console.error('[useSocketBootstrap] Socket connection failed:', error);
        });

        // Start domain handlers
        rideRequestHandler.startListening();
        tripSocketHandler.startListening();
      }
    } else {
      // User is not authenticated - clean up
      if (socketInitialized.current) {
        console.log('[useSocketBootstrap] Cleaning up socket...');
        socketInitialized.current = false;

        // Stop handlers
        rideRequestHandler.stopListening();
        tripSocketHandler.stopListening();

        // Disconnect socket
        socketService.disconnect();
      }
    }

    // Cleanup on unmount
    return () => {
      if (socketInitialized.current) {
        rideRequestHandler.stopListening();
        tripSocketHandler.stopListening();
        socketService.disconnect();
        socketInitialized.current = false;
      }
    };
  }, [user, loading]);
};