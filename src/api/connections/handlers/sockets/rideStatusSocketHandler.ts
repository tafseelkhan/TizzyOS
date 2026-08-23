// src/utils/socket/handlers/rideStatusSocketHandler.ts

import { socketService } from '../../../../core/utils/socket/socketUtils';
import { SOCKET_EVENTS } from '../../../../api/constants/rideRequestConfig';

// ============================================================
// TYPES
// ============================================================

export interface RideStatusChangeData {
  bookingId: string;
  trackingId?: string;
  status: string;
  previousStatus?: string;
  timestamp: string;
  updatedBy?: string;
}

export interface RideCancellationData {
  bookingId: string;
  trackingId?: string;
  reason?: string;
  cancelledBy?: 'driver' | 'customer' | 'system';
  timestamp: string;
}

export interface DriverLocationData {
  driverId: string;
  bookingId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

export interface RideStatusCallbacks {
  onStatusChange?: (data: RideStatusChangeData) => void;
  onCancellation?: (data: RideCancellationData) => void;
  onDriverLocation?: (data: DriverLocationData) => void;
  onError?: (error: { message: string }) => void;
}

// ============================================================
// RIDE STATUS SOCKET HANDLER
// ============================================================

class RideStatusSocketHandler {
  private static instance: RideStatusSocketHandler;
  private isRegistered: boolean = false;
  private listeners: Map<string, Set<Function>> = new Map();

  // Handler references for cleanup
  private statusChangeHandler: ((data: any) => void) | null = null;
  private cancellationHandler: ((data: any) => void) | null = null;
  private driverLocationHandler: ((data: any) => void) | null = null;
  private errorHandler: ((data: any) => void) | null = null;

  private constructor() {}

  static getInstance(): RideStatusSocketHandler {
    if (!RideStatusSocketHandler.instance) {
      RideStatusSocketHandler.instance = new RideStatusSocketHandler();
    }
    return RideStatusSocketHandler.instance;
  }

  /**
   * Register socket listeners for ride status events
   */
  register(): void {
    if (this.isRegistered) {
      console.log('[RideStatusSocketHandler] Already registered');
      return;
    }

    console.log('[RideStatusSocketHandler] Registering ride status listeners...');

    // ============================================================
    // RIDE STATUS CHANGE
    // ============================================================
    this.statusChangeHandler = (data: RideStatusChangeData) => {
      console.log('[RideStatusSocketHandler] 🚦 Ride status change:', data);
      this.emitEvent(SOCKET_EVENTS.RIDE_STATUS_CHANGE, data);
    };

    // ============================================================
    // RIDE CANCELLATION
    // ============================================================
    this.cancellationHandler = (data: RideCancellationData) => {
      console.log('[RideStatusSocketHandler] ❌ Ride cancelled:', data);
      this.emitEvent('cancel-ride', data);
    };

    // ============================================================
    // DRIVER LOCATION (Legacy - kept for compatibility)
    // ============================================================
    this.driverLocationHandler = (data: DriverLocationData) => {
      console.log('[RideStatusSocketHandler] 📍 Driver location (legacy):', data);
      this.emitEvent('driver-location-updated', data);
    };

    // ============================================================
    // ERROR HANDLING
    // ============================================================
    this.errorHandler = (data: { message: string }) => {
      console.log('[RideStatusSocketHandler] ❌ Error:', data);
      this.emitEvent('ride-status-error', data);
    };

    // Register with socketService
    socketService.on(SOCKET_EVENTS.RIDE_STATUS_CHANGE, this.statusChangeHandler);
    socketService.on('cancel-ride', this.cancellationHandler);
    socketService.on('driver-location-updated', this.driverLocationHandler);
    socketService.on('ride-status-error', this.errorHandler);

    this.isRegistered = true;
    console.log('[RideStatusSocketHandler] ✅ Registered');
  }

  /**
   * Unregister socket listeners
   */
  unregister(): void {
    if (!this.isRegistered) {
      console.log('[RideStatusSocketHandler] Not registered');
      return;
    }

    console.log('[RideStatusSocketHandler] Unregistering...');

    if (this.statusChangeHandler) {
      socketService.off(SOCKET_EVENTS.RIDE_STATUS_CHANGE, this.statusChangeHandler);
      this.statusChangeHandler = null;
    }
    if (this.cancellationHandler) {
      socketService.off('cancel-ride', this.cancellationHandler);
      this.cancellationHandler = null;
    }
    if (this.driverLocationHandler) {
      socketService.off('driver-location-updated', this.driverLocationHandler);
      this.driverLocationHandler = null;
    }
    if (this.errorHandler) {
      socketService.off('ride-status-error', this.errorHandler);
      this.errorHandler = null;
    }

    this.listeners.clear();
    this.isRegistered = false;
    console.log('[RideStatusSocketHandler] ✅ Unregistered');
  }

  /**
   * Subscribe to ride status events
   */
  on<T = any>(event: string, callback: (data: T) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as Function);
  }

  /**
   * Unsubscribe from ride status events
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
   * Emit ride status change
   */
  emitStatusChange(data: { bookingId: string; status: string }): void {
    console.log('[RideStatusSocketHandler] 📤 Emitting status change:', data);
    socketService.emit(SOCKET_EVENTS.RIDE_STATUS_CHANGE, data);
  }

  /**
   * Emit ride cancellation
   */
  emitCancelRide(data: { bookingId: string; reason?: string }): void {
    console.log('[RideStatusSocketHandler] 📤 Emitting cancel ride:', data);
    socketService.emit('cancel-ride', data);
  }
}

// Singleton export
export const rideStatusSocketHandler = RideStatusSocketHandler.getInstance();