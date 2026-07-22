// src/services/authService.ts
import axios from 'axios';
import {
  setToken,
  removeToken,
  getToken,
} from '../../api/connections/token/tokenSlice';
import { jwtDecode } from 'jwt-decode';

// =============================================
// TYPES - ✅ FIXED: Added role support
// =============================================

export interface AuthResponse {
  success: boolean;
  msg?: string;
  token?: string;
  identifier?: string;
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

export interface SignupPayload {
  identifier: string;
  role?: string; // ✅ Added role
}

export interface VerifySignupPayload {
  identifier: string;
  otp: string;
  name: string;
  role?: string; // ✅ Added role
}

export interface LoginPayload {
  identifier: string;
}

export interface VerifyLoginPayload {
  identifier: string;
  otp: string;
}

export interface ResendOtpPayload {
  identifier: string;
}

// =============================================
// TOKEN MANAGEMENT
// =============================================

export const verifyToken = async (
  token: string,
): Promise<{ success: boolean }> => {
  try {
    console.log('📦 Token being sent to backend:', token);

    if (!token) {
      console.warn('⚠️ No token found before API call!');
      return { success: false };
    }

    const res = await axios.get('http://172.20.245.121:5000/api/v0/auth/check', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('✅ Token verification response:', res.data);
    return { success: res.data.success };
  } catch (error: any) {
    console.error(
      '❌ Token verification failed:',
      error?.response?.data || error,
    );
    return { success: false };
  }
};

// 🔐 Token check utility
export const checkToken = async (): Promise<string | null> => {
  try {
    let token = await getToken();
    if (!token) return null;

    const decoded: { exp: number } = jwtDecode(token);
    const now = Date.now() / 1000;

    if (decoded.exp < now) {
      return null;
    }

    return token;
  } catch (err) {
    console.error('❌ Token check failed:', err);
    return null;
  }
};

// ✅ Helper: Save token with expiry and user data
export const saveAuthData = async (
  token: string,
  userId: string,
  linkedAccounts?: any[],
): Promise<void> => {
  try {
    await setToken(token);
    console.log('✅ Auth data saved successfully');
  } catch (error) {
    console.error('❌ Error saving auth data:', error);
    throw error;
  }
};

// ✅ Common fetch handler
const fetchHandler = async (url: string, options: RequestInit) => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
// SIGNUP - Step 1: Send OTP (✅ FIXED)
// =============================================

export const signup = async ({ identifier, role }: SignupPayload) => {
  const formattedIdentifier = identifier.toLowerCase().trim();

  try {
    const response = await fetch('http://172.20.245.121:5000/api/v0/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: formattedIdentifier,
        role: role || 'SELLER', // ✅ Send role to backend
      }),
    });

    const data = await response.json();
    
    console.log('📥 Signup Raw Response:', data);

    // ✅ Normalize response - Always return consistent format
    return {
      success: response.ok,
      msg: data.msg || (response.ok ? 'OTP sent successfully' : 'Failed to send OTP'),
      identifier: data.identifier || formattedIdentifier,
      ...data
    };
  } catch (error: any) {
    console.error('❌ Signup API error:', error);
    return {
      success: false,
      msg: error.message || 'Network error. Please try again.',
      identifier: identifier,
    };
  }
};

// =============================================
// SIGNUP - Step 2: Verify OTP (✅ FIXED)
// =============================================

export const verifySignup = async ({
  identifier,
  otp,
  name,
  role,
}: VerifySignupPayload) => {
  const formattedIdentifier = identifier.toLowerCase().trim();

  try {
    const response = await fetch('http://172.20.245.121:5000/api/v0/auth/verify-signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: formattedIdentifier,
        otp,
        name,
        role: role || 'SELLER', // ✅ Send role to backend
      }),
    });

    const data = await response.json();
    
    console.log('📥 Verify Raw Response:', data);

    // ✅ Normalize response
    const result = {
      success: response.ok,
      msg: data.msg || (response.ok ? 'Verification successful' : 'Verification failed'),
      token: data.token,
      user: data.user,
      linkedAccounts: data.linkedAccounts,
      ...data
    };

    // ✅ Save token if present
    if (result.token && result.user?._id) {
      await saveAuthData(result.token, result.user._id, result.linkedAccounts);
    }

    return result;
  } catch (error: any) {
    console.error('❌ Verify API error:', error);
    return {
      success: false,
      msg: error.message || 'Verification failed. Please try again.',
    };
  }
};

