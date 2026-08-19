// src/services/notification/NotificationService.ts

import notifee, { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { Platform, AppState } from 'react-native';
import { rideRequestNotification } from './RideRequestNotification';
import { ringtoneService } from '../audio/RingtoneService';
import { RideRequest } from '../../types/RideTypes';

class NotificationService {
  private static instance: NotificationService;
  private isSetup = false;
  private isAppForeground = true;

  private constructor() {
    AppState.addEventListener('change', nextAppState => {
      this.isAppForeground = nextAppState === 'active';
      console.log(
        `[NotificationService] App state: ${this.isAppForeground ? 'FOREGROUND' : 'BACKGROUND'}`,
      );
    });
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async setup(): Promise<void> {
    if (this.isSetup) return;

    try {
      console.log('🔔 [NotificationService] setup() called');
      await ringtoneService.setup();
      await this.requestPermissions();
      this.setupFCMListeners();
      this.setupNotifeeListeners();

      messaging().setBackgroundMessageHandler(async remoteMessage => {
        await this.handleBackgroundMessage(remoteMessage);
      });

      notifee.onBackgroundEvent(async ({ type, detail }) => {
        if (type === EventType.ACTION_PRESS) {
          const actionId = detail.pressAction?.id || '';
          const data = detail.notification?.data || {};
          await rideRequestNotification.handleAction(actionId, data);
        }
      });

      this.isSetup = true;
      console.log('✅ [NotificationService] SETUP COMPLETE');
    } catch (error) {
      console.error('❌ [NotificationService] Setup failed:', error);
      throw error;
    }
  }

  private async requestPermissions(): Promise<void> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      await notifee.requestPermission();
    }
  }

  private setupFCMListeners(): void {
    messaging().onMessage(async remoteMessage => {
      console.log('📱 [FCM] FOREGROUND MESSAGE RECEIVED');
      if (remoteMessage.data?.type === 'ride_request') {
        console.log('📱 [FCM] Ride request in foreground, popup will handle');
      }
    });
  }

  private setupNotifeeListeners(): void {
    notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS) {
        const actionId = detail.pressAction?.id || '';
        const data = detail.notification?.data || {};
        await rideRequestNotification.handleAction(actionId, data);
      }
    });
  }

  private async handleBackgroundMessage(remoteMessage: any): Promise<void> {
    console.log('📱 [FCM] BACKGROUND MESSAGE RECEIVED');
    console.log(`📱 [FCM] isAppForeground: ${this.isAppForeground}`);
    
    if (remoteMessage.data?.type === 'ride_request') {
      const data = remoteMessage.data;
      console.log('📱 [FCM] ✅ Ride request in background, showing notification');
      await this.showRideRequest(data);
    }
  }

  // ✅ PUBLIC METHOD - Called from rideRequestHandler
  async showRideRequestNotification(rideRequest: RideRequest): Promise<void> {
    console.log('📱 [Notification] ========================================');
    console.log('📱 [Notification] showRideRequestNotification() CALLED');
    console.log(`📱 [Notification] isAppForeground: ${this.isAppForeground}`);
    console.log(`📱 [Notification] Request ID: ${rideRequest.requestId}`);
    console.log(`📱 [Notification] Booking ID: ${rideRequest.booking?.bookingId}`);
    console.log('📱 [Notification] ========================================');

    // ✅ Use AppState.currentState for accurate check
    const currentState = AppState.currentState;
    const isBackground = currentState !== 'active';
    console.log(`📱 [Notification] AppState.currentState: ${currentState}`);
    console.log(`📱 [Notification] isBackground: ${isBackground}`);

    // ✅ Only show system notification if in background
    if (isBackground) {
      console.log('📱 [Notification] ✅ App in background, showing system notification');
      await this.showRideRequest({
        requestId: rideRequest.requestId,
        bookingId: rideRequest.booking?.bookingId || '',
        fare: String(rideRequest.fare || 0),
        pickup: rideRequest.pickup?.address || 'Loading...',
        destination: rideRequest.destination?.address || 'Loading...',
        distance: String(rideRequest.distance || 0),
        pickupLat: rideRequest.pickup?.latitude || 0,
        pickupLng: rideRequest.pickup?.longitude || 0,
        dropLat: rideRequest.destination?.latitude || 0,
        dropLng: rideRequest.destination?.longitude || 0,
        expiresAt: rideRequest.expiresAt,
        customerName: rideRequest.customer?.name,
        serviceType: rideRequest.booking?.serviceType,
        rideCode: rideRequest.booking?.rideCode,
      });
    } else {
      console.log('📱 [Notification] App in foreground, popup will handle (no notification)');
    }
    console.log('📱 [Notification] ========================================');
  }

  // ✅ PRIVATE METHOD - Called from FCM
  private async showRideRequest(data: Record<string, any>): Promise<void> {
    console.log('📱 [Notification] showRideRequest() called from FCM');
    console.log(`📱 [Notification] Request ID: ${data.requestId}`);
    console.log(`📱 [Notification] Booking ID: ${data.bookingId}`);
    
    try {
      await rideRequestNotification.showRideRequest({
        requestId: data.requestId || '',
        bookingId: data.bookingId || '',
        fare: data.fare || '0',
        pickup: data.pickup || 'Loading...',
        destination: data.destination || 'Loading...',
        distance: data.distance || '0',
        pickupLat: parseFloat(data.pickupLat || '0'),
        pickupLng: parseFloat(data.pickupLng || '0'),
        dropLat: parseFloat(data.dropLat || '0'),
        dropLng: parseFloat(data.dropLng || '0'),
        expiresAt: data.expiresAt,
        customerName: data.customerName,
        serviceType: data.serviceType,
        rideCode: data.rideCode,
      });
      console.log(`📱 [Notification] ✅ Notification shown for ${data.requestId}`);
    } catch (error) {
      console.error('📱 [Notification] ❌ Error showing notification:', error);
    }
  }

  async registerFCMToken(): Promise<string> {
    try {
      const token = await messaging().getToken();
      console.log('📱 [FCM] Token:', token);
      return token;
    } catch (error) {
      console.error('❌ [FCM] Failed to get token:', error);
      return '';
    }
  }

  // ✅ Dismiss specific request - RINGTONE STOP MAT KARO
  async dismissRideRequest(requestId?: string): Promise<void> {
    console.log(
      '🔔 [Notification] dismissRideRequest() called for:',
      requestId,
    );
    if (requestId) {
      await rideRequestNotification.dismissRequestById(requestId);
    } else {
      await rideRequestNotification.dismiss();
    }
    // ✅ Ringtone stop nahi karenge - queue management handle karega
  }

  // ✅ Dismiss all requests - YAHAN RINGTONE STOP KARO
  async dismissAllRequests(): Promise<void> {
    console.log('🔔 [Notification] dismissAllRequests() called');
    await rideRequestNotification.dismissAllRequests();
    await ringtoneService.stopRingtone();
  }

  isRideRequestActive(): boolean {
    return rideRequestNotification.isRequestActive();
  }

  async cleanup(): Promise<void> {
    console.log('🧹 [Notification] cleanup() called');
    await rideRequestNotification.dismissAllRequests();
    await ringtoneService.cleanup();
    this.isSetup = false;
  }
}

export const notificationService = NotificationService.getInstance();