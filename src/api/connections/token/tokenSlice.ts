import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../keys/storageKeys';

const SESSION_TOKEN_KEY =
  (STORAGE_KEYS as Record<string, string>).SESSION_TOKEN ?? 'QUTON_SESSION_TOKEN';

export interface AuthTokens {
  accessToken: string;
  sessionToken: string;
}

export const setToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
};

export const getToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
};

export const removeToken = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
};

export const setSessionToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
};

export const getSessionToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(SESSION_TOKEN_KEY);
};

export const removeSessionToken = async (): Promise<void> => {
  await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
};

export const setAuthTokens = async ({
  accessToken,
  sessionToken,
}: AuthTokens): Promise<void> => {
  if (!accessToken || !sessionToken) {
    throw new Error('Both accessToken and sessionToken are required.');
  }

  // Store both together from the caller's perspective.
  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken),
    AsyncStorage.setItem(SESSION_TOKEN_KEY, sessionToken),
  ]);
};

export const clearAuthTokens = async (): Promise<void> => {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN),
    AsyncStorage.removeItem(SESSION_TOKEN_KEY),
  ]);
};
