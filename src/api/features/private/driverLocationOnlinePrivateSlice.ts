// api/features/private/driverLocationOnlinePrivateSlice.ts

import axios, { AxiosError, AxiosResponse } from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { getToken } from '../../connections/token/tokenSlice';
import { decode as base64Decode } from 'base-64';

// ================================
// INTERFACES / TYPES
// ================================

export interface DriverStatusResponse {
  success: boolean;
  message?: string;
  data?: {
    userId: string;
    isOnline: boolean;
    isAvailable: boolean;
    lastSeen: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
}

export interface UpdateOnlineStatusRequest {
  isOnline: boolean;
}

export interface UpdateOnlineStatusResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
    isOnline: boolean;
    isAvailable: boolean;
    lastSeen: string;
    updatedAt: string;
  };
}

export interface ToggleStatusResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
    isOnline: boolean;
    isAvailable: boolean;
    lastSeen: string;
  };
}

export interface OnlineDriversResponse {
  success: boolean;
  data: Array<{
    userId: string;
    isOnline: boolean;
    isAvailable: boolean;
    lastSeen: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface OnlineCountResponse {
  success: boolean;
  data: {
    onlineCount: number;
  };
}

// ✅ Location Update Request
export interface LocationUpdateRequest {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  bearing?: number;
  altitude?: number;
  provider?: string;
  batteryLevel?: number;
  networkType?: string;
  isMockLocation: boolean;
  isTrackingOn: boolean;
}

export interface LocationUpdateResponse {
  success: boolean;
  message: string;
}

// ================================
// FETCH HANDLER WITH AXIOS
// ================================

interface FetchHandlerOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
}

async function fetchHandler(
  url: string,
  options: FetchHandlerOptions,
): Promise<any> {
  try {
    const config: any = {
      method: options.method,
      url: url,
      headers: options.headers || {},
    };

    if (options.body) {
      config.data = options.body;
    }

    const response: AxiosResponse = await axios(config);

    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        throw (
          axiosError.response.data || {
            success: false,
            message: 'Server error',
          }
        );
      } else if (axiosError.request) {
        throw {
          success: false,
          message: 'Network error - No response from server',
        };
      } else {
        throw { success: false, message: axiosError.message };
      }
    }
    throw error;
  }
}

// ================================
// DRIVER STATUS API
// ================================

export const driverStatusApi = {
  /**
   * ✅ Update Driver Online/Offline Status
   * PUT /driver/online-status
   */
  updateOnlineStatus: async (
    isOnline: boolean,
  ): Promise<UpdateOnlineStatusResponse> => {
    const token: string | null = await getToken();
    if (!token) {
      throw { success: false, message: 'No authentication token found' };
    }

    const url = `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.UPDATE_DRIVER_ONLINE_STATUS}`;

    try {
      const response = await fetchHandler(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
        body: { isOnline },
      });

      return response;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * ✅ Get Driver Current Status
   * GET /driver/status
   */
  getDriverStatus: async (): Promise<DriverStatusResponse> => {
    const token: string | null = await getToken();
    if (!token) {
      throw { success: false, message: 'No authentication token found' };
    }

    const url = `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_DRIVER_AVAILABLE_STATUS}`;

    try {
      const response = await fetchHandler(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
      });

      return response;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * ✅ Toggle Driver Status (Online/Offline)
   * PUT /driver/toggle-status
   */
  toggleDriverStatus: async (
    socketId: string | null,
  ): Promise<ToggleStatusResponse> => {
    const token: string | null = await getToken();
    if (!token) {
      throw { success: false, message: 'No authentication token found' };
    }

    const url = `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.TOGGLE_DRIVER_STATUS}`;

    try {
      const response = await fetchHandler(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
        body: { socketId: socketId || null },
      });

      return response;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * ✅ ✅ NEW: Update Driver Location
   * POST /locations/driver
   */
  updateDriverLocation: async (
    locationData: LocationUpdateRequest,
  ): Promise<LocationUpdateResponse> => {
    const token: string | null = await getToken();
    if (!token) {
      throw { success: false, message: 'No authentication token found' };
    }

    const url = `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.UPDATE_DRIVER_LOCATION}`;

    try {
      const response = await fetchHandler(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
        body: locationData,
      });

      return response;
    } catch (error: any) {
      throw error;
    }
  },
};

export default driverStatusApi;