// src/utils/socket/socketUtils.ts

import io, { Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { API_BASE_URL } from '../../../api/connections/snippet/apiBaseUrl';
import { getToken } from '../../../api/connections/token/tokenSlice';
import {
  CONFIG,
  SOCKET_EVENTS,
} from '../../../api/constants/rideRequestConfig';

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = CONFIG.SOCKET_RECONNECTION_ATTEMPTS;
  private isAuthenticated = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private connectionPromise: Promise<string | null> | null = null;
  private connectionResolve: ((value: string | null) => void) | null = null;
  private connectionReject: ((reason: Error) => void) | null = null;
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private processedRequests: Set<string> = new Set();
  private isProcessing: boolean = false;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  async connect(): Promise<void> {
    console.log('🔌 [SocketService] ========================================');
    console.log('🔌 [SocketService] connect() called');

    if (this.socket?.connected) {
      console.log(
        '🔌 [SocketService] ✅ Socket already connected with ID:',
        this.socket.id,
      );
      return;
    }

    if (this.socket && !this.socket.connected) {
      console.log(
        '🔌 [SocketService] 🔄 Socket exists but disconnected, reconnecting...',
      );
      this.socket.connect();
      return;
    }

    console.log('🔌 [SocketService] 🆕 Creating new socket connection...');

    try {
      const token = await getToken();
      if (!token) {
        console.warn('⚠️ [SocketService] No token found');
        return;
      }

      const options: Partial<ManagerOptions & SocketOptions> = {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: CONFIG.SOCKET_RECONNECTION_DELAY,
        timeout: CONFIG.SOCKET_TIMEOUT,
        auth: { token },
        autoConnect: false,
      };

      this.socket = io(API_BASE_URL, options);
      this.setupListeners();
      this.socket.connect();
    } catch (error) {
      console.error('❌ [SocketService] Connection failed:', error);
      throw error;
    }
  }

  waitForConnection(
    timeout: number = CONFIG.SOCKET_TIMEOUT,
  ): Promise<string | null> {
    console.log(
      '⏳ [SocketService] waitForConnection() called, timeout:',
      timeout,
    );

    if (this.socket?.connected && this.socket.id) {
      console.log('✅ [SocketService] Already connected, ID:', this.socket.id);
      return Promise.resolve(this.socket.id);
    }

    if (this.connectionPromise) {
      console.log('⏳ [SocketService] Already waiting for connection...');
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionResolve = resolve;
      this.connectionReject = reject;

      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
      }

      this.connectionTimeoutId = setTimeout(() => {
        console.error('⏰ [SocketService] Connection timeout!');
        const error = new Error('Connection timeout');
        if (this.connectionReject) {
          this.connectionReject(error);
        }
        this.connectionPromise = null;
        this.connectionResolve = null;
        this.connectionReject = null;
        this.connectionTimeoutId = null;
        resolve(null);
      }, timeout);
    });

    if (this.socket && !this.socket.connected) {
      console.log(
        '🔄 [SocketService] Socket exists but not connected, triggering connect...',
      );
      this.socket.connect();
    } else if (!this.socket) {
      console.log(
        '🆕 [SocketService] Socket is null, creating new connection...',
      );
      this.connect().catch(err => {
        console.error('❌ [SocketService] Connection failed:', err);
        if (this.connectionReject) {
          this.connectionReject(err);
        }
      });
    }

    return this.connectionPromise;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
        console.log('💓 [SocketService] Heartbeat sent');
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private setupListeners(): void {
    if (!this.socket) return;

    console.log('📡 [SocketService] Setting up event listeners...');

    this.socket.on('connect', () => {
      console.log('✅ [SocketService] SOCKET CONNECTED!');
      console.log('📡 [SocketService] Socket ID:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();

      if (this.connectionResolve) {
        console.log('✅ [SocketService] Resolving connection promise...');
        this.connectionResolve(this.socket?.id || null);
        this.connectionPromise = null;
        this.connectionResolve = null;
        this.connectionReject = null;
        if (this.connectionTimeoutId) {
          clearTimeout(this.connectionTimeoutId);
          this.connectionTimeoutId = null;
        }
      }

      this.registerDriver();
      this.authenticate();
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('❌ [SocketService] SOCKET DISCONNECTED:', reason);
      this.isConnected = false;
      this.isAuthenticated = false;
      this.stopHeartbeat();
    });

    this.socket.on('reconnect', (attempt: number) => {
      console.log('🔄 [SocketService] RECONNECTED:', attempt);
      this.isConnected = true;
      this.startHeartbeat();
      this.registerDriver();
      this.authenticate();
    });

    this.socket.on('reconnect_attempt', (attempt: number) => {
      this.reconnectAttempts = attempt;
      console.log('🔄 [SocketService] Reconnect attempt:', attempt);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ [SocketService] RECONNECT FAILED');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ [SocketService] Connection error:', error.message);
      this.isConnected = false;

      if (this.connectionReject) {
        this.connectionReject(error);
        this.connectionPromise = null;
        this.connectionResolve = null;
        this.connectionReject = null;
        if (this.connectionTimeoutId) {
          clearTimeout(this.connectionTimeoutId);
          this.connectionTimeoutId = null;
        }
      }
    });

    // DRIVER STATUS EVENTS
    this.socket.on('driver:registered', (data: any) => {
      console.log('✅ [SocketService] DRIVER:REGISTERED:', data);
      this.emitEvent('driver:registered', data);
    });

    this.socket.on('driver:status-changed', (data: any) => {
      console.log('📊 [SocketService] DRIVER:STATUS-CHANGED:', data);
      this.emitEvent('driver:status-changed', data);
    });

    this.socket.on('driver:error', (data: any) => {
      console.error('❌ [SocketService] DRIVER:ERROR:', data);
      this.emitEvent('driver:error', data);
    });

    this.socket.on('welcome', (data: any) => {
      console.log('👋 [SocketService] Welcome:', data);
      this.emitEvent('welcome', data);
    });

    // RIDE REQUEST EVENTS
    this.socket.on(SOCKET_EVENTS.NEW_RIDE_REQUEST, (data: any) => {
      console.log('🚗 [SocketService] NEW RIDE REQUEST RECEIVED');
      console.log('📡 [SocketService] Data:', JSON.stringify(data, null, 2));
      this.emitEvent(SOCKET_EVENTS.NEW_RIDE_REQUEST, data);
    });

    this.socket.on(SOCKET_EVENTS.RIDE_ACCEPTED, (data: any) => {
      console.log('✅ [SocketService] RIDE ACCEPTED');
      this.emitEvent(SOCKET_EVENTS.RIDE_ACCEPTED, data);
    });

    this.socket.on(SOCKET_EVENTS.RIDE_REJECTED, (data: any) => {
      console.log('❌ [SocketService] RIDE REJECTED');
      this.emitEvent(SOCKET_EVENTS.RIDE_REJECTED, data);
    });

    this.socket.on(SOCKET_EVENTS.DRIVER_TIMEOUT, (data: any) => {
      console.log('⏰ [SocketService] DRIVER TIMEOUT');
      this.emitEvent(SOCKET_EVENTS.DRIVER_TIMEOUT, data);
    });

    this.socket.on(SOCKET_EVENTS.RIDE_STATUS_CHANGE, (data: any) => {
      console.log('🚦 [SocketService] RIDE STATUS CHANGE');
      this.emitEvent(SOCKET_EVENTS.RIDE_STATUS_CHANGE, data);
    });

    this.socket.on('driver-location-updated', (data: any) => {
      console.log('📍 [SocketService] DRIVER LOCATION UPDATED');
      this.emitEvent('driver-location-updated', data);
    });

    // AUTH EVENTS
    this.socket.on('authenticated', (data: any) => {
      console.log('🔐 [SocketService] AUTHENTICATED');
      this.isAuthenticated = true;
    });

    this.socket.on('auth-error', (data: any) => {
      console.error('🚫 [SocketService] AUTH ERROR:', data);
      this.isAuthenticated = false;
    });

    // ✅ FIXED: ERROR EVENT HANDLER
    this.socket.on('error', (error: any) => {
      console.warn('⚠️ [SocketService] SOCKET ERROR:', error);

      // ✅ Ignore "Request is no longer pending" error
      if (error?.message === 'Request is no longer pending') {
        console.log(
          'ℹ️ [SocketService] Request already processed, ignoring error',
        );
        return;
      }

      // ✅ Ignore duplicate reject errors
      if (
        error?.message?.includes('already rejected') ||
        error?.message?.includes('already processed') ||
        error?.message === 'Failed to process response'
      ) {
        console.log('ℹ️ [SocketService] Request already processed, ignoring');
        return;
      }

      this.emitEvent('socket-error', error);
    });

    this.socket.on('response-processed', (data: any) => {
      console.log('✅ [SocketService] Response processed:', data);
      this.isProcessing = false;
    });

    this.socket.on('no-driver-found', (data: any) => {
      console.log('❌ [SocketService] No driver found:', data);
      this.isProcessing = false;
      this.emitEvent('no-driver-found', data);
    });

    // FORWARD ALL EVENTS
    this.socket.onAny((event: string, ...args: any[]) => {
      const skipEvents = [
        'connect',
        'disconnect',
        'reconnect',
        'reconnect_attempt',
        'reconnect_failed',
        'connect_error',
        'pong',
        'ping',
        'error',
        'response-processed',
        'no-driver-found',
        SOCKET_EVENTS.NEW_RIDE_REQUEST,
        SOCKET_EVENTS.RIDE_ACCEPTED,
        SOCKET_EVENTS.RIDE_REJECTED,
        SOCKET_EVENTS.DRIVER_TIMEOUT,
        SOCKET_EVENTS.RIDE_STATUS_CHANGE,
        'authenticated',
        'auth-error',
        'driver:registered',
        'driver:status-changed',
        'driver:error',
        'welcome',
        'driver-location-updated',
      ];
      if (skipEvents.includes(event)) return;
      console.log(`📡 [SocketService] Event: ${event}`, args);
      this.emitEvent(event, ...args);
    });

    console.log('📡 [SocketService] ✅ All event listeners registered');
  }

  // ============================================
  // ✅ DRIVER RESPONSE WITH CORRECT FIELD NAME
  // ============================================
  driverResponse(
    requestId: string,
    status: 'accepted' | 'rejected',
    driverId: string,
  ): void {
    console.log('📤 [SocketService] driverResponse() called:', {
      requestId,
      status,
      driverId,
    });

    if (this.isProcessing) {
      console.warn('⚠️ [SocketService] Already processing, ignoring duplicate');
      return;
    }

    const key = `${requestId}-${status}`;
    if (this.processedRequests.has(key)) {
      console.warn('⚠️ [SocketService] Request already processed:', key);
      return;
    }

    this.isProcessing = true;
    this.processedRequests.add(key);

    // ✅ FIX: Convert status to action (accept/reject)
    const action = status === 'accepted' ? 'accept' : 'reject';

    // ✅ Emit with correct field name "action"
    this.emit('driver-response', {
      requestId: requestId,
      action: action, // ✅ "accept" or "reject"
      driverId: driverId,
      timestamp: new Date().toISOString(),
    });

    setTimeout(() => {
      this.isProcessing = false;
    }, 2000);

    setTimeout(() => {
      this.processedRequests.delete(key);
    }, 5000);
  }

  // ============================================
  // 🔑 REGISTER DRIVER
  // ============================================
  private registerDriver(): void {
    const auth = this.socket?.auth;
    const token =
      auth && typeof auth !== 'function'
        ? (auth as { token?: string }).token
        : undefined;
    if (token) {
      const userId = this.extractUserIdFromToken(token);
      if (userId && this.socket?.connected) {
        console.log('📤 [SocketService] Emitting driver:register for:', userId);
        this.socket.emit('driver:register', { userId });
      }
    }
  }

  private extractUserIdFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload.userId || payload.sub || null;
    } catch {
      return null;
    }
  }

  private async authenticate(): Promise<void> {
    if (this.isAuthenticated) return;

    try {
      const token = await getToken();
      if (token && this.socket?.connected) {
        const userId = this.extractUserIdFromToken(token);
        this.emit(SOCKET_EVENTS.AUTHENTICATE, {
          userType: 'driver',
          userId: userId,
        });
        this.isAuthenticated = true;
        console.log(
          '🔐 [SocketService] ✅ Authentication sent with userId:',
          userId,
        );
      }
    } catch (error) {
      console.error('❌ [SocketService] Auth failed:', error);
    }
  }

  emit<T = any>(event: string, data?: T): void {
    if (!this.socket?.connected) {
      console.warn(
        `⚠️ [SocketService] Socket not connected, cannot emit: ${event}`,
      );
      return;
    }
    console.log(`📤 [SocketService] Emitting: ${event}`);
    this.socket.emit(event, data);
  }

  on<T = any>(event: string, callback: (data: T) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as Function);
  }

  off<T = any>(event: string, callback: (data: T) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as Function);
      if (callbacks.size === 0) this.listeners.delete(event);
    }
  }

  removeAllListeners(event: string): void {
    this.listeners.delete(event);
  }

  private emitEvent(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(...args));
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  disconnect(): void {
    console.log('🔌 [SocketService] 🔴 INTENTIONAL DISCONNECT');
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.isAuthenticated = false;
    this.processedRequests.clear();
    this.isProcessing = false;
    if (this.connectionResolve) {
      this.connectionResolve(null);
      this.connectionPromise = null;
      this.connectionResolve = null;
      this.connectionReject = null;
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
        this.connectionTimeoutId = null;
      }
    }
    this.listeners.clear();
    console.log('🔌 [SocketService] ✅ Socket intentionally disconnected');
  }

  cleanup(): void {
    console.log('🧹 [SocketService] 🧹 FULL CLEANUP');
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.isAuthenticated = false;
    this.processedRequests.clear();
    this.isProcessing = false;
    this.listeners.clear();
    if (this.connectionResolve) {
      this.connectionResolve(null);
      this.connectionPromise = null;
      this.connectionResolve = null;
      this.connectionReject = null;
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
        this.connectionTimeoutId = null;
      }
    }
    console.log('🧹 [SocketService] ✅ Cleanup complete');
  }
}

export const socketService = SocketService.getInstance();

function atob(arg0: string): string {
  const b64: string = arg0;
  try {
    const GlobalBuffer = (globalThis as any).Buffer;
    if (typeof GlobalBuffer !== 'undefined') {
      return GlobalBuffer.from(b64, 'base64').toString('utf-8');
    }
  } catch (e) {}

  const globalAtob: any =
    (typeof globalThis !== 'undefined' && (globalThis as any).atob) ||
    ((globalThis as any).window && (globalThis as any).window.atob);
  if (typeof globalAtob === 'function') {
    const binary: string = globalAtob(b64);
    try {
      const percentEncoded: string = binary
        .split('')
        .map((c: string) => {
          const code: string = c.charCodeAt(0).toString(16).toUpperCase();
          return '%' + (code.length === 1 ? '0' + code : code);
        })
        .join('');
      return decodeURIComponent(percentEncoded);
    } catch (e) {
      return binary;
    }
  }

  throw new Error('No base64 decode method available in this environment');
}
