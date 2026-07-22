// src/hooks/useDriverSocket.ts

import { useState, useEffect, useCallback } from 'react';
import { socketService } from '../../utils/socket/rideRequestUtils';
import { SOCKET_EVENTS } from '../../../api/constants/rideRequestConfig';

interface UseDriverSocketReturn {
  isConnected: boolean;
  socketId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback: (data: any) => void) => void;
  updateStatus: (isAvailable: boolean) => void;
  updateLocation: (location: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
  }) => void;
}

export const useDriverSocket = (): UseDriverSocketReturn => {
  const [isConnected, setIsConnected] = useState(
    socketService.isSocketConnected(),
  );
  const [socketId, setSocketId] = useState<string | null>(
    socketService.getSocketId(),
  );

  useEffect(() => {
    // Check connection status periodically
    const interval = setInterval(() => {
      const connected = socketService.isSocketConnected();
      setIsConnected(connected);
      setSocketId(socketService.getSocketId());
    }, 3000);

    // Initial connection
    socketService.connect();

    // Listen to socket events
    const onConnect = () => {
      setIsConnected(true);
      setSocketId(socketService.getSocketId());
    };

    const onDisconnect = () => {
      setIsConnected(false);
      setSocketId(null);
    };

    socketService.on('connect', onConnect);
    socketService.on('disconnect', onDisconnect);

    return () => {
      clearInterval(interval);
      socketService.off('connect', onConnect);
      socketService.off('disconnect', onDisconnect);
    };
  }, []);

  /**
   * Connect socket
   */
  const connect = useCallback(async (): Promise<void> => {
    await socketService.connect();
    setIsConnected(socketService.isSocketConnected());
    setSocketId(socketService.getSocketId());
  }, []);

  /**
   * Disconnect socket
   */
  const disconnect = useCallback((): void => {
    socketService.disconnect();
    setIsConnected(false);
    setSocketId(null);
  }, []);

  /**
   * Emit event
   */
  const emit = useCallback((event: string, data?: any): void => {
    socketService.emit(event, data);
  }, []);

  /**
   * Register event listener
   */
  const on = useCallback(
    (event: string, callback: (data: any) => void): void => {
      socketService.on(event, callback);
    },
    [],
  );

  /**
   * Remove event listener
   */
  const off = useCallback(
    (event: string, callback: (data: any) => void): void => {
      socketService.off(event, callback);
    },
    [],
  );

  /**
   * Update driver status (Online/Offline)
   */
  const updateStatus = useCallback((isAvailable: boolean): void => {
    socketService.emit(SOCKET_EVENTS.DRIVER_STATUS_UPDATE, { isAvailable });
  }, []);

  /**
   * Update driver location
   */
  const updateLocation = useCallback(
    (location: {
      latitude: number;
      longitude: number;
      heading?: number;
      speed?: number;
      accuracy?: number;
    }): void => {
      socketService.emit(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, {
        ...location,
        timestamp: new Date().toISOString(),
      });
    },
    [],
  );

  return {
    isConnected,
    socketId,
    connect,
    disconnect,
    emit,
    on,
    off,
    updateStatus,
    updateLocation,
  };
};
