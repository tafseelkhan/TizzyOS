// services/SplashService.ts
import { splashApi } from '../../../api/features/private/splashPrivateSlice';

export interface AuthResult {
  success: boolean;
  shouldNavigateTo: 'Home' | 'Login' | 'Signup';
}

/**
 * Service for splash screen related operations
 */
export class SplashService {
  /**
   * Verify token and determine navigation destination
   * @param token - Auth token to verify
   * @returns Promise with navigation decision
   */
  static async verifyTokenAndNavigate(): Promise<AuthResult> {
    try {
      console.log('🔄 Verifying token with server...');
      const { success } = await splashApi.verifyToken();
      console.log('Token verification result:', success);

      if (success) {
        console.log('✅ Token valid, navigate to Home');
        return {
          success: true,
          shouldNavigateTo: 'Home',
        };
      } else {
        console.log('❌ Token invalid, clearing and navigating to Login');
        await splashApi.clearAuthToken();
        return {
          success: false,
          shouldNavigateTo: 'Login',
        };
      }
    } catch (error) {
      console.error('❌ Auth error:', error);
      return {
        success: false,
        shouldNavigateTo: 'Signup',
      };
    }
  }

  /**
   * Check auth status and get navigation destination
   * @returns Promise with navigation destination
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
}

// For backward compatibility
export const verifyToken = splashApi.verifyToken;
