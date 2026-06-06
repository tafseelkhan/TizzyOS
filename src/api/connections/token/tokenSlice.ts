// Token management utilities for authentication and session handling in the app.

// This module provides functions to set, get, and remove the authentication token from AsyncStorage,

// as well as a function to verify the token with the backend server.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../keys/storageKeys';

// Verify token with backend server to check if it's still valid and retrieve user info if needed.
// This function sends the token to the backend API and expects a response indicating whether the token is valid and, if so, any associated user information.
export const setToken = async (token: string) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  } catch (error) {
    console.log('Error setting token ❌', error);
  }
};

// Token management functions for authentication and session handling.
// These functions interact with AsyncStorage to persist the authentication token across app sessions, and also include a function to verify the token with the backend server.
export const getToken = async () => {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    return token;
  } catch (error) {
    console.log('Error getting token ❌', error);
    return null;
  }
};

// Remove token from AsyncStorage, effectively logging the user out of the app.
// This function is called when the user logs out or when the token is deemed invalid, ensuring that the app no longer has access to the old token.
export const removeToken = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  } catch (error) {
    console.log('Error removing token ❌', error);
  }
};