// =============================================
// LOGIN - Step 1: Send OTP
// =============================================

export const login = async ({ identifier }: LoginPayload) => {
  const formattedIdentifier = identifier.toLowerCase().trim();

  return await fetchHandler(
    'http://172.20.245.121:5000/api/v0/auth/send-login-otp',
    {
      method: 'POST',
      body: JSON.stringify({ identifier: formattedIdentifier }),
    },
  );
};

// =============================================
// LOGIN - Step 2: Verify OTP
// =============================================

export const verifyLogin = async ({ identifier, otp }: VerifyLoginPayload) => {
  const formattedIdentifier = identifier.toLowerCase().trim();

  const data = await fetchHandler(
    'http://172.20.245.121:5000/api/v0/auth/verify-login',
    {
      method: 'POST',
      body: JSON.stringify({
        identifier: formattedIdentifier,
        otp,
      }),
    },
  );

  // ✅ Token automatically save karo
  if (data.token && data.user && data.user._id) {
    await saveAuthData(data.token, data.user._id, data.linkedAccounts);
  }

  return data;
};

// =============================================
// RESEND OTP
// =============================================

export const resendOtp = async ({ identifier }: ResendOtpPayload) => {
  const formattedIdentifier = identifier.toLowerCase().trim();

  return await fetchHandler('http://172.20.245.121:5000/api/v0/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier: formattedIdentifier }),
  });
};

// =============================================
// AUTH STATUS CHECK
// =============================================

export const isAuthenticated = async (): Promise<boolean> => {
  const token = await checkToken();
  return !!token;
};

export const getCurrentToken = async (): Promise<string | null> => {
  return await checkToken();
};

// =============================================
// ACCOUNT SWITCHING (Optional - for later use)
// =============================================

export interface SwitchAccountPayload {
  targetUserId: string;
}

export const switchAccount = async ({ targetUserId }: SwitchAccountPayload) => {
  const token = await getCurrentToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const data = await fetchHandler(
    'http://172.20.245.121:5000/api/v0/auth/switch-account',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUserId }),
    },
  );

  // ✅ Save new token if present
  if (data.token && data.currentAccount) {
    await saveAuthData(
      data.token,
      data.currentAccount.userId,
      data.linkedAccounts,
    );
  }

  return data;
};

export interface AddLinkedAccountPayload {
  name: string;
  email?: string;
  phone?: string;
  role: 'SELLER' | 'FWS' | 'SHIPPING';
}

export const addLinkedAccount = async (payload: AddLinkedAccountPayload) => {
  const token = await getCurrentToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const data = await fetchHandler(
    'http://172.20.245.121:5000/api/v0/auth/add-linked-account',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return data;
};

export const fetchLinkedAccounts = async () => {
  const token = await getCurrentToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const data = await fetchHandler(
    'http://172.20.245.121:5000/api/v0/auth/linked-accounts',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return data;
};

export const removeLinkedAccount = async (targetUserId: string) => {
  const token = await getCurrentToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const data = await fetchHandler(
    'http://172.20.245.121:5000/api/v0/auth/remove-linked-account',
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUserId }),
    },
  );

  return data;
};

export const checkAuthStatus = async () => {
  try {
    const token = await getCurrentToken();
    if (!token) {
      return { authenticated: false };
    }

    const response = await axios.get(
      'http://172.20.245.121:5000/api/v0/auth/check-auth',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return {
      authenticated: response.data.authenticated || false,
      user: response.data.user,
      linkedAccounts: response.data.linkedAccounts,
    };
  } catch (error) {
    console.error('❌ Auth check failed:', error);
    return { authenticated: false };
  }
};
