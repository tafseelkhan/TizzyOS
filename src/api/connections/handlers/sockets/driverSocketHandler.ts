// src/utils/socket/handlers/driverSocketHandler.ts

import { socketService } from '../../../../core/utils/socket/socketUtils';

// ============================================================
// TYPES
// ============================================================

export interface DriverRegisteredData {
  success: boolean;
  message: string;
  data: {
    userId: string;
    isOnline: boolean;
    isAvailable: boolean;
    socketId: string;
  };
}

export interface DriverStatusChangedData {
  userId: string;
  isOnline: boolean;
  isAvailable: boolean;
  timestamp: string;
}

export interface DriverErrorData {
  message: string;
}

export interface WelcomeData {
  message: string;
  userId: string;
}

export interface DriverCallbacks {
  onRegistered?: (data: DriverRegisteredData) => void;
  onStatusChanged?: (data: DriverStatusChangedData) => void;
  onError?: (data: DriverErrorData) => void;
  onWelcome?: (data: WelcomeData) => void;
}

// ============================================================
// DRIVER SOCKET HANDLER
// ============================================================

class DriverSocketHandler {
  private static instance: DriverSocketHandler;
  private isRegistered: boolean = false;
  private listeners: Map<string, Set<Function>> = new Map();

  // Handler references for cleanup
  private registeredHandler: ((data: any) => void) | null = null;
  private statusHandler: ((data: any) => void) | null = null;
  private errorHandler: ((data: any) => void) | null = null;
  private welcomeHandler: ((data: any) => void) | null = null;

  private constructor() {}

  static getInstance(): DriverSocketHandler {
    if (!DriverSocketHandler.instance) {
      DriverSocketHandler.instance = new DriverSocketHandler();
    }
    return DriverSocketHandler.instance;
  }

  /**
   * Register socket listeners for driver events
   */
  register(): void {
    if (this.isRegistered) {
      console.log('[DriverSocketHandler] Already registered');
      return;
    }

    console.log('[DriverSocketHandler] Registering driver socket listeners...');

    // ============================================================
    // DRIVER REGISTERED
    // ============================================================
    this.registeredHandler = (data: DriverRegisteredData) => {
      console.log('[DriverSocketHandler] ✅ Driver registered:', data);
      this.emitEvent('driver:registered', data);
    };

    // ============================================================
    // DRIVER STATUS CHANGED
    // ============================================================
    this.statusHandler = (data: DriverStatusChangedData) => {
      console.log('[DriverSocketHandler] 📊 Driver status changed:', data);
      this.emitEvent('driver:status-changed', data);
    };

    // ============================================================
    // DRIVER ERROR
    // ============================================================
    this.errorHandler = (data: DriverErrorData) => {
      console.error('[DriverSocketHandler] ❌ Driver error:', data);
      this.emitEvent('driver:error', data);
    };

    // ============================================================
    // WELCOME
    // ============================================================
    this.welcomeHandler = (data: WelcomeData) => {
      console.log('[DriverSocketHandler] 👋 Welcome:', data);
      this.emitEvent('welcome', data);
    };

    // Register with socketService
    socketService.on('driver:registered', this.registeredHandler);
    socketService.on('driver:status-changed', this.statusHandler);
    socketService.on('driver:error', this.errorHandler);
    socketService.on('welcome', this.welcomeHandler);

    this.isRegistered = true;
    console.log('[DriverSocketHandler] ✅ Registered');
  }

  /**
   * Unregister socket listeners
   */
  unregister(): void {
    if (!this.isRegistered) {
      console.log('[DriverSocketHandler] Not registered');
      return;
    }

    console.log('[DriverSocketHandler] Unregistering...');

    if (this.registeredHandler) {
      socketService.off('driver:registered', this.registeredHandler);
      this.registeredHandler = null;
    }
    if (this.statusHandler) {
      socketService.off('driver:status-changed', this.statusHandler);
      this.statusHandler = null;
    }
    if (this.errorHandler) {
      socketService.off('driver:error', this.errorHandler);
      this.errorHandler = null;
    }
    if (this.welcomeHandler) {
      socketService.off('welcome', this.welcomeHandler);
      this.welcomeHandler = null;
    }

    this.listeners.clear();
    this.isRegistered = false;
    console.log('[DriverSocketHandler] ✅ Unregistered');
  }

  /**
   * Subscribe to driver events
   */
  on<T = any>(event: string, callback: (data: T) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as Function);
  }

  /**
   * Unsubscribe from driver events
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
   * Emit driver registration
   */
  emitRegister(data: { userId: string }): void {
    console.log('[DriverSocketHandler] 📤 Emitting driver:register:', data);
    socketService.emit('driver:register', data);
  }
}

// Singleton export
export const driverSocketHandler = DriverSocketHandler.getInstance();