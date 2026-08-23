// src/services/socket/TripSocketHandler.ts

import { rideStatusSocketHandler } from '../../../api/connections/handlers/sockets/rideStatusSocketHandler';

export type TripStatusCallback = (data: any) => void;
export type TripCallback = (data: any) => void;

/**
 * TripSocketHandler - Domain-specific handler for active trip events
 * 
 * ✅ NOW USING HANDLERS instead of direct socketService
 */
class TripSocketHandler {
  private static instance: TripSocketHandler;
  private statusListeners: Set<TripStatusCallback> = new Set();
  private cancelListeners: Set<TripCallback> = new Set();
  private isListening: boolean = false;

  // Cleanup refs
  private statusUnsubscribe: (() => void) | null = null;
  private cancelUnsubscribe: (() => void) | null = null;

  private constructor() {}

  static getInstance(): TripSocketHandler {
    if (!TripSocketHandler.instance) {
      TripSocketHandler.instance = new TripSocketHandler();
    }
    return TripSocketHandler.instance;
  }

  /**
   * Start listening for trip events - USING HANDLERS
   */
  startListening(): void {
    if (this.isListening) {
      console.log('[TripSocketHandler] Already listening');
      return;
    }

    console.log('[TripSocketHandler] Starting to listen for trip events via handlers');

    // ✅ Use rideStatusSocketHandler for status changes
    rideStatusSocketHandler.on(
      'ride-status-change',
      this.handleStatusChange
    );

    // ✅ Use rideStatusSocketHandler for cancellations
    rideStatusSocketHandler.on(
      'cancel-ride',
      this.handleCancelRide
    );

    this.isListening = true;
  }

  /**
   * Stop listening for trip events
   */
  stopListening(): void {
    if (!this.isListening) {
      console.log('[TripSocketHandler] Not listening');
      return;
    }

    console.log('[TripSocketHandler] Stopping trip event listening');

    // ✅ Cleanup via handlers
    if (this.statusUnsubscribe) {
      this.statusUnsubscribe();
      this.statusUnsubscribe = null;
    }
    if (this.cancelUnsubscribe) {
      this.cancelUnsubscribe();
      this.cancelUnsubscribe = null;
    }

    this.isListening = false;
    this.statusListeners.clear();
    this.cancelListeners.clear();
  }

  /**
   * Subscribe to ride status changes
   * @returns Unsubscribe function
   */
  subscribeToStatusChanges(callback: TripStatusCallback): () => void {
    console.log('[TripSocketHandler] New status subscriber added');
    this.statusListeners.add(callback);

    return () => {
      console.log('[TripSocketHandler] Status subscriber removed');
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Subscribe to ride cancellations
   * @returns Unsubscribe function
   */
  subscribeToCancellations(callback: TripCallback): () => void {
    console.log('[TripSocketHandler] New cancel subscriber added');
    this.cancelListeners.add(callback);

    return () => {
      console.log('[TripSocketHandler] Cancel subscriber removed');
      this.cancelListeners.delete(callback);
    };
  }

  /**
   * Emit a ride status change - USING HANDLERS
   */
  emitStatusChange(data: { bookingId: string; status: string }): void {
    console.log('[TripSocketHandler] Emitting status change:', data);
    rideStatusSocketHandler.emitStatusChange(data);
  }

  /**
   * Emit a ride cancellation - USING HANDLERS
   */
  emitCancelRide(data: { bookingId: string }): void {
    console.log('[TripSocketHandler] Emitting cancel ride:', data);
    rideStatusSocketHandler.emitCancelRide(data);
  }

  /**
   * Handle incoming status change events
   */
  private handleStatusChange = (data: any): void => {
    console.log('[TripSocketHandler] Status change received:', data);
    this.statusListeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[TripSocketHandler] Error in status callback:', error);
      }
    });
  };

  /**
   * Handle incoming cancellation events
   */
  private handleCancelRide = (data: any): void => {
    console.log('[TripSocketHandler] Cancel ride received:', data);
    this.cancelListeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[TripSocketHandler] Error in cancel callback:', error);
      }
    });
  };

  /**
   * Check if there are any status listeners
   */
  hasStatusSubscribers(): boolean {
    return this.statusListeners.size > 0;
  }

  /**
   * Check if there are any cancel listeners
   */
  hasCancelSubscribers(): boolean {
    return this.cancelListeners.size > 0;
  }
}

// Singleton export
export const tripSocketHandler = TripSocketHandler.getInstance();