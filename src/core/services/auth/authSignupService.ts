// services/AuthService.ts
import {
  signup as signupApi,
  verifySignup as verifySignupApi,
  resendOtp as resendOtpApi,
} from '../../../api/features/public/authPublicSlice';

interface SignupParams {
  identifier: string;
}

interface VerifySignupParams {
  identifier: string;
  otp: string;
  name: string;
}

interface SignupResult {
  identifier?: string;
  msg?: string;
  success: boolean;
}

interface VerifySignupResult {
  token?: string;
  user?: {
    _id: string;
    name?: string;
    email?: string;
  };
  msg?: string;
  success: boolean;
}

/**
 * Signup service - Sends OTP to user's email/phone
 */
export const signup = async ({
  identifier,
}: SignupParams): Promise<SignupResult> => {
  try {
    const response = await signupApi({ identifier });

    // Check if response is successful and contains identifier
    if (response?.identifier) {
      return {
        identifier: response.identifier,
        msg: response.msg || `OTP sent to ${response.identifier}`,
        success: true,
      };
    }

    // Check if response has error message
    if (response?.msg) {
      return {
        msg: response.msg,
        success: false,
      };
    }

    // Default error case
    return {
      msg: 'Failed to send OTP. Please try again.',
      success: false,
    };
  } catch (error: any) {
    console.error('Signup service error:', error);
    return {
      msg: error?.msg || error?.message || 'An unexpected error occurred',
      success: false,
    };
  }
};

/**
 * Verify Signup service - Verifies OTP and completes signup
 */
export const verifySignup = async ({
  identifier,
  otp,
  name,
}: VerifySignupParams): Promise<VerifySignupResult> => {
  try {
    const response = await verifySignupApi({ identifier, otp, name });

    // Check if verification successful
    if (response?.token && response?.user?._id) {
      // Also store user data if needed
      if (response.user.name) {
      }
      if (response.user.email) {
      }

      return {
        token: response.token,
        user: response.user,
        success: true,
      };
    }

    // Check if response has error message
    if (response?.msg) {
      return {
        msg: response.msg,
        success: false,
      };
    }

    // Default error case
    return {
      msg: 'Invalid OTP. Please try again.',
      success: false,
    };
  } catch (error: any) {
    console.error('Verify signup service error:', error);
    return {
      msg: error?.msg || error?.message || 'An unexpected error occurred',
      success: false,
    };
  }
};

/**
 * Resend OTP service - Resends OTP to user's email/phone
 */
export const resendOTP = async ({
  identifier,
}: SignupParams): Promise<SignupResult> => {
  try {
    const response = await resendOtpApi({ identifier });

    // Check if response is successful
    if (response?.identifier) {
      return {
        identifier: response.identifier,
        msg: response.msg || `OTP resent to ${response.identifier}`,
        success: true,
      };
    }

    // Check if response has error message
    if (response?.msg) {
      return {
        msg: response.msg,
        success: false,
      };
    }

    // Default error case
    return {
      msg: 'Failed to resend OTP. Please try again.',
      success: false,
    };
  } catch (error: any) {
    console.error('Resend OTP service error:', error);
    return {
      msg: error?.msg || error?.message || 'An unexpected error occurred',
      success: false,
    };
  }
};
