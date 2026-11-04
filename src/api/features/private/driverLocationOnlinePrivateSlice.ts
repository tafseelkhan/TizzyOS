// api/features/private/driverLocationOnlinePrivateSlice.ts

import { Platform } from 'react-native';
import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import {
  apiRequest,
  ApiError,
} from '../../../core/utils/handler/apiClient';

// ================================
// INTERFACES / TYPES (same)
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
// PLATFORM HEADERS — ek jagah
// ================================

const platformHeaders: Record<string, string> =
  Platform.OS === 'android'
    ? { 'X-Platform': 'android' }
    : Platform.OS === 'ios'
    ? { 'X-Platform': 'ios' }
    : {};

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
    return apiRequest<UpdateOnlineStatusResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.UPDATE_DRIVER_ONLINE_STATUS}`,
      {
        method: 'PUT',
        headers: platformHeaders,
        body: JSON.stringify({ isOnline } as UpdateOnlineStatusRequest),
      },
    );
  },

  /**
   * ✅ Get Driver Current Status
   * GET /driver/status
   */
  getDriverStatus: async (): Promise<DriverStatusResponse> => {
    return apiRequest<DriverStatusResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_DRIVER_AVAILABLE_STATUS}`,
      {
        method: 'GET',
        headers: platformHeaders,
      },
    );
  },

  /**
   * ✅ Toggle Driver Status (Online/Offline)
   * PUT /driver/toggle-status
   */
  toggleDriverStatus: async (
    socketId: string | null,
  ): Promise<ToggleStatusResponse> => {
    return apiRequest<ToggleStatusResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.TOGGLE_DRIVER_STATUS}`,
      {
        method: 'PUT',
        headers: platformHeaders,
        body: JSON.stringify({ socketId: socketId || null }),
      },
    );
  },

  /**
   * ✅ Update Driver Location
   * POST /locations/driver
   */
  updateDriverLocation: async (
    locationData: LocationUpdateRequest,
  ): Promise<LocationUpdateResponse> => {
    return apiRequest<LocationUpdateResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.UPDATE_DRIVER_LOCATION}`,
      {
        method: 'POST',
        headers: platformHeaders,
        body: JSON.stringify(locationData),
      },
    );
  },
};

export default driverStatusApi;