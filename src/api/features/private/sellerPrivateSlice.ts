// src/api/features/private/sellerPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest, ApiError } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface SellerStatusData {
  status: 'pending' | 'approved' | 'rejected' | 'none';
  uniqOsId?: string;
  rejectionReason?: string;
  pendingDetails?: {
    reason?: string;
    durationInDays?: number;
  };
  createdAt?: string;
}

export interface SellerStatusResponse {
  success: boolean;
  data?: SellerStatusData;
  message?: string;
}

export interface SellerFormStatusResponse {
  success: boolean;
  canSubmit?: boolean;
  data?: unknown;
  message?: string;
  [key: string]: unknown;
}

export interface SellerApplicationData {
  fullName: string;
  email: string;
  phone: string;
  fullAddress: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  shopName: string;
  gstNumber: string;
  category: string;
  subcategories: string[];
  aadhaarFront: any;
  aadhaarBack: any;
  panFront: any;
  panBack: any;
  selfieWithDoc: any;
  gstCertificate: any;
}

export interface SellerApplicationResponse {
  success: boolean;
  message?: string;
  applicationId?: string;
  uniqOsId?: string;
}

// ============================================================
// RAW BACKEND TYPES
// ============================================================

interface RawSellerStatusData {
  status: 'pending' | 'approved' | 'rejected' | 'none';
  uniqOsId?: string | null;
  rejectionReason?: string | null;
  pendingDetails?: {
    reason?: string | null;
    durationInDays?: number | null;
  } | null;
  createdAt?: string;
}

interface RawSellerStatusResponse {
  success?: boolean;
  data?: RawSellerStatusData;
  message?: string;
}

// ============================================================
// 1. GET MY SELLER APPLICATION
// ============================================================

export const getMySellerApplication =
  async (): Promise<SellerStatusResponse> => {
    try {
      const raw = await apiRequest<RawSellerStatusResponse>(
        `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_SELLER_STATUS}`,
        { method: 'GET' },
      );

      if (raw.success && raw.data) {
        const responseData = raw.data;

        const transformed: SellerStatusData = {
          status: responseData.status,
          uniqOsId: responseData.uniqOsId || undefined,
          rejectionReason: responseData.rejectionReason || undefined,
          pendingDetails: responseData.pendingDetails
            ? {
                reason: responseData.pendingDetails.reason || undefined,
                durationInDays:
                  responseData.pendingDetails.durationInDays || undefined,
              }
            : undefined,
          createdAt: responseData.createdAt,
        };

        return { success: true, data: transformed };
      }

      return {
        success: raw.success ?? false,
        data: undefined,
        message: raw.message,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ getMySellerApplication error:', error);
      }

      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to fetch seller status. Please try again later.';

      return { success: false, message };
    }
  };

// ============================================================
// 2. CHECK SELLER FORM STATUS
// ============================================================

export const checkSellerFormStatus =
  async (): Promise<SellerFormStatusResponse> => {
    try {
      const data = await apiRequest<SellerFormStatusResponse>(
        `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.CHECK_SELLER_FORM_STATUS}`,
        { method: 'GET' },
      );

      return data;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ checkSellerFormStatus error:', error);
      }

      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to check seller form status';

      throw new Error(message);
    }
  };

// ============================================================
// 3. SUBMIT SELLER APPLICATION
//
// Uses FormData for multipart upload (files + fields).
// apiClient handles Authorization header automatically.
// ============================================================

export const submitSellerApplication = async (
  data: SellerApplicationData,
): Promise<SellerApplicationResponse> => {
  try {
    // ✅ Build FormData for multipart upload
    const formData = new FormData();

    // Text fields
    formData.append('fullName', data.fullName);
    formData.append('email', data.email);
    formData.append('phone', data.phone);
    formData.append('fullAddress', data.fullAddress);
    formData.append('city', data.city);
    formData.append('state', data.state);
    formData.append('country', data.country);
    formData.append('pincode', data.pincode);
    formData.append('shopName', data.shopName);
    formData.append('gstNumber', data.gstNumber || '');
    formData.append('category', data.category);
    formData.append('subcategories', JSON.stringify(data.subcategories || []));

    // File fields — only append if present
    const appendFile = (field: string, file: any, fallbackName: string) => {
      if (!file) return;
      const uri = file.uri || file.uri;
      if (!uri) return;

      formData.append(field, {
        uri,
        name: file.name || fallbackName,
        type: file.type || 'image/jpeg',
      } as any);
    };

    appendFile('aadhaarFront', data.aadhaarFront, 'aadhaar_front.jpg');
    appendFile('aadhaarBack', data.aadhaarBack, 'aadhaar_back.jpg');
    appendFile('panFront', data.panFront, 'pan_front.jpg');
    appendFile('panBack', data.panBack, 'pan_back.jpg');
    appendFile('selfieWithDoc', data.selfieWithDoc, 'selfie.jpg');
    appendFile('gstCertificate', data.gstCertificate, 'gst.jpg');

    // ✅ apiRequest auto-detects FormData, sets Content-Type
    const response = await apiRequest<SellerApplicationResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.SUBMIT_SELLER_APPLICATION}`,
      {
        method: 'POST',
        body: formData as any,
      },
    );

    return response;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ submitSellerApplication error:', error);
    }

    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to submit application. Please try again.';

    return { success: false, message };
  }
};
