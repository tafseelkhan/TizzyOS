// src/api/features/private/themePrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColorState {
  theme: ThemeMode;
  color: string;
}

export interface ThemeColorResponse {
  success: boolean;
  theme?: ThemeMode;
  color?: string;
  message?: string;
  [key: string]: unknown;
}

export interface UpdateThemeColorPayload {
  theme?: ThemeMode;
  color?: string;
}

const ALLOWED_THEMES: readonly ThemeMode[] = ['light', 'dark', 'system'];

function isValidTheme(value: unknown): value is ThemeMode {
  return (
    typeof value === 'string' &&
    ALLOWED_THEMES.includes(value as ThemeMode)
  );
}

// ============================================================
// 1. GET THEME + COLOR
// ============================================================

export const getThemeColor = async (): Promise<ThemeColorState | null> => {
  try {
    const data = await apiRequest<ThemeColorResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.THEME_COLOR}`,
      { method: 'GET' },
    );

    if (!data.success) {
      return null;
    }

    return {
      theme: isValidTheme(data.theme) ? data.theme : 'system',
      color: typeof data.color === 'string' ? data.color : '',
    };
  } catch (error) {
    if (__DEV__) {
      console.error('❌ getThemeColor error:', error);
    }
    return null;
  }
};

// ============================================================
// 2. UPDATE THEME + COLOR
//    At least one of theme or color must be provided.
// ============================================================

export const updateThemeColor = async (
  payload: UpdateThemeColorPayload,
): Promise<ThemeColorState> => {
  if (
    !payload ||
    (payload.theme === undefined && payload.color === undefined)
  ) {
    throw new Error('Provide at least one of: theme, color.');
  }

  if (payload.theme !== undefined && !isValidTheme(payload.theme)) {
    throw new Error('Theme must be one of: light, dark, system.');
  }

  if (
    payload.color !== undefined &&
    (typeof payload.color !== 'string' || !payload.color.trim())
  ) {
    throw new Error('Color must be a non-empty string.');
  }

  const data = await apiRequest<ThemeColorResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.UPDATE_THEME_COLOR}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );

  if (!data.success) {
    throw new Error(data.message || 'Theme/color update failed on server');
  }

  return {
    theme: isValidTheme(data.theme) ? data.theme : payload.theme ?? 'system',
    color:
      typeof data.color === 'string' ? data.color : payload.color ?? '',
  };
};