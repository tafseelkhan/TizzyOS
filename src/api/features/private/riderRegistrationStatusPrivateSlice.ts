// src/api/features/private/riderRegistrationStatusPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface ShippingData {
  _id: string;
  name: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleNumber: string;
  vehicleCategory: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_review';
  maxOrdersPerDay?: number;
  drivingLicenseNumber?: string;
  identityType?: string;
  identityNumber?: string;
  vehicleImage?: string;
  drivingLicenseImage?: string;
  identityImage?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  approvedAt?: string;
  rejectedAt?: string;
  kyc?: {
    status?: string;
  };
}

export interface ShippingStatusApiResponse {
  success: boolean;
  message: string;
  status: {
    formStatus: string;
    kycStatus: string;
    isApproved: boolean;
    isKycVerified: boolean;
  };
  shipping: ShippingData;
}

// ============================================================
// GET SHIPPING REGISTRATION STATUS BY ID
// ============================================================

export const getShippingRegistrationById = async (
  shippingId: string,
): Promise<ShippingStatusApiResponse> => {
  return apiRequest<ShippingStatusApiResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_SHIPPING_BY_ID}/${shippingId}`,
    { method: 'GET' },
  );
};