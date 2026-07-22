// src/services/socket/rideRequestHandler.ts

import { socketService } from './rideRequestUtils';
import { notificationService } from '../../services/notification/NotificationService';
import { SOCKET_EVENTS } from '../../../api/constants/rideRequestConfig';
import { RideRequest } from '../../types/RideTypes';

type RideRequestCallback = (data: RideRequest) => void;

class RideRequestHandler {
  private static instance: RideRequestHandler;
  private onRequestCallback: RideRequestCallback | null = null;
  private isSetup = false;

  private constructor() {}

  static getInstance(): RideRequestHandler {
    if (!RideRequestHandler.instance) {
      RideRequestHandler.instance = new RideRequestHandler();
    }
    return RideRequestHandler.instance;
  }

  /**
   * Setup ride request event listeners
   */
  setup(): void {
    if (this.isSetup) return;

    // Listen for new ride requests
    socketService.on(SOCKET_EVENTS.NEW_RIDE_REQUEST, async (data: any) => {
      console.log('🚗 New ride request received:', data);

      // Convert to RideRequest type
      const rideRequest: RideRequest = {
        requestId: data.requestId,
        bookingId: data.bookingId,
        fare: data.fare || 0,
        pickup: data.pickup,
        destination: data.destination,
        distance: data.distance || 0,
        isRetry: data.isRetry || false,
        batchNumber: data.batchNumber || 1,
        expiresAt: data.expiresAt || new Date().toISOString(),
      };

      // Show notification (Foreground + Background)
      await (notificationService as any).showRideRequestNotification(rideRequest);

      // Call callback for UI update
      if (this.onRequestCallback) {
        this.onRequestCallback(rideRequest);
      }
    });

    // Listen for ride accepted confirmation
    socketService.on(SOCKET_EVENTS.RIDE_ACCEPTED, async (data: any) => {
      console.log('✅ Ride accepted by system:', data);
      await notificationService.dismissRideRequest();
    });

    // Listen for ride rejected
    socketService.on(SOCKET_EVENTS.RIDE_REJECTED, async (data: any) => {
      console.log('❌ Ride rejected:', data);
      await notificationService.dismissRideRequest();
    });

    // Listen for driver timeout
    socketService.on(SOCKET_EVENTS.DRIVER_TIMEOUT, async (data: any) => {
      console.log('⏰ Driver timeout:', data);
      await notificationService.dismissRideRequest();
    });

    this.isSetup = true;
    console.log('✅ Ride request handler setup complete');
  }

  /**
   * Accept ride request via socket
   */
  acceptRide(requestId: string): void {
    socketService.emit(SOCKET_EVENTS.DRIVER_RESPONSE, {
      requestId,
      action: 'accept',
    });
    // Dismiss notification immediately
    notificationService.dismissRideRequest();
  }

  /**
   * Reject ride request via socket
   */
  rejectRide(requestId: string): void {
    socketService.emit(SOCKET_EVENTS.DRIVER_RESPONSE, {
      requestId,
      action: 'reject',
    });
    // Dismiss notification immediately
    notificationService.dismissRideRequest();
  }

  /**
   * Set callback for new ride requests
   */
  onNewRequest(callback: RideRequestCallback): void {
    this.onRequestCallback = callback;
  }

  /**
   * Remove callback
   */
  removeCallback(): void {
    this.onRequestCallback = null;
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    socketService.removeAllListeners(SOCKET_EVENTS.NEW_RIDE_REQUEST);
    socketService.removeAllListeners(SOCKET_EVENTS.RIDE_ACCEPTED);
    socketService.removeAllListeners(SOCKET_EVENTS.RIDE_REJECTED);
    socketService.removeAllListeners(SOCKET_EVENTS.DRIVER_TIMEOUT);
    this.onRequestCallback = null;
    this.isSetup = false;
  }
}

export const rideRequestHandler = RideRequestHandler.getInstance();