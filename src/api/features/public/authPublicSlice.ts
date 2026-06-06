import Config from 'react-native-config';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { fetchHandler } from '../../../core/utils/handler/fetchHandler';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { setToken } from '../../connections/token/tokenSlice';

// ================================
// TYPES
// ================================

interface AuthPayload {
  identifier: string;
}

interface VerifySignupPayload {
  identifier: string;
  otp: string;
  name: string;
}

interface VerifyLoginPayload {
  identifier: string;
  otp: string;
}

// ================================
// HELPERS
// ================================

const formatIdentifier = (identifier: string) => {
  return identifier.toLowerCase().trim();
};

/**
 * @param identifier - The user's identifier, which can be an email or phone number.
 * @returns A promise that resolves to the response from the signup API endpoint, indicating whether the OTP was sent successfully.
 */
// ================================
// SIGNUP - SEND OTP
// ================================

export const signup = async ({ identifier }: AuthPayload) => {
  console.log(
    'Sending signup request to:',
    `${API_BASE_URL}${API_ENDPOINTS.SIGNUP}`,
  );
  return await fetchHandler(`${API_BASE_URL}${API_ENDPOINTS.SIGNUP}`, {
    method: 'POST',
    body: JSON.stringify({
      identifier: formatIdentifier(identifier),
    }),
  });
};
console.log('BASE URL:', Config.API_AXIOS_BASE_URL);
console.log('API_ENDPOINTS:', API_ENDPOINTS.SIGNUP);

// ================================
// VERIFY SIGNUP
// ================================

/**
 * Verifies the user's signup information with the provided OTP.
 * @param identifier - The user's identifier (email or phone number).
 * @param otp - The one-time password sent to the user.
 * @param name - The user's name.
 * @returns A promise resolving to the result of the fetch operation.
 */
export const verifySignup = async ({
  identifier,
  otp,
  name,
}: VerifySignupPayload) => {
  const data = await fetchHandler(
    `${API_BASE_URL}${API_ENDPOINTS.VERIFY_SIGNUP}`,
    {
      method: 'POST',
      body: JSON.stringify({
        identifier: formatIdentifier(identifier),
        otp,
        name,
      }),
    },
  );

  // Save auth data automatically
  if (data?.token && data?.user?._id) {
    await setToken(data.token);
  }

  return data;
};

/**
 * Initiates the login process by sending an OTP to the specified identifier.
 * @param identifier - The user's identifier (email or phone number).
 * @returns A promise resolving to the result of the fetch operation.
 */
// ================================
// LOGIN - SEND OTP
// ================================

export const login = async ({ identifier }: AuthPayload) => {
  console.log(
    'Sending login request to:',
    `${API_BASE_URL}${API_ENDPOINTS.LOGIN}`,
  );
  return await fetchHandler(`${API_BASE_URL}${API_ENDPOINTS.LOGIN}`, {
    method: 'POST',
    body: JSON.stringify({
      identifier: formatIdentifier(identifier),
    }),
  });
};
console.log('BASE URL:', Config.API_AXIOS_BASE_URL);
console.log('API_ENDPOINTS:', API_ENDPOINTS.LOGIN);
/**
 * Verifies the user's login credentials with the provided OTP.
 * @param identifier - The user's identifier (email or phone number).
 * @param otp - The one-time password sent to the user.
 * @returns A promise resolving to the result of the fetch operation.
 */
// ================================
// VERIFY LOGIN
// ================================

export const verifyLogin = async ({ identifier, otp }: VerifyLoginPayload) => {
  const data = await fetchHandler(
    `${API_BASE_URL}${API_ENDPOINTS.VERIFY_LOGIN}`,
    {
      method: 'POST',
      body: JSON.stringify({
        identifier: formatIdentifier(identifier),
        otp,
      }),
    },
  );

  // Save auth data automatically
  if (data?.token && data?.user?._id) {
    await setToken(data.token);
  }
console.log('token:', data.token)
  return data;
};

/**
 * Resends an OTP to the specified identifier.
 * @param identifier - The user's identifier (email or phone number).
 * @returns A promise resolving to the result of the fetch operation.
 */
// ================================
// RESEND OTP
// ================================

export const resendOtp = async ({ identifier }: AuthPayload) => {
  return await fetchHandler(`${API_BASE_URL}${API_ENDPOINTS.RESEND_OTP}`, {
    method: 'POST',
    body: JSON.stringify({
      identifier: formatIdentifier(identifier),
    }),
  });
};

/**
 * @description
 * This module provides functions to handle user authentication processes such as signup, login, OTP verification, and resending OTP.
 */
