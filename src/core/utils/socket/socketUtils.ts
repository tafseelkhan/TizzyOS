// utils/socket/socketUtils.ts

import io, { Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../../../api/connections/snippet/apiBaseUrl';
import { getToken } from '../../../api/connections/token/tokenSlice';
import { decode as base64Decode } from 'base-64';

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private socketId: string | null = null;
  private userId: string | null = null;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  // ✅ Extract userId from token
  private extractUserIdFromToken(token: string): string | null {
    try {
      // Token format: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('❌ [SocketService] Invalid token format');
        return null;
      }

      // Decode payload (middle part)
      const payload = parts[1];
      const decoded = base64Decode(payload);
      const parsed = JSON.parse(decoded);

      console.log('🔓 [SocketService] Decoded token:', parsed);

      // Try different possible field names
      const userId =
        parsed.userId || parsed.id || parsed.sub || parsed.user_id || null;

      if (userId) {
        console.log('✅ [SocketService] UserId extracted from token:', userId);
        return userId;
      } else {
        console.error('❌ [SocketService] No userId found in token');
        return null;
      }
    } catch (error) {
      console.error(
        '❌ [SocketService] Failed to extract userId from token:',
        error,
      );
      return null;
    }
  }

  // ✅ Connect to socket server - Auto extracts userId from token
  async connect(): Promise<Socket> {
    console.log('🔌 [SocketService] Connecting...');

    if (this.socket && this.isConnected) {
      console.log(
        '🔌 [SocketService] Already connected with ID:',
        this.socket.id,
      );
      return this.socket;
    }

    try {
      const token = await getToken();
      console.log('🔑 [SocketService] Token available:', !!token);

      if (!token) {
        throw new Error('No authentication token found');
      }

      // ✅ Extract userId from token
      this.userId = this.extractUserIdFromToken(token);

      if (!this.userId) {
        throw new Error('Failed to extract userId from token');
      }

      // ✅ Base URL
      let baseUrl = API_BASE_URL || 'http://172.20.245.121:5000';
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }
      if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.slice(0, -4);
      }

      console.log('🌐 [SocketService] Connecting to:', baseUrl);
      console.log('👤 [SocketService] UserId:', this.userId);

      // ✅ Socket connection
      this.socket = io(baseUrl, {
        transports: ['websocket'],
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        forceNew: true,
        auth: {
          token: token,
          userId: this.userId,
        },
        query: {
          platform: Platform.OS,
          userId: this.userId,
        },
      });

      // ✅ Socket event listeners
      this.socket.on('connect', () => {
        this.isConnected = true;
        this.socketId = this.socket?.id || null;
        console.log('✅ [SocketService] CONNECTED! ID:', this.socketId);

        // ✅ Auto register driver with extracted userId
        if (this.userId && this.socket) {
          console.log(
            '📤 [SocketService] Emitting driver:register for:',
            this.userId,
          );
          this.socket.emit('driver:register', { userId: this.userId });
        }
      });

      this.socket.on('connect_error', error => {
        console.error('❌ [SocketService] Connection error:', error.message);
        this.isConnected = false;
        this.socketId = null;
      });

      this.socket.on('disconnect', reason => {
        console.log('🔌 [SocketService] Disconnected:', reason);
        this.isConnected = false;
        this.socketId = null;
      });

      this.socket.on('error', error => {
        console.error('❌ [SocketService] Error:', error);
      });

      // ✅ Listen for registration confirmation
      this.socket.on('driver:registered', data => {
        console.log('✅ [SocketService] Driver registered successfully:', data);
        if (data.data?.socketId) {
          this.socketId = data.data.socketId;
          console.log('📌 [SocketService] Socket ID saved:', this.socketId);
        }
      });

      this.socket.on('driver:error', data => {
        console.error('❌ [SocketService] Driver error:', data);
      });

      // ✅ Welcome message
      this.socket.on('welcome', data => {
        console.log('👋 [SocketService] Welcome:', data);
      });

      // ✅ Wait for connection
      await new Promise(resolve => {
        if (this.socket?.connected) {
          resolve(true);
        } else {
          this.socket?.on('connect', () => resolve(true));
        }
      });

      return this.socket;
    } catch (error) {
      console.error('❌ [SocketService] Failed to connect:', error);
      throw error;
    }
  }

  // ✅ Get userId
  getUserId(): string | null {
    return this.userId;
  }

  getSocketId(): string | null {
    const id = this.socket?.id || this.socketId || null;
    console.log('📌 [SocketService] getSocketId():', id);
    return id;
  }

  isSocketConnected(): boolean {
    return (this.isConnected && this.socket?.connected) || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.socketId = null;
      this.userId = null;
      console.log('🔌 [SocketService] Disconnected manually');
    }
  }

  emit(event: string, data: any): void {
    console.log(`📤 [SocketService] Emitting: ${event}`, data);
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.warn(
        `⚠️ [SocketService] Socket not connected, cannot emit: ${event}`,
      );
    }
  }

  on(event: string, callback: (data: any) => void): void {
    console.log(`📥 [SocketService] Listening: ${event}`);
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string): void {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export default SocketService.getInstance();
