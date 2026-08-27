// contexts/ThemeContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  Platform,
  Alert,
  AppState,
  Appearance,
  StatusBar,
  ColorSchemeName,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ColorScheme = 'light' | 'dark';
type ThemeMode = 'light' | 'dark' | 'system';

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

// API URL
const API_URL = 'http://10.194.138.121:5000';

// ✅ FIX: Remove setAndroidNavigationBar - use StatusBar component instead
// We'll handle status bar via component props in render

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

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const newColorScheme: ColorScheme =
        colorScheme === 'dark' ? 'dark' : 'light';
      setSystemTheme(newColorScheme);
    });

    return () => subscription.remove();
  }, []);

  // App state change listener
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

  // ✅ FIX: Apply theme via StatusBar component props only
  useEffect(() => {
    // StatusBar is controlled via component props in render
    // No need for setBackgroundColor
    console.log(`🎨 Theme applied: ${isDark ? 'dark' : 'light'}`);
  }, [isDark]);

  // Load theme on startup
  const loadTheme = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const savedTheme = await AsyncStorage.getItem('app-theme');
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeState(savedTheme as ThemeMode);
      }

      await refreshThemeFromAPI();
    } catch (error) {
      console.error('Error loading theme:', error);
      setError('Failed to load theme');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  // ✅ FETCH THEME FROM BACKEND
  const refreshThemeFromAPI = async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('No auth token, skipping API theme fetch');
        return;
      }

      console.log('🔍 Fetching theme from API...');

      const response = await fetch(`${API_URL}/api/v0/user/theme`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 API Response Status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ API Response:', data);

      if (
        data.success &&
        data.theme &&
        ['light', 'dark', 'system'].includes(data.theme)
      ) {
        console.log('🎨 Setting theme from API:', data.theme);
        setThemeState(data.theme);
        await AsyncStorage.setItem('app-theme', data.theme);
      }
    } catch (err) {
      console.error('❌ Error fetching theme from API:', err);
    }
  };

  // ✅ UPDATE THEME
  const handleSetTheme = async (newTheme: ThemeMode): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      setThemeState(newTheme);
      await AsyncStorage.setItem('app-theme', newTheme);

      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        console.log('🔄 Syncing theme with backend...');

        const response = await fetch(`${API_URL}/api/v0/user/theme`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ theme: newTheme }),
        });

        console.log('📡 Update API Status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Backend response:', data);

        if (!data.success) {
          throw new Error(data.message || 'Theme update failed on server');
        }

        if (data.theme && data.theme !== newTheme) {
          setThemeState(data.theme);
          await AsyncStorage.setItem('app-theme', data.theme);
        }

        console.log('🎉 Theme updated successfully!');
      } else {
        console.log('👤 No user token, theme saved locally only');
      }
    } catch (err: any) {
      console.error('❌ Error setting theme:', err);

      const errorMsg = err.message.includes('Network')
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

  // ✅ FIX: Use StatusBar as component with props
  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      {/* ✅ Add a background view to handle status bar color on Android */}
      <View style={{ flex: 1 }}>{children}</View>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};

export default ThemeContext;
