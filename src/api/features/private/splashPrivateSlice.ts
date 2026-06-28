// api/features/private/splashPrivateSlice.ts
import { getToken, removeToken } from '../../connections/token/tokenSlice';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';

// Interface for token verification response
export interface VerifyTokenResponse {
  success: boolean;
  message?: string;
  user?: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    role: string; // ✅ Added role
    roles?: string; // Fallback
    [key: string]: any;
  };
}

export const splashApi = {
  /**
   * Verify token with backend
   * @returns {Promise<VerifyTokenResponse>} - Token verification response with user data
   */
  verifyToken: async (): Promise<VerifyTokenResponse> => {
    try {
      const token = await getToken();

      console.log('📦 Token being sent to backend:', token);

      if (!token) {
        console.warn('⚠️ No token found before API call!');
        return { success: false, message: 'No token provided' };
      }

      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.VERIFY_USER_ROUTE}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('📡 Token verification response status:', response.status);

      const data = await response.json();
      console.log('✅ Token verification response:', data);

      if (response.ok && data.success) {
        // ✅ Extract role from response
        const userData = data.user || data.data || {};
        const role = userData.role || userData.roles || 'SELLER';

        console.log('👤 User Role extracted:', role);

        return {
          success: true,
          user: {
            ...userData,
            role: role,
          },
          message: data.message,
        };
      } else {
        return {
          success: false,
          message: data.message || 'Token invalid',
        };
      }
    } catch (error: any) {
      console.error('❌ Token verification failed:', error?.message || error);
      return { success: false, message: 'Network error' };
    }
  },

  /**
   * Clear auth token
   */
  clearAuthToken: async (): Promise<void> => {
    try {
      await removeToken();
      console.log('✅ Auth token removed');
    } catch (error) {
      console.error('❌ Error removing token:', error);
    }
  },
};
