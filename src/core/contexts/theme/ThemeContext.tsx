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
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ NEW — API slice
import {
  getUserTheme,
  updateUserTheme,
  ThemeMode,
} from '../../../api/features/private/themePrivateSlice';
import { ApiError } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

type ColorScheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  isDark: boolean;
  resolvedTheme: ColorScheme;
  systemColorScheme: ColorScheme;
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
  // ✅ REFRESH THEME FROM API (via slice)
  // ============================================================

  const refreshThemeFromAPI = useCallback(async (): Promise<void> => {
    try {
      const remoteTheme = await getUserTheme();

      if (remoteTheme) {
        if (__DEV__) {
          console.log('🎨 Setting theme from API:', remoteTheme);
        }
        setThemeState(remoteTheme);
        await AsyncStorage.setItem('app-theme', remoteTheme);
      }
    } catch (err) {
      if (__DEV__) {
        console.error('❌ Error refreshing theme from API:', err);
      }
    }
  }, []);

  // ============================================================
  // ✅ LOAD THEME ON STARTUP
  // ============================================================

  const loadTheme = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const savedTheme = await AsyncStorage.getItem('app-theme');
      if (
        savedTheme &&
        ['light', 'dark', 'system'].includes(savedTheme)
      ) {
        setThemeState(savedTheme as ThemeMode);
      }

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
  // ✅ SET THEME (via slice)
  // ============================================================

  const handleSetTheme = async (newTheme: ThemeMode): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Optimistic update (local first)
      setThemeState(newTheme);
      await AsyncStorage.setItem('app-theme', newTheme);

      // Check if user is logged in — if not, skip API call
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        if (__DEV__) {
          console.log('👤 No user token, theme saved locally only');
        }
        return;
      }

      // Sync with backend
      const serverTheme = await updateUserTheme(newTheme);

      // If server normalized the theme (rare), apply it
      if (serverTheme !== newTheme) {
        setThemeState(serverTheme);
        await AsyncStorage.setItem('app-theme', serverTheme);
      }

      if (__DEV__) {
        console.log('🎉 Theme synced with backend');
      }
    } catch (err: any) {
      if (__DEV__) {
        console.error('❌ Error setting theme:', err);
      }

      const isNetwork =
        err instanceof ApiError && err.status === 0;
      const errorMsg = isNetwork
        ? 'Network error. Theme saved locally.'
        : 'Server error. Theme saved locally.';

      setError(errorMsg);

      Alert.alert('Theme Updated', errorMsg, [
        { text: 'OK', onPress: () => setError(null) },
      ]);
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