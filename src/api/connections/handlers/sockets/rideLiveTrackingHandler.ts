// src/utils/socket/handlers/rideLiveTrackingHandler.ts

import { socketService } from '../../../../core/utils/socket/socketUtils';

// ============================================================
// TYPES
// ============================================================

export interface DriverLocationUpdate {
  driverId: string;
  quoteId: string;
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
  quoteId?: string;
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
  quoteId: string;
}

export interface DriverLiveAckData {
  success: boolean;
  timestamp: string;
}

export interface DriverLiveStoppedData {
  driverId?: string;
  quoteId?: string;
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
  private activeSubscriptions: Map<string, Set<string>> = new Map();
  private callbackRegistry: Map<string, TrackingCallbacks> = new Map();
  private callbackIdCounter: number = 0;

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

  register(): void {
    if (this.isRegistered) {
      console.log('[RideLiveTrackingHandler] Already registered');
      return;
    }

    console.log(
      '[RideLiveTrackingHandler] Registering live tracking listeners...',
    );

    this.locationHandler = (data: DriverLocationUpdate) => {
      console.log(
        '[RideLiveTrackingHandler] ========================================',
      );
      console.log(
        '[RideLiveTrackingHandler] 📡 EVENT: driver:live:location RECEIVED!',
      );
      console.log('[RideLiveTrackingHandler] 📦 driverId:', data.driverId);
      console.log('[RideLiveTrackingHandler] 🔑 quoteId:', data.quoteId);
      console.log('[RideLiveTrackingHandler] 📍 latitude:', data.latitude);
      console.log('[RideLiveTrackingHandler] 📍 longitude:', data.longitude);
      console.log(
        '[RideLiveTrackingHandler] ========================================',
      );

      const quoteId = data.quoteId;

      if (quoteId) {
        const callbackIds = this.activeSubscriptions.get(quoteId);
        if (callbackIds) {
          callbackIds.forEach(callbackId => {
            const callbacks = this.callbackRegistry.get(callbackId);
            if (callbacks?.onLocationUpdate) {
              callbacks.onLocationUpdate(data);
            }
          });
        }
      }
    };

    // ✅ FIXED: Handle both nested and flat payload
    this.successHandler = (data: any) => {
      console.log(
        '[RideLiveTrackingHandler] ========================================',
      );
      console.log(
        '[RideLiveTrackingHandler] 📡 EVENT: customer:track:success RECEIVED!',
      );

      // ✅ Support both old (nested) and new (flat) payload
      let parsedData = data;
      if (data?.data) {
        parsedData = data.data;
      }

      console.log(
        '[RideLiveTrackingHandler] 📦 bookingId:',
        parsedData.bookingId,
      );
      console.log(
        '[RideLiveTrackingHandler] 📦 trackingId:',
        parsedData.trackingId,
      );
      console.log('[RideLiveTrackingHandler] 🔑 quoteId:', parsedData.quoteId);
      console.log(
        '[RideLiveTrackingHandler] ========================================',
      );

      const trackingId = parsedData.trackingId || parsedData.bookingId;
      if (trackingId) {
        const callbackIds = this.activeSubscriptions.get(trackingId);
        if (callbackIds) {
          callbackIds.forEach(callbackId => {
            const callbacks = this.callbackRegistry.get(callbackId);
            if (callbacks?.onTrackingSuccess) {
              callbacks.onTrackingSuccess(parsedData);
            }
          });
        }
      }
    };

    this.driverStartedHandler = (data: DriverLiveStartData) => {
      console.log(
        '[RideLiveTrackingHandler] 📡 EVENT: driver:live:started RECEIVED!',
      );
      this.broadcastToAll('onDriverStarted', data);
    };

    this.driverAckHandler = (data: DriverLiveAckData) => {
      console.log(
        '[RideLiveTrackingHandler] 📡 EVENT: driver:live:ack RECEIVED!',
      );
      this.broadcastToAll('onDriverAck', data);
    };

    this.driverStoppedHandler = (data: DriverLiveStoppedData) => {
      console.log(
        '[RideLiveTrackingHandler] 📡 EVENT: driver:live:stopped RECEIVED!',
      );
      this.broadcastToAll('onDriverStopped', data);
    };

    this.errorHandler = (data: TrackingErrorData) => {
      console.log('[RideLiveTrackingHandler] 📡 EVENT: error RECEIVED!', data);
      this.broadcastToAll('onError', data);
    };

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

  private broadcastToAll(
    callbackName: keyof TrackingCallbacks,
    data: any,
  ): void {
    this.callbackRegistry.forEach(callbacks => {
      const callback = callbacks[callbackName];
      if (callback) {
        callback(data);
      }
    });
  }

  subscribe(
    trackingId: string,
    bookingId: string,
    quoteId: string,
    callbacks: TrackingCallbacks,
  ): () => void {
    console.log(
      `[RideLiveTrackingHandler] ========================================`,
    );
    console.log(`[RideLiveTrackingHandler] 📡 SUBSCRIBING TO TRACKING`);
    console.log(`[RideLiveTrackingHandler] 📦 trackingId: ${trackingId}`);
    console.log(`[RideLiveTrackingHandler] 📦 bookingId: ${bookingId}`);
    console.log(`[RideLiveTrackingHandler] 🔑 quoteId: ${quoteId}`);
    console.log(
      `[RideLiveTrackingHandler] ========================================`,
    );

    const callbackId = `cb_${++this.callbackIdCounter}_${trackingId}`;
    this.callbackRegistry.set(callbackId, callbacks);

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

    // ✅ EMIT customer:track:start with all 3 IDs
    console.log(`[RideLiveTrackingHandler] 📤 EMITTING: customer:track:start`);
    console.log(`[RideLiveTrackingHandler] 📦 bookingId: ${bookingId}`);
    console.log(`[RideLiveTrackingHandler] 📦 trackingId: ${trackingId}`);
    console.log(`[RideLiveTrackingHandler] 🔑 quoteId: ${quoteId}`);

    socketService.emit('customer:track:start', {
      bookingId: bookingId,
      trackingId: trackingId,
      quoteId: quoteId,
    });

    console.log(
      `[RideLiveTrackingHandler] ✅ Subscribed with ID: ${callbackId}`,
    );

    return () => {
      this.unsubscribe(callbackId, trackingId, bookingId);
    };
  }

  private unsubscribe(
    callbackId: string,
    trackingId: string,
    bookingId: string,
  ): void {
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

  emitDriverLocation(data: {
    driverId: string;
    quoteId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
  }): void {
    console.log(
      '[RideLiveTrackingHandler] ========================================',
    );
    console.log('[RideLiveTrackingHandler] 📤 EMITTING: driver:live:update');
    console.log('[RideLiveTrackingHandler] 📦 driverId:', data.driverId);
    console.log('[RideLiveTrackingHandler] 🔑 quoteId:', data.quoteId);
    console.log('[RideLiveTrackingHandler] 📍 latitude:', data.latitude);
    console.log('[RideLiveTrackingHandler] 📍 longitude:', data.longitude);
    console.log(
      '[RideLiveTrackingHandler] ========================================',
    );

    socketService.emit('driver:live:update', data);
  }

  emitDriverStart(data: {
    driverId: string;
    quoteId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  }): void {
    console.log('[RideLiveTrackingHandler] 📤 EMITTING: driver:live:start');
    console.log('[RideLiveTrackingHandler] 📦 driverId:', data.driverId);
    console.log('[RideLiveTrackingHandler] 🔑 quoteId:', data.quoteId);
    socketService.emit('driver:live:start', data);
  }

  emitDriverStop(data: { driverId: string; quoteId: string }): void {
    console.log('[RideLiveTrackingHandler] 📤 EMITTING: driver:live:stop');
    console.log('[RideLiveTrackingHandler] 📦 driverId:', data.driverId);
    console.log('[RideLiveTrackingHandler] 🔑 quoteId:', data.quoteId);
    socketService.emit('driver:live:stop', {
      driverId: data.driverId,
      quoteId: data.quoteId,
    });
  }

  isRegisteredHandler(): boolean {
    return this.isRegistered;
  }

  getSubscriptionCount(): number {
    return this.activeSubscriptions.size;
  }
}

export const rideLiveTrackingHandler = RideLiveTrackingHandler.getInstance();
