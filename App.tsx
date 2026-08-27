/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/core/contexts/theme/ThemeContext';
// import { AdsSDK, initializeAds } from './src/api/ads';
import { AuthProvider } from './src/core/contexts/auth/UserContext';
import { RideRequestProvider } from './src/core/contexts/rideRequest/RideRequestContext';
import AppContent from './src/api/connections/snippet/AppContent';

// ============================================
// 🎯 MAIN APP - CLEAN ROOT COMPOSITION
// ============================================
function App(): React.ReactElement {
  // useEffect(() => {
  //   // Initialize Ads SDK
  //   initializeAds().catch((error: Error) => {
  //     console.error('[App] Ads initialization failed:', error);
  //   });
  // }, []);

  // // Register navigation ref when available
  // useEffect(() => {
  //   if (navigationRef.current) {
  //     AdsSDK.registerNavigationContainer(navigationRef.current);
  //   }
  // }, [navigationRef.current]);

  return (
    <ThemeProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <AuthProvider>
            <RideRequestProvider>
              <AppContent />
            </RideRequestProvider>
          </AuthProvider>
        </SafeAreaView>
    </ThemeProvider>
  );
}

export default App;
