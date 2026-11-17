// contexts/ThemeContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  Alert,
  AppState,
  Appearance,
  StatusBar,
  View,
} from 'react-native';

// ✅ combined theme+color API slice
import {
  getThemeColor,
  updateThemeColor,
  ThemeMode,
} from '../../../api/features/private/themePrivateSlice';
import { ApiError } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

type ColorScheme = 'light' | 'dark';

interface ThemeContextType {
  // Theme
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  isDark: boolean;
  resolvedTheme: ColorScheme;
  systemColorScheme: ColorScheme;

  // Accent color
  color: string;
  setColor: (color: string) => Promise<void>;

  // Lifecycle
  refreshThemeFromAPI: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================================
// PROVIDER
// ============================================================

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [color, setColorState] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getInitialColorScheme = (): ColorScheme => {
    const colorScheme = Appearance.getColorScheme();
    return colorScheme === 'dark' ? 'dark' : 'light';
  };

  const [systemTheme, setSystemTheme] = useState<ColorScheme>(
    getInitialColorScheme(),
  );

  // ============================================================
  // SYSTEM THEME LISTENER
  // ============================================================

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const newColorScheme: ColorScheme =
        colorScheme === 'dark' ? 'dark' : 'light';
      setSystemTheme(newColorScheme);
    });

    return () => subscription.remove();
  }, []);

  // ============================================================
  // APP STATE LISTENER
  // ============================================================

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        refreshThemeFromAPI();
      }
    });

    return () => subscription.remove();
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;
  const isDark = resolvedTheme === 'dark';

  // ============================================================
  // THEME APPLIED LOG (dev only)
  // ============================================================

  useEffect(() => {
    if (__DEV__) {
      console.log(`🎨 Theme applied: ${isDark ? 'dark' : 'light'}`);
    }
  }, [isDark]);

  // ============================================================
  // ✅ REFRESH THEME + COLOR FROM API (via slice)
  // ============================================================

  const refreshThemeFromAPI = useCallback(async (): Promise<void> => {
    try {
      const remote = await getThemeColor();

      if (!remote) return;

      if (__DEV__) {
        console.log('🎨 Theme/color fetched from API:', remote);
      }

      // Apply theme if valid
      if (remote.theme && ['light', 'dark', 'system'].includes(remote.theme)) {
        setThemeState(remote.theme);
      }

      // Apply color if present
      if (typeof remote.color === 'string') {
        setColorState(remote.color);
      }
    } catch (err) {
      if (__DEV__) {
        console.error('❌ Error refreshing theme/color from API:', err);
      }
    }
  }, []);

  // ============================================================
  // ✅ LOAD THEME + COLOR ON STARTUP (server only)
  // ============================================================

  const loadTheme = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Pull everything from the server
      await refreshThemeFromAPI();
    } catch (err) {
      if (__DEV__) {
        console.error('Error loading theme:', err);
      }
      setError('Failed to load theme');
    } finally {
      setLoading(false);
    }
  }, [refreshThemeFromAPI]);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  // ============================================================
  // ✅ SET THEME (via combined API)
  // ============================================================

  const handleSetTheme = async (newTheme: ThemeMode): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Optimistic update (in-memory only)
      setThemeState(newTheme);

      // Sync with backend
      const result = await updateThemeColor({ theme: newTheme });

      // If server normalized the theme (rare), apply it
      if (result.theme && result.theme !== newTheme) {
        setThemeState(result.theme);
      }

      if (__DEV__) {
        console.log('🎉 Theme synced with backend');
      }
    } catch (err: any) {
      if (__DEV__) {
        console.error('❌ Error setting theme:', err);
      }

      const isNetwork = err instanceof ApiError && err.status === 0;
      const errorMsg = isNetwork
        ? 'Network error. Please try again.'
        : 'Server error. Please try again.';

      setError(errorMsg);

      Alert.alert('Theme Update Failed', errorMsg, [
        { text: 'OK', onPress: () => setError(null) },
      ]);

      // Revert optimistic update on failure
      // (server state is the source of truth)
      await refreshThemeFromAPI();
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ✅ SET COLOR (via combined API)
  // ============================================================

  const handleSetColor = async (newColor: string): Promise<void> => {
    const trimmed = newColor.trim();

    if (!trimmed) {
      setError('Color cannot be empty');
      return;
    }

    if (trimmed.length > 32) {
      setError('Color value is too long');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Optimistic update (in-memory only)
      setColorState(trimmed);

      // Sync with backend
      const result = await updateThemeColor({ color: trimmed });

      // If server normalized the color, apply it
      if (result.color && result.color !== trimmed) {
        setColorState(result.color);
      }

      if (__DEV__) {
        console.log('🎉 Color synced with backend');
      }
    } catch (err: any) {
      if (__DEV__) {
        console.error('❌ Error setting color:', err);
      }

      const isNetwork = err instanceof ApiError && err.status === 0;
      const errorMsg = isNetwork
        ? 'Network error. Please try again.'
        : 'Server error. Please try again.';

      setError(errorMsg);

      Alert.alert('Color Update Failed', errorMsg, [
        { text: 'OK', onPress: () => setError(null) },
      ]);

      // Revert optimistic update on failure
      await refreshThemeFromAPI();
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value: ThemeContextType = {
    theme,
    setTheme: handleSetTheme,
    isDark,
    resolvedTheme,
    systemColorScheme: systemTheme,

    color,
    setColor: handleSetColor,

    refreshThemeFromAPI,
    loading,
    error,
  };

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1 }}>{children}</View>
    </ThemeContext.Provider>
  );
};

// ============================================================
// HOOK
// ============================================================

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};

export default ThemeContext;