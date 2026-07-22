// src/hooks/useRideRequest.ts

import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { rideRequestHandler } from '../../utils/socket/rideRequestHandler';
import { notificationService } from '../../services/notification/NotificationService';
import { RideRequest } from '../../types/RideTypes';

interface UseRideRequestReturn {
  currentRequest: RideRequest | null;
  isRequestActive: boolean;
  acceptRide: () => Promise<void>;
  rejectRide: () => Promise<void>;
  dismissRequest: () => Promise<void>;
}

export const useRideRequest = (): UseRideRequestReturn => {
  const navigation = useNavigation<any>();
  const [currentRequest, setCurrentRequest] = useState<RideRequest | null>(
    null,
  );
  const [isRequestActive, setIsRequestActive] = useState(false);

  useEffect(() => {
    // Setup ride request handler
    rideRequestHandler.setup();

    // Listen for new ride requests
    rideRequestHandler.onNewRequest((request: RideRequest) => {
      setCurrentRequest(request);
      setIsRequestActive(true);
    });

    // Cleanup
    return () => {
      rideRequestHandler.removeCallback();
      notificationService.dismissRideRequest();
    };
  }, []);

  /**
   * Accept the current ride request
   */
  const acceptRide = useCallback(async (): Promise<void> => {
    if (!currentRequest) return;

    // Send accept via socket
    rideRequestHandler.acceptRide(currentRequest.requestId);

    // Dismiss notification and popup
    await notificationService.dismissRideRequest();

    // Clear state
    const bookingId = currentRequest.bookingId;
    setCurrentRequest(null);
    setIsRequestActive(false);

    // Navigate to active trip screen
    navigation.navigate('ActiveTrip', { bookingId });
  }, [currentRequest, navigation]);

  /**
   * Reject the current ride request
   */
  const rejectRide = useCallback(async (): Promise<void> => {
    if (!currentRequest) return;

    // Send reject via socket
    rideRequestHandler.rejectRide(currentRequest.requestId);

    // Dismiss notification and popup
    await notificationService.dismissRideRequest();

    // Clear state
    setCurrentRequest(null);
    setIsRequestActive(false);
  }, [currentRequest]);

  /**
   * Dismiss the current ride request (timeout)
   */
  const dismissRequest = useCallback(async (): Promise<void> => {
    await notificationService.dismissRideRequest();
    setCurrentRequest(null);
    setIsRequestActive(false);
  }, []);

  return {
    currentRequest,
    isRequestActive,
    acceptRide,
    rejectRide,
    dismissRequest,
  };
};
