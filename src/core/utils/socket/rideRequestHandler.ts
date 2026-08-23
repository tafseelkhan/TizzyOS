// src/core/utils/socket/rideRequestHandler.ts

import { rideRequestSocketHandler } from '../../../api/connections/handlers/sockets/rideRequestSocketHandler';
import { RideRequest } from '../../types/RideTypes';

export type RideRequestCallback = (request: RideRequest) => void;

/**
 * RideRequestHandler - Domain-specific handler for ride requests
 * 
 * ✅ NOW USING HANDLERS instead of direct socketService
 */
class RideRequestHandler {
  private static instance: RideRequestHandler;
  private subscribers: Set<RideRequestCallback> = new Set();
  private isListening: boolean = false;
  private currentRequest: RideRequest | null = null;

  // Cleanup refs
  private newRideUnsubscribe: (() => void) | null = null;

  private constructor() {
    console.log('[RideRequestHandler] 🏗️ Constructor called');
  }

  static getInstance(): RideRequestHandler {
    if (!RideRequestHandler.instance) {
      console.log('[RideRequestHandler] 🆕 Creating new instance');
      RideRequestHandler.instance = new RideRequestHandler();
    }
    return RideRequestHandler.instance;
  }

  /**
   * Start listening - USING HANDLERS
   */
  startListening(): void {
    if (this.isListening) {
      console.log('[RideRequestHandler] ⚠️ Already listening');
      return;
    }

    console.log('[RideRequestHandler] 🔥 STARTING to listen via handlers');

    // ✅ Use rideRequestSocketHandler for new ride requests
    rideRequestSocketHandler.on(
      'new-ride-request',
      this.handleNewRideRequest
    );
    this.newRideUnsubscribe = null;

    this.isListening = true;
    console.log('[RideRequestHandler] ✅ Listening started');
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (!this.isListening) return;

    console.log('[RideRequestHandler] 🛑 Stopping');

    if (this.newRideUnsubscribe) {
      this.newRideUnsubscribe();
      this.newRideUnsubscribe = null;
    }

    this.isListening = false;
    this.subscribers.clear();
    this.currentRequest = null;
  }

  /**
   * Subscribe to ride requests
   */
  subscribe(callback: RideRequestCallback): () => void {
    console.log('[RideRequestHandler] 📝 Subscriber added');
    this.subscribers.add(callback);

    // If there's a pending request, send it
    if (this.currentRequest) {
      try {
        callback(this.currentRequest);
      } catch (error) {
        console.error('[RideRequestHandler] ❌ Subscriber error:', error);
      }
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Accept ride (local state only)
   */
  acceptRide(requestId: string): void {
    console.log('[RideRequestHandler] ✅ Accept (local):', requestId);
    this.currentRequest = null;
    this.notifySubscribers();
  }

  /**
   * Reject ride (local state only)
   */
  rejectRide(requestId: string): void {
    console.log('[RideRequestHandler] ❌ Reject (local):', requestId);
    this.currentRequest = null;
    this.notifySubscribers();
  }

  /**
   * Notify subscribers
   */
  private notifySubscribers(): void {
    if (!this.currentRequest) {
      console.log('[RideRequestHandler] ⚠️ No current request');
      return;
    }

    this.subscribers.forEach(callback => {
      try {
        callback(this.currentRequest!);
      } catch (error) {
        console.error('[RideRequestHandler] ❌ Subscriber error:', error);
      }
    });
  }

  /**
   * Handle new ride request
   */
  private handleNewRideRequest = (data: any): void => {
    console.log('[RideRequestHandler] 🔥 NEW REQUEST:', data?.requestId);

    const request = this.parseRideRequest(data);
    if (!request) {
      console.warn('[RideRequestHandler] ❌ Invalid request');
      return;
    }

    this.currentRequest = request;

    console.log(`[RideRequestHandler] 📢 Notifying ${this.subscribers.size} subscribers`);

    this.subscribers.forEach(callback => {
      try {
        callback(request);
      } catch (error) {
        console.error('[RideRequestHandler] ❌ Subscriber error:', error);
      }
    });
  };

  /**
   * Parse ride request
   */
  private parseRideRequest(data: any): RideRequest | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const requestId = data.requestId || data._id || data.id;
    const bookingId = data.bookingId || data.booking?.bookingId;

    if (!requestId || !bookingId) {
      console.warn('[RideRequestHandler] ❌ Missing IDs');
      return null;
    }

    const pickup = data.pickup || {};
    const destination = data.destination || {};
    const customerData = data.customer || {};
    const bookingData = data.booking || {};

    return {
      requestId,
      customer: {
        customerId: customerData.customerId || '',
        name: customerData.name || 'Customer',
        profilePicture: customerData.profilePicture,
      },
      booking: {
        bookingId,
        rideCode: bookingData.rideCode || data.rideCode || '',
        serviceType: bookingData.serviceType || data.serviceType || 'STANDARD',
        quoteId: bookingData.quoteId || data.quoteId || '',
        fwsAirportRideId: bookingData.fwsAirportRideId || data.fwsAirportRideId || '',
      },
      fare: data.fare || data.totalFare || 0,
      distance: data.distance || 0,
      pickup: {
        address: pickup.address || 'Loading...',
        latitude: pickup.latitude || 0,
        longitude: pickup.longitude || 0,
      },
      destination: {
        address: destination.address || 'Loading...',
        latitude: destination.latitude || 0,
        longitude: destination.longitude || 0,
      },
      expiresAt: data.expiresAt || new Date(Date.now() + 30000).toISOString(),
      isRetry: data.isRetry || false,
      batchNumber: data.batchNumber || '',
    };
  }

  getCurrentRequest(): RideRequest | null {
    return this.currentRequest;
  }

  clearCurrentRequest(): void {
    console.log('[RideRequestHandler] 🧹 Clearing current');
    this.currentRequest = null;
  }

  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

export const rideRequestHandler = RideRequestHandler.getInstance();