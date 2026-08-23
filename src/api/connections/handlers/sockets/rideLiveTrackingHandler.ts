// src/utils/socket/handlers/rideLiveTrackingHandler.ts

import { socketService } from '../../../../core/utils/socket/socketUtils';

// ============================================================
// TYPES
// ============================================================

export interface DriverLocationUpdate {
  driverId: string;
  rideId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  timestamp: string;
  accuracy?: number;
  bearing?: number;
  altitude?: number;
  fromCache?: boolean;
}

export interface TrackingSuccessData {
  bookingId: string;
  trackingId: string;
  rideCode: string;
  status: string;
  pickup: {
    latitude: number;
    longitude: number;
    address: string;
    googlePlaceId?: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
    googlePlaceId?: string;
  };
  driver: {
    userId: string;
    driverCode?: string;
    location: {
      latitude: number;
      longitude: number;
    } | null;
    heading?: number;
    speed?: number;
    accuracy?: number;
    bearing?: number;
    altitude?: number;
    provider?: string;
    batteryLevel?: number;
    networkType?: string;
    isMockLocation?: boolean;
    locationUpdatedAt?: string;
    isTrackingOn: boolean;
    cachedLocation?: {
      latitude: number;
      longitude: number;
      heading: number;
      speed: number;
      timestamp: string;
    } | null;
  };
  customer: {
    userId: string;
    location: {
      latitude: number;
      longitude: number;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      pinCode?: string;
      landmark?: string;
    } | null;
  };
}

export interface DriverLiveStartData {
  success: boolean;
  message: string;
  rideId: string;
}

export interface DriverLiveAckData {
  success: boolean;
  timestamp: string;
}

export interface DriverLiveStoppedData {
  driverId?: string;
  rideId?: string;
  message: string;
  timestamp: string;
  isDisconnect?: boolean;
  isTimeout?: boolean;
  success?: boolean;
}

export interface TrackingErrorData {
  message: string;
}

export interface TrackingCallbacks {
  onLocationUpdate?: (data: DriverLocationUpdate) => void;
  onTrackingSuccess?: (data: TrackingSuccessData) => void;
  onDriverStarted?: (data: DriverLiveStartData) => void;
  onDriverAck?: (data: DriverLiveAckData) => void;
  onDriverStopped?: (data: DriverLiveStoppedData) => void;
  onError?: (error: TrackingErrorData) => void;
}

// ============================================================
// RIDE LIVE TRACKING HANDLER
// ============================================================

class RideLiveTrackingHandler {
  private static instance: RideLiveTrackingHandler;
  private isRegistered: boolean = false;
  private activeSubscriptions: Map<string, Set<string>> = new Map(); // trackingId -> Set of callback IDs
  private callbackRegistry: Map<string, TrackingCallbacks> = new Map();
  private callbackIdCounter: number = 0;

  // Handler references for cleanup
  private locationHandler: ((data: any) => void) | null = null;
  private successHandler: ((data: any) => void) | null = null;
  private driverStartedHandler: ((data: any) => void) | null = null;
  private driverAckHandler: ((data: any) => void) | null = null;
  private driverStoppedHandler: ((data: any) => void) | null = null;
  private errorHandler: ((data: any) => void) | null = null;

  private constructor() {}

  static getInstance(): RideLiveTrackingHandler {
    if (!RideLiveTrackingHandler.instance) {
      RideLiveTrackingHandler.instance = new RideLiveTrackingHandler();
    }
    return RideLiveTrackingHandler.instance;
  }

