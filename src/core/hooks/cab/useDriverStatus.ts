// src/hooks/useDriverStatus.ts

import { useState, useEffect, useCallback } from 'react';
import { driverStatusApi } from '../../../api/features/private/driverLocationOnlinePrivateSlice';
import { driverRideApi } from '../../../api/features/private/driverRidePrivateSlice';
import { socketService } from '../../utils/socket/rideRequestUtils';
import { SOCKET_EVENTS } from '../../../api/constants/rideRequestConfig';
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

      // TODO: Get earnings from API
      // const earningsData = await driverEarningsApi.getTodayEarnings();
      // setEarnings(earningsData || 0);
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
      // Update local state
      setIsOnline(value);
      setIsAvailable(value);

      // Update backend API
      await driverStatusApi.updateOnlineStatus(value);

      // Update socket
      socketService.emit(SOCKET_EVENTS.DRIVER_STATUS_UPDATE, {
        isAvailable: value,
      });
    } catch (error) {
      console.error('Failed to toggle online status:', error);
      // Rollback local state on error
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
      // Update local state
      setIsAvailable(value);

      // Update socket
      socketService.emit(SOCKET_EVENTS.DRIVER_STATUS_UPDATE, {
        isAvailable: value,
      });
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

    // Listen for ride accepted events
    const handleRideAccepted = (data: any) => {
      console.log('Ride accepted, updating active trip:', data);
      // Refresh active trip
      loadStatus();
    };

    socketService.on(SOCKET_EVENTS.RIDE_ACCEPTED, handleRideAccepted);

    return () => {
      socketService.off(SOCKET_EVENTS.RIDE_ACCEPTED, handleRideAccepted);
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
