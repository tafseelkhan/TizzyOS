// src/services/socket/SocketService.ts

import io, { Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { API_BASE_URL } from '../../../api/connections/snippet/apiBaseUrl';
import { getToken } from '../../../api/connections/token/tokenSlice';
import {
  CONFIG,
  SOCKET_EVENTS,
} from '../../../api/constants/rideRequestConfig';

interface SocketEventMap {
  [event: string]: (...args: any[]) => void;
}

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = CONFIG.SOCKET_RECONNECTION_ATTEMPTS;
  private isAuthenticated = false;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Connect to socket server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        console.warn('No token found, socket connection skipped');
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
      console.error('Socket connection failed:', error);
      throw error;
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.authenticate();
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnected = false;
      this.isAuthenticated = false;
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('🔄 Socket reconnected:', attemptNumber);
      this.isConnected = true;
      this.authenticate();
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      this.reconnectAttempts = attemptNumber;
      console.log('🔄 Socket reconnect attempt:', attemptNumber);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnect failed');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ Socket connection error:', error);
      this.isConnected = false;
    });

    // Forward all events to listeners
    this.socket.onAny((event: string, ...args: any[]) => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(...args);
          } catch (error) {
            console.error(`Error in listener for ${event}:`, error);
          }
        });
      }
    });
  }

  /**
   * Authenticate with socket server
   */
  private async authenticate(): Promise<void> {
    if (this.isAuthenticated) return;
    try {
      const token = await getToken();
      if (token && this.socket?.connected) {
        this.emit(SOCKET_EVENTS.AUTHENTICATE, { userType: 'driver' });
        this.isAuthenticated = true;
        console.log('🔐 Socket authenticated');
      }
    } catch (error) {
      console.error('Socket authentication failed:', error);
    }
  }

  /**
   * Emit an event to the server
   */
  emit<T = any>(event: string, data?: T): void {
    if (!this.socket?.connected) {
      console.warn(`Socket not connected, cannot emit: ${event}`);
      return;
    }
    this.socket.emit(event, data);
  }

  /**
   * Register event listener
   */
  on<T = any>(event: string, callback: (data: T) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as Function);
  }

  /**
   * Remove event listener
   */
  off<T = any>(event: string, callback: (data: T) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as Function);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.isAuthenticated = false;
      this.listeners.clear();
    }
  }

  /**
   * Check if socket is connected
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  /**
   * Reconnect socket
   */
  reconnect(): void {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.listeners.clear();
    this.disconnect();
  }
}

export const socketService = SocketService.getInstance();
