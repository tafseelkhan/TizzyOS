// src/core/services/SplashService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// API URL - Change this to your actual API URL
const API_URL = 'http://172.20.10.12:5000';

// Interface for token verification response
interface VerifyTokenResponse {
  success: boolean;
  message?: string;
  user?: any;
}

// Interface for login response
interface LoginResponse {
  success: boolean;
  token?: string;
  user?: any;
  message?: string;
}

// Interface for signup response
interface SignupResponse {
  success: boolean;
  token?: string;
  user?: any;
  message?: string;
}

// Verify token with backend
export const verifyToken = async (token: string): Promise<VerifyTokenResponse> => {
  try {
    console.log('📦 Token being sent to backend:', token);

    if (!token) {
      console.warn('⚠️ No token found before API call!');
      return { success: false, message: 'No token provided' };
    }

    const response = await fetch(`${API_URL}/api/auth/check`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Token verification response status:', response.status);

    const data = await response.json();
    console.log('✅ Token verification response:', data);

    if (response.ok && data.success) {
      return { success: true, user: data.user };
    } else {
      return { success: false, message: data.message || 'Token invalid' };
    }
  } catch (error: any) {
    console.error('❌ Token verification failed:', error?.message || error);
    return { success: false, message: 'Network error' };
  }
};
