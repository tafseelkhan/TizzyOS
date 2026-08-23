// src/utils/socket/handlers/rideRequestSocketHandler.ts

import { socketService } from '../../../../core/utils/socket/socketUtils';
import { SOCKET_EVENTS } from '../../../../api/constants/rideRequestConfig';

// ============================================================
// TYPES
// ============================================================

export interface NewRideRequestData {
  requestId: string;
  bookingId: string;
  trackingId: string;
  customerId: string;
  pickup: {
    latitude: number;
    longitude: number;
    address: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  fare: number;
  distance: number;
  timestamp: string;
}

export interface RideAcceptedData {
  requestId: string;
  bookingId: string;
  driverId: string;
  timestamp: string;
}

export interface RideRejectedData {
  requestId: string;
  bookingId: string;
  driverId: string;
  timestamp: string;
}

export interface DriverTimeoutData {
  requestId: string;
  bookingId: string;
  reason: string;
  timestamp: string;
}

export interface NoDriverFoundData {
  requestId: string;
  bookingId: string;
  reason: string;
  timestamp: string;
}

export interface RideRequestCallbacks {
  onNewRideRequest?: (data: NewRideRequestData) => void;
  onRideAccepted?: (data: RideAcceptedData) => void;
  onRideRejected?: (data: RideRejectedData) => void;
  onDriverTimeout?: (data: DriverTimeoutData) => void;
  onNoDriverFound?: (data: NoDriverFoundData) => void;
  onError?: (error: { message: string }) => void;
}

// ============================================================
// RIDE REQUEST SOCKET HANDLER
// ============================================================

class RideRequestSocketHandler {
  private static instance: RideRequestSocketHandler;
  private isRegistered: boolean = false;
  private listeners: Map<string, Set<Function>> = new Map();

  // Handler references for cleanup
  private newRideHandler: ((data: any) => void) | null = null;
  private acceptedHandler: ((data: any) => void) | null = null;
  private rejectedHandler: ((data: any) => void) | null = null;
  private timeoutHandler: ((data: any) => void) | null = null;
  private noDriverHandler: ((data: any) => void) | null = null;
  private errorHandler: ((data: any) => void) | null = null;

  private constructor() {}

  static getInstance(): RideRequestSocketHandler {
    if (!RideRequestSocketHandler.instance) {
      RideRequestSocketHandler.instance = new RideRequestSocketHandler();
    }
    return RideRequestSocketHandler.instance;
  }

  /**
   * Register socket listeners for ride request events
   */
  register(): void {
    if (this.isRegistered) {
      console.log('[RideRequestSocketHandler] Already registered');
      return;
    }

    console.log('[RideRequestSocketHandler] Registering ride request listeners...');

    // ============================================================
    // NEW RIDE REQUEST
    // ============================================================
    this.newRideHandler = (data: NewRideRequestData) => {
      console.log('[RideRequestSocketHandler] 🚗 New ride request:', data);
      this.emitEvent(SOCKET_EVENTS.NEW_RIDE_REQUEST, data);
    };

    // ============================================================
    // RIDE ACCEPTED
    // ============================================================
    this.acceptedHandler = (data: RideAcceptedData) => {
      console.log('[RideRequestSocketHandler] ✅ Ride accepted:', data);
      this.emitEvent(SOCKET_EVENTS.RIDE_ACCEPTED, data);
    };

    // ============================================================
    // RIDE REJECTED
    // ============================================================
    this.rejectedHandler = (data: RideRejectedData) => {
      console.log('[RideRequestSocketHandler] ❌ Ride rejected:', data);
      this.emitEvent(SOCKET_EVENTS.RIDE_REJECTED, data);
    };

    // ============================================================
    // DRIVER TIMEOUT
    // ============================================================
    this.timeoutHandler = (data: DriverTimeoutData) => {
      console.log('[RideRequestSocketHandler] ⏰ Driver timeout:', data);
      this.emitEvent(SOCKET_EVENTS.DRIVER_TIMEOUT, data);
    };

    // ============================================================
    // NO DRIVER FOUND
    // ============================================================
    this.noDriverHandler = (data: NoDriverFoundData) => {
      console.log('[RideRequestSocketHandler] ❌ No driver found:', data);
      this.emitEvent('no-driver-found', data);
    };

    // ============================================================
    // ERROR HANDLING
    // ============================================================
    this.errorHandler = (data: { message: string }) => {
      console.log('[RideRequestSocketHandler] ❌ Error:', data);
      this.emitEvent('ride-request-error', data);
    };

    // Register with socketService
    socketService.on(SOCKET_EVENTS.NEW_RIDE_REQUEST, this.newRideHandler);
    socketService.on(SOCKET_EVENTS.RIDE_ACCEPTED, this.acceptedHandler);
    socketService.on(SOCKET_EVENTS.RIDE_REJECTED, this.rejectedHandler);
    socketService.on(SOCKET_EVENTS.DRIVER_TIMEOUT, this.timeoutHandler);
    socketService.on('no-driver-found', this.noDriverHandler);
    socketService.on('ride-request-error', this.errorHandler);

    this.isRegistered = true;
    console.log('[RideRequestSocketHandler] ✅ Registered');
  }

  /**
   * Unregister socket listeners
   */
  unregister(): void {
    if (!this.isRegistered) {
      console.log('[RideRequestSocketHandler] Not registered');
      return;
    }

    console.log('[RideRequestSocketHandler] Unregistering...');

    if (this.newRideHandler) {
      socketService.off(SOCKET_EVENTS.NEW_RIDE_REQUEST, this.newRideHandler);
      this.newRideHandler = null;
    }
    if (this.acceptedHandler) {
      socketService.off(SOCKET_EVENTS.RIDE_ACCEPTED, this.acceptedHandler);
      this.acceptedHandler = null;
    }
    if (this.rejectedHandler) {
      socketService.off(SOCKET_EVENTS.RIDE_REJECTED, this.rejectedHandler);
      this.rejectedHandler = null;
    }
    if (this.timeoutHandler) {
      socketService.off(SOCKET_EVENTS.DRIVER_TIMEOUT, this.timeoutHandler);
      this.timeoutHandler = null;
    }
    if (this.noDriverHandler) {
      socketService.off('no-driver-found', this.noDriverHandler);
      this.noDriverHandler = null;
    }
    if (this.errorHandler) {
      socketService.off('ride-request-error', this.errorHandler);
      this.errorHandler = null;
    }

    this.listeners.clear();
    this.isRegistered = false;
    console.log('[RideRequestSocketHandler] ✅ Unregistered');
  }

  /**
   * Subscribe to ride request events
   */
  on<T = any>(event: string, callback: (data: T) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as Function);
  }

  /**
   * Unsubscribe from ride request events
   */
  off<T = any>(event: string, callback: (data: T) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as Function);
      if (callbacks.size === 0) this.listeners.delete(event);
    }
  }

  /**
   * Emit event to subscribers
   */
  private emitEvent(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(...args));
    }
  }

  /**
   * Emit driver response (accept/reject)
   */
  emitDriverResponse(
    requestId: string,
    status: 'accepted' | 'rejected',
    driverId: string
  ): void {
    console.log('[RideRequestSocketHandler] 📤 Emitting driver response:', {
      requestId,
      status,
      driverId,
    });
    socketService.driverResponse(requestId, status, driverId);
  }
}

// Singleton export
export const rideRequestSocketHandler = RideRequestSocketHandler.getInstance();