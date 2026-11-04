// src/api/features/private/riderLocationPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface RiderLocationPayload {
  shippingId: string;
  action: 'update';
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  altitude: number;
  provider: string;
  batteryLevel: number;
  networkType: string;
  timestamp: number;
}

export interface RiderLocationResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

// ============================================================
// UPLOAD RIDER LOCATION
//
// Called from the background task — safe because `apiClient`
// is React-independent and works inside BackgroundActions.
// ============================================================

export const updateRiderLocation = async (
  payload: RiderLocationPayload,
): Promise<RiderLocationResponse> => {
  return apiRequest<RiderLocationResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.UPDATE_RIDER_LOCATION}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};