// services/auth/AuthService.ts
import {
  login as apiLogin,
  verifyLogin as apiVerifyLogin,
  resendOtp as apiResendOtp,
} from '../../../api/features/public/authPublicSlice';

export interface LoginResult {
  success: boolean;
  msg?: string;
  token?: string;
  userId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  formattedIdentifier?: string;
}

// Type definitions for API calls
interface LoginRequest {
  identifier: string;
}

interface VerifyLoginRequest {
  identifier: string;
  otp: string;
}

/**
 * Auth Service - Handles all authentication business logic
 */
export class AuthService {
  /**
   * Validate email or phone number
   * @param identifier - Email or phone number to validate
   * @returns Validation result with formatted identifier if valid
   */
  static validateIdentifier(identifier: string): ValidationResult {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      return {
        isValid: false,
        error: 'Please enter your email or phone number',
      };
    }

    const isEmail = trimmedIdentifier.includes('@');
    const isPhone = /^\d+$/.test(trimmedIdentifier.replace(/\D/g, ''));

    if (isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedIdentifier)) {
        return { isValid: false, error: 'Please enter a valid email address' };
      }
      return { isValid: true, formattedIdentifier: trimmedIdentifier };
    }

    if (isPhone) {
      const cleanPhone = trimmedIdentifier.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return {
          isValid: false,
          error: 'Please enter a valid 10-digit phone number',
        };
      }
      return { isValid: true, formattedIdentifier: cleanPhone };
    }

    return {
      isValid: false,
      error: 'Please enter a valid email or phone number',
    };
  }

  /**
   * Validate OTP
   * @param otp - OTP to validate
   * @returns Validation result
   */
  static validateOTP(otp: string): ValidationResult {
    if (!otp) {
      return { isValid: false, error: 'Please enter the OTP' };
    }

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return { isValid: false, error: 'Please enter a valid 6-digit OTP' };
    }

    return { isValid: true };
  }

  /**
   * Send OTP for login
   * @param identifier - Email or phone number
   * @returns Promise with login result
   */
  static async sendOTP(identifier: string): Promise<LoginResult> {
    try {
      // Validate identifier
      const validation = this.validateIdentifier(identifier);
      if (!validation.isValid) {
        return { success: false, msg: validation.error };
      }

      // Prepare request
      const request: LoginRequest = {
        identifier: validation.formattedIdentifier || identifier.trim(),
      };

      // Call API
      const response = await apiLogin(request);

      console.log('Login API response:', response);

      // Check if OTP was sent successfully
      if (response?.msg?.toLowerCase().includes('otp sent')) {
        return {
          success: true,
          msg: `OTP sent to ${identifier}`,
        };
      }

      // Handle user not found or other errors
      return {
        success: false,
        msg: response?.msg || 'User not found. Please sign up first.',
      };
    } catch (error: any) {
      console.error('Send OTP error:', error);
      return {
        success: false,
        msg: error?.message || 'Login failed. Please try again.',
      };
    }
  }

  /**
   * Verify OTP and authenticate user
   * @param identifier - Email or phone number
   * @param otp - OTP to verify
   * @returns Promise with authentication result
   */
  static async verifyOTPAndLogin(
    identifier: string,
    otp: string,
  ): Promise<LoginResult> {
    try {
      // Validate OTP
      const otpValidation = this.validateOTP(otp);
      if (!otpValidation.isValid) {
        return { success: false, msg: otpValidation.error };
      }

      // Validate identifier
      const identifierValidation = this.validateIdentifier(identifier);
      if (!identifierValidation.isValid) {
        return { success: false, msg: identifierValidation.error };
      }

      // Prepare request
      const request: VerifyLoginRequest = {
        identifier:
          identifierValidation.formattedIdentifier || identifier.trim(),
        otp: otp.trim(),
      };

      // Call API
      const response = await apiVerifyLogin(request);

      console.log('Verify login response:', response);

      // Check if verification was successful
      if (response?.token && response?.user?._id) {
        // Store auth data
        return {
          success: true,
          token: response.token,
          userId: response.user._id,
          msg: response?.msg || 'Login successful',
        };
      }

      // Handle invalid OTP
      return {
        success: false,
        msg: response?.msg || 'Invalid OTP. Please try again.',
      };
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      return {
        success: false,
        msg: error?.message || 'OTP verification failed',
      };
    }
  }

  /**
   * Resend OTP
   * @param identifier - Email or phone number
   * @returns Promise with resend result
   */
  static async resendOTP(identifier: string): Promise<LoginResult> {
    try {
      // Validate identifier
      const validation = this.validateIdentifier(identifier);
      if (!validation.isValid) {
        return { success: false, msg: validation.error };
      }

      // Prepare request
      const request: LoginRequest = {
        identifier: validation.formattedIdentifier || identifier.trim(),
      };

      // Call API
      const response = await apiResendOtp(request);

      console.log('Resend OTP response:', response);

      // Check if OTP was resent successfully
      if (response?.msg?.toLowerCase().includes('otp sent')) {
        return {
          success: true,
          msg: `OTP resent to ${identifier}`,
        };
      }

      // Handle failure
      return {
        success: false,
        msg: response?.msg || 'Failed to resend OTP',
      };
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      return {
        success: false,
        msg: error?.message || 'Something went wrong while resending OTP',
      };
    }
  }
}

// For backward compatibility with existing code
export const login = AuthService.sendOTP;
export const verifyLogin = AuthService.verifyOTPAndLogin;
export const resendOtp = AuthService.resendOTP;
