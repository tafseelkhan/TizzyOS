import { TIZZYGO_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import {
  apiRequest,
  clearLocalAuth,
} from '../../../core/utils/handler/apiClient';
import {
  getSessionToken,
  setAuthTokens,
  setToken,
} from '../../connections/token/tokenSlice';

// ============================================================
// PAYLOAD TYPES
// ============================================================

export interface ConnectSignupPayload {
  firstName: string;
  lastName?: string;
  username: string;
  password: string;
  confirmPassword: string;
  phone: string;
  termsAccepted: boolean;
}

export interface ConnectVerifyPhonePayload {
  verificationId: string;
  code: string;
}

export interface ConnectLoginPayload {
  login: string;
  password: string;
  deviceName?: string;
}

export interface ConnectVerifyLoginOtpPayload {
  verificationId: string;
  code: string;
  deviceName?: string;
}

export interface ConnectForgotPasswordPayload {
  identifier: string; // username or connectAddress
}

export interface ConnectVerifyForgotPasswordOtpPayload {
  verificationId: string;
  code: string;
}

export interface ConnectResetPasswordPayload {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ConnectResendOtpPayload {
  verificationId: string;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

export interface ConnectApp {
  app: string;
  roles: string[];
}

export interface ConnectUser {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  connectAddress?: string;
  displayName?: string;
  profilePhoto?: string;
  phone?: string;
  phoneVerified?: boolean;
  connectVerified?: boolean;
  role?: string;
  status?: string;
  apps?: ConnectApp[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectAuthResponse {
  success?: boolean;
  accessToken?: string;
  sessionToken?: string;
  verificationRequired?: boolean;
  verificationId?: string | null;
  expiresInSeconds?: number;
  phone?: string | null;
  message?: string;
  user?: ConnectUser;
  resetToken?: string;
  [key: string]: unknown;
}

export interface ConnectMeResponse {
  success: boolean;
  message?: string;
  user: ConnectUser;
}

export interface ConnectRefreshResponse {
  success?: boolean;
  message?: string;
  accessToken: string;
}

export interface ConnectLogoutResponse {
  success: boolean;
  message: string;
}

// ============================================================
// TOKEN HELPERS
// ============================================================

const saveTokensIfPresent = async (
  data: ConnectAuthResponse,
): Promise<ConnectAuthResponse> => {
  if (data.accessToken && data.sessionToken) {
    await setAuthTokens({
      accessToken: data.accessToken,
      sessionToken: data.sessionToken,
    });
  } else if (data.accessToken) {
    await setToken(data.accessToken);
  }

  return data;
};

// ============================================================
// AUTH API – SIGNUP
// ============================================================

export const signup = async (
  payload: ConnectSignupPayload,
): Promise<ConnectAuthResponse> => {
  return apiRequest<ConnectAuthResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.SIGNUP}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
      retryOnUnauthorized: false,
    },
  );
};

export const verifyPhone = async (
  payload: ConnectVerifyPhonePayload,
): Promise<ConnectAuthResponse> => {
  const data = await apiRequest<ConnectAuthResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.VERIFY_PHONE}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
      retryOnUnauthorized: false,
    },
  );

  return saveTokensIfPresent(data);
};

// ============================================================
// AUTH API – LOGIN (2-step)
// ============================================================

/**
 * Step 1: Validate password → backend sends OTP.
 * Response will have verificationRequired: true and verificationId.
 * No tokens are returned at this step.
 */
export const login = async (
  payload: ConnectLoginPayload,
): Promise<ConnectAuthResponse> => {
  return apiRequest<ConnectAuthResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.LOGIN}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
      retryOnUnauthorized: false,
    },
  );
};

/**
 * Step 2: Verify login OTP → receive accessToken + sessionToken.
 */
export const verifyLoginOtp = async (
  payload: ConnectVerifyLoginOtpPayload,
): Promise<ConnectAuthResponse> => {
  const data = await apiRequest<ConnectAuthResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.LOGIN_VERIFY_OTP}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
      retryOnUnauthorized: false,
    },
  );

  return saveTokensIfPresent(data);
};

// ============================================================
// AUTH API – FORGOT PASSWORD (3-step)
// ============================================================

/**
 * Step 1: Request OTP using username or connectAddress.
 * Always returns a generic success-shaped response (anti-enumeration).
 */
export const requestForgotPassword = async (
  payload: ConnectForgotPasswordPayload,
): Promise<ConnectAuthResponse> => {
  return apiRequest<ConnectAuthResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.FORGOT_PASSWORD}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
      retryOnUnauthorized: false,
    },
  );
};

/**
 * Step 2: Verify OTP → receive short-lived resetToken.
 */
export const verifyForgotPasswordOtp = async (
  payload: ConnectVerifyForgotPasswordOtpPayload,
): Promise<ConnectAuthResponse> => {
  return apiRequest<ConnectAuthResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.FORGOT_PASSWORD_VERIFY_OTP}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
      retryOnUnauthorized: false,
    },
  );
};

/**
 * Step 3: Submit resetToken + new password.
 * Does NOT auto-login. User must login normally afterwards.
 */
export const resetPassword = async (
  payload: ConnectResetPasswordPayload,
): Promise<ConnectAuthResponse> => {
  return apiRequest<ConnectAuthResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.FORGOT_PASSWORD_RESET}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
      retryOnUnauthorized: false,
    },
  );
};

// ============================================================
// AUTH API – RESEND OTP (shared)
// ============================================================

/**
 * Resend OTP for signup / login / forgot-password.
 * Purpose is determined by the backend from the stored verification record.
 */
export const resendOtp = async (
  payload: ConnectResendOtpPayload,
): Promise<ConnectAuthResponse> => {
  return apiRequest<ConnectAuthResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.RESEND_OTP}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
      retryOnUnauthorized: false,
    },
  );
};

// ============================================================
// AUTH API – SESSION
// ============================================================

export const me = async (): Promise<ConnectMeResponse> => {
  return apiRequest<ConnectMeResponse>(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.ME}`,
    {
      method: 'GET',
    },
  );
};

export const refresh = async (): Promise<ConnectRefreshResponse> => {
  const sessionToken = await getSessionToken();

  if (!sessionToken) {
    throw new Error('No session token is stored.');
  }

  // Direct fetch avoids recursively triggering apiClient refresh.
  const response = await fetch(
    `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.REFRESH}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
      },
    },
  );

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message || `Refresh failed (${response.status}).`,
    );
  }

  const accessToken =
    result?.accessToken ?? result?.data?.accessToken;

  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('Refresh response did not contain an access token.');
  }

  // Update access token; retain the existing session token.
  await setToken(accessToken);

  return {
    ...result,
    accessToken,
  } as ConnectRefreshResponse;
};

export const logout = async (): Promise<ConnectLogoutResponse> => {
  try {
    const sessionToken = await getSessionToken();

    return await apiRequest<ConnectLogoutResponse>(
      `${TIZZYGO_API_BASE_URL}${API_ENDPOINTS.LOGOUT}`,
      {
        method: 'POST',
        headers: sessionToken
          ? { 'x-session-token': sessionToken }
          : {},
      },
    );
  } finally {
    await clearLocalAuth();
  }
};
