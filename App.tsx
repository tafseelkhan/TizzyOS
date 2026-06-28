/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainerRef } from '@react-navigation/native';
import TizzyOS from './src/navigations';
import { ThemeProvider } from './src/core/contexts/theme/ThemeContext';
import { ZeptPayProvider } from '@flixora/zeptpay-react-native';
import { AdsSDK, initializeAds } from './src/api/ads';
import { RootStackParamList } from './src/navigations';

function App(): React.ReactElement {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    // Initialize Ads SDK
    initializeAds().catch((error: Error) => {
      console.error('[App] Ads initialization failed:', error);
    });
  }, []);

  // Register navigation ref when available
  useEffect(() => {
    if (navigationRef.current) {
      AdsSDK.registerNavigationContainer(navigationRef.current);
    }
  }, [navigationRef.current]);

  return (
    <ThemeProvider>
      <ZeptPayProvider publicKey="pk-flixora_test_@zeptpay:tizzy-flixora-ecosystem_053bf0f4f1e59760a3f63fe3ebc28a1920f4b57c93c8e648">
        <SafeAreaView style={{ flex: 1 }}>
          <TizzyOS />
        </SafeAreaView>
      </ZeptPayProvider>
    </ThemeProvider>
  );
}

export default App;
