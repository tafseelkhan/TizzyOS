// src/core/AppContent.tsx

import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
import TizzyOS from '../../../navigations';
import { RootStackParamList } from '../../../navigations/RootStackParamList';
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

const AppContent: React.FC = () => {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [isNavReady, setIsNavReady] = useState(false);
  const actionCallbackSetRef = useRef<boolean>(false);
  const backgroundHandlerSetRef = useRef<boolean>(false);

  // ✅ Get ride actions
  const { acceptRide, rejectRide } = useRideActions();

  useSocketBootstrap();

  // ✅ Handle navigation container ready
  const handleNavReady = () => {
    setIsNavReady(true);

    if (navigationRef.current) {
      NavigationService.setNavigator(navigationRef.current);

      // ✅ Also set global navigation refs for backward compatibility
      setGlobalNavigation(navigationRef.current);

      // ✅ Check if there's a pending action after navigation ready
      const pendingAction = rideRequestNotification.getPendingAction();
      if (pendingAction) {
        // Action will be processed by the callback below
      }
    }
  };

  // ✅ Set navigation ref when available
  useEffect(() => {
    if (navigationRef.current) {
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
    if (actionCallbackSetRef.current) {
      return;
    }

    // ✅ Set callback for notification actions
    rideRequestNotification.setActionCallback(
      async (
        action: 'accept' | 'reject',
        requestId: string,
        bookingId: string,
      ) => {
        try {
          if (action === 'accept') {
            await acceptRide(requestId, bookingId);
          } else if (action === 'reject') {
            await rejectRide(requestId);
          }
        } catch (error) {
          // Error handling - no log
        }
      },
    );

    actionCallbackSetRef.current = true;

    // ✅ Setup Notifee background handler (only once)
    if (!backgroundHandlerSetRef.current) {
      setupNotifeeBackgroundHandler();
      backgroundHandlerSetRef.current = true;
    }

    return () => {
      rideRequestNotification.clearActionCallback();
      actionCallbackSetRef.current = false;
    };
  }, [acceptRide, rejectRide]);

  // ✅ Check for pending action on mount
  useEffect(() => {
    const checkPendingAction = () => {
      const pendingAction = rideRequestNotification.getPendingAction();
      if (pendingAction) {
        // The callback will process it when set
      }
    };

    // Check after a short delay to allow callback to be set
    const timer = setTimeout(checkPendingAction, 500);
    return () => clearTimeout(timer);
  }, []);

  // ✅ Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // 1. Notification Service
        await notificationService.setup();

        // 2. FCM Token
        const fcmToken = await notificationService.registerFCMToken();

        // 3. Ringtone
        const {
          trackPlayerBackgroundHandler,
        } = require('../../../core/services/audio/RingtoneService');
        await trackPlayerBackgroundHandler();

        // 4. ✅ CRITICAL: Start ride request handler
        if (
          rideRequestHandler &&
          typeof rideRequestHandler.startListening === 'function'
        ) {
          rideRequestHandler.startListening();
        }

        // ✅ Check for pending action after services initialized
        const pendingAction = rideRequestNotification.getPendingAction();
        if (pendingAction) {
          // Pending action will be handled by callback
        }
      } catch (error) {
        // Error handling - no log
      }
    };

    initializeServices();

    // Cleanup on app unmount
    return () => {
      socketService.cleanup();
      ringtoneService.cleanup();
      notificationService.cleanup();
      if (
        rideRequestHandler &&
        typeof rideRequestHandler.stopListening === 'function'
      ) {
        rideRequestHandler.stopListening();
      }
    };
  }, []);

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