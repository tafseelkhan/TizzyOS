// src/api/features/private/airxPayoutPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest, ApiError } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface SellerAccount {
  _id: string;
  name: string;
  email: string;
  stripeAccountId: string;
  payoutMode: 'automatic' | 'manual';
  payoutVerified: boolean;
  [key: string]: unknown;
}

export interface CreateSellerAccountPayload {
  name: string;
  email: string;
  payoutMode: 'automatic' | 'manual';
}

export interface CreateSellerAccountResponse {
  success: boolean;
  message?: string;
  seller?: SellerAccount;
  accountLink?: string;
  error?: string;
  [key: string]: unknown;
}

export interface OnboardingLinkResponse {
  success: boolean;
  onboardingUrl?: string;
  error?: string;
  [key: string]: unknown;
}

export interface AccountStatusResponse {
  success: boolean;
  payoutVerified?: boolean;
  seller?: SellerAccount;
  error?: string;
  [key: string]: unknown;
}

// ============================================================
// 1. CREATE SELLER ACCOUNT
// ============================================================

export const createAirXSellerAccount = async (
  payload: CreateSellerAccountPayload,
): Promise<CreateSellerAccountResponse> => {
  return apiRequest<CreateSellerAccountResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.CREATE_AIRX_SELLER_ACCOUNT}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};

// ============================================================
// 2. GET ONBOARDING LINK
// ============================================================

export const getAirXOnboardingLink = async (
  sellerId: string,
): Promise<OnboardingLinkResponse> => {
  return apiRequest<OnboardingLinkResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_AIRX_ONBOARDING_LINK}/${sellerId}/onboarding-link`,
    { method: 'GET' },
  );
};

// ============================================================
// 3. CHECK ACCOUNT STATUS
// ============================================================

export const checkAirXAccountStatus = async (
  sellerId: string,
): Promise<AccountStatusResponse> => {
  return apiRequest<AccountStatusResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.CHECK_AIRX_ACCOUNT_STATUS}/${sellerId}/status`,
    { method: 'GET' },
  );
};