// src/services/notification/RideRequestNotification.ts

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
} from '@notifee/react-native';
import { Platform, PermissionsAndroid } from 'react-native';
import { ringtoneService } from '../audio/RingtoneService';

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
  expiresAt?: string;
  customerName?: string;
  serviceType?: string;
  rideCode?: string;
}

type RideActionCallback = (
  action: 'accept' | 'reject',
  requestId: string,
  bookingId: string,
) => void;

// ✅ Pending action for killed/background state
interface PendingAction {
  action: 'accept' | 'reject';
  requestId: string;
  bookingId: string;
  timestamp: number;
}

class RideRequestNotification {
  private static instance: RideRequestNotification;
  private activeRequests: Map<
    string,
    {
      expiresAt: Date;
      notificationId: string;
      data: RideRequestData;
      interval: ReturnType<typeof setInterval> | null;
    }
  > = new Map();
  private actionCallback: RideActionCallback | null = null;
  private channelId: string | null = null;
  private isRingtonePlaying = false;
  private pendingAction: PendingAction | null = null;
  private isBackgroundHandlerRegistered = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.init();
    console.log('[RideRequestNotification] 🏗️ Instance created');
  }

  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log('[RideRequestNotification] 🔧 Initializing...');
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          if (!granted) {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
          }
        }
        await this.createChannel();
        await ringtoneService.setup();

        // ✅ Check for pending action from previous session
        await this.loadPendingAction();

        console.log('[RideRequestNotification] ✅ Initialized');
      } catch (error) {
        console.error('[RideRequestNotification] ❌ Init error:', error);
      }
    })();

    return this.initPromise;
  }

  private async createChannel(): Promise<void> {
    try {
      this.channelId = await notifee.createChannel({
        id: 'ride_requests',
        name: 'Ride Requests',
        importance: AndroidImportance.HIGH,
        vibration: true,
        sound: 'ride_request',
        visibility: AndroidVisibility.PUBLIC,
        bypassDnd: true,
      });
      console.log('[RideRequestNotification] ✅ Channel created:', this.channelId);
    } catch (error) {
      console.error('[RideRequestNotification] ❌ Channel creation error:', error);
    }
  }

  static getInstance(): RideRequestNotification {
    if (!RideRequestNotification.instance) {
      RideRequestNotification.instance = new RideRequestNotification();
    }
    return RideRequestNotification.instance;
  }

  // ✅ Set action callback
  setActionCallback(callback: RideActionCallback): void {
    console.log('[RideRequestNotification] 🔗 Action callback set');
    this.actionCallback = callback;

    // ✅ Check if there's a pending action to process
    if (this.pendingAction) {
      console.log('[RideRequestNotification] 📦 Pending action found, processing:', this.pendingAction);
      this.processPendingAction();
    }
  }

  // ✅ Clear action callback
  clearActionCallback(): void {
    console.log('[RideRequestNotification] 🧹 Action callback cleared');
    this.actionCallback = null;
  }

  // ✅ Store pending action
  private storePendingAction(action: 'accept' | 'reject', requestId: string, bookingId: string): void {
    this.pendingAction = {
      action,
      requestId,
      bookingId,
      timestamp: Date.now(),
    };
    // ✅ Persist to AsyncStorage or file system if needed
    console.log('[RideRequestNotification] 💾 Pending action stored:', this.pendingAction);
  }

  // ✅ Load pending action from storage
  private async loadPendingAction(): Promise<void> {
    // For now, just log - can be extended with AsyncStorage
    console.log('[RideRequestNotification] 📂 Checking for pending action...');
  }

  // ✅ Clear pending action
  private clearPendingAction(): void {
    if (this.pendingAction) {
      console.log('[RideRequestNotification] 🧹 Clearing pending action:', this.pendingAction);
      this.pendingAction = null;
    }
  }

  // ✅ Get pending action (for AppContent to check)
  getPendingAction(): PendingAction | null {
    return this.pendingAction;
  }

  // ✅ Process pending action
  private processPendingAction(): void {
    if (!this.pendingAction) {
      return;
    }

    const { action, requestId, bookingId } = this.pendingAction;
    console.log('[RideRequestNotification] 🎯 Processing pending action:', { action, requestId, bookingId });

    if (this.actionCallback) {
      this.actionCallback(action, requestId, bookingId);
      this.clearPendingAction();
    } else {
      console.log('[RideRequestNotification] ⚠️ No action callback to process pending action');
    }
  }

  async showRideRequest(data: RideRequestData): Promise<void> {
    console.log('[RideRequestNotification] ========================================');
    console.log('[RideRequestNotification] 📱 showRideRequest()');
    console.log('[RideRequestNotification] 📦 Request ID:', data.requestId);
    console.log('[RideRequestNotification] 📦 Booking ID:', data.bookingId);
    console.log('[RideRequestNotification] 📦 Customer:', data.customerName);
    console.log('[RideRequestNotification] 📦 Fare:', data.fare);
    console.log('[RideRequestNotification] ========================================');

    try {
      if (!this.channelId) {
        await this.createChannel();
      }

      const notificationId = `ride-request-${data.requestId}`;

      let expiryDate: Date;
      if (data.expiresAt) {
        expiryDate = new Date(data.expiresAt);
        if (expiryDate.getTime() < Date.now()) {
          expiryDate = new Date(Date.now() + 20000);
          console.log('[RideRequestNotification] ⚠️ Expiry in past, reset to 20s');
        }
      } else {
        expiryDate = new Date(Date.now() + 20000);
      }

      this.activeRequests.set(data.requestId, {
        expiresAt: expiryDate,
        notificationId,
        data,
        interval: null,
      });
      console.log('[RideRequestNotification] 📊 Active requests:', this.activeRequests.size);

      const fareAmount = `Rs.${data.fare}`;
      const pickupText = data.pickup || 'Pickup location';
      const dropText = data.destination || 'Drop location';
      const customerName = data.customerName || 'Customer';

      const now = Date.now();
      const initialRemaining = Math.max(
        0,
        Math.floor((expiryDate.getTime() - now) / 1000),
      );
      console.log('[RideRequestNotification] ⏱️ Initial remaining:', initialRemaining, 's');

      await notifee.displayNotification({
        id: notificationId,
        title: `${customerName} - ${fareAmount} (${initialRemaining}s)`,
        body: `${pickupText} → ${dropText}`,
        data: {
          type: 'ride_request',
          requestId: data.requestId,
          bookingId: data.bookingId,
          fare: data.fare,
          pickup: data.pickup,
          destination: data.destination,
          distance: data.distance,
          customerName: data.customerName || '',
          serviceType: data.serviceType || '',
          expiresAt: data.expiresAt || '',
        },
        android: {
          channelId: this.channelId || 'ride_requests',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          actions: [
            {
              title: '✅ Accept',
              pressAction: { id: `accept_ride_${data.requestId}` },
            },
            {
              title: '❌ Decline',
              pressAction: { id: `reject_ride_${data.requestId}` },
            },
          ],
          vibrationPattern: [500, 300, 500, 300],
          sound: 'ride_request',
        },
        ios: {
          categoryId: 'ride_request',
          sound: 'ride_request.caf',
          critical: true,
          interruptionLevel: 'critical',
        },
      });

      console.log('[RideRequestNotification] ✅ Notification displayed:', notificationId);

      this.startCountdown(data.requestId);

      if (!this.isRingtonePlaying) {
        console.log('[RideRequestNotification] 🔊 Playing ringtone (first request)');
        await ringtoneService.playRideRequestRingtone();
        this.isRingtonePlaying = true;
      } else {
        console.log('[RideRequestNotification] 🔊 Ringtone already playing, skipping');
      }
    } catch (error) {
      console.error('[RideRequestNotification] ❌ Error showing ride request:', error);
    }
  }

  private startCountdown(requestId: string): void {
    console.log('[RideRequestNotification] ⏱️ startCountdown for:', requestId);

    const requestData = this.activeRequests.get(requestId);
    if (!requestData) {
      console.log('[RideRequestNotification] ⚠️ No data found for:', requestId);
      return;
    }

    if (requestData.interval) {
      clearInterval(requestData.interval);
    }

    let lastRemaining = -1;

    const interval = setInterval(async () => {
      try {
        const currentData = this.activeRequests.get(requestId);
        if (!currentData) {
          clearInterval(interval);
          return;
        }

        const now = Date.now();
        const remaining = Math.max(
          0,
          Math.floor((currentData.expiresAt.getTime() - now) / 1000),
        );

        if (remaining !== lastRemaining) {
          lastRemaining = remaining;
          console.log(`[RideRequestNotification] ⏱️ Countdown ${requestId}: ${remaining}s`);
        }

        if (remaining <= 0) {
          clearInterval(interval);
          console.log(`[RideRequestNotification] ⏰ Request ${requestId} expired!`);
          await this.dismissRequest(requestId);
          if (this.actionCallback) {
            console.log(`[RideRequestNotification] 📤 Calling reject callback for ${requestId}`);
            this.actionCallback('reject', requestId, currentData.data.bookingId);
          }
          return;
        }

        if (remaining % 2 === 0 || remaining <= 5) {
          const data = currentData.data;
          await notifee.displayNotification({
            id: currentData.notificationId,
            title: `${data.customerName || 'Customer'} - Rs.${data.fare} (${remaining}s)`,
            body: `${data.pickup} → ${data.destination}`,
            data: {
              type: 'ride_request',
              requestId: data.requestId,
              bookingId: data.bookingId,
              fare: data.fare,
              pickup: data.pickup,
              destination: data.destination,
              expiresAt: data.expiresAt || '',
            },
            android: {
              channelId: this.channelId || 'ride_requests',
              importance: AndroidImportance.HIGH,
              visibility: AndroidVisibility.PUBLIC,
              actions: [
                {
                  title: 'Accept',
                  pressAction: { id: `accept_ride_${data.requestId}` },
                },
                {
                  title: 'Decline',
                  pressAction: { id: `reject_ride_${data.requestId}` },
                },
              ],
            },
            ios: {
              categoryId: 'ride_request',
              critical: true,
              interruptionLevel: 'critical',
            },
          });
        }
      } catch (error) {
        console.error('[RideRequestNotification] ❌ Error updating notification:', error);
      }
    }, 1000);

    requestData.interval = interval;
    this.activeRequests.set(requestId, requestData);
  }

  async dismissRequest(requestId: string): Promise<void> {
    console.log(`[RideRequestNotification] 🗑️ dismissRequest() for:`, requestId);

    const requestData = this.activeRequests.get(requestId);
    if (!requestData) {
      console.log('[RideRequestNotification] ⚠️ Request not found:', requestId);
      return;
    }

    if (requestData.interval) {
      clearInterval(requestData.interval);
    }

    await notifee.cancelNotification(requestData.notificationId);
    this.activeRequests.delete(requestId);

    console.log(`[RideRequestNotification] ✅ Notification dismissed for: ${requestId}`);
    console.log(`[RideRequestNotification] 📊 Remaining requests:`, this.activeRequests.size);

    if (this.activeRequests.size === 0) {
      console.log('[RideRequestNotification] 🔕 No requests left, stopping ringtone');
      await ringtoneService.stopRingtone();
      this.isRingtonePlaying = false;
    }
  }

  async dismissAllRequests(): Promise<void> {
    console.log('[RideRequestNotification] 🗑️ dismissAllRequests() called');
    const requestIds = Array.from(this.activeRequests.keys());
    for (const requestId of requestIds) {
      const requestData = this.activeRequests.get(requestId);
      if (requestData && requestData.interval) {
        clearInterval(requestData.interval);
      }
      await notifee.cancelNotification(`ride-request-${requestId}`);
    }
    this.activeRequests.clear();
    await ringtoneService.stopRingtone();
    this.isRingtonePlaying = false;
    console.log('[RideRequestNotification] ✅ All notifications dismissed');
  }

  async dismiss(): Promise<void> {
    await this.dismissAllRequests();
  }

  async dismissRequestById(requestId: string): Promise<void> {
    await this.dismissRequest(requestId);
  }

  // ✅ Handle action from notification - robust for all states
  async handleAction(actionId: string, data: Record<string, any>): Promise<void> {
    console.log('[RideRequestNotification] ========================================');
    console.log('[RideRequestNotification] 🎯 handleAction()');
    console.log('[RideRequestNotification] 📌 Action ID:', actionId);
    console.log('[RideRequestNotification] 📦 Data:', JSON.stringify(data, null, 2));
    console.log('[RideRequestNotification] ========================================');

    // ✅ Extract requestId from actionId if not in data
    let requestId = data.requestId;
    if (!requestId) {
      if (actionId.startsWith('accept_ride_')) {
        requestId = actionId.replace('accept_ride_', '');
      } else if (actionId.startsWith('reject_ride_')) {
        requestId = actionId.replace('reject_ride_', '');
      }
    }

    // ✅ Get bookingId from data
    const bookingId = data.bookingId || '';

    if (!requestId) {
      console.warn('[RideRequestNotification] ⚠️ Could not extract requestId');
      return;
    }

    if (!bookingId) {
      console.warn('[RideRequestNotification] ⚠️ No bookingId found');
    }

    const isAccept = actionId.includes('accept');

    console.log(`[RideRequestNotification] 🎯 Action: ${isAccept ? 'ACCEPT' : 'REJECT'}`);
    console.log(`[RideRequestNotification] 📦 Request ID: ${requestId}`);
    console.log(`[RideRequestNotification] 📦 Booking ID: ${bookingId}`);

    // ✅ Store pending action FIRST (for killed app case)
    this.storePendingAction(isAccept ? 'accept' : 'reject', requestId, bookingId);

    // ✅ Dismiss notification
    await this.dismissRequest(requestId);

    // ✅ If callback exists, process immediately
    if (this.actionCallback) {
      if (isAccept) {
        console.log('[RideRequestNotification] ✅ ACCEPTED from notification');
        this.actionCallback('accept', requestId, bookingId);
      } else {
        console.log('[RideRequestNotification] ❌ REJECTED from notification');
        this.actionCallback('reject', requestId, bookingId);
      }
      // ✅ Clear pending action after successful callback
      this.clearPendingAction();
    } else {
      console.log('[RideRequestNotification] ⏳ No callback available, action stored as pending');
      // ✅ Action stored as pending - will be processed when AppContent initializes
    }
  }

  isRequestActive(requestId?: string): boolean {
    if (requestId) {
      return this.activeRequests.has(requestId);
    }
    return this.activeRequests.size > 0;
  }

  getActiveRequestIds(): string[] {
    return Array.from(this.activeRequests.keys());
  }

  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  // ✅ Register background handler (safe, no duplicates)
  registerBackgroundHandler(): void {
    if (this.isBackgroundHandlerRegistered) {
      console.log('[RideRequestNotification] ⚠️ Background handler already registered');
      return;
    }

    console.log('[RideRequestNotification] 📡 Registering background handler');

    notifee.onBackgroundEvent(async ({ type, detail }) => {
      console.log('[RideRequestNotification] 📡 BACKGROUND EVENT RECEIVED');
      console.log('[RideRequestNotification] 📌 Event type:', type);

      if (type === EventType.ACTION_PRESS) {
        const actionId = detail.pressAction?.id || '';
        const data = detail.notification?.data || {};

        console.log('[RideRequestNotification] 🎯 Background action:', actionId);
        console.log('[RideRequestNotification] 📦 Background data:', JSON.stringify(data, null, 2));

        await this.handleAction(actionId, data);
      }
    });

    this.isBackgroundHandlerRegistered = true;
    console.log('[RideRequestNotification] ✅ Background handler registered');
  }
}

export const rideRequestNotification = RideRequestNotification.getInstance();

// ✅ Safe setup function - no duplicates
export const setupNotifeeBackgroundHandler = (): void => {
  console.log('[RideRequestNotification] ========================================');
  console.log('[RideRequestNotification] 📡 setupNotifeeBackgroundHandler() called');
  console.log('[RideRequestNotification] ========================================');

  rideRequestNotification.registerBackgroundHandler();

  console.log('[RideRequestNotification] ✅ Background handler setup complete');
  console.log('[RideRequestNotification] ========================================');
};