  /**
   * Register socket listeners for live tracking events
   */
  register(): void {
    if (this.isRegistered) {
      console.log('[RideLiveTrackingHandler] Already registered');
      return;
    }

    console.log('[RideLiveTrackingHandler] Registering live tracking listeners...');

    // ============================================================
    // DRIVER LIVE LOCATION UPDATES
    // ============================================================
    this.locationHandler = (data: DriverLocationUpdate) => {
      console.log('[RideLiveTrackingHandler] 📍 Driver location update:', data);
      
      const rideId = data.rideId || data.rideId;
      if (rideId) {
        const callbackIds = this.activeSubscriptions.get(rideId);
        if (callbackIds) {
          callbackIds.forEach((callbackId) => {
            const callbacks = this.callbackRegistry.get(callbackId);
            if (callbacks?.onLocationUpdate) {
              callbacks.onLocationUpdate(data);
            }
          });
        }
      }
    };

    // ============================================================
    // CUSTOMER TRACKING SUCCESS
    // ============================================================
    this.successHandler = (data: TrackingSuccessData) => {
      console.log('[RideLiveTrackingHandler] ✅ Tracking success:', data);
      
      const trackingId = data.trackingId || data.bookingId;
      if (trackingId) {
        const callbackIds = this.activeSubscriptions.get(trackingId);
        if (callbackIds) {
          callbackIds.forEach((callbackId) => {
            const callbacks = this.callbackRegistry.get(callbackId);
            if (callbacks?.onTrackingSuccess) {
              callbacks.onTrackingSuccess(data);
            }
          });
        }
      }
    };

    // ============================================================
    // DRIVER LIVE STARTED
    // ============================================================
    this.driverStartedHandler = (data: DriverLiveStartData) => {
      console.log('[RideLiveTrackingHandler] 🚗 Driver started:', data);
      this.broadcastToAll('onDriverStarted', data);
    };

    // ============================================================
    // DRIVER LIVE ACK
    // ============================================================
    this.driverAckHandler = (data: DriverLiveAckData) => {
      console.log('[RideLiveTrackingHandler] ✅ Driver ack:', data);
      this.broadcastToAll('onDriverAck', data);
    };

    // ============================================================
    // DRIVER LIVE STOPPED
    // ============================================================
    this.driverStoppedHandler = (data: DriverLiveStoppedData) => {
      console.log('[RideLiveTrackingHandler] ⏹️ Driver stopped:', data);
      this.broadcastToAll('onDriverStopped', data);
    };

    // ============================================================
    // ERROR HANDLING
    // ============================================================
    this.errorHandler = (data: TrackingErrorData) => {
      console.log('[RideLiveTrackingHandler] ❌ Error:', data);
      this.broadcastToAll('onError', data);
    };

    // Register with socketService
    socketService.on('driver:live:location', this.locationHandler);
    socketService.on('customer:track:success', this.successHandler);
    socketService.on('driver:live:started', this.driverStartedHandler);
    socketService.on('driver:live:ack', this.driverAckHandler);
    socketService.on('driver:live:stopped', this.driverStoppedHandler);
    socketService.on('customer:track:error', this.errorHandler);
    socketService.on('driver:live:error', this.errorHandler);

    this.isRegistered = true;
    console.log('[RideLiveTrackingHandler] ✅ Registered successfully');
  }

  /**
   * Unregister socket listeners
   */
  unregister(): void {
    if (!this.isRegistered) {
      console.log('[RideLiveTrackingHandler] Not registered');
      return;
    }

    console.log('[RideLiveTrackingHandler] Unregistering...');

    if (this.locationHandler) {
      socketService.off('driver:live:location', this.locationHandler);
      this.locationHandler = null;
    }
    if (this.successHandler) {
      socketService.off('customer:track:success', this.successHandler);
      this.successHandler = null;
    }
    if (this.driverStartedHandler) {
      socketService.off('driver:live:started', this.driverStartedHandler);
      this.driverStartedHandler = null;
    }
    if (this.driverAckHandler) {
      socketService.off('driver:live:ack', this.driverAckHandler);
      this.driverAckHandler = null;
    }
    if (this.driverStoppedHandler) {
      socketService.off('driver:live:stopped', this.driverStoppedHandler);
      this.driverStoppedHandler = null;
    }
    if (this.errorHandler) {
      socketService.off('customer:track:error', this.errorHandler);
      socketService.off('driver:live:error', this.errorHandler);
      this.errorHandler = null;
    }

    this.activeSubscriptions.clear();
    this.callbackRegistry.clear();
    this.isRegistered = false;
    console.log('[RideLiveTrackingHandler] ✅ Unregistered');
  }

