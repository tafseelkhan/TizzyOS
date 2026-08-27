// src/core/AppContent.tsx

import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
import TizzyOS from '../../../navigations';
import { RootStackParamList } from '../../../navigations/index';
import { setGlobalNavigation } from '../../../core/contexts/rideRequest/RideRequestContext';
import {
  useRideActions,
} from '../../../core/hooks/cab/useRideActions';
import { useSocketBootstrap } from '../../../core/hooks/cab/useSocketBootstrap';
import GlobalRideRequestPopup from '../../../core/components/cab/rideRequest/GlobalRideRequestPopup';
import { notificationService } from '../../../core/services/notification/NotificationService';
import {
  rideRequestNotification,
  setupNotifeeBackgroundHandler,
} from '../../../core/services/notification/RideRequestNotification';
import { socketService } from '../../../core/utils/socket/socketUtils';
import { rideRequestHandler } from '../../../core/utils/socket/rideRequestHandler';
import { ringtoneService } from '../../../core/services/audio/RingtoneService';
import { NavigationService } from '../../../core/services/navigation/NavigationService';

console.log('🔥🔥🔥 [AppContent] ========================================');
console.log('🔥🔥🔥 [AppContent] FILE LOADED');
console.log('🔥🔥🔥 [AppContent] ========================================');

