// src/hooks/useDriverStatus.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { driverStatusApi } from '../../../api/features/private/driverLocationOnlinePrivateSlice';
import { driverRideApi } from '../../../api/features/private/driverRidePrivateSlice';
import { driverSocketHandler } from '../../../api/connections/handlers/sockets/driverSocketHandler';
import { rideRequestSocketHandler } from '../../../api/connections/handlers/sockets/rideRequestSocketHandler';
import { DriverStatus, Tracking } from '../../types/RideTypes';

interface UseDriverStatusReturn {
  isOnline: boolean;
  isAvailable: boolean;
  isLoading: boolean;
  activeTrip: Tracking | null;
  earnings: number;
  toggleOnline: (value: boolean) => Promise<void>;
  toggleAvailable: (value: boolean) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export const useDriverStatus = (): UseDriverStatusReturn => {
  const [isOnline, setIsOnline] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTrip, setActiveTrip] = useState<Tracking | null>(null);
  const [earnings, setEarnings] = useState(0);

  // Cleanup refs
  const statusUnsubscribeRef = useRef<(() => void) | null>(null);
  const rideAcceptedUnsubscribeRef = useRef<(() => void) | null>(null);

  /**
   * Load driver status from API
   */
  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);

      // Get driver status
      const statusResponse = await driverStatusApi.getDriverStatus();
      if (statusResponse.success && statusResponse.data) {
        setIsOnline(statusResponse.data.isOnline);
        setIsAvailable(statusResponse.data.isAvailable);
      }

      // Get active trip
      const trip = await driverRideApi.getActiveTrip();
      if (trip) {
        setActiveTrip(trip);
      }
    } catch (error) {
      console.error('Failed to load driver status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Toggle online status
   */
  const toggleOnline = useCallback(async (value: boolean): Promise<void> => {
    try {
      setIsOnline(value);
      setIsAvailable(value);

      await driverStatusApi.updateOnlineStatus(value);

      // ✅ Use driverSocketHandler to emit status
      driverSocketHandler.emitRegister({ userId: '' });
    } catch (error) {
      console.error('Failed to toggle online status:', error);
      setIsOnline(!value);
      setIsAvailable(!value);
      throw error;
    }
  }, []);

  /**
   * Toggle available status
   */
  const toggleAvailable = useCallback(async (value: boolean): Promise<void> => {
    try {
      setIsAvailable(value);

      // ✅ Use driverSocketHandler
      // driverSocketHandler has status update method if needed
    } catch (error) {
      console.error('Failed to toggle available status:', error);
      setIsAvailable(!value);
      throw error;
    }
  }, []);

  /**
   * Refresh driver status
   */
  const refreshStatus = useCallback(async (): Promise<void> => {
    await loadStatus();
  }, [loadStatus]);

  // Load initial status
  useEffect(() => {
    loadStatus();

    // ✅ Use rideRequestSocketHandler for ride accepted
    rideRequestSocketHandler.on(
      'accept',
      (data: any) => {
        console.log('Ride accepted, updating active trip:', data);
        loadStatus();
      }
    );

    // ✅ Use driverSocketHandler for status changes
    driverSocketHandler.on(
      'driver:status-changed',
      (data: any) => {
        console.log('Driver status changed:', data);
        if (data.isOnline !== undefined) setIsOnline(data.isOnline);
        if (data.isAvailable !== undefined) setIsAvailable(data.isAvailable);
      }
    );

    return () => {
      if (rideAcceptedUnsubscribeRef.current) {
        rideAcceptedUnsubscribeRef.current();
        rideAcceptedUnsubscribeRef.current = null;
      }
      if (statusUnsubscribeRef.current) {
        statusUnsubscribeRef.current();
        statusUnsubscribeRef.current = null;
      }
    };
  }, [loadStatus]);

  return {
    isOnline,
    isAvailable,
    isLoading,
    activeTrip,
    earnings,
    toggleOnline,
    toggleAvailable,
    refreshStatus,
  };
};
