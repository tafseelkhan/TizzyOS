// src/services/authService.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

export const verifyToken = async (
  token: string,
): Promise<{ success: boolean }> => {
  try {
    console.log('📦 Token being sent to backend:', token); // ✅ Debug log

    if (!token) {
      console.warn('⚠️ No token found before API call!');
      return { success: false };
    }

    const res = await axios.get('http://172.20.10.12:5000/api/auth/check', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('✅ Token verification response:', res.data); // ✅ Debug log

    return { success: res.data.success };
  } catch (error: any) {
    console.error(
      '❌ Token verification failed:',
      error?.response?.data || error,
    );
    return { success: false };
  }
};

// 🔐 Token check utility (sirf token validate karega)
export const checkToken = async (): Promise<string | null> => {
  try {
    // Pehle authToken check karo
    let token = await AsyncStorage.getItem('authToken');

    if (!token) return null;

    const decoded: { exp: number } = jwtDecode(token);
    const now = Date.now() / 1000;

    if (decoded.exp < now) {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userId');
      return null;
    }

    return token;
  } catch (err) {
    console.error('❌ Token check failed:', err);
    return null;
  }
};

// ✅ Helper: Save token with expiry
export const saveAuthData = async (
  token: string,
  userId: string,
): Promise<void> => {
  try {
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('userId', userId);
  } catch (error) {
    console.error('❌ Error saving auth data:', error);
    throw error;
  }
};

// ✅ Helper: Clear auth data
export const clearAuthData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove(['authToken', 'userId']);
  } catch (error) {
    console.error('❌ Error clearing auth data:', error);
  }
};

// ✅ Helper: Get current user ID
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('userId');
  } catch (error) {
    console.error('❌ Error getting user ID:', error);
    return null;
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

// ✅ Signup - Step 1: Send OTP
export const signup = async ({ identifier }: { identifier: string }) => {
  const formattedIdentifier = identifier.toLowerCase().trim();

  return await fetchHandler('http://172.20.10.12:5000/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ identifier: formattedIdentifier }),
  });
};

// ✅ Signup - Step 2: Verify OTP & Create Profile
export const verifySignup = async ({
  identifier,
  otp,
  name,
}: {
  identifier: string;
  otp: string;
  name: string;
}) => {
  const formattedIdentifier = identifier.toLowerCase().trim();

  const data = await fetchHandler(
    'http://172.20.10.12:5000/api/auth/verify-signup',
    {
      method: 'POST',
      body: JSON.stringify({
        identifier: formattedIdentifier,
        otp,
        name,
      }),
    },
  );

  // ✅ Token automatically save karo agar mila toh
  if (data.token && data.user && data.user._id) {
    await saveAuthData(data.token, data.user._id);
  }

  return data;
};

// ✅ Login - Step 1: Send OTP
export const login = async ({ identifier }: { identifier: string }) => {
  const formattedIdentifier = identifier.toLowerCase().trim();

  return await fetchHandler('http://172.20.10.12:5000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: formattedIdentifier }),
  });
};

// ✅ Login - Step 2: Verify OTP (TOKEN AUTOMATICALLY STORE HOGA)
export const verifyLogin = async ({
  identifier,
  otp,
}: {
  identifier: string;
  otp: string;
}) => {
  const formattedIdentifier = identifier.toLowerCase().trim();

  const data = await fetchHandler(
    'http://172.20.10.12:5000/api/auth/verify-login',
    {
      method: 'POST',
      body: JSON.stringify({
        identifier: formattedIdentifier,
        otp,
      }),
    },
  );

  // ✅ TOKEN AUTOMATICALLY STORE KARO
  if (data.token && data.user && data.user._id) {
    await saveAuthData(data.token, data.user._id);
  }

  return data;
};

// ✅ Resend OTP
export const resendOtp = async ({ identifier }: { identifier: string }) => {
  const formattedIdentifier = identifier.toLowerCase().trim();

  return await fetchHandler('http://172.20.10.12:5000/api/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier: formattedIdentifier }),
  });
};

// ✅ Logout user
export const logout = async (): Promise<void> => {
  await clearAuthData();
};

// ✅ Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const token = await checkToken();
  return !!token;
};

// ✅ Get current user token
export const getCurrentToken = async (): Promise<string | null> => {
  return await checkToken();
};
