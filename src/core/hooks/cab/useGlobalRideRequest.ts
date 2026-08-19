// src/hooks/cab/useGlobalRideRequest.ts
import { useRideRequestContext } from '../../contexts/rideRequest/RideRequestContext';

/**
 * useGlobalRideRequest - Hook to access the global ride request state
 * 
 * This hook provides access to the ride request context from anywhere in the app.
 * It should be used instead of the old useRideRequest hook.
 */
export const useGlobalRideRequest = () => {
  return useRideRequestContext();
};

// Re-export with a more convenient name
export const useRideRequest = useGlobalRideRequest;