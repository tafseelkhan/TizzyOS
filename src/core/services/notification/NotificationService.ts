// src/services/notification/NotificationService.ts

import notifee, { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { rideRequestNotification } from './RideRequestNotification';
import { ringtoneService } from '../audio/RingtoneService';

class NotificationService {
  private static instance: NotificationService;
  private isSetup = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Setup notification service
   */
  async setup(): Promise<void> {
    if (this.isSetup) return;

    try {
      // 1. Setup ringtone
      await ringtoneService.setup();

      // 2. Request permissions
      await this.requestPermissions();

      // 3. Setup FCM listeners
      this.setupFCMListeners();

      // 4. Setup Notifee listeners
      this.setupNotifeeListeners();

      // 5. Setup background handler for FCM
      messaging().setBackgroundMessageHandler(async remoteMessage => {
        await this.handleBackgroundMessage(remoteMessage);
      });

      // 6. Setup Notifee background handler
      notifee.onBackgroundEvent(async ({ type, detail }) => {
        if (type === EventType.ACTION_PRESS) {
          const actionId = detail.pressAction?.id || '';
          const data = detail.notification?.data || {};
          await rideRequestNotification.handleAction(actionId, data);
        }
      });

      this.isSetup = true;
      console.log('✅ Notification service setup complete');
    } catch (error) {
      console.error('❌ Notification service setup failed:', error);
      throw error;
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermissions(): Promise<void> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const permission = await notifee.requestPermission();
      console.log('🔔 Notification permission:', permission);
    }
  }

  /**
   * Setup FCM message listeners
   */
  private setupFCMListeners(): void {
    // Foreground messages
    messaging().onMessage(async remoteMessage => {
      console.log('📱 Foreground FCM message:', remoteMessage);

      if (remoteMessage.data?.type === 'ride_request') {
        const data = remoteMessage.data;
        await this.showRideRequest(data);
      }
    });
  }

  /**
   * Setup Notifee event listeners
   */
  private setupNotifeeListeners(): void {
    notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS) {
        const actionId = detail.pressAction?.id || '';
        const data = detail.notification?.data || {};
        await rideRequestNotification.handleAction(actionId, data);
      }
    });
  }

  /**
   * Handle background message
   */
  private async handleBackgroundMessage(remoteMessage: any): Promise<void> {
    console.log('📱 Background FCM message:', remoteMessage);

    if (remoteMessage.data?.type === 'ride_request') {
      const data = remoteMessage.data;
      await this.showRideRequest(data);
    }
  }

  /**
   * Show ride request
   */
  private async showRideRequest(data: Record<string, any>): Promise<void> {
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
    });

    await ringtoneService.playRideRequestRingtone();
  }

  /**
   * Register FCM token with server
   */
  async registerFCMToken(): Promise<string> {
    try {
      const token = await messaging().getToken();
      console.log('📱 FCM Token:', token);
      return token;
    } catch (error) {
      console.error('❌ Failed to get FCM token:', error);
      return '';
    }
  }

  /**
   * Dismiss current ride request
   */
  async dismissRideRequest(): Promise<void> {
    await rideRequestNotification.dismiss();
    await ringtoneService.stopRingtone();
  }

  /**
   * Check if ride request is active
   */
  isRideRequestActive(): boolean {
    return rideRequestNotification.isRequestActive();
  }

  /**
   * Clean up
   */
  async cleanup(): Promise<void> {
    await ringtoneService.cleanup();
    this.isSetup = false;
  }
}

export const notificationService = NotificationService.getInstance();
