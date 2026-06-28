// services/SplashService.ts
import { splashApi } from '../../../api/features/private/splashPrivateSlice';

export interface AuthResult {
  success: boolean;
  shouldNavigateTo: 'Home' | 'Login' | 'Signup';
  userRole?: string;
  userData?: any;
}

/**
 * Service for splash screen related operations
 */
export class SplashService {
  /**
   * Verify token and determine navigation destination
   * @param token - Auth token to verify
   * @returns Promise with navigation decision and user role
   */
  static async verifyTokenAndNavigate(): Promise<AuthResult> {
    try {
      console.log('🔄 Verifying token with server...');
      const result = await splashApi.verifyToken();
      console.log('Token verification result:', result);

      if (result.success && result.user) {
        console.log('✅ Token valid, navigate to Home');
        console.log('👤 User Role:', result.user.role || result.user.roles);
        console.log('👤 User Data:', result.user);

        return {
          success: true,
          shouldNavigateTo: 'Home',
          userRole: result.user.role || result.user.roles,
          userData: result.user,
        };
      } else {
        console.log('❌ Token invalid, clearing and navigating to Login');
        console.log('Going to Login...');
        await splashApi.clearAuthToken();
        return {
          success: false,
          shouldNavigateTo: 'Login',
          userRole: undefined,
          userData: undefined,
        };
      }
    } catch (error) {
      console.error('❌ Auth error:', error);
      return {
        success: false,
        shouldNavigateTo: 'Signup',
        userRole: undefined,
        userData: undefined,
      };
    }
  }

  /**
   * Check auth status and get navigation destination with user role
   * @returns Promise with navigation destination and user role
   */
  static async checkAuthAndGetDestination(): Promise<AuthResult> {
    return await this.verifyTokenAndNavigate();
  }

  /**
   * Simulate minimum loading time
   * @param minTime - Minimum time in milliseconds
   * @returns Promise that resolves after minTime
   */
  static async waitMinimumTime(minTime: number = 3000): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`⏰ ${minTime / 1000} seconds elapsed`);
        resolve();
      }, minTime);
    });
  }

  /**
   * Get user role from stored token/user data
   */
  static async getUserRole(): Promise<string | null> {
    try {
      const result = await splashApi.verifyToken();
      if (result.success && result.user) {
        return result.user.role || result.user.roles || null;
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting user role:', error);
      return null;
    }
  }
}

// For backward compatibility
export const verifyToken = splashApi.verifyToken;
