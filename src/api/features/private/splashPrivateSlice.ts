import { getToken, removeToken } from '../../connections/token/tokenSlice';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';

// Interface for token verification response
interface VerifyTokenResponse {
  success: boolean;
  message?: string;
  user?: any;
}

export const splashApi = {
  /**
 * @name VerifyTokenResponse
 
 * @success 200 - Token is valid, user data returned

 * @failure 401 - Token is invalid, user must log in again

 * @user  - The user object returned on successful token verification, containing user details such as name, email, and any other relevant information.

 * @message - A message string returned on failure, providing details about why the token verification failed (e.g., "Token invalid", "No token provided", "Network error").

 */

  // Verify token with backend
  verifyToken: async (): Promise<VerifyTokenResponse> => {
    try {
      const token = await getToken();

      console.log('📦 Token being sent to backend:', token);

      if (!token) {
        console.warn('⚠️ No token found before API call!');
        return { success: false, message: 'No token provided' };
      }

      /**
       * @route   GET /api/auth/check
       * @desc    Check if the user's token is valid and retrieve user information.
       * @access  Private
       * @body    None
       * @response
       *  - Success: { success: true, user: { ...userData } }
       *  - Failure: { success: false, message: 'Token invalid' }
       */

      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.VERIFY_USER_ROUTE}`,
        /**
       * @API_BASE_URL - The base URL for the API, defined in the environment variables.

       * @API_ENDPOINTS.VERIFY_USER_ROUTE - The specific endpoint for verifying the user's token, defined in the API endpoints configuration.
       */
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
        return { success: true, user: data.user };

        /**
         * Note: The backend should return a 200 status code for valid tokens and include the user data in the response. If the token is invalid, it should return a 401 status code, which will be handled in the UI to redirect to the login screen.
         */
      } else {
        return {
          success: false,
          message: data.message || 'Token invalid',
        };
      }
      // Note: The backend should return a 401 status code for invalid tokens, which will be handled in the UI to redirect to the login screen.
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
