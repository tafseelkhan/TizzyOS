// src/api/features/private/riderRegistrationPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest, ApiError } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface ShippingData {
  _id: string;
  status: string;
  name: string;
  vehicleBrand: string;
  vehicleModel: string;
  isOnline: boolean;
  lastOnlineAt?: string;
  lastOfflineAt?: string;
  shippingType?: string;
  city?: string;
  state?: string;
  vehicleCategory?: string;
  vehicleNumber?: string;
  maxOrdersPerDay?: number;
  kyc?: {
    drivingLicenseNumber: string;
    drivingLicenseImage: string;
    identityType: string;
    identityNumber: string;
    identityImage: string;
    status: string;
    verified?: boolean;
  };
  kycVerified?: boolean;
}

export interface ShippingFormCheckResponse {
  exists: boolean;
  shippingData?: ShippingData;
  message?: string;
  [key: string]: unknown;
}

export interface OnlineStatusResponse {
  success: boolean;
  message?: string;
  data?: {
    lastOnlineAt?: string;
    lastOfflineAt?: string;
    isOnline?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface RegistrationResponse {
  success?: boolean;
  message?: string;
  shipping?: { _id?: string; [key: string]: unknown };
  _id?: string;
  id?: string;
  [key: string]: unknown;
}

// ============================================================
// 1. CHECK SHIPPING FORM
// ============================================================

export const checkShippingForm = async (): Promise<ShippingFormCheckResponse> => {
  return apiRequest<ShippingFormCheckResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.CHECK_SHIPPING_FORM}`,
    { method: 'GET' },
  );
};

// ============================================================
// 2. UPDATE SHIPPER ONLINE STATUS
// ============================================================

export const updateShipperOnlineStatus = async (
  isOnline: boolean,
): Promise<OnlineStatusResponse> => {
  const data = await apiRequest<OnlineStatusResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.UPDATE_SHIPPER_ONLINE_STATUS}`,
    {
      method: 'POST',
      body: JSON.stringify({ isOnline }),
    },
  );

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to update online status');
  }

  return data;
};

// ============================================================
// 3. START RIDER LOCATION (start action)
// ============================================================

export const startRiderLocation = async (
  shippingId: string,
  latitude: number,
  longitude: number,
): Promise<void> => {
  try {
    await apiRequest(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.START_RIDER_LOCATION}`,
      {
        method: 'POST',
        body: JSON.stringify({
          shippingId,
          action: 'start',
          latitude,
          longitude,
        }),
      },
    );
  } catch (error) {
    if (__DEV__) {
      console.warn('⚠️ startRiderLocation error:', error);
    }
    throw error;
  }
};

// ============================================================
// 4. REGISTER RIDER
// ============================================================

export interface RiderRegistrationPayload {
  name: string;
  shippingType: string | null;
  city: string;
  state: string;
  vehicleCategory: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleNumber: string;
  vehicleImage: string;
  maxOrdersPerDay: number;
  kyc: {
    drivingLicenseNumber: string;
    drivingLicenseImage: string;
    identityType: string | null;
    identityNumber: string | null;
    identityImage: string | null;
  };
  agreedToTerms: boolean;
  agreedAt: string;
}

export const registerRider = async (
  payload: RiderRegistrationPayload,
): Promise<RegistrationResponse> => {
  try {
    const data = await apiRequest<RegistrationResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.REGISTER_RIDER}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 409) {
        throw new Error('Already registered');
      }
      if (error.status === 401) {
        throw new Error('Session expired');
      }
    }
    throw error;
  }
};