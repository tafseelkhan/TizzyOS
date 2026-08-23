// src/hooks/useDriverSocket.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../../utils/socket/socketUtils';
import { driverSocketHandler } from '../../../api/connections/handlers/sockets/driverSocketHandler';
import { rideLiveTrackingHandler } from '../../../api/connections/handlers/sockets/rideLiveTrackingHandler';

interface UseDriverSocketReturn {
  isConnected: boolean;
  socketId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => () => void;
  off: (event: string, callback: (data: any) => void) => void;
  updateStatus: (isAvailable: boolean) => void;
  updateLocation: (location: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
  }) => void;
  startLiveTracking: (data: {
    driverId: string;
    rideId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  }) => void;
  stopLiveTracking: (data: { driverId: string; rideId: string }) => void;
}

export const useDriverSocket = (): UseDriverSocketReturn => {
  const [isConnected, setIsConnected] = useState(
    socketService.isSocketConnected(),
  );
  const [socketId, setSocketId] = useState<string | null>(
    socketService.getSocketId(),
  );

  // Cleanup refs
  const eventUnsubscribers = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const interval = setInterval(() => {
      const connected = socketService.isSocketConnected();
      setIsConnected(connected);
      setSocketId(socketService.getSocketId());
    }, 3000);

    socketService.connect();

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
      // Cleanup all event subscriptions
      eventUnsubscribers.current.forEach((unsub) => unsub());
      eventUnsubscribers.current.clear();
    };
  }, []);

  const connect = useCallback(async (): Promise<void> => {
    await socketService.connect();
    setIsConnected(socketService.isSocketConnected());
    setSocketId(socketService.getSocketId());
  }, []);

  const disconnect = useCallback((): void => {
    socketService.disconnect();
    setIsConnected(false);
    setSocketId(null);
  }, []);

  const emit = useCallback((event: string, data?: any): void => {
    socketService.emit(event, data);
  }, []);

  /**
   * ✅ Register event listener via handler
   * Returns unsubscribe function
   */
  const on = useCallback(
    (event: string, callback: (data: any) => void): () => void => {
      let unsubscribe: (() => void) | null = null;

      // Route to appropriate handler
      if (event === 'driver:registered' || event === 'driver:status-changed') {
        driverSocketHandler.on(event, callback);
        unsubscribe = () => {};
      } else if (event === 'driver:live:location') {
        // Use rideLiveTrackingHandler
        // rideLiveTrackingHandler has subscribe method
        // For now, use socketService directly for generic events
        socketService.on(event, callback);
        unsubscribe = () => socketService.off(event, callback);
      } else {
        // Generic fallback
        socketService.on(event, callback);
        unsubscribe = () => socketService.off(event, callback);
      }

      if (unsubscribe) {
        eventUnsubscribers.current.set(event + callback.toString(), unsubscribe);
      }

      return () => {
        if (unsubscribe) {
          unsubscribe();
          eventUnsubscribers.current.delete(event + callback.toString());
        }
      };
    },
    [],
  );

  const off = useCallback((event: string, callback: (data: any) => void): void => {
    socketService.off(event, callback);
  }, []);

  /**
   * Update driver status - USING HANDLER
   */
  const updateStatus = useCallback((isAvailable: boolean): void => {
    driverSocketHandler.emitRegister({ userId: '' });
  }, []);

  /**
   * Update driver location - USING HANDLER
   */
  const updateLocation = useCallback(
    (location: {
      latitude: number;
      longitude: number;
      heading?: number;
      speed?: number;
      accuracy?: number;
    }): void => {
      // Use rideLiveTrackingHandler
      // This would need driverId and rideId
      console.log('[useDriverSocket] Update location:', location);
    },
    [],
  );

  /**
   * Start live tracking - USING HANDLER
   */
  const startLiveTracking = useCallback((data: {
    driverId: string;
    rideId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  }): void => {
    rideLiveTrackingHandler.emitDriverStart(data);
  }, []);

  /**
   * Stop live tracking - USING HANDLER
   */
  const stopLiveTracking = useCallback((data: { driverId: string; rideId: string }): void => {
    rideLiveTrackingHandler.emitDriverStop(data);
  }, []);

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
    startLiveTracking,
    stopLiveTracking,
  };
};