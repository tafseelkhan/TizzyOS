// src/api/features/private/authProfileSlice.ts

import { TIZZYGO_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface UpdatedProfileUser {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  profilePhoto?: string;
  dateOfBirth?: string;
  theme?: string;
  color?: string;
  phone?: string;
  phoneVerified?: boolean;
  username?: string;
  connectAddress?: string;
  role?: string;
  status?: string;
  apps?: Array<{ app: string; roles: string[] }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message?: string;
  user: UpdatedProfileUser;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  profilePhoto?: string;
  dateOfBirth?: string;
  theme?: string;
  color?: string;
}

export interface UpdateAppRolePayload {
  app: 'TIZZYGO' | 'TIZZYOS' | 'LINKEDROP';
  role: string;
}

export interface UpdateAppRoleResponse {
  success: boolean;
  message?: string;
  apps: Array<{ app: string; roles: string[] }>;
  activeApp: string;
  activeRole: string;
}

export interface RecoveryConnectRequestResponse {
  success: boolean;
  verificationRequired: boolean;
  verificationId: string;
  recoveryConnect: string;
  expiresInSeconds: number;
  message: string;
}

export interface RecoveryConnectVerifyPayload {
  verificationId: string;
  code: string;
}

export interface RecoveryConnectVerifyResponse {
  success: boolean;
  recoveryConnect: string;
  recoveryConnectVerified: boolean;
  recoveryConnectVerifiedAt: string;
  message: string;
}

export interface PhoneChangeRequestResponse {
  success: boolean;
  verificationRequired: boolean;
  verificationId: string;
  phone: string;
  expiresInSeconds: number;
  message: string;
}

export interface PhoneChangeVerifyPayload {
  phone: string;
  verificationId: string;
  code: string;
}

export interface PhoneChangeVerifyResponse {
  success: boolean;
  phone: string;
  phoneVerified: boolean;
  phoneVerifiedAt: string;
  message: string;
}

// ============================================================
// 1. UPDATE BASIC PROFILE
// ============================================================

export const updateBasicProfile = async (
  payload: UpdateProfilePayload,
): Promise<UpdateProfileResponse> => {
  return apiRequest<UpdateProfileResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.UPDATE_BASIC_PROFILE}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
};

// ============================================================
// 2. UPDATE APP-SPECIFIC ROLE
// ============================================================

export const updateAppRole = async (
  payload: UpdateAppRolePayload,
): Promise<UpdateAppRoleResponse> => {
  return apiRequest<UpdateAppRoleResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.UPDATE_APP_ROLE}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
};

// ============================================================
// 3. REQUEST RECOVERY CONNECT UPDATE
// ============================================================

export const requestRecoveryConnectUpdate = async (
  recoveryConnect: string,
): Promise<RecoveryConnectRequestResponse> => {
  return apiRequest<RecoveryConnectRequestResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.REQUEST_RECOVERY_CONNECT_UPDATE}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ recoveryConnect }),
    },
  );
};

// ============================================================
// 3b. VERIFY RECOVERY CONNECT OTP
// ============================================================

export const verifyRecoveryConnectUpdate = async (
  payload: RecoveryConnectVerifyPayload,
): Promise<RecoveryConnectVerifyResponse> => {
  return apiRequest<RecoveryConnectVerifyResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.VERIFY_RECOVERY_CONNECT_UPDATE}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};

// ============================================================
// 4. REQUEST PHONE CHANGE OTP
// ============================================================

export const requestPhoneChangeOTP = async (
  phone: string,
): Promise<PhoneChangeRequestResponse> => {
  return apiRequest<PhoneChangeRequestResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.REQUEST_PHONE_CHANGE_OTP}`,
    {
      method: 'POST',
      body: JSON.stringify({ phone }),
    },
  );
};

// ============================================================
// 5. VERIFY PHONE CHANGE OTP
// ============================================================

export const verifyPhoneChangeOTP = async (
  payload: PhoneChangeVerifyPayload,
): Promise<PhoneChangeVerifyResponse> => {
  return apiRequest<PhoneChangeVerifyResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.VERIFY_PHONE_CHANGE_OTP}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};