const AppContent: React.FC = () => {
  console.log('🔥 [AppContent] COMPONENT RENDER START');

  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [isNavReady, setIsNavReady] = useState(false);
  const actionCallbackSetRef = useRef<boolean>(false);
  const backgroundHandlerSetRef = useRef<boolean>(false);

  // ✅ Get ride actions
  const { acceptRide, rejectRide } = useRideActions();

  console.log('🔥 [AppContent] 🔍 Checking rideRequestHandler before useSocketBootstrap:');
  console.log('🔥 [AppContent] rideRequestHandler type:', typeof rideRequestHandler);
  console.log('🔥 [AppContent] rideRequestHandler.startListening type:', typeof rideRequestHandler?.startListening);

  console.log('🔥 [AppContent] Calling useSocketBootstrap...');
  useSocketBootstrap();
  console.log('🔥 [AppContent] ✅ useSocketBootstrap done');

  // ✅ Handle navigation container ready
  const handleNavReady = () => {
    console.log('[AppContent] ✅ Navigation container ready');
    setIsNavReady(true);

    if (navigationRef.current) {
      console.log('[AppContent] ✅ Setting NavigationService navigator');
      NavigationService.setNavigator(navigationRef.current);

      // ✅ Also set global navigation refs for backward compatibility
      setGlobalNavigation(navigationRef.current);

      // ✅ Check if there's a pending action after navigation ready
      const pendingAction = rideRequestNotification.getPendingAction();
      if (pendingAction) {
        console.log('[AppContent] 📦 Pending action found after nav ready:', pendingAction);
        // Action will be processed by the callback below
      }
    } else {
      console.log('[AppContent] ⚠️ navigationRef.current is null on ready');
    }
  };

  // ✅ Set navigation ref when available
  useEffect(() => {
    console.log('🔥 [AppContent] useEffect 1 - navigation ref');

    if (navigationRef.current) {
      console.log('[AppContent] ✅ Setting navigation ref immediately');
      // Don't set NavigationService yet - wait for onReady
    }

    // ✅ If nav is already ready (edge case)
    if (isNavReady && navigationRef.current) {
      NavigationService.setNavigator(navigationRef.current);
      setGlobalNavigation(navigationRef.current);
    }
  }, [navigationRef, isNavReady]);

  // ✅ Register notification callback with useRideActions
  useEffect(() => {
    console.log('[AppContent] ========================================');
    console.log('[AppContent] 🔥 Registering notification action callback');
    console.log('[AppContent] ========================================');

    if (actionCallbackSetRef.current) {
      console.log('[AppContent] ⚠️ Action callback already set, skipping');
      return;
    }

    // ✅ Set callback for notification actions
    rideRequestNotification.setActionCallback(
      async (
        action: 'accept' | 'reject',
        requestId: string,
        bookingId: string,
      ) => {
        console.log('[AppContent] ========================================');
        console.log('[AppContent] 📱 Notification action callback triggered!');
        console.log('[AppContent] 📌 Action:', action);
        console.log('[AppContent] 📦 Request ID:', requestId);
        console.log('[AppContent] 📦 Booking ID:', bookingId);
        console.log('[AppContent] ========================================');

        try {
          if (action === 'accept') {
            console.log('[AppContent] ✅ Calling acceptRide()...');
            await acceptRide(requestId, bookingId);
            console.log('[AppContent] ✅ Ride accepted from notification successfully');
          } else if (action === 'reject') {
            console.log('[AppContent] ❌ Calling rejectRide()...');
            await rejectRide(requestId);
            console.log('[AppContent] ✅ Ride rejected from notification successfully');
          }
        } catch (error) {
          console.error('[AppContent] ❌ Error processing notification action:', error);
        }
      },
    );

    actionCallbackSetRef.current = true;

    // ✅ Setup Notifee background handler (only once)
    if (!backgroundHandlerSetRef.current) {
      console.log('[AppContent] 📡 Setting up Notifee background handler...');
      setupNotifeeBackgroundHandler();
      backgroundHandlerSetRef.current = true;
      console.log('[AppContent] ✅ Notifee background handler set');
    }

    console.log('[AppContent] ✅ Notification callback registration complete');
    console.log('[AppContent] ========================================');

    return () => {
      console.log('[AppContent] 🧹 Clearing notification action callback');
      rideRequestNotification.clearActionCallback();
      actionCallbackSetRef.current = false;
    };
  }, [acceptRide, rejectRide]);

  // ✅ Check for pending action on mount
  useEffect(() => {
    const checkPendingAction = () => {
      const pendingAction = rideRequestNotification.getPendingAction();
      if (pendingAction) {
        console.log('[AppContent] 📦 Pending action found on mount:', pendingAction);
        // The callback will process it when set
      }
    };

    // Check after a short delay to allow callback to be set
    const timer = setTimeout(checkPendingAction, 500);
    return () => clearTimeout(timer);
  }, []);

  // ✅ Initialize services
  useEffect(() => {
    console.log('🔥 [AppContent] useEffect 2 - initializeServices START');

    const initializeServices = async () => {
      try {
        console.log('========================================');
        console.log('🚀 Initializing driver services...');
        console.log('========================================');

        // 1. Notification Service
        console.log('📱 [1/4] Setting up notification service...');
        await notificationService.setup();
        console.log('✅ [1/4] Notification service ready');

        // 2. FCM Token
        console.log('📱 [2/4] Registering FCM token...');
        const fcmToken = await notificationService.registerFCMToken();
        if (fcmToken) {
          console.log('📱 [2/4] FCM Token:', fcmToken);
        } else {
          console.log('📱 [2/4] ⚠️ No FCM token received');
        }

        // 3. Ringtone
        console.log('🎵 [3/4] Setting up ringtone...');
        const {
          trackPlayerBackgroundHandler,
        } = require('../../../core/services/audio/RingtoneService');
        await trackPlayerBackgroundHandler();
        console.log('✅ [3/4] TrackPlayer background handler ready');

        // 4. ✅ CRITICAL: Start ride request handler
        console.log('========================================');
        console.log('🔥🔥🔥 [4/4] CALLING rideRequestHandler.startListening()...');
        console.log('🔥 [4/4] rideRequestHandler type:', typeof rideRequestHandler);
        console.log('🔥 [4/4] rideRequestHandler.startListening type:', typeof rideRequestHandler?.startListening);
        console.log('========================================');

        if (
          rideRequestHandler &&
          typeof rideRequestHandler.startListening === 'function'
        ) {
          console.log('🔥 [4/4] ✅ startListening is a function, calling now...');
          rideRequestHandler.startListening();
          console.log('✅ [4/4] Ride request handler started successfully');
        } else {
          console.error('❌ [4/4] rideRequestHandler.startListening is NOT a function!');
          console.log('❌ [4/4] rideRequestHandler value:', rideRequestHandler);
        }

        // ✅ Check for pending action after services initialized
        const pendingAction = rideRequestNotification.getPendingAction();
        if (pendingAction) {
          console.log('[AppContent] 📦 Pending action found after services init:', pendingAction);
        }

        console.log('========================================');
        console.log('✅ All driver services initialized successfully!');
        console.log('========================================');
      } catch (error) {
        console.error('❌❌❌ Service initialization FAILED:', error);
        console.error(
          '❌ Error stack:',
          error instanceof Error ? error.stack : 'No stack',
        );
      }
    };

    initializeServices();

    // Cleanup on app unmount
    return () => {
      console.log('[AppContent] 🧹 CLEANUP - Services unmounting...');
      console.log('[AppContent] 🧹 Cleaning socket...');
      socketService.cleanup();
      console.log('[AppContent] 🧹 Cleaning ringtone...');
      ringtoneService.cleanup();
      console.log('[AppContent] 🧹 Cleaning notification...');
      notificationService.cleanup();
      console.log('[AppContent] 🧹 Stopping ride request handler...');
      if (
        rideRequestHandler &&
        typeof rideRequestHandler.stopListening === 'function'
      ) {
        rideRequestHandler.stopListening();
        console.log('[AppContent] ✅ Ride request handler stopped');
      }
      console.log('[AppContent] ✅ Cleanup complete');
    };
  }, []);

  console.log('🔥 [AppContent] RETURNING JSX - Rendering TizzyOS and GlobalRideRequestPopup');

  return (
    <>
      <TizzyOS
        ref={navigationRef}
        onReady={handleNavReady}
      />
      <GlobalRideRequestPopup />
    </>
  );
};

export default AppContent;