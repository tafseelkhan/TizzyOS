// src/utils/socket/socketUtils.ts

import io, { Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { TIZZYOS_API_BASE_URL } from '../../../api/connections/snippet/apiBaseUrl';
import { getToken } from '../../../api/connections/token/tokenSlice';
import {
  CONFIG,
  SOCKET_EVENTS,
} from '../../../api/constants/rideRequestConfig';

// Socket state enum
export enum SocketState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  READY = 'ready',
  ERROR = 'error',
}

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private state: SocketState = SocketState.DISCONNECTED;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = CONFIG.SOCKET_RECONNECTION_ATTEMPTS;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private connectionPromise: Promise<string | null> | null = null;
  private connectionResolve: ((value: string | null) => void) | null = null;
  private connectionReject: ((reason: Error) => void) | null = null;
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Shared authentication promise - single source of truth
  private authPromise: Promise<boolean> | null = null;
  private authResolve: ((value: boolean) => void) | null = null;
  private authReject: ((reason: Error) => void) | null = null;
  private authTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private authEmitTime: number | null = null;
  private authRetryCount = 0;
  private maxAuthRetries = 5;

  private processedRequests: Set<string> = new Set();
  private isProcessing: boolean = false;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  getState(): SocketState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      this.state = SocketState.CONNECTED;
      this.isConnected = true;
      return;
    }

    if (this.socket && !this.socket.connected) {
      this.state = SocketState.CONNECTING;
      this.socket.connect();
      return;
    }

    this.state = SocketState.CONNECTING;

    try {
      const token = await getToken();
      if (!token) {
        this.state = SocketState.ERROR;
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

      this.socket = io(TIZZYOS_API_BASE_URL, options);
      this.setupCoreListeners();
      this.socket.connect();
    } catch (error) {
      this.state = SocketState.ERROR;
      throw error;
    }
  }

  waitForConnection(
    timeout: number = CONFIG.SOCKET_TIMEOUT,
  ): Promise<string | null> {
    if (this.socket?.connected && this.socket.id) {
      this.state = SocketState.CONNECTED;
      this.isConnected = true;
      return Promise.resolve(this.socket.id);
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionResolve = resolve;
      this.connectionReject = reject;

      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
      }

      this.connectionTimeoutId = setTimeout(() => {
        this.connectionPromise = null;
        this.connectionResolve = null;
        this.connectionReject = null;
        this.connectionTimeoutId = null;
        this.state = SocketState.ERROR;
        resolve(null);
      }, timeout);
    });

    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    } else if (!this.socket) {
      this.connect().catch(err => {
        if (this.connectionReject) {
          this.connectionReject(err);
        }
      });
    }

    return this.connectionPromise;
  }

  waitForAuthentication(
    timeout: number = CONFIG.SOCKET_TIMEOUT,
  ): Promise<boolean> {
    if (
      this.state === SocketState.AUTHENTICATED ||
      this.state === SocketState.READY
    ) {
      return Promise.resolve(true);
    }

    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = new Promise((resolve, reject) => {
      this.authResolve = resolve;
      this.authReject = reject;

      if (this.authTimeoutId) {
        clearTimeout(this.authTimeoutId);
      }

      this.authTimeoutId = setTimeout(() => {
        this.authPromise = null;
        this.authResolve = null;
        this.authReject = null;
        this.authTimeoutId = null;
        this.state = SocketState.ERROR;
        resolve(false);
      }, timeout);
    });

    if (!this.isConnected) {
      this.waitForConnection(timeout)
        .then(() => {
          if (
            this.state !== SocketState.AUTHENTICATED &&
            this.state !== SocketState.READY
          ) {
            this.authenticate();
          }
        })
        .catch(() => {
          if (this.authReject) {
            this.authReject(new Error('Connection failed'));
          }
        });
    } else {
      this.authenticate();
    }

    return this.authPromise;
  }

  async waitForReady(timeout: number = CONFIG.SOCKET_TIMEOUT): Promise<{
    socketId: string | null;
    authenticated: boolean;
    state: SocketState;
  }> {
    try {
      const socketId = await this.waitForConnection(timeout);
      if (!socketId) {
        return { socketId: null, authenticated: false, state: this.state };
      }

      const authenticated = await this.waitForAuthentication(timeout);
      if (authenticated) {
        this.state = SocketState.READY;
      }

      return { socketId, authenticated, state: this.state };
    } catch (error) {
      return { socketId: null, authenticated: false, state: SocketState.ERROR };
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private setupCoreListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.state = SocketState.CONNECTED;
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.authRetryCount = 0;
      this.startHeartbeat();

      if (this.connectionResolve) {
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

      setTimeout(() => {
        if (this.isConnected && this.state !== SocketState.AUTHENTICATED) {
          this.authenticate();
        }
      }, 500);
    });

    this.socket.on('disconnect', (reason: string) => {
      this.state = SocketState.DISCONNECTED;
      this.isConnected = false;
      this.stopHeartbeat();
      this.isProcessing = false;
      this.authRetryCount = 0;
      if (this.authResolve) {
        this.authResolve(false);
        this.authPromise = null;
        this.authResolve = null;
        this.authReject = null;
        if (this.authTimeoutId) {
          clearTimeout(this.authTimeoutId);
          this.authTimeoutId = null;
        }
      }
    });

    this.socket.on('reconnect', (attempt: number) => {
      this.state = SocketState.CONNECTED;
      this.isConnected = true;
      this.authRetryCount = 0;
      this.startHeartbeat();
      this.registerDriver();
      setTimeout(() => {
        if (this.isConnected && this.state !== SocketState.AUTHENTICATED) {
          this.authenticate();
        }
      }, 500);
    });

    this.socket.on('reconnect_attempt', (attempt: number) => {
      this.reconnectAttempts = attempt;
      this.state = SocketState.CONNECTING;
    });

    this.socket.on('reconnect_failed', () => {
      this.state = SocketState.ERROR;
    });

    this.socket.on('connect_error', (error: Error) => {
      this.state = SocketState.ERROR;

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

    // ============================================================
    // 🔥 FIX: AUTH EVENTS - Listen for both 'authenticated' and 'auth-success'
    // ============================================================
    this.socket.on('authenticated', (data: any) => {
      this.state = SocketState.AUTHENTICATED;
      this.authRetryCount = 0;

      if (this.authResolve) {
        this.authResolve(true);
        this.authPromise = null;
        this.authResolve = null;
        this.authReject = null;
        if (this.authTimeoutId) {
          clearTimeout(this.authTimeoutId);
          this.authTimeoutId = null;
        }
      }
    });

    // 🔥 FIX: Also listen for 'auth-success' event (backend emits this)
    this.socket.on('auth-success', (data: any) => {
      this.state = SocketState.AUTHENTICATED;
      this.authRetryCount = 0;

      if (this.authResolve) {
        this.authResolve(true);
        this.authPromise = null;
        this.authResolve = null;
        this.authReject = null;
        if (this.authTimeoutId) {
          clearTimeout(this.authTimeoutId);
          this.authTimeoutId = null;
        }
      }
    });

    this.socket.on('auth-error', (data: any) => {
      this.state = SocketState.ERROR;
      this.authRetryCount++;

      if (this.authReject) {
        this.authReject(new Error(data?.message || 'Authentication failed'));
        this.authPromise = null;
        this.authResolve = null;
        this.authReject = null;
        if (this.authTimeoutId) {
          clearTimeout(this.authTimeoutId);
          this.authTimeoutId = null;
        }
      }

      if (this.authRetryCount < this.maxAuthRetries && this.isConnected) {
        setTimeout(() => {
          if (this.isConnected && this.state !== SocketState.AUTHENTICATED) {
            this.authenticate();
          }
        }, 2000);
      }
    });

    // ============================================================
    // ERROR HANDLER
    // ============================================================
    this.socket.on('error', (error: any) => {
      if (error?.message === 'Request is no longer pending') {
        return;
      }

      if (
        error?.message?.includes('already rejected') ||
        error?.message?.includes('already processed') ||
        error?.message === 'Failed to process response'
      ) {
        return;
      }

      this.emitEvent('socket-error', error);
    });

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
        'authenticated',
        'auth-success',
        'auth-error',
      ];
      if (skipEvents.includes(event)) return;
      this.emitEvent(event, ...args);
    });
  }

  private registerDriver(): void {
    const auth = this.socket?.auth;
    const token =
      auth && typeof auth !== 'function'
        ? (auth as { token?: string }).token
        : undefined;
    if (token) {
      const userId = this.extractUserIdFromToken(token);
      if (userId && this.socket?.connected) {
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
    if (
      this.state === SocketState.AUTHENTICATED ||
      this.state === SocketState.READY
    ) {
      return;
    }

    if (this.state === SocketState.AUTHENTICATING) {
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        if (this.authReject) {
          this.authReject(new Error('No token available'));
        }
        return;
      }

      const userId = this.extractUserIdFromToken(token);
      const payload = this.decodeToken(token);
      const userType = payload?.userType || payload?.role || 'driver';

      this.state = SocketState.AUTHENTICATING;

      if (this.socket?.connected) {
        const authEvent = SOCKET_EVENTS.AUTHENTICATE || 'authenticate';
        // Send token in auth payload
        this.emit(authEvent, {
          userType: userType,
          userId: userId,
          token: token,
        });
        this.authEmitTime = Date.now();
      } else {
        this.state = SocketState.ERROR;
        if (this.authReject) {
          this.authReject(new Error('Socket not connected'));
        }
      }
    } catch (error) {
      this.state = SocketState.ERROR;
      if (this.authReject) {
        this.authReject(error as Error);
      }
    }
  }

  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1]));
    } catch {
      return null;
    }
  }

  driverResponse(
    requestId: string,
    status: 'accepted' | 'rejected',
    driverId: string,
  ): void {
    if (this.isProcessing) {
      return;
    }

    const key = `${requestId}-${status}`;
    if (this.processedRequests.has(key)) {
      return;
    }

    this.isProcessing = true;
    this.processedRequests.add(key);

    const action = status === 'accepted' ? 'accept' : 'reject';

    this.emit('driver-response', {
      requestId: requestId,
      action: action,
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

  emit<T = any>(event: string, data?: T): void {
    if (!this.socket?.connected) {
      return;
    }
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

  isAuthenticatedFlag(): boolean {
    return (
      this.state === SocketState.AUTHENTICATED ||
      this.state === SocketState.READY
    );
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  disconnect(): void {
    this.stopHeartbeat();

    if (this.authResolve) {
      this.authResolve(false);
      this.authPromise = null;
      this.authResolve = null;
      this.authReject = null;
      if (this.authTimeoutId) {
        clearTimeout(this.authTimeoutId);
        this.authTimeoutId = null;
      }
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.state = SocketState.DISCONNECTED;
    this.isConnected = false;
    this.processedRequests.clear();
    this.isProcessing = false;
    this.authRetryCount = 0;
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
  }

  cleanup(): void {
    this.stopHeartbeat();

    if (this.authResolve) {
      this.authResolve(false);
      this.authPromise = null;
      this.authResolve = null;
      this.authReject = null;
      if (this.authTimeoutId) {
        clearTimeout(this.authTimeoutId);
        this.authTimeoutId = null;
      }
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.state = SocketState.DISCONNECTED;
    this.isConnected = false;
    this.processedRequests.clear();
    this.isProcessing = false;
    this.authRetryCount = 0;
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