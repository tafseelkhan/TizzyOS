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
import './headlessTasks'; // <-- This is essential
import { ThemeProvider } from './src/core/contexts/theme/ThemeContext';
import { ZeptPayProvider } from '@flixora/zeptpay-react-native';
// import { AdsSDK, initializeAds } from './src/api/ads';
import { RootStackParamList } from './src/navigations';

// ============================================
// 🚗 IMPORT DRIVER SERVICES
// ============================================
import { notificationService } from './src/core/services/notification/NotificationService';
import { socketService } from './src/core/utils/socket/rideRequestUtils';
import { rideRequestHandler } from './src/core/utils/socket/rideRequestHandler';
import { ringtoneService } from './src/core/services/audio/RingtoneService';

function App(): React.ReactElement {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);

  // ============================================
  // ✅ INITIALIZE DRIVER SERVICES
  // ============================================
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('🚀 Initializing driver services...');

        // 1. Setup Notification Service (includes ringtone)
        await notificationService.setup();
        console.log('✅ Notification service ready');

        // 2. Register FCM Token
        const fcmToken = await notificationService.registerFCMToken();
        if (fcmToken) {
          console.log('📱 FCM Token:', fcmToken);
          // Send token to backend if needed
          // await api.registerFCMToken(fcmToken);
        }

        // 3. Setup Ringtone Background Handler
        const {
          trackPlayerBackgroundHandler,
        } = require('./src/services/audio/RingtoneService');
        await trackPlayerBackgroundHandler();
        console.log('✅ TrackPlayer background handler ready');

        // 4. Setup Ride Request Handler (Socket will connect when driver goes online)
        rideRequestHandler.setup();
        console.log('✅ Ride request handler ready');

        console.log('✅ All driver services initialized');
      } catch (error) {
        console.error('❌ Service initialization failed:', error);
      }
    };

    initializeServices();

    // Cleanup on app unmount
    return () => {
      socketService.cleanup();
      ringtoneService.cleanup();
      notificationService.cleanup();
      rideRequestHandler.cleanup();
    };
  }, []);

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
      <ZeptPayProvider publicKey="pk-flixora_test_@zeptpay:tizzy-flixora-ecosystem_053bf0f4f1e59760a3f63fe3ebc28a1920f4b57c93c8e648">
        <SafeAreaView style={{ flex: 1 }}>
          <TizzyOS />
        </SafeAreaView>
      </ZeptPayProvider>
    </ThemeProvider>
  );
}

export default App;
