// src/services/auth/authService.ts
import Config from 'react-native-config';
import { jwtDecode } from 'jwt-decode';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { fetchHandler } from '../../../core/utils/handler/fetchHandler';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import {
  setToken,
  removeToken,
  getToken,
} from '../../connections/token/tokenSlice';

// =============================================
// TYPES
// =============================================

export interface AuthPayload {
  identifier: string;
  role?: string;
}

export interface VerifySignupPayload {
  identifier: string;
  otp: string;
  name: string;
  role?: string;
}

export interface VerifyLoginPayload {
  identifier: string;
  otp: string;
}

export interface ResendOtpPayload {
  identifier: string;
}

export interface SwitchAccountPayload {
  targetUserId: string;
}

export interface AddLinkedAccountPayload {
  name: string;
  email?: string;
  phone?: string;
  role: 'SELLER' | 'FWS' | 'SHIPPING';
}

export interface AuthResponse {
  success: boolean;
  msg?: string;
  token?: string;
  user?: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    role: string;
  };
  linkedAccounts?: {
    userId: string;
    role: string;
    name: string;
    email?: string;
    phone?: string;
    isPrimary: boolean;
  }[];
}

// =============================================
// HELPERS
// =============================================

const formatIdentifier = (identifier: string) => {
  return identifier.toLowerCase().trim();
};

const getAuthToken = async (): Promise<string | null> => {
  try {
    const token = await getToken();
    return token || null;
  } catch (error) {
    console.error('❌ Error getting token:', error);
    return null;
  }
};

const saveAuthData = async (token: string): Promise<void> => {
  try {
    await setToken(token);
    console.log('✅ Token saved successfully');
  } catch (error) {
    console.error('❌ Error saving auth data:', error);
    throw error;
  }
};

const clearAuthData = async (): Promise<void> => {
  try {
    await removeToken();
    console.log('✅ Auth data cleared');
  } catch (error) {
    console.error('❌ Error clearing auth data:', error);
  }
};

// =============================================
// FETCH HANDLER WITH AUTH
// =============================================

const authFetchHandler = async (url: string, options: RequestInit = {}) => {
  try {
    const token = await getAuthToken();
    const headers: any = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.msg || `HTTP error! status: ${response.status}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error('❌ API call failed:', error);
    throw error;
  }
};

// =============================================
// SIGNUP - Step 1: Send OTP
// =============================================

export const signup = async ({ identifier, role }: AuthPayload) => {
  const formattedIdentifier = formatIdentifier(identifier);
  const url = `${API_BASE_URL}${API_ENDPOINTS.SIGNUP}`;
  console.log('📤 Signup request to:', url);

  return await authFetchHandler(url, {
    method: 'POST',
    body: JSON.stringify({
      identifier: formattedIdentifier,
      role: role || 'SELLER',
    }),
  });
};

// =============================================
// SIGNUP - Step 2: Verify OTP
// =============================================

export const verifySignup = async ({
  identifier,
  otp,
  name,
  role,
}: VerifySignupPayload) => {
  const formattedIdentifier = formatIdentifier(identifier);
  const url = `${API_BASE_URL}${API_ENDPOINTS.VERIFY_SIGNUP}`;

  const data = await authFetchHandler(url, {
    method: 'POST',
    body: JSON.stringify({
      identifier: formattedIdentifier,
      otp,
      name,
      role: role || 'SELLER',
    }),
  });

  // ✅ Save token automatically if present
  if (data.token) {
    await saveAuthData(data.token);
  }

  return data;
};

// =============================================
// LOGIN - Step 1: Send OTP
// =============================================

export const login = async ({ identifier }: AuthPayload) => {
  const formattedIdentifier = formatIdentifier(identifier);
  const url = `${API_BASE_URL}${API_ENDPOINTS.LOGIN}`;
  console.log('📤 Login request to:', url);

  return await authFetchHandler(url, {
    method: 'POST',
    body: JSON.stringify({
      identifier: formattedIdentifier,
    }),
  });
};

// =============================================
// LOGIN - Step 2: Verify OTP
// =============================================

export const verifyLogin = async ({ identifier, otp }: VerifyLoginPayload) => {
  const formattedIdentifier = formatIdentifier(identifier);
  const url = `${API_BASE_URL}${API_ENDPOINTS.VERIFY_LOGIN}`;

  const data = await authFetchHandler(url, {
    method: 'POST',
    body: JSON.stringify({
      identifier: formattedIdentifier,
      otp,
    }),
  });

  // ✅ Save token automatically if present
  if (data.token) {
    await saveAuthData(data.token);
  }

  return data;
};

// =============================================
// RESEND OTP
// =============================================

export const resendOtp = async ({ identifier }: ResendOtpPayload) => {
  const formattedIdentifier = formatIdentifier(identifier);
  const url = `${API_BASE_URL}${API_ENDPOINTS.RESEND_OTP}`;

  return await authFetchHandler(url, {
    method: 'POST',
    body: JSON.stringify({
      identifier: formattedIdentifier,
    }),
  });
};

// =============================================
// ACCOUNT SWITCHING
// =============================================

export const switchAccount = async ({ targetUserId }: SwitchAccountPayload) => {
  const url = `${API_BASE_URL}${API_ENDPOINTS.SWITCH_ACCOUNT}`;

  const data = await authFetchHandler(url, {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
  });

  // ✅ Save new token if present
  if (data.token) {
    await saveAuthData(data.token);
  }

  return data;
};

// =============================================
// ADD LINKED ACCOUNT
// =============================================

export const addLinkedAccount = async (payload: AddLinkedAccountPayload) => {
  const url = `${API_BASE_URL}${API_ENDPOINTS.ADD_LINKED_ACCOUNT}`;

  const data = await authFetchHandler(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return data;
};

// =============================================
// GET LINKED ACCOUNTS
// =============================================

export const fetchLinkedAccounts = async () => {
  const url = `${API_BASE_URL}${API_ENDPOINTS.GET_LINKED_ACCOUNTS}`;

  const data = await authFetchHandler(url, {
    method: 'GET',
  });

  return data;
};

// =============================================
// REMOVE LINKED ACCOUNT
// =============================================

export const removeLinkedAccount = async (targetUserId: string) => {
  const url = `${API_BASE_URL}${API_ENDPOINTS.REMOVE_LINKED_ACCOUNT}`;

  const data = await authFetchHandler(url, {
    method: 'DELETE',
    body: JSON.stringify({ targetUserId }),
  });

  return data;
};

// =============================================
// TOKEN MANAGEMENT - Using TokenSlice
// =============================================

export const getCurrentToken = async (): Promise<string | null> => {
  return await getAuthToken();
};

export const clearAuth = async (): Promise<void> => {
  await clearAuthData();
};

export const isAuthenticated = async (): Promise<boolean> => {
  const token = await getAuthToken();
  if (!token) return false;

  try {
    const decoded: { exp: number } = jwtDecode(token);
    const now = Date.now() / 1000;
    if (decoded.exp < now) {
      await clearAuthData();
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const logout = async (): Promise<void> => {
  await clearAuthData();
};

// =============================================
// EXPORT CONFIGURATION
// =============================================

console.log('🔧 Auth Service Configuration:');
console.log('📡 API Base URL:', API_BASE_URL);
console.log('📡 Signup Endpoint:', API_ENDPOINTS.SIGNUP);
console.log('📡 Login Endpoint:', API_ENDPOINTS.LOGIN);
