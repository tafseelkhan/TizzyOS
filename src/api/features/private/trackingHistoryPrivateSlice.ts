// src/api/features/private/trackingHistoryPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface TrackingHistoryResponse {
  success?: boolean;
  message?: string;
  routeHistory?: Array<{
    fromHolderType?: string;
    fromHolderId?: string;
    toHolderType?: string;
    toHolderId?: string;
  }>;
  assignmentHistory?: Array<{
    assigneeType?: string;
    assigneeId?: string;
  }>;
  pendingAssignment?: {
    assigneeType?: string;
    assigneeId?: string;
    status?: string;
  };
  [key: string]: unknown;
}

// ============================================================
// API — Get Tracking History (for excluded partner IDs)
// ============================================================

export const getTrackingHistory = async (
  orderId: string,
): Promise<TrackingHistoryResponse> => {
  return apiRequest<TrackingHistoryResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_TRACKING_HISTORY}?orderId=${encodeURIComponent(
      orderId,
    )}`,
    { method: 'GET' },
  );
};

// ============================================================
// HELPER — Exclude partner IDs from tracking history
// ============================================================

export const extractExcludedPartnerIds = (
  tracking: TrackingHistoryResponse,
): string[] => {
  const excluded: string[] = [];

  const isShippingType = (t?: string) => t === 'RIDER' || t === 'TRUCK';

  tracking.routeHistory?.forEach(r => {
    if (isShippingType(r.fromHolderType) && r.fromHolderId) {
      excluded.push(r.fromHolderId);
    }
    if (isShippingType(r.toHolderType) && r.toHolderId) {
      excluded.push(r.toHolderId);
    }
  });

  tracking.assignmentHistory?.forEach(a => {
    if (isShippingType(a.assigneeType) && a.assigneeId) {
      excluded.push(a.assigneeId);
    }
  });

  const pending = tracking.pendingAssignment;
  if (pending && isShippingType(pending.assigneeType) && pending.assigneeId) {
    excluded.push(pending.assigneeId);
  }

  return [...new Set(excluded)];
};