  /**
   * Broadcast to all subscribers
   */
  private broadcastToAll(callbackName: keyof TrackingCallbacks, data: any): void {
    this.callbackRegistry.forEach((callbacks) => {
      const callback = callbacks[callbackName];
      if (callback) {
        callback(data);
      }
    });
  }

  /**
   * Subscribe to live tracking updates
   */
  subscribe(
    trackingId: string,
    bookingId: string,
    callbacks: TrackingCallbacks
  ): () => void {
    console.log(`[RideLiveTrackingHandler] 📡 Subscribing to tracking: ${trackingId}`);

    const callbackId = `cb_${++this.callbackIdCounter}_${trackingId}`;
    this.callbackRegistry.set(callbackId, callbacks);

    // Add to active subscriptions
    if (!this.activeSubscriptions.has(trackingId)) {
      this.activeSubscriptions.set(trackingId, new Set());
    }
    this.activeSubscriptions.get(trackingId)?.add(callbackId);

    if (bookingId && bookingId !== trackingId) {
      if (!this.activeSubscriptions.has(bookingId)) {
        this.activeSubscriptions.set(bookingId, new Set());
      }
      this.activeSubscriptions.get(bookingId)?.add(callbackId);
    }

    // Emit customer:track:start
    socketService.emit('customer:track:start', {
      bookingId: bookingId,
      trackingId: trackingId,
    });

    console.log(`[RideLiveTrackingHandler] ✅ Subscribed with ID: ${callbackId}`);

    return () => {
      this.unsubscribe(callbackId, trackingId, bookingId);
    };
  }

  /**
   * Unsubscribe from live tracking
   */
  private unsubscribe(callbackId: string, trackingId: string, bookingId: string): void {
    console.log(`[RideLiveTrackingHandler] 📡 Unsubscribing: ${callbackId}`);

    const trackingSubs = this.activeSubscriptions.get(trackingId);
    if (trackingSubs) {
      trackingSubs.delete(callbackId);
      if (trackingSubs.size === 0) {
        this.activeSubscriptions.delete(trackingId);
      }
    }

    if (bookingId && bookingId !== trackingId) {
      const bookingSubs = this.activeSubscriptions.get(bookingId);
      if (bookingSubs) {
        bookingSubs.delete(callbackId);
        if (bookingSubs.size === 0) {
          this.activeSubscriptions.delete(bookingId);
        }
      }
    }

    this.callbackRegistry.delete(callbackId);

    if (this.activeSubscriptions.size === 0) {
      socketService.emit('customer:track:stop', {
        bookingId: bookingId,
      });
    }

    console.log(`[RideLiveTrackingHandler] ✅ Unsubscribed: ${callbackId}`);
  }

  /**
   * Emit driver location update
   */
  emitDriverLocation(data: {
    driverId: string;
    rideId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
  }): void {
    console.log('[RideLiveTrackingHandler] 📤 Emitting driver location:', data);
    socketService.emit('driver:live:update', data);
  }

  /**
   * Emit driver start tracking
   */
  emitDriverStart(data: {
    driverId: string;
    rideId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  }): void {
    console.log('[RideLiveTrackingHandler] 📤 Emitting driver start:', data);
    socketService.emit('driver:live:start', data);
  }

  /**
   * Emit driver stop tracking
   */
  emitDriverStop(data: {
    driverId: string;
    rideId: string;
  }): void {
    console.log('[RideLiveTrackingHandler] 📤 Emitting driver stop:', data);
    socketService.emit('driver:live:stop', {
      driverId: data.driverId,
      rideId: data.rideId,
    });
  }

  isRegisteredHandler(): boolean {
    return this.isRegistered;
  }

  getSubscriptionCount(): number {
    return this.activeSubscriptions.size;
  }
}

// Singleton export
export const rideLiveTrackingHandler = RideLiveTrackingHandler.getInstance();