// src/api/features/private/qrHandoverPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface HandoverViaQrData {
  orderId?: string;
  trackingId?: string;
  fromHolder?: {
    type?: string;
    id?: string;
    name?: string;
  };
  toHolder?: {
    type?: string;
    id?: string;
    name?: string;
  };
  handedOverAt?: string;
  [key: string]: unknown;
}

export interface HandoverViaQrResponse {
  success: boolean;
  message?: string;
  data?: HandoverViaQrData;
  duplicate?: boolean;
  alreadyScanned?: boolean;
  code?: string;
  details?: string;
  [key: string]: unknown;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * QR data may be:
 * - Raw string token
 * - JSON string `{"token": "..."}`
 * - JSON string with other keys
 */
const extractQrToken = (qrData: string): string => {
  try {
    const parsed = JSON.parse(qrData);
    if (parsed && typeof parsed === 'object' && parsed.token) {
      return String(parsed.token);
    }
    // Agar JSON parse hua lekin token nahi — raw string hi use karo
    return qrData;
  } catch {
    // JSON nahi hai — raw string hi token hai
    return qrData;
  }
};

// ============================================================
// API
// ============================================================

/**
 * Handover order via QR token.
 *
 * Same pattern as `me()` / `getDriverProfile()`:
 * - Auto refresh + retry on 401 (apiClient handles)
 * - Throws ApiError on failure
 * - Caller handles duplicate/alreadyScanned via response body
 */
export const handoverViaQr = async (
  qrData: string,
): Promise<HandoverViaQrResponse> => {
  const token = extractQrToken(qrData);

  const response = await apiRequest<HandoverViaQrResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.HANDOVER_VIA_QR}`,
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    },
  );

  return response;
};