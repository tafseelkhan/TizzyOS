// src/api/features/private/themePrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest, ApiError } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserThemeResponse {
  success: boolean;
  theme?: ThemeMode;
  message?: string;
  [key: string]: unknown;
}

// ============================================================
// 1. GET USER THEME
// ============================================================

export const getUserTheme = async (): Promise<ThemeMode | null> => {
  try {
    const data = await apiRequest<UserThemeResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.USER_THEME}`,
      { method: 'GET' },
    );

    if (
      data.success &&
      data.theme &&
      ['light', 'dark', 'system'].includes(data.theme)
    ) {
      return data.theme;
    }

    return null;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ getUserTheme error:', error);
    }
    return null;
  }
};

// ============================================================
// 2. UPDATE USER THEME
// ============================================================

export const updateUserTheme = async (
  theme: ThemeMode,
): Promise<ThemeMode> => {
  const data = await apiRequest<UserThemeResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.USER_THEME}`,
    {
      method: 'POST',
      body: JSON.stringify({ theme }),
    },
  );

  if (!data.success) {
    throw new Error(data.message || 'Theme update failed on server');
  }

  // Server may return a different theme (e.g., normalized)
  if (
    data.theme &&
    ['light', 'dark', 'system'].includes(data.theme) &&
    data.theme !== theme
  ) {
    return data.theme;
  }

  return theme;
};