// src/services/notification/RideRequestNotification.ts

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
  AndroidStyle,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { ringtoneService } from '../audio/RingtoneService';
import { CONFIG } from '../../../api/constants/rideRequestConfig';

interface RideRequestData {
  requestId: string;
  bookingId: string;
  fare: string;
  pickup: string;
  destination: string;
  distance: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

class RideRequestNotification {
  private static instance: RideRequestNotification;
  private currentRequestId: string | null = null;
  private isActive = false;
  private countdownInterval: ReturnType<typeof setTimeout> | null = null;
  private onActionCallback: ((action: 'accept' | 'reject', requestId: string) => void) | null = null;

  private constructor() {}

  static getInstance(): RideRequestNotification {
    if (!RideRequestNotification.instance) {
      RideRequestNotification.instance = new RideRequestNotification();
    }
    return RideRequestNotification.instance;
  }

  /**
   * Set action callback for notification button presses
   */
  setActionCallback(
    callback: (action: 'accept' | 'reject', requestId: string) => void
  ): void {
    this.onActionCallback = callback;
  }

  /**
   * Show full-screen ride request notification
   */
  async showRideRequest(data: RideRequestData): Promise<void> {
    // Stop any previous notification
    await this.dismiss();

    this.currentRequestId = data.requestId;
    this.isActive = true;

    // Create channel for ride requests
    const channelId = await notifee.createChannel({
      id: 'ride_requests',
      name: 'Ride Requests',
      importance: AndroidImportance.HIGH,
      vibration: true,
      sound: 'ride_request.mp3',
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: true,
    });

    // Display full-screen notification
    await notifee.displayNotification({
      id: `ride-request-${data.requestId}`,
      title: '🚗 New Ride Request',
      body: `₹${data.fare} · ${data.pickup}`,
      data: {
        type: 'ride_request',
        requestId: data.requestId,
        bookingId: data.bookingId,
        fare: data.fare,
        pickup: data.pickup,
        destination: data.destination,
        distance: data.distance,
        pickupLat: String(data.pickupLat),
        pickupLng: String(data.pickupLng),
        dropLat: String(data.dropLat),
        dropLng: String(data.dropLng),
      },
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        fullScreenAction: {
          id: 'show_ride_request',
          launchActivity: 'com.tizzygo.MainActivity',
        },
        actions: [
          {
            title: '✅ Accept',
            pressAction: {
              id: 'accept_ride',
              launchActivity: 'com.tizzygo.MainActivity',
            },
          },
          {
            title: '❌ Decline',
            pressAction: {
              id: 'reject_ride',
              launchActivity: 'com.tizzygo.MainActivity',
            },
          },
        ],
        style: {
          type: AndroidStyle.BIGPICTURE,
          picture: 'https://your-cdn.com/ride-request-banner.png',
        },
        progress: {
          max: CONFIG.RIDE_REQUEST_TIMEOUT_SECONDS,
          current: CONFIG.RIDE_REQUEST_TIMEOUT_SECONDS,
          indeterminate: false,
        },
        ongoing: true,
        autoCancel: false,
        timeoutAfter: CONFIG.RIDE_REQUEST_TIMEOUT_SECONDS * 1000,
      },
      ios: {
        categoryId: 'ride_request',
        sound: 'ride_request.caf',
        critical: true,
        interruptionLevel: 'critical',
        foregroundPresentationOptions: {
          banner: true,
          list: true,
          sound: true,
        },
      },
    });

    // Start countdown
    this.startCountdown(data.requestId);
  }

  /**
   * Update countdown progress in notification
   */
  private startCountdown(requestId: string): void {
    let count = CONFIG.RIDE_REQUEST_TIMEOUT_SECONDS;

    this.countdownInterval = setInterval(async () => {
      count--;

      if (count <= 0 || !this.isActive || this.currentRequestId !== requestId) {
        clearInterval(this.countdownInterval!);
        this.countdownInterval = null;
        await this.dismiss();
        // Auto reject on timeout
        if (this.onActionCallback) {
          this.onActionCallback('reject', requestId);
        }
        return;
      }

      await notifee.displayNotification({
        id: `ride-request-${requestId}`,
        android: {
          progress: {
            max: CONFIG.RIDE_REQUEST_TIMEOUT_SECONDS,
            current: count,
            indeterminate: false,
          },
        },
      });
    }, CONFIG.RIDE_REQUEST_COUNTDOWN_INTERVAL);
  }

  /**
   * Handle notification action
   */
  async handleAction(actionId: string, data: Record<string, any>): Promise<void> {
    const requestId = data.requestId || data.requestId;

    if (actionId === 'accept_ride') {
      await this.dismiss();
      if (this.onActionCallback) {
        this.onActionCallback('accept', requestId);
      }
    } else if (actionId === 'reject_ride') {
      await this.dismiss();
      if (this.onActionCallback) {
        this.onActionCallback('reject', requestId);
      }
    }
  }

  /**
   * Dismiss notification
   */
  async dismiss(): Promise<void> {
    this.isActive = false;
    this.currentRequestId = null;

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    await notifee.cancelAllNotifications();
    await ringtoneService.stopRingtone();
  }

  /**
   * Check if request is active
   */
  isRequestActive(): boolean {
    return this.isActive;
  }

  /**
   * Get current request ID
   */
  getCurrentRequestId(): string | null {
    return this.currentRequestId;
  }
}

export const rideRequestNotification = RideRequestNotification.getInstance();

// Notifee background event handler
export const setupNotifeeBackgroundHandler = (): void => {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS) {
      const actionId = detail.pressAction?.id || '';
      const data = detail.notification?.data || {};
      await rideRequestNotification.handleAction(actionId, data);
    }
  });
};