import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  FlatList,
  Dimensions,
  ScrollView,
  Modal,
  Alert,
  Switch,
  PermissionsAndroid,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  launchImageLibrary,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import DeviceInfo from 'react-native-device-info';
import { vehicleOptions } from '../../shipping/Apply/vehicleCategory';

// NEW: Import react-native-get-location instead of react-native-geolocation-service
import GetLocation from 'react-native-get-location';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export type RootStackParamList = {
  RiderRegistration: undefined;
  RegistrationSuccess: { shippingId: string };
  Login: undefined;
  Home: undefined;
};

type RiderRegistrationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RiderRegistration'
>;

type VehicleCategory = 'Car' | 'Bike' | 'Scooter' | 'Auto' | 'Tempo';
type IdentityType = 'Aadhaar' | 'VoterID' | 'Passport' | 'PAN';

const API_BASE_URL = 'http://172.20.10.12:5000';

const ONLINE_STATUS_KEY = 'rider_online_status';
const TRACKING_STATUS_KEY = 'rider_tracking_status';
const LAST_ONLINE_KEY = 'rider_last_online';
const LAST_OFFLINE_KEY = 'rider_last_offline';
const PERMISSION_GRANTED_KEY = 'location_permission_granted';

// ============================================================
// PRODUCTION-GRADE LOCATION TRACKER with react-native-get-location
// ============================================================

interface PermissionState {
  fineLocation: boolean;
  backgroundLocation: boolean;
  lastChecked: number | null;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

class LocationTracker {
  private static instance: LocationTracker;
  private isTracking = false;
  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private riderId: string | null = null;
  private authToken: string | null = null;
  private lastLocation: LocationData | null = null;
  private appStateSubscription: any = null;
  private backgroundMode = false;
  private abortController: AbortController | null = null;
  private batteryLevel = 100;
  private batteryInterval: ReturnType<typeof setInterval> | null = null;
  private isPollingInProgress = false;
  private currentIntervalMs = 10000;
  private appState: AppStateStatus = 'active';
  private isStarting = false;
  private isStopping = false;

  private permissionState: PermissionState = {
    fineLocation: false,
    backgroundLocation: false,
    lastChecked: null,
  };

  private permissionsRequestedByUser = false;

  private readonly HIGH_BATTERY_THRESHOLD = 30;
  private readonly LOW_BATTERY_THRESHOLD = 15;
  private highBatteryIntervalForeground = 8000;
  private balancedIntervalForeground = 15000;
  private lowBatteryIntervalForeground = 60000;

  private constructor() {
    console.log('[Tracker] Constructor - Initializing');
    try {
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.onAppStateChange.bind(this),
      );
      this.startBatteryMonitoring();
      this.loadStoredPermissionState();
    } catch (error) {
      console.error('[Tracker] Constructor error:', error);
    }
  }

  static getInstance(): LocationTracker {
    if (!LocationTracker.instance) {
      LocationTracker.instance = new LocationTracker();
    }
    return LocationTracker.instance;
  }

  private async loadStoredPermissionState() {
    try {
      const stored = await AsyncStorage.getItem(PERMISSION_GRANTED_KEY);
      if (stored === 'true') {
        console.log('[Permission] Loaded stored granted state');
        this.permissionState.fineLocation = true;
        this.permissionState.backgroundLocation = true;
        this.permissionState.lastChecked = Date.now();
        this.permissionsRequestedByUser = true;
      }
    } catch (error) {
      console.warn('[Permission] Failed to load stored state:', error);
    }
  }

  private async savePermissionState(granted: boolean) {
    try {
      await AsyncStorage.setItem(
        PERMISSION_GRANTED_KEY,
        granted ? 'true' : 'false',
      );
      console.log(`[Permission] Saved state: ${granted}`);
    } catch (error) {
      console.warn('[Permission] Failed to save state:', error);
    }
  }

  async requestPermissionsFromScreen(): Promise<boolean> {
    console.log('[Permission] requestPermissionsFromScreen called');
    console.log(
      '[Permission] ⚠️ This MUST be called from a mounted screen with Activity',
    );
    console.log(`[Permission] AppState: ${this.appState}`);

    this.permissionsRequestedByUser = true;
    const result = await this.requestPermissionsWithActivityCheck();

    if (result) {
      await this.savePermissionState(true);
    }

    return result;
  }

  hasPermissions(): boolean {
    const hasFine = this.permissionState.fineLocation;
    const hasBg =
      Platform.OS === 'android' && Platform.Version >= 29
        ? this.permissionState.backgroundLocation
        : true;
    console.log(
      `[Permission] hasPermissions check: fine=${hasFine}, bg=${hasBg}`,
    );
    return hasFine && hasBg;
  }

  private async requestPermissionsWithActivityCheck(): Promise<boolean> {
    console.log('[Permission] requestPermissionsWithActivityCheck - START');
    console.log(`[Permission] AppState: ${this.appState}`);

    try {
      if (Platform.OS !== 'android') {
        console.log('[Permission] iOS - using different flow');
        return this.requestIOSPermissions();
      }

      if (this.appState !== 'active') {
        console.log(
          '[Permission] SKIPPED - AppState is not active:',
          this.appState,
        );
        return false;
      }

      console.log(
        '[Permission] Attempting to check current permission state...',
      );

      let fineGranted = false;
      let bgGranted = false;

      try {
        const fineCheck = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        fineGranted = fineCheck;
        console.log(`[Permission] Fine location check result: ${fineGranted}`);
      } catch (checkError: any) {
        console.error(
          '[Permission] FAILED to check fine location - Activity unavailable',
        );
        return false;
      }

      if (Platform.Version >= 29) {
        try {
          const bgCheck = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          );
          bgGranted = bgCheck;
          console.log(
            `[Permission] Background location check result: ${bgGranted}`,
          );
        } catch (checkError: any) {
          console.error('[Permission] FAILED to check background location');
          return false;
        }
      } else {
        bgGranted = true;
      }

      if (fineGranted && bgGranted) {
        console.log('[Permission] Permissions already granted, updating state');
        this.permissionState.fineLocation = fineGranted;
        this.permissionState.backgroundLocation = bgGranted;
        this.permissionState.lastChecked = Date.now();
        return true;
      }

      console.log(
        '[Permission] Permissions not granted, need to request dialog',
      );

      let fineResult: string;
      try {
        console.log('[Permission] Requesting ACCESS_FINE_LOCATION...');
        fineResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission Required',
            message: 'TizzyGo needs location access to track your deliveries.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        console.log(`[Permission] Fine location request result: ${fineResult}`);
      } catch (reqError: any) {
        console.error('[Permission] FAILED to request fine location');
        return false;
      }

      const fineGrantedNow = fineResult === PermissionsAndroid.RESULTS.GRANTED;
      if (!fineGrantedNow) {
        console.log('[Permission] Fine location denied by user');
        this.permissionState.fineLocation = false;
        return false;
      }

      if (Platform.Version >= 29) {
        let bgResult: string;
        try {
          console.log('[Permission] Requesting ACCESS_BACKGROUND_LOCATION...');
          bgResult = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            {
              title: 'Background Location Permission',
              message: 'App needs background location for delivery tracking.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
          console.log(
            `[Permission] Background location request result: ${bgResult}`,
          );
          bgGranted = bgResult === PermissionsAndroid.RESULTS.GRANTED;
        } catch (reqError: any) {
          console.error('[Permission] FAILED to request background location');
          bgGranted = false;
        }
      } else {
        bgGranted = true;
      }

      this.permissionState.fineLocation = fineGrantedNow;
      this.permissionState.backgroundLocation = bgGranted;
      this.permissionState.lastChecked = Date.now();

      const success = fineGrantedNow && bgGranted;
      console.log(`[Permission] Request complete - SUCCESS: ${success}`);
      return success;
    } catch (outerError: any) {
      console.error('[Permission] UNEXPECTED error:', outerError);
      return false;
    }
  }

  private async requestIOSPermissions(): Promise<boolean> {
    console.log('[Permission iOS] Starting permission flow');
    return new Promise<boolean>(resolve => {
      try {
        GetLocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 5000,
        })
          .then(() => {
            console.log('[Permission iOS] Success');
            resolve(true);
          })
          .catch(error => {
            console.warn('[Permission iOS] Denied:', error);
            resolve(false);
          });
      } catch (error) {
        console.error('[Permission iOS] Request error:', error);
        resolve(false);
      }
    });
  }

  async startTracking(riderId: string, authToken: string): Promise<boolean> {
    console.log('[Tracker] ========== startTracking CALLED ==========');
    console.log(`[Tracker] hasPermissions(): ${this.hasPermissions()}`);

    if (!this.hasPermissions()) {
      console.error(
        '[Tracker] Cannot start tracking - permissions not granted',
      );
      return false;
    }

    if (this.isStarting || this.isTracking) {
      console.log('[Tracker] Already starting or tracking');
      return false;
    }

    this.isStarting = true;
    try {
      if (this.isTracking) {
        console.log('[Tracker] Already tracking');
        return false;
      }

      console.log('[Tracker] Stopping any existing polling loop');
      this.stopPollingLoop();

      if (!this.hasPermissions()) {
        console.error('[Tracker] No permissions - aborting start');
        return false;
      }

      this.isTracking = true;
      this.riderId = riderId;
      this.authToken = authToken;
      this.backgroundMode = false;
      this.isPollingInProgress = false;

      console.log('[Tracker] Updating battery level...');
      try {
        await this.updateBatteryLevel();
      } catch (batteryError) {
        console.warn('[Tracker] Battery update failed:', batteryError);
      }

      console.log('[Tracker] Starting polling loop...');
      this.startPollingLoop();

      console.log('[Tracker] Tracking started successfully');
      return true;
    } catch (error) {
      console.error('[Tracker] startTracking error:', error);
      return false;
    } finally {
      this.isStarting = false;
    }
  }

  async stopTracking(): Promise<void> {
    console.log('[Tracker] stopTracking called');
    if (this.isStopping) return;
    this.isStopping = true;
    try {
      this.isTracking = false;
      this.stopPollingLoop();
      if (this.abortController) {
        try {
          this.abortController.abort();
        } catch (abortError) {
          console.warn('[Tracker] Abort error:', abortError);
        }
        this.abortController = null;
      }
      this.riderId = null;
      this.authToken = null;
      this.lastLocation = null;
      this.isPollingInProgress = false;
      console.log('[Tracker] Tracking stopped');
    } catch (error) {
      console.error('[Tracker] stopTracking error:', error);
    } finally {
      this.isStopping = false;
    }
  }

  isTrackingActive(): boolean {
    return this.isTracking;
  }

  async updatePermissionState(granted: boolean) {
    console.log(`[Permission] updatePermissionState called with: ${granted}`);
    if (granted) {
      this.permissionState.fineLocation = true;
      this.permissionState.backgroundLocation = true;
      this.permissionState.lastChecked = Date.now();
      this.permissionsRequestedByUser = true;
      await this.savePermissionState(true);
    } else {
      this.permissionState.fineLocation = false;
      this.permissionState.backgroundLocation = false;
      await this.savePermissionState(false);
    }
  }

  destroy() {
    console.log('[Tracker] destroy called');
    try {
      this.stopTracking();
    } catch (error) {
      console.warn('[Tracker] destroy - stopTracking error:', error);
    }
    if (this.appStateSubscription) {
      try {
        this.appStateSubscription.remove();
      } catch (subError) {
        console.warn('[Tracker] Subscription removal error:', subError);
      }
    }
    if (this.batteryInterval) {
      try {
        clearInterval(this.batteryInterval);
      } catch (intervalError) {
        console.warn('[Tracker] Battery interval clear error:', intervalError);
      }
    }
    if (this.pollingIntervalId) {
      try {
        clearInterval(this.pollingIntervalId);
      } catch (pollError) {
        console.warn('[Tracker] Polling interval clear error:', pollError);
      }
    }
  }

  private onAppStateChange(nextAppState: AppStateStatus) {
    console.log(
      `[Tracker] AppState changed: ${this.appState} -> ${nextAppState}`,
    );
    try {
      this.appState = nextAppState;
      this.backgroundMode = nextAppState === 'background';
      if (this.isTracking) {
        this.restartPollingWithNewInterval();
      }
    } catch (error) {
      console.error('[Tracker] onAppStateChange error:', error);
    }
  }

  private restartPollingWithNewInterval() {
    console.log('[Tracker] restartPollingWithNewInterval');
    if (!this.isTracking) return;
    try {
      this.stopPollingLoop();
      this.startPollingLoop();
    } catch (error) {
      console.error('[Tracker] restartPollingWithNewInterval error:', error);
    }
  }

  private startPollingLoop() {
    console.log('[Tracker] ========== startPollingLoop ==========');
    if (this.pollingIntervalId) {
      console.log('[Tracker] Clearing existing interval');
      this.stopPollingLoop();
    }

    try {
      const interval = this.getCurrentInterval();
      this.currentIntervalMs = interval;
      console.log(
        `[Tracker] Starting polling loop: interval=${interval}ms, bg=${this.backgroundMode}, battery=${this.batteryLevel}%`,
      );

      console.log('[Tracker] Executing initial location poll...');
      this.executeLocationPoll();

      console.log('[Tracker] Setting up interval timer');
      this.pollingIntervalId = setInterval(() => {
        console.log('[Tracker] Interval callback triggered');
        this.executeLocationPoll();
      }, interval);

      console.log('[Tracker] Polling loop started successfully');
    } catch (error) {
      console.error('[Tracker] startPollingLoop error:', error);
    }
  }

  private stopPollingLoop() {
    console.log('[Tracker] stopPollingLoop called');
    if (this.pollingIntervalId) {
      try {
        clearInterval(this.pollingIntervalId);
        this.pollingIntervalId = null;
        console.log('[Tracker] Polling loop stopped');
      } catch (error) {
        console.error('[Tracker] stopPollingLoop clear error:', error);
      }
    }
  }

  private async executeLocationPoll() {
    console.log('[GPS] ========== executeLocationPoll START ==========');
    console.log(`[GPS] isTracking: ${this.isTracking}`);
    console.log(`[GPS] isPollingInProgress: ${this.isPollingInProgress}`);

    if (!this.isTracking) {
      console.log('[GPS] Not tracking, skipping poll');
      return;
    }

    if (this.isPollingInProgress) {
      console.log('[GPS] Poll already in progress, skipping');
      return;
    }

    this.isPollingInProgress = true;
    try {
      const { highAccuracy } = this.getAccuracyConfig();
      console.log(`[GPS] Getting position with highAccuracy=${highAccuracy}`);

      let location: LocationData;
      try {
        console.log('[GPS] BEFORE GetLocation.getCurrentPosition call');
        location = await this.getCurrentLocationPromise(highAccuracy);
        console.log('[GPS] AFTER GetLocation.getCurrentPosition - SUCCESS!');
        console.log(
          `[GPS] Coordinates: lat=${location.latitude}, lng=${location.longitude}, accuracy=${location.accuracy}`,
        );
      } catch (locationError: any) {
        console.error(
          '[GPS] Location error caught:',
          locationError.code,
          locationError.message,
        );
        console.log('[GPS] Error details:', JSON.stringify(locationError));
        return;
      }

      await this.handleLocationUpdate(location);
      console.log('[GPS] Location update handled successfully');
    } catch (err: any) {
      console.error(
        '[GPS] executeLocationPoll unexpected error:',
        err?.message || err,
      );
    } finally {
      this.isPollingInProgress = false;
      console.log('[GPS] executeLocationPoll END');
    }
  }

  private getCurrentInterval(): number {
    try {
      if (this.batteryLevel > this.HIGH_BATTERY_THRESHOLD) {
        return this.highBatteryIntervalForeground;
      } else if (this.batteryLevel > this.LOW_BATTERY_THRESHOLD) {
        return this.balancedIntervalForeground;
      } else {
        return this.lowBatteryIntervalForeground;
      }
    } catch (error) {
      console.error('[Tracker] getCurrentInterval error:', error);
      return 15000;
    }
  }

  private getAccuracyConfig(): { highAccuracy: boolean } {
    try {
      return {
        highAccuracy: this.batteryLevel > this.LOW_BATTERY_THRESHOLD,
      };
    } catch (error) {
      console.error('[Tracker] getAccuracyConfig error:', error);
      return { highAccuracy: false };
    }
  }

  // NEW: Complete rewrite using react-native-get-location with proper timeout
  private getCurrentLocationPromise(
    highAccuracy: boolean,
  ): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      console.log('[GPS] Promise started, setting timeout...');

      let isResolved = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      // Cleanup function to prevent memory leaks
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      // Set timeout to prevent hanging
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.log(
            '[GPS] ⚠️ TIMEOUT FIRED - 15 seconds elapsed without response',
          );
          cleanup();
          reject(new Error('Location timeout - no response from GPS'));
        }
      }, 15000);

      const options = {
        enableHighAccuracy: highAccuracy,
        timeout: 10000, // milliseconds
        maxAge: 0, // no cached location
      };

      console.log(
        `[GPS] Calling GetLocation.getCurrentPosition with options:`,
        options,
      );

      try {
        GetLocation.getCurrentPosition(options)
          .then(location => {
            if (!isResolved) {
              isResolved = true;
              const timestamp = Date.now();
              console.log('[GPS] ✅ SUCCESS CALLBACK FIRED');
              console.log(
                `[GPS] Location: lat=${location.latitude}, lng=${location.longitude}, accuracy=${location.accuracy}, timestamp=${timestamp}`,
              );
              cleanup();
              resolve({
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy || 0,
                timestamp,
              });
            }
          })
          .catch(error => {
            if (!isResolved) {
              isResolved = true;
              console.log('[GPS] ❌ ERROR CALLBACK FIRED');
              console.log(
                `[GPS] Error code: ${error.code}, message: ${error.message}`,
              );
              cleanup();
              reject(error);
            }
          });
        console.log(
          '[GPS] GetLocation.getCurrentPosition call completed (async)',
        );
      } catch (error) {
        if (!isResolved) {
          isResolved = true;
          console.error(
            '[GPS] 🔥 EXCEPTION in GetLocation.getCurrentPosition:',
            error,
          );
          cleanup();
          reject(error);
        }
      }
    });
  }

  private startBatteryMonitoring() {
    console.log('[Tracker] startBatteryMonitoring');
    this.batteryInterval = setInterval(async () => {
      try {
        await this.updateBatteryLevel();
        if (this.isTracking) {
          console.log(`[Tracker] Battery updated: ${this.batteryLevel}%`);
          const newInterval = this.getCurrentInterval();
          if (newInterval !== this.currentIntervalMs) {
            this.restartPollingWithNewInterval();
          }
        }
      } catch (error) {
        console.warn('[Tracker] Battery monitoring interval error:', error);
      }
    }, 60000);
    this.updateBatteryLevel();
  }

  private async updateBatteryLevel() {
    try {
      const level = await DeviceInfo.getBatteryLevel();
      this.batteryLevel = level * 100;
    } catch (e) {
      console.warn('[Tracker] Could not get battery level', e);
      this.batteryLevel = 50;
    }
  }

  private async handleLocationUpdate(location: LocationData) {
    console.log('[Tracker] handleLocationUpdate called');
    if (!this.isTracking || !this.riderId || !this.authToken) {
      console.log('[Tracker] handleLocationUpdate - missing data, skipping');
      return;
    }

    try {
      const { latitude, longitude, accuracy } = location;
      console.log(
        `[Tracker] Processing location: (${latitude}, ${longitude}) accuracy=${accuracy}`,
      );

      if (latitude === 0 && longitude === 0) {
        console.log('[Tracker] Invalid coordinates (0,0), skipping');
        return;
      }

      if (this.lastLocation) {
        const latDiff =
          Math.abs(latitude - this.lastLocation.latitude) * 111000;
        const lngDiff =
          Math.abs(longitude - this.lastLocation.longitude) * 111000;
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        console.log(
          `[Tracker] Movement distance: ${distance.toFixed(2)} meters`,
        );

        if (
          distance < 10 &&
          Math.abs(accuracy - this.lastLocation.accuracy) < 5
        ) {
          console.log('[Tracker] Insufficient movement, skipping send');
          return;
        }
      }

      this.lastLocation = {
        latitude,
        longitude,
        accuracy,
        timestamp: Date.now(),
      };
      console.log('[Tracker] Sending location to backend...');
      await this.sendLocationToBackend(latitude, longitude, accuracy);
    } catch (error) {
      console.error('[Tracker] handleLocationUpdate error:', error);
    }
  }

  private async sendLocationToBackend(
    lat: number,
    lng: number,
    accuracy: number,
  ) {
    if (!this.riderId || !this.authToken) return;

    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch (abortError) {}
    }

    this.abortController = new AbortController();
    const controller = this.abortController;

    try {
      const timeoutId = setTimeout(() => {
        try {
          controller.abort();
        } catch (e) {}
      }, 10000);

      const response = await fetch(
        `${API_BASE_URL}/api/shipping/rider/location`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.authToken}`,
          },
          body: JSON.stringify({
            riderId: this.riderId,
            action: 'update',
            latitude: lat,
            longitude: lng,
            accuracy,
            timestamp: new Date().toISOString(),
            updateType: 'tracking',
            batteryLevel: this.batteryLevel,
            isBackground: this.backgroundMode,
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[API] Server error: ${response.status}`);
        return;
      }

      console.log('[API] Location sent successfully');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[API] Request aborted');
      } else {
        console.error('[API] Send failed', error?.message || error);
      }
    } finally {
      if (this.abortController === controller) {
        this.abortController = null;
      }
    }
  }
}

// Helper: one-time location for going online using new library
const getLocationOnce = (): Promise<{ lat: number; lng: number }> => {
  return new Promise((resolve, reject) => {
    console.log('[getLocationOnce] Starting one-time location request');
    try {
      GetLocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 15000,
      })
        .then(location => {
          console.log(
            '[getLocationOnce] Success:',
            location.latitude,
            location.longitude,
          );
          resolve({ lat: location.latitude, lng: location.longitude });
        })
        .catch(error => {
          console.error('[getLocationOnce] Error:', error.code, error.message);
          reject(error);
        });
    } catch (error) {
      console.error('[getLocationOnce] Exception:', error);
      reject(error);
    }
  });
};

// ======================= DEBOUNCE HOOK =======================
function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fn(...args);
        timerRef.current = null;
      }, delay);
    },
    [fn, delay],
  ) as T;
  return debouncedFn;
}

// ======================= PERMISSION HELPERS =======================
export async function requestLocationPermission(): Promise<boolean> {
  console.log('[Permission] requestLocationPermission called from screen');

  const tracker = LocationTracker.getInstance();
  const result = await tracker.requestPermissionsFromScreen();

  if (result) {
    console.log('[Permission] Granted successfully');
    await tracker.updatePermissionState(true);
  } else {
    console.log('[Permission] Denied or failed');
    await tracker.updatePermissionState(false);
  }

  return result;
}

async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs access to your storage to upload images',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('[Storage] Permission error:', error);
      return false;
    }
  }
  return true;
}

const { width } = Dimensions.get('window');

interface ModelItem {
  label: string;
  value: string;
  originalIndex?: number;
}

interface ExistingRegistration {
  _id: string;
  status: string;
  name: string;
  vehicleBrand: string;
  vehicleModel: string;
  isOnline: boolean;
  lastOnlineAt?: string;
  lastOfflineAt?: string;
  kyc?: {
    drivingLicenseNumber: string;
    drivingLicenseImage: string;
    identityType: string;
    identityNumber: string;
    identityImage: string;
    status: string;
    verified?: boolean;
  };
  kycVerified?: boolean;
}

interface ItemType<T> {
  label: string;
  value: T;
}

const RiderRegistrationScreen: React.FC = () => {
  const navigation = useNavigation<RiderRegistrationScreenNavigationProp>();
  const isMounted = useRef(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const [name, setName] = useState<string>('');
  const [vehicleCategory, setVehicleCategory] =
    useState<VehicleCategory | null>(null);
  const [vehicleBrand, setVehicleBrand] = useState<string | null>(null);
  const [vehicleModel, setVehicleModel] = useState<string | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [maxOrdersPerDay, setMaxOrdersPerDay] = useState<string>('25');

  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState<string>('');
  const [identityType, setIdentityType] = useState<IdentityType | null>(null);
  const [identityNumber, setIdentityNumber] = useState<string>('');

  const [vehicleImage, setVehicleImage] = useState<string | null>(null);
  const [drivingLicenseImage, setDrivingLicenseImage] = useState<string | null>(
    null,
  );
  const [identityImage, setIdentityImage] = useState<string | null>(null);

  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isTrackingOn, setIsTrackingOn] = useState<boolean>(false);
  const [isUpdatingOnlineStatus, setIsUpdatingOnlineStatus] =
    useState<boolean>(false);
  const [isUpdatingTrackingStatus, setIsUpdatingTrackingStatus] =
    useState<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);
  const [lastOfflineAt, setLastOfflineAt] = useState<string | null>(null);
  const [hasLocationPermission, setHasLocationPermission] =
    useState<boolean>(false);

  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showBrandModal, setShowBrandModal] = useState<boolean>(false);
  const [showModelModal, setShowModelModal] = useState<boolean>(false);
  const [showIdentityModal, setShowIdentityModal] = useState<boolean>(false);

  const [allModels, setAllModels] = useState<ModelItem[]>([]);
  const [allBrands, setAllBrands] = useState<ItemType<string>[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState<boolean>(true);
  const [existingRegistration, setExistingRegistration] =
    useState<ExistingRegistration | null>(null);

  const [vehicleCategories] = useState<ItemType<VehicleCategory>[]>([
    { label: 'Car', value: 'Car' },
    { label: 'Bike', value: 'Bike' },
    { label: 'Scooter', value: 'Scooter' },
    { label: 'Auto', value: 'Auto' },
    { label: 'Tempo', value: 'Tempo' },
  ]);

  const [identityTypes] = useState<ItemType<IdentityType>[]>([
    { label: 'Aadhaar Card', value: 'Aadhaar' },
    { label: 'Voter ID', value: 'VoterID' },
    { label: 'Passport', value: 'Passport' },
    { label: 'PAN Card', value: 'PAN' },
  ]);

  const checkPermissionStatus = useCallback(() => {
    const tracker = LocationTracker.getInstance();
    const hasPerm = tracker.hasPermissions();
    setHasLocationPermission(hasPerm);
    console.log(`[Screen] Permission status: ${hasPerm}`);
  }, []);

  const loadVehicleBrands = useCallback((category: VehicleCategory) => {
    if (vehicleOptions[category]) {
      const brands = Object.keys(vehicleOptions[category]).map(brand => ({
        label: brand,
        value: brand,
      }));
      setAllBrands(brands);
    } else {
      setAllBrands([]);
    }
    setVehicleBrand(null);
    setVehicleModel(null);
    setAllModels([]);
  }, []);

  const loadVehicleModels = useCallback(
    (category: VehicleCategory, brand: string) => {
      if (vehicleOptions[category] && vehicleOptions[category][brand]) {
        const models = vehicleOptions[category][brand].map(
          (model: string, index: number) => ({
            label: model,
            value: model,
            originalIndex: index,
          }),
        );
        setAllModels(models);
      } else {
        setAllModels([]);
      }
      setVehicleModel(null);
    },
    [],
  );

  useEffect(() => {
    if (vehicleCategory) loadVehicleBrands(vehicleCategory);
    else setAllBrands([]);
  }, [vehicleCategory, loadVehicleBrands]);

  useEffect(() => {
    if (vehicleCategory && vehicleBrand)
      loadVehicleModels(vehicleCategory, vehicleBrand);
    else setAllModels([]);
  }, [vehicleCategory, vehicleBrand, loadVehicleModels]);

  const saveOnlineStatus = async (status: boolean) => {
    try {
      await AsyncStorage.setItem(ONLINE_STATUS_KEY, JSON.stringify(status));
    } catch {}
  };

  const saveTrackingStatus = async (status: boolean) => {
    try {
      await AsyncStorage.setItem(TRACKING_STATUS_KEY, JSON.stringify(status));
    } catch {}
  };

  const saveLastOnlineTime = async (time: string) => {
    try {
      await AsyncStorage.setItem(LAST_ONLINE_KEY, time);
    } catch {}
  };

  const saveLastOfflineTime = async (time: string) => {
    try {
      await AsyncStorage.setItem(LAST_OFFLINE_KEY, time);
    } catch {}
  };

  const loadPersistedStatus = async () => {
    if (!isMounted.current) return;
    try {
      const [
        savedOnlineStatus,
        savedTrackingStatus,
        savedLastOnline,
        savedLastOffline,
      ] = await Promise.all([
        AsyncStorage.getItem(ONLINE_STATUS_KEY),
        AsyncStorage.getItem(TRACKING_STATUS_KEY),
        AsyncStorage.getItem(LAST_ONLINE_KEY),
        AsyncStorage.getItem(LAST_OFFLINE_KEY),
      ]);
      if (savedOnlineStatus !== null && isMounted.current)
        setIsOnline(JSON.parse(savedOnlineStatus));
      if (savedTrackingStatus !== null && isMounted.current)
        setIsTrackingOn(JSON.parse(savedTrackingStatus));
      if (savedLastOnline !== null && isMounted.current)
        setLastOnlineAt(savedLastOnline);
      if (savedLastOffline !== null && isMounted.current)
        setLastOfflineAt(savedLastOffline);
    } catch {}
  };

  useEffect(() => {
    isMounted.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    checkPermissionStatus();
    loadPersistedStatus();

    return () => {
      isMounted.current = false;
      LocationTracker.getInstance().stopTracking();
    };
  }, [fadeAnim, slideAnim, checkPermissionStatus]);

  const handleRequestPermissions = async () => {
    console.log('[Screen] User requested permissions via button');
    const granted = await requestLocationPermission();
    setHasLocationPermission(granted);
    if (granted) {
      Toast.show({
        type: 'success',
        text1: 'Permission Granted',
        text2: 'Location access enabled',
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Permission Required',
        text2: 'Location access is needed for delivery tracking',
      });
    }
  };

  const goOnlineWithLocation = async (
    riderId: string,
    authToken: string,
  ): Promise<boolean> => {
    try {
      const { lat, lng } = await getLocationOnce();
      await fetch(`${API_BASE_URL}/api/shipping/rider/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          riderId,
          action: 'start',
          latitude: lat,
          longitude: lng,
        }),
      });
    } catch (error) {
      console.warn('Could not get initial location for online status', error);
    }
    const tracker = LocationTracker.getInstance();
    const success = await tracker.startTracking(riderId, authToken);
    if (isMounted.current && success) {
      setIsTrackingOn(true);
      await saveTrackingStatus(true);
    }
    return success;
  };

  const startLiveTracking = async (
    riderId: string,
    authToken: string,
  ): Promise<boolean> => {
    try {
      const tracker = LocationTracker.getInstance();
      if (!tracker.hasPermissions()) {
        Toast.show({
          type: 'error',
          text1: 'Permission Required',
          text2: 'Please grant location permission first',
        });
        return false;
      }
      const success = await tracker.startTracking(riderId, authToken);
      if (success && isMounted.current) {
        setIsTrackingOn(true);
        await saveTrackingStatus(true);
        Toast.show({
          type: 'success',
          text1: 'Location Tracking Started',
          text2: 'Continuous tracking active',
        });
        return true;
      }
      throw new Error('Failed to start tracking');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Tracking Failed',
        text2: String(error),
      });
      return false;
    }
  };

  const stopLiveTracking = async (): Promise<boolean> => {
    try {
      const tracker = LocationTracker.getInstance();
      await tracker.stopTracking();
      if (isMounted.current) {
        setIsTrackingOn(false);
        await saveTrackingStatus(false);
      }
      return true;
    } catch (error) {
      console.error('Stop tracking error:', error);
      return false;
    }
  };

  useFocusEffect(
    useCallback(() => {
      checkExistingRegistration();
      loadPersistedStatus();
      checkPermissionStatus();
    }, [checkPermissionStatus]),
  );

  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch {
      return null;
    }
  };

  const checkExistingRegistration = async () => {
    if (!isMounted.current) return;
    try {
      setCheckingExisting(true);
      const authToken = await getAuthToken();
      if (!authToken) {
        setCheckingExisting(false);
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/shipping/form/check`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.exists && data.shippingData) {
          const registrationData = data.shippingData;
          if (isMounted.current) setExistingRegistration(registrationData);
          await loadPersistedStatus();
          if (registrationData.kyc && isMounted.current) {
            setDrivingLicenseNumber(
              registrationData.kyc.drivingLicenseNumber || '',
            );
            setIdentityType(
              (registrationData.kyc.identityType as IdentityType) || null,
            );
            setIdentityNumber(registrationData.kyc.identityNumber || '');
            if (registrationData.kyc.drivingLicenseImage)
              setDrivingLicenseImage(registrationData.kyc.drivingLicenseImage);
            if (registrationData.kyc.identityImage)
              setIdentityImage(registrationData.kyc.identityImage);
          }
          const isApproved = registrationData.status === 'approved';
          const isKYCVerified =
            registrationData.kyc?.status === 'verified' ||
            registrationData.kyc?.verified === true ||
            registrationData.kycVerified === true;
          if (isApproved && isKYCVerified) {
            const savedTracking = await AsyncStorage.getItem(
              TRACKING_STATUS_KEY,
            );
            if (savedTracking === null)
              await fetchLocationStatus(registrationData._id, authToken);
          } else if (isMounted.current) {
            setIsTrackingOn(false);
            await saveTrackingStatus(false);
          }
        }
      } else if (response.status === 404) {
        if (isMounted.current) setExistingRegistration(null);
        await AsyncStorage.multiRemove([
          ONLINE_STATUS_KEY,
          TRACKING_STATUS_KEY,
          LAST_ONLINE_KEY,
          LAST_OFFLINE_KEY,
        ]);
      }
    } catch {
    } finally {
      if (isMounted.current) setCheckingExisting(false);
    }
  };

  const fetchLocationStatus = async (shippingId: string, authToken: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/shipping/rider/location`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ riderId: shippingId, action: 'get' }),
        },
      );
      if (response.ok) {
        const data = await response.json();
        const trackingStatus = data.data?.isTrackingOn || false;
        if (isMounted.current) {
          setIsTrackingOn(trackingStatus);
          await saveTrackingStatus(trackingStatus);
        }
      }
    } catch {}
  };

  const toggleOnlineStatusCore = async () => {
    if (!existingRegistration) {
      Toast.show({
        type: 'error',
        text1: 'No Registration',
        text2: 'You need to register first',
      });
      return;
    }
    const isApproved = existingRegistration.status === 'approved';
    const isKYCVerified =
      existingRegistration.kyc?.status === 'verified' ||
      existingRegistration.kyc?.verified === true ||
      existingRegistration.kycVerified === true;
    if (!isApproved || !isKYCVerified) {
      Toast.show({
        type: 'error',
        text1: 'Verification Pending',
        text2: 'You need to be approved and KYC verified to go online',
      });
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      return;
    }
    if (isUpdatingOnlineStatus) return;
    setIsUpdatingOnlineStatus(true);
    try {
      const authToken = await getAuthToken();
      if (!authToken) {
        navigation.navigate('Login');
        return;
      }
      const newStatus = !isOnline;
      setIsOnline(newStatus);
      await saveOnlineStatus(newStatus);
      const response = await fetch(
        `${API_BASE_URL}/api/shipper/online-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ isOnline: newStatus }),
        },
      );
      const responseData = await response.json();
      if (response.ok && responseData.success) {
        const currentTime = new Date().toISOString();
        if (responseData.data) {
          if (isMounted.current) {
            setLastOnlineAt(responseData.data.lastOnlineAt || currentTime);
            setLastOfflineAt(responseData.data.lastOfflineAt || currentTime);
          }
          if (responseData.data.lastOnlineAt)
            await saveLastOnlineTime(responseData.data.lastOnlineAt);
          if (responseData.data.lastOfflineAt)
            await saveLastOfflineTime(responseData.data.lastOfflineAt);
        } else {
          if (newStatus) {
            await saveLastOnlineTime(currentTime);
            if (isMounted.current) setLastOnlineAt(currentTime);
          } else {
            await saveLastOfflineTime(currentTime);
            if (isMounted.current) setLastOfflineAt(currentTime);
          }
        }
        ReactNativeHapticFeedback.trigger(
          newStatus ? 'notificationSuccess' : 'notificationWarning',
          hapticOptions,
        );
        if (newStatus) {
          await goOnlineWithLocation(existingRegistration._id, authToken);
          Toast.show({
            type: 'success',
            text1: 'You are now Online',
            text2: 'Location tracking enabled ✅',
          });
        } else {
          await stopLiveTracking();
          Toast.show({
            type: 'info',
            text1: 'You are now Offline',
            text2: 'Location tracking stopped',
          });
        }
      } else {
        const revertStatus = !newStatus;
        if (isMounted.current) setIsOnline(revertStatus);
        await saveOnlineStatus(revertStatus);
        throw new Error(responseData.message || 'Failed to update status');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.message || 'Failed to update online status',
      });
    } finally {
      if (isMounted.current) setIsUpdatingOnlineStatus(false);
    }
  };

  const toggleOnlineStatus = useDebounce(toggleOnlineStatusCore, 1500);

  const toggleLocationTrackingCore = async () => {
    if (!existingRegistration) {
      Toast.show({
        type: 'error',
        text1: 'No Registration',
        text2: 'You need to register first',
      });
      return;
    }
    if (!isOnline) {
      Toast.show({
        type: 'error',
        text1: 'Go Online First',
        text2: 'You need to be online to enable location tracking',
      });
      return;
    }
    if (isUpdatingTrackingStatus) return;
    setIsUpdatingTrackingStatus(true);
    try {
      const authToken = await getAuthToken();
      if (!authToken) {
        navigation.navigate('Login');
        return;
      }
      if (!isTrackingOn) {
        const success = await startLiveTracking(
          existingRegistration._id,
          authToken,
        );
        if (success && isMounted.current) {
          ReactNativeHapticFeedback.trigger(
            'notificationSuccess',
            hapticOptions,
          );
          Toast.show({
            type: 'success',
            text1: 'Location Tracking ON',
            text2: 'Your location is now being shared',
          });
        } else if (isMounted.current) {
          setIsTrackingOn(false);
          await saveTrackingStatus(false);
          throw new Error('Failed to start location tracking');
        }
      } else {
        const success = await stopLiveTracking();
        if (success && isMounted.current) {
          ReactNativeHapticFeedback.trigger(
            'notificationWarning',
            hapticOptions,
          );
          Toast.show({
            type: 'info',
            text1: 'Location Tracking OFF',
            text2: 'Location sharing stopped',
          });
        } else {
          throw new Error('Failed to stop location tracking');
        }
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.message || 'Failed to update location tracking',
      });
    } finally {
      if (isMounted.current) setIsUpdatingTrackingStatus(false);
    }
  };

  const toggleLocationTracking = useDebounce(toggleLocationTrackingCore, 2000);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const pickImage = async (
    type: 'vehicle' | 'license' | 'identity',
  ): Promise<void> => {
    try {
      ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
      setUploadingImage(type);
      await requestStoragePermission();
      const options: ImageLibraryOptions = {
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
      };
      const result = await launchImageLibrary(options);
      if (result.didCancel) {
        setUploadingImage(null);
        return;
      }
      if (result.errorCode) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: result.errorMessage || 'Failed to select image',
        });
        setUploadingImage(null);
        return;
      }
      if (result.assets && result.assets[0] && result.assets[0].base64) {
        const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        if (type === 'vehicle') setVehicleImage(base64);
        else if (type === 'license') setDrivingLicenseImage(base64);
        else setIdentityImage(base64);
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        Toast.show({
          type: 'success',
          text1: 'Image Selected',
          text2: `${
            type === 'vehicle'
              ? 'Vehicle'
              : type === 'license'
              ? 'Driving License'
              : 'Identity'
          } image uploaded`,
        });
      }
    } catch {
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to select image',
      });
    } finally {
      setUploadingImage(null);
    }
  };

  const validateForm = (): boolean => {
    const checks: [boolean, string][] = [
      [!name.trim(), 'Please enter your name'],
      [!vehicleCategory, 'Please select vehicle category'],
      [!vehicleBrand, 'Please select vehicle brand'],
      [!vehicleModel, 'Please select vehicle model'],
      [!vehicleNumber.trim(), 'Please enter vehicle number'],
      [!vehicleImage, 'Please upload vehicle image'],
      [!drivingLicenseNumber.trim(), 'Please enter driving license number'],
      [!drivingLicenseImage, 'Please upload driving license image'],
      [
        !!identityType && !identityNumber.trim(),
        'Please enter identity number',
      ],
      [
        !!identityNumber && !identityImage,
        'Please upload identity document image',
      ],
      [!agreedToTerms, 'Please agree to terms and conditions'],
    ];
    for (const [invalid, msg] of checks) {
      if (invalid) {
        Toast.show({ type: 'error', text1: 'Required', text2: msg });
        return false;
      }
    }
    return true;
  };

  const submitRegistration = async (formData: any) => {
    const authToken = await getAuthToken();
    if (!authToken)
      throw new Error('Authentication token not found. Please login again.');
    const response = await fetch(`${API_BASE_URL}/api/shipping/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(formData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Registration failed';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      if (response.status === 409)
        throw new Error(
          'You already have a registration. Please contact support to update.',
        );
      if (response.status === 401) {
        await AsyncStorage.removeItem('authToken');
        throw new Error('Session expired. Please login again.');
      }
      throw new Error(errorMessage);
    }
    return await response.json();
  };

  const proceedWithRegistration = async () => {
    const formData = {
      name: name.trim(),
      vehicleCategory,
      vehicleBrand,
      vehicleModel,
      vehicleNumber: vehicleNumber.toUpperCase().replace(/\s/g, ''),
      vehicleImage: vehicleImage ? vehicleImage.split(',')[1] : '',
      maxOrdersPerDay: parseInt(maxOrdersPerDay) || 25,
      kyc: {
        drivingLicenseNumber: drivingLicenseNumber.toUpperCase(),
        drivingLicenseImage: drivingLicenseImage
          ? drivingLicenseImage.split(',')[1]
          : '',
        identityType: identityType || null,
        identityNumber: identityNumber || null,
        identityImage: identityImage ? identityImage.split(',')[1] : null,
      },
      agreedToTerms: true,
      agreedAt: new Date().toISOString(),
    };
    const response = await submitRegistration(formData);
    ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
    Toast.show({
      type: 'success',
      text1: 'Registration Successful',
      text2: 'Your application has been submitted!',
    });
    const shippingId =
      response.shipping?._id ||
      response._id ||
      response.id ||
      response.data?._id ||
      response.data?.id;
    if (!shippingId)
      throw new Error('Registration successful but no ID received from server');
    navigation.navigate('RegistrationSuccess', { shippingId });
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validateForm()) return;
    setLoading(true);
    ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
    try {
      await proceedWithRegistration();
    } catch (error: any) {
      if (error.message.includes('already have a registration')) {
        Alert.alert('Duplicate Registration', error.message, [
          { text: 'OK', style: 'default' },
        ]);
      } else if (
        error.message === 'Session expired. Please login again.' ||
        error.message === 'Authentication token not found. Please login again.'
      ) {
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: 'Please login again to continue',
        });
        setTimeout(() => navigation.navigate('Login'), 1500);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Registration Failed',
          text2: error.message || 'Please try again',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewStatus = () => {
    if (existingRegistration)
      navigation.navigate('RegistrationSuccess', {
        shippingId: existingRegistration._id,
      });
  };

  const handleNewRegistration = () => {
    setExistingRegistration(null);
    setName('');
    setVehicleCategory(null);
    setVehicleBrand(null);
    setVehicleModel(null);
    setVehicleNumber('');
    setMaxOrdersPerDay('25');
    setVehicleImage(null);
    setDrivingLicenseNumber('');
    setDrivingLicenseImage(null);
    setIdentityType(null);
    setIdentityNumber('');
    setIdentityImage(null);
    setAgreedToTerms(false);
    AsyncStorage.multiRemove([
      ONLINE_STATUS_KEY,
      TRACKING_STATUS_KEY,
      LAST_ONLINE_KEY,
      LAST_OFFLINE_KEY,
    ]);
    setIsOnline(false);
    setIsTrackingOn(false);
    setLastOnlineAt(null);
    setLastOfflineAt(null);
  };

  if (checkingExisting) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.checkingText}>
          Checking your registration status...
        </Text>
      </SafeAreaView>
    );
  }

  if (existingRegistration) {
    const isApproved = existingRegistration.status === 'approved';
    const isKYCVerified =
      existingRegistration.kyc?.status === 'verified' ||
      existingRegistration.kyc?.verified === true ||
      existingRegistration.kycVerified === true;
    const showSwiper = isApproved && isKYCVerified;

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusHeader}>
            <View style={styles.statusHeaderIconContainer}>
              <Icon
                name={showSwiper ? 'verified' : 'pending'}
                size={28}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.statusHeaderTextContainer}>
              <Text style={styles.statusHeaderTitle}>
                Delivery Partner Dashboard
              </Text>
              <Text style={styles.statusHeaderSubtitle}>
                {showSwiper
                  ? 'Your account is fully activated'
                  : 'Complete verification to start deliveries'}
              </Text>
            </View>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.profileSection}>
              <Icon name="person" size={24} color="#4F46E5" />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {existingRegistration.name}
                </Text>
                <Text style={styles.profileVehicle}>
                  {existingRegistration.vehicleBrand} •{' '}
                  {existingRegistration.vehicleModel}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  existingRegistration.status === 'approved'
                    ? styles.statusApproved
                    : existingRegistration.status === 'pending'
                    ? styles.statusPending
                    : styles.statusDeclined,
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {existingRegistration.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {existingRegistration.kyc && (
              <View style={styles.kycCard}>
                <View style={styles.kycHeader}>
                  <Icon
                    name={isKYCVerified ? 'verified-user' : 'pending-actions'}
                    size={22}
                    color={isKYCVerified ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={styles.kycTitle}>KYC Status</Text>
                  <View
                    style={[
                      styles.kycStatusBadge,
                      isKYCVerified
                        ? styles.kycStatusVerified
                        : styles.kycStatusPending,
                    ]}
                  >
                    <Text style={styles.kycStatusText}>
                      {isKYCVerified ? 'VERIFIED' : 'PENDING'}
                    </Text>
                  </View>
                </View>
                <View style={styles.kycDetails}>
                  <View style={styles.kycDetailRow}>
                    <Text style={styles.kycDetailLabel}>Driving License:</Text>
                    <Text style={styles.kycDetailValue}>
                      {existingRegistration.kyc.drivingLicenseNumber}
                    </Text>
                  </View>
                  {existingRegistration.kyc.identityType && (
                    <View style={styles.kycDetailRow}>
                      <Text style={styles.kycDetailLabel}>ID Type:</Text>
                      <Text style={styles.kycDetailValue}>
                        {existingRegistration.kyc.identityType}
                      </Text>
                    </View>
                  )}
                  {existingRegistration.kyc.identityNumber && (
                    <View style={styles.kycDetailRow}>
                      <Text style={styles.kycDetailLabel}>ID Number:</Text>
                      <Text style={styles.kycDetailValue}>
                        {existingRegistration.kyc.identityNumber}
                      </Text>
                    </View>
                  )}
                  <View style={styles.kycDetailRow}>
                    <Text style={styles.kycDetailLabel}>
                      Verification Status:
                    </Text>
                    <Text
                      style={[
                        styles.kycDetailValue,
                        isKYCVerified
                          ? styles.kycStatusVerifiedText
                          : styles.kycStatusPendingText,
                      ]}
                    >
                      {isKYCVerified ? 'Verified' : 'Pending Verification'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {!hasLocationPermission && (
              <View style={styles.permissionWarningCard}>
                <Icon name="location-disabled" size={32} color="#EF4444" />
                <Text style={styles.permissionWarningTitle}>
                  Location Permission Required
                </Text>
                <Text style={styles.permissionWarningText}>
                  To track your deliveries and show nearby orders, we need
                  location access.
                </Text>
                <TouchableOpacity
                  style={styles.permissionWarningButton}
                  onPress={handleRequestPermissions}
                  activeOpacity={0.8}
                >
                  <Text style={styles.permissionWarningButtonText}>
                    Grant Location Access
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {showSwiper ? (
              <>
                <View style={styles.swiperCard}>
                  <View style={styles.swiperHeader}>
                    <Icon
                      name={isOnline ? 'wifi' : 'wifi-off'}
                      size={22}
                      color={isOnline ? '#10B981' : '#6B7280'}
                    />
                    <Text style={styles.swiperTitle}>Online Status</Text>
                    <View style={styles.swiperStatus}>
                      <Text
                        style={[
                          styles.swiperStatusText,
                          isOnline
                            ? styles.swiperStatusOnline
                            : styles.swiperStatusOffline,
                        ]}
                      >
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.swiperBody}>
                    <Text style={styles.swiperDescription}>
                      {isOnline
                        ? 'You are currently online and ready to accept orders'
                        : 'You are offline and will not receive new orders'}
                    </Text>
                    <View style={styles.swiperContainer}>
                      <Text style={styles.swiperLabel}>
                        Go {isOnline ? 'Offline' : 'Online'}
                      </Text>
                      <Switch
                        value={isOnline}
                        onValueChange={() => toggleOnlineStatus()}
                        disabled={isUpdatingOnlineStatus}
                        trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                        thumbColor="#FFFFFF"
                        style={styles.swiperSwitch}
                      />
                    </View>
                    {isUpdatingOnlineStatus && (
                      <ActivityIndicator
                        size="small"
                        color="#4F46E5"
                        style={styles.swiperLoading}
                      />
                    )}
                    <View style={styles.lastStatusContainer}>
                      <Icon name="access-time" size={16} color="#6B7280" />
                      <Text style={styles.lastStatusText}>
                        {isOnline
                          ? `Online since: ${formatDate(lastOnlineAt)}`
                          : `Last online: ${formatDate(lastOnlineAt)}`}
                      </Text>
                    </View>
                  </View>
                </View>

                {isOnline && hasLocationPermission && (
                  <View style={styles.swiperCard}>
                    <View style={styles.swiperHeader}>
                      <Icon
                        name={isTrackingOn ? 'location-on' : 'location-off'}
                        size={22}
                        color={isTrackingOn ? '#3B82F6' : '#6B7280'}
                      />
                      <Text style={styles.swiperTitle}>Location Tracking</Text>
                      <View style={styles.swiperStatus}>
                        <Text
                          style={[
                            styles.swiperStatusText,
                            isTrackingOn
                              ? styles.swiperStatusTracking
                              : styles.swiperStatusNotTracking,
                          ]}
                        >
                          {isTrackingOn ? 'ACTIVE' : 'STOPPED'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.swiperBody}>
                      <Text style={styles.swiperDescription}>
                        {isTrackingOn
                          ? 'Your location is being tracked continuously (adaptive battery)'
                          : 'Location tracking is currently turned off'}
                      </Text>
                      <View style={styles.swiperContainer}>
                        <Text style={styles.swiperLabel}>
                          {isTrackingOn ? 'Stop Tracking' : 'Start Tracking'}
                        </Text>
                        <Switch
                          value={isTrackingOn}
                          onValueChange={() => toggleLocationTracking()}
                          disabled={isUpdatingTrackingStatus || !isOnline}
                          trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                          thumbColor="#FFFFFF"
                          style={styles.swiperSwitch}
                        />
                      </View>
                      {isUpdatingTrackingStatus && (
                        <ActivityIndicator
                          size="small"
                          color="#4F46E5"
                          style={styles.swiperLoading}
                        />
                      )}
                      {isTrackingOn && (
                        <View style={styles.lastStatusContainer}>
                          <Icon name="info" size={16} color="#3B82F6" />
                          <Text
                            style={[
                              styles.lastStatusText,
                              { color: '#3B82F6' },
                            ]}
                          >
                            Adaptive intervals based on battery
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {isOnline && !hasLocationPermission && (
                  <View style={styles.swiperCard}>
                    <View style={styles.swiperBody}>
                      <Text
                        style={[
                          styles.swiperDescription,
                          { color: '#EF4444', textAlign: 'center' },
                        ]}
                      >
                        ⚠️ Location permission required to enable tracking
                      </Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.verificationCard}>
                <View style={styles.verificationIconContainer}>
                  <Icon
                    name={isApproved ? 'pending-actions' : 'hourglass-empty'}
                    size={32}
                    color="#F59E0B"
                  />
                </View>
                <Text style={styles.verificationTitle}>
                  {!isApproved
                    ? 'Registration Pending Approval'
                    : 'KYC Verification Pending'}
                </Text>
                <Text style={styles.verificationText}>
                  {!isApproved
                    ? 'Your registration is under review. You will be able to go online once approved.'
                    : 'Your KYC verification is pending. Please complete KYC to start accepting orders.'}
                </Text>
                <View style={styles.verificationStatusContainer}>
                  <View style={styles.verificationStatusRow}>
                    <Icon
                      name={
                        isApproved ? 'check-circle' : 'radio-button-unchecked'
                      }
                      size={20}
                      color={isApproved ? '#10B981' : '#9CA3AF'}
                    />
                    <Text
                      style={[
                        styles.verificationStatusText,
                        isApproved && styles.verificationStatusCompleted,
                      ]}
                    >
                      Registration {isApproved ? 'Approved' : 'Pending'}
                    </Text>
                  </View>
                  <View style={styles.verificationStatusRow}>
                    <Icon
                      name={
                        isKYCVerified
                          ? 'check-circle'
                          : 'radio-button-unchecked'
                      }
                      size={20}
                      color={isKYCVerified ? '#10B981' : '#9CA3AF'}
                    />
                    <Text
                      style={[
                        styles.verificationStatusText,
                        isKYCVerified && styles.verificationStatusCompleted,
                      ]}
                    >
                      KYC {isKYCVerified ? 'Verified' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.viewStatusButton}
              onPress={handleViewStatus}
              activeOpacity={0.8}
            >
              <View style={styles.buttonIconContainer}>
                <Icon name="visibility" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.viewStatusButtonText}>
                View Current Status
              </Text>
              <Icon name="chevron-right" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Icon name="info" size={20} color="#3B82F6" />
                <Text style={styles.infoTitle}>Registration Information</Text>
              </View>
              {[
                {
                  label: 'Registration ID:',
                  value: existingRegistration._id,
                  style: styles.infoValue,
                  extra: { numberOfLines: 1, ellipsizeMode: 'middle' as const },
                },
              ].map(row => (
                <View key={row.label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={row.style} {...row.extra}>
                    {row.value}
                  </Text>
                </View>
              ))}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status:</Text>
                <Text
                  style={[
                    styles.infoValue,
                    existingRegistration.status === 'approved'
                      ? styles.infoValueApproved
                      : existingRegistration.status === 'pending'
                      ? styles.infoValuePending
                      : styles.infoValueDeclined,
                  ]}
                >
                  {existingRegistration.status}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>KYC Status:</Text>
                <Text
                  style={[
                    styles.infoValue,
                    isKYCVerified
                      ? styles.infoValueApproved
                      : styles.infoValuePending,
                  ]}
                >
                  {isKYCVerified ? 'Verified' : 'Pending'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vehicle:</Text>
                <Text style={styles.infoValue}>
                  {existingRegistration.vehicleBrand}{' '}
                  {existingRegistration.vehicleModel}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Online Status:</Text>
                <Text
                  style={[
                    styles.infoValue,
                    isOnline
                      ? styles.infoValueApproved
                      : styles.infoValueDeclined,
                  ]}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Location Tracking:</Text>
                <Text
                  style={[
                    styles.infoValue,
                    isTrackingOn
                      ? styles.infoValueApproved
                      : styles.infoValueDeclined,
                  ]}
                >
                  {isTrackingOn ? 'Active (battery adaptive)' : 'Inactive'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.newRegistrationButton}
              onPress={handleNewRegistration}
              activeOpacity={0.8}
            >
              <Icon name="add-circle-outline" size={20} color="#4F46E5" />
              <Text style={styles.newRegistrationButtonText}>
                Register Another Vehicle
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Registration Form - Keep original UI
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.formContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.header,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerIconContainer}>
                <Icon name="directions-bike" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.title}>Become a Delivery Partner</Text>
                <Text style={styles.subtitle}>
                  Register your vehicle and start earning
                </Text>
              </View>
            </View>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>Registration Form</Text>
              <View style={styles.progressBar}>
                <View style={styles.progressFill} />
              </View>
            </View>
          </Animated.View>

          <View style={styles.checkInfoCard}>
            <Icon name="verified-user" size={20} color="#3b82f6" />
            <View style={styles.checkInfoContent}>
              <Text style={styles.checkInfoTitle}>New Registration</Text>
              <Text style={styles.checkInfoText}>
                Please fill in all the details below to register as a delivery
                partner.
              </Text>
            </View>
          </View>

          {/* Personal Details */}
          <View style={styles.sectionHeader}>
            <Icon
              name="person"
              size={20}
              color="#2563EB"
              style={styles.sectionIcon}
            />
            <Text style={styles.sectionHeaderText}>Personal Details</Text>
          </View>
          <Animated.View
            style={[
              styles.sectionCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <View style={styles.inputWrapper}>
                <Icon
                  name="person-outline"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                  maxLength={100}
                />
              </View>
            </View>
          </Animated.View>

          {/* KYC Documents */}
          <View style={styles.sectionHeader}>
            <Icon
              name="verified-user"
              size={20}
              color="#2563EB"
              style={styles.sectionIcon}
            />
            <Text style={styles.sectionHeaderText}>
              KYC Documents (Required)
            </Text>
          </View>
          <Animated.View
            style={[
              styles.sectionCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Driving License Number *</Text>
              <View style={styles.inputWrapper}>
                <Icon
                  name="credit-card"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter license number"
                  placeholderTextColor="#9CA3AF"
                  value={drivingLicenseNumber}
                  onChangeText={setDrivingLicenseNumber}
                  autoCapitalize="characters"
                  maxLength={20}
                />
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Driving License Image *</Text>
              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  drivingLicenseImage && styles.uploadButtonSuccess,
                ]}
                onPress={() => pickImage('license')}
                disabled={uploadingImage === 'license'}
                activeOpacity={0.8}
              >
                {uploadingImage === 'license' ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Icon
                      name={drivingLicenseImage ? 'check-circle' : 'badge'}
                      size={22}
                      color="white"
                      style={styles.uploadIcon}
                    />
                    <Text style={styles.uploadText}>
                      {drivingLicenseImage
                        ? 'License Uploaded ✓'
                        : 'Upload License Image'}
                    </Text>
                    {!drivingLicenseImage && (
                      <Icon
                        name="chevron-right"
                        size={20}
                        color="white"
                        style={styles.uploadArrow}
                      />
                    )}
                  </>
                )}
              </TouchableOpacity>
              {drivingLicenseImage && (
                <Text style={styles.uploadHint}>
                  ✓ License image uploaded successfully
                </Text>
              )}
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Identity Document Type</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownButton,
                  identityType && styles.dropdownButtonSelected,
                ]}
                onPress={() => setShowIdentityModal(true)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownButtonContent}>
                  <Icon
                    name={identityType ? 'check-circle' : 'fingerprint'}
                    size={20}
                    color={identityType ? '#10B981' : '#4F46E5'}
                  />
                  <Text
                    style={[
                      styles.dropdownButtonText,
                      identityType
                        ? styles.dropdownButtonTextSelected
                        : styles.dropdownButtonTextPlaceholder,
                    ]}
                  >
                    {identityType || 'Select identity type'}
                  </Text>
                  <Icon name="keyboard-arrow-down" size={22} color="#4F46E5" />
                </View>
              </TouchableOpacity>
            </View>
            {identityType && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>{identityType} Number</Text>
                  <View style={styles.inputWrapper}>
                    <Icon
                      name="fingerprint"
                      size={20}
                      color="#6B7280"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={`Enter ${identityType} number`}
                      placeholderTextColor="#9CA3AF"
                      value={identityNumber}
                      onChangeText={setIdentityNumber}
                      maxLength={identityType === 'Aadhaar' ? 12 : 20}
                    />
                  </View>
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    {identityType} Document Image
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.uploadButton,
                      identityImage && styles.uploadButtonSuccess,
                    ]}
                    onPress={() => pickImage('identity')}
                    disabled={uploadingImage === 'identity'}
                    activeOpacity={0.8}
                  >
                    {uploadingImage === 'identity' ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Icon
                          name={identityImage ? 'check-circle' : 'description'}
                          size={22}
                          color="white"
                          style={styles.uploadIcon}
                        />
                        <Text style={styles.uploadText}>
                          {identityImage
                            ? 'Document Uploaded ✓'
                            : `Upload ${identityType}`}
                        </Text>
                        {!identityImage && (
                          <Icon
                            name="chevron-right"
                            size={20}
                            color="white"
                            style={styles.uploadArrow}
                          />
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                  {identityImage && (
                    <Text style={styles.uploadHint}>
                      ✓ {identityType} document uploaded
                    </Text>
                  )}
                </View>
              </>
            )}
          </Animated.View>

          {/* Vehicle Information */}
          <View style={styles.sectionHeader}>
            <Icon
              name="directions-car"
              size={20}
              color="#2563EB"
              style={styles.sectionIcon}
            />
            <Text style={styles.sectionHeaderText}>Vehicle Information</Text>
          </View>
          <Animated.View
            style={[
              styles.sectionCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Vehicle Number *</Text>
              <View style={styles.inputWrapper}>
                <Icon
                  name="confirmation-number"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., MH12AB1234"
                  placeholderTextColor="#9CA3AF"
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  autoCapitalize="characters"
                  maxLength={15}
                />
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Vehicle Category *</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownButton,
                  vehicleCategory && styles.dropdownButtonSelected,
                ]}
                onPress={() => setShowCategoryModal(true)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownButtonContent}>
                  <Icon
                    name={vehicleCategory ? 'check-circle' : 'category'}
                    size={20}
                    color={vehicleCategory ? '#10B981' : '#4F46E5'}
                  />
                  <Text
                    style={[
                      styles.dropdownButtonText,
                      vehicleCategory
                        ? styles.dropdownButtonTextSelected
                        : styles.dropdownButtonTextPlaceholder,
                    ]}
                  >
                    {vehicleCategory || 'Select vehicle type'}
                  </Text>
                  <Icon name="keyboard-arrow-down" size={22} color="#4F46E5" />
                </View>
              </TouchableOpacity>
            </View>
            {vehicleCategory && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Vehicle Brand *</Text>
                <TouchableOpacity
                  style={[
                    styles.dropdownButton,
                    vehicleBrand && styles.dropdownButtonSelected,
                  ]}
                  onPress={() => setShowBrandModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownButtonContent}>
                    <Icon
                      name={vehicleBrand ? 'check-circle' : 'directions-car'}
                      size={20}
                      color={vehicleBrand ? '#10B981' : '#4F46E5'}
                    />
                    <Text
                      style={[
                        styles.dropdownButtonText,
                        vehicleBrand
                          ? styles.dropdownButtonTextSelected
                          : styles.dropdownButtonTextPlaceholder,
                      ]}
                    >
                      {vehicleBrand || 'Select vehicle brand'}
                    </Text>
                    <Icon
                      name="keyboard-arrow-down"
                      size={22}
                      color="#4F46E5"
                    />
                  </View>
                </TouchableOpacity>
              </View>
            )}
            {vehicleBrand && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Vehicle Model *</Text>
                <TouchableOpacity
                  style={[
                    styles.dropdownButton,
                    vehicleModel && styles.dropdownButtonSelected,
                  ]}
                  onPress={() => setShowModelModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownButtonContent}>
                    <Icon
                      name={vehicleModel ? 'check-circle' : 'directions-car'}
                      size={20}
                      color={vehicleModel ? '#10B981' : '#4F46E5'}
                    />
                    <Text
                      style={[
                        styles.dropdownButtonText,
                        vehicleModel
                          ? styles.dropdownButtonTextSelected
                          : styles.dropdownButtonTextPlaceholder,
                      ]}
                    >
                      {vehicleModel || 'Select vehicle model'}
                    </Text>
                    <Icon
                      name="keyboard-arrow-down"
                      size={22}
                      color="#4F46E5"
                    />
                  </View>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Vehicle Image *</Text>
              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  vehicleImage && styles.uploadButtonSuccess,
                ]}
                onPress={() => pickImage('vehicle')}
                disabled={uploadingImage === 'vehicle'}
                activeOpacity={0.8}
              >
                {uploadingImage === 'vehicle' ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Icon
                      name={vehicleImage ? 'check-circle' : 'add-a-photo'}
                      size={22}
                      color="white"
                      style={styles.uploadIcon}
                    />
                    <Text style={styles.uploadText}>
                      {vehicleImage
                        ? 'Image Uploaded ✓'
                        : 'Upload Vehicle Image'}
                    </Text>
                    {!vehicleImage && (
                      <Icon
                        name="chevron-right"
                        size={20}
                        color="white"
                        style={styles.uploadArrow}
                      />
                    )}
                  </>
                )}
              </TouchableOpacity>
              {vehicleImage && (
                <Text style={styles.uploadHint}>
                  ✓ Vehicle image selected successfully
                </Text>
              )}
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Daily Order Capacity</Text>
              <View style={styles.inputWrapper}>
                <Icon
                  name="local-shipping"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Default: 25 orders"
                  placeholderTextColor="#9CA3AF"
                  value={maxOrdersPerDay}
                  onChangeText={text =>
                    setMaxOrdersPerDay(text.replace(/[^0-9]/g, ''))
                  }
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
          </Animated.View>

          {/* Terms and Conditions */}
          <Animated.View
            style={[
              styles.termsCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.termsHeader}>
              <Icon name="gavel" size={24} color="#7C3AED" />
              <Text style={styles.termsTitle}>Terms & Conditions</Text>
            </View>
            <ScrollView
              style={styles.termsScroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View style={styles.termsContent}>
                <Text style={styles.termsSubtitle}>
                  By registering, you agree to:
                </Text>
                {[
                  'Comply with all traffic laws and regulations',
                  'Maintain valid documents and insurance',
                  'Accept delivery assignments responsibly',
                  'Maintain professional conduct with customers',
                  'Allow location tracking when online for deliveries',
                ].map((point, i) => (
                  <View key={i} style={styles.termsPoint}>
                    <Icon name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.termsPointText}>{point}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => {
                ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
                setAgreedToTerms(!agreedToTerms);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  agreedToTerms && styles.checkboxChecked,
                ]}
              >
                {agreedToTerms && <Icon name="check" size={16} color="white" />}
              </View>
              <View style={styles.checkboxTextContainer}>
                <Text style={styles.checkboxText}>
                  I agree to the terms and conditions
                </Text>
                <Text style={styles.checkboxSubtext}>
                  Required to proceed with registration
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {agreedToTerms && (
            <Animated.View
              style={[
                styles.agreementCard,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <Icon name="verified" size={20} color="#059669" />
              <View style={styles.agreementTextContainer}>
                <Text style={styles.agreementTitle}>Terms Accepted</Text>
                <Text style={styles.agreementText}>
                  Agreed on{' '}
                  {new Date().toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  at{' '}
                  {new Date().toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </Animated.View>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!agreedToTerms || loading) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!agreedToTerms || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <View style={styles.buttonIconContainer}>
                  <Icon name="send" size={22} color="white" />
                </View>
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.submitButtonText}>
                    Submit Registration
                  </Text>
                  <Text style={styles.submitButtonSubtext}>
                    Your application will be reviewed within 24 hours
                  </Text>
                </View>
                <Icon
                  name="arrow-forward"
                  size={22}
                  color="white"
                  style={styles.buttonArrow}
                />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.helpCard}>
            <View style={styles.helpIconContainer}>
              <Icon name="support-agent" size={20} color="#7C3AED" />
            </View>
            <View style={styles.helpTextContainer}>
              <Text style={styles.helpTitle}>Need Help?</Text>
              <Text style={styles.helpText}>
                Contact our support team at support@delivery.com
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals - Keep existing modals (same as before) */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.modalBackButton}
              >
                <Icon name="arrow-back" size={24} color="#4F46E5" />
              </TouchableOpacity>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Select Vehicle Category</Text>
                <Text style={styles.modalSubtitle}>
                  Choose your vehicle type
                </Text>
              </View>
            </View>
          </View>
          <FlatList
            data={vehicleCategories}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  vehicleCategory === item.value && styles.selectedModalItem,
                ]}
                onPress={() => {
                  setVehicleCategory(item.value);
                  setShowCategoryModal(false);
                  ReactNativeHapticFeedback.trigger(
                    'impactMedium',
                    hapticOptions,
                  );
                }}
                activeOpacity={0.7}
              >
                <View style={styles.modalItemContent}>
                  <View style={styles.modalIconContainer}>
                    <Icon
                      name={
                        item.value === 'Car'
                          ? 'directions-car'
                          : item.value === 'Bike'
                          ? 'directions-bike'
                          : item.value === 'Scooter'
                          ? 'scooter'
                          : item.value === 'Auto'
                          ? 'local-taxi'
                          : 'local-shipping'
                      }
                      size={20}
                      color={
                        vehicleCategory === item.value ? '#4F46E5' : '#6B7280'
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.modalItemText,
                      vehicleCategory === item.value &&
                        styles.selectedModalItemText,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {vehicleCategory === item.value && (
                    <Icon name="check-circle" size={20} color="#10B981" />
                  )}
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.modalList}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showBrandModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBrandModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <TouchableOpacity
                onPress={() => setShowBrandModal(false)}
                style={styles.modalBackButton}
              >
                <Icon name="arrow-back" size={24} color="#4F46E5" />
              </TouchableOpacity>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Select Vehicle Brand</Text>
                <Text style={styles.modalSubtitle}>
                  {vehicleCategory} brands
                </Text>
              </View>
            </View>
          </View>
          <FlatList
            data={allBrands}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  vehicleBrand === item.value && styles.selectedModalItem,
                ]}
                onPress={() => {
                  setVehicleBrand(item.value);
                  setShowBrandModal(false);
                  ReactNativeHapticFeedback.trigger(
                    'impactMedium',
                    hapticOptions,
                  );
                }}
                activeOpacity={0.7}
              >
                <View style={styles.modalItemContent}>
                  <View style={styles.modalIconContainer}>
                    <Icon
                      name="directions-car"
                      size={20}
                      color={
                        vehicleBrand === item.value ? '#4F46E5' : '#6B7280'
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.modalItemText,
                      vehicleBrand === item.value &&
                        styles.selectedModalItemText,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {vehicleBrand === item.value && (
                    <Icon name="check-circle" size={20} color="#10B981" />
                  )}
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.modalList}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showModelModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModelModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <TouchableOpacity
                onPress={() => setShowModelModal(false)}
                style={styles.modalBackButton}
              >
                <Icon name="arrow-back" size={24} color="#4F46E5" />
              </TouchableOpacity>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Select Vehicle Model</Text>
                <Text style={styles.modalSubtitle}>{vehicleBrand} models</Text>
              </View>
            </View>
          </View>
          <FlatList
            data={allModels}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  vehicleModel === item.value && styles.selectedModalItem,
                ]}
                onPress={() => {
                  setVehicleModel(item.value);
                  setShowModelModal(false);
                  ReactNativeHapticFeedback.trigger(
                    'impactMedium',
                    hapticOptions,
                  );
                }}
                activeOpacity={0.7}
              >
                <View style={styles.modalItemContent}>
                  <View style={styles.modalIconContainer}>
                    <Icon
                      name="directions-car"
                      size={20}
                      color={
                        vehicleModel === item.value ? '#4F46E5' : '#6B7280'
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.modalItemText,
                      vehicleModel === item.value &&
                        styles.selectedModalItemText,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {vehicleModel === item.value && (
                    <Icon name="check-circle" size={20} color="#10B981" />
                  )}
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.modalList}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showIdentityModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowIdentityModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <TouchableOpacity
                onPress={() => setShowIdentityModal(false)}
                style={styles.modalBackButton}
              >
                <Icon name="arrow-back" size={24} color="#4F46E5" />
              </TouchableOpacity>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Select Identity Document</Text>
                <Text style={styles.modalSubtitle}>
                  Choose your identity document type
                </Text>
              </View>
            </View>
          </View>
          <FlatList
            data={identityTypes}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  identityType === item.value && styles.selectedModalItem,
                ]}
                onPress={() => {
                  setIdentityType(item.value);
                  setShowIdentityModal(false);
                  ReactNativeHapticFeedback.trigger(
                    'impactMedium',
                    hapticOptions,
                  );
                }}
                activeOpacity={0.7}
              >
                <View style={styles.modalItemContent}>
                  <View style={styles.modalIconContainer}>
                    <Icon
                      name={
                        item.value === 'Aadhaar'
                          ? 'badge'
                          : item.value === 'VoterID'
                          ? 'how-to-vote'
                          : item.value === 'Passport'
                          ? 'card-travel'
                          : 'credit-card'
                      }
                      size={20}
                      color={
                        identityType === item.value ? '#4F46E5' : '#6B7280'
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.modalItemText,
                      identityType === item.value &&
                        styles.selectedModalItemText,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {identityType === item.value && (
                    <Icon name="check-circle" size={20} color="#10B981" />
                  )}
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.modalList}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20 },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  checkingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  statusHeader: {
    backgroundColor: '#4F46E5',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  statusHeaderIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  statusHeaderTextContainer: { flex: 1 },
  statusHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  statusHeaderSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    fontWeight: '400',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 0,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  profileInfo: { flex: 1, marginLeft: 12 },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  profileVehicle: { fontSize: 14, color: '#6B7280', fontWeight: '400' },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  statusApproved: { backgroundColor: '#10B981' },
  statusPending: { backgroundColor: '#F59E0B' },
  statusDeclined: { backgroundColor: '#EF4444' },
  kycCard: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  kycHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  kycTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 10,
    flex: 1,
  },
  kycStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kycStatusVerified: { backgroundColor: '#D1FAE5' },
  kycStatusPending: { backgroundColor: '#FEF3C7' },
  kycStatusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  kycDetails: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  kycDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  kycDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
    width: 120,
    fontWeight: '500',
  },
  kycDetailValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
  },
  kycStatusVerifiedText: { color: '#10B981' },
  kycStatusPendingText: { color: '#F59E0B' },
  permissionWarningCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  permissionWarningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991B1B',
    marginTop: 12,
    marginBottom: 8,
  },
  permissionWarningText: {
    fontSize: 14,
    color: '#7F1D1D',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  permissionWarningButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  permissionWarningButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationCard: {
    padding: 24,
    margin: 20,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
  },
  verificationIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
    textAlign: 'center',
    marginBottom: 8,
  },
  verificationText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  verificationStatusContainer: { width: '100%', marginTop: 8 },
  verificationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  verificationStatusText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 10,
    fontWeight: '500',
  },
  verificationStatusCompleted: { color: '#065F46' },
  swiperCard: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  swiperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  swiperTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 10,
    flex: 1,
  },
  swiperStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  swiperStatusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  swiperStatusOnline: { color: '#10B981' },
  swiperStatusOffline: { color: '#6B7280' },
  swiperStatusTracking: { color: '#3B82F6' },
  swiperStatusNotTracking: { color: '#6B7280' },
  swiperBody: { marginTop: 4 },
  swiperDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  swiperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  swiperLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  swiperSwitch: {
    transform: Platform.OS === 'ios' ? [{ scaleX: 0.9 }, { scaleY: 0.9 }] : [],
  },
  swiperLoading: { marginTop: 8 },
  lastStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  lastStatusText: { fontSize: 12, color: '#6B7280', marginLeft: 6 },
  viewStatusButton: {
    backgroundColor: '#4F46E5',
    margin: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewStatusButtonText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 12,
  },
  infoCard: {
    padding: 20,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoLabel: { fontSize: 14, color: '#6B7280', width: 120, fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#374151', fontWeight: '600', flex: 1 },
  infoValueApproved: { color: '#10B981' },
  infoValuePending: { color: '#F59E0B' },
  infoValueDeclined: { color: '#EF4444' },
  newRegistrationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4F46E5',
    backgroundColor: '#FFFFFF',
  },
  newRegistrationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    marginLeft: 10,
  },
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerTextContainer: { flex: 1 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '400',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginLeft: 12,
    overflow: 'hidden',
  },
  progressFill: {
    width: '40%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  formContainer: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionIcon: {
    marginRight: 10,
    backgroundColor: '#EDE9FE',
    padding: 6,
    borderRadius: 8,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  checkInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  checkInfoContent: { flex: 1, marginLeft: 12 },
  checkInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 4,
  },
  checkInfoText: { fontSize: 12, color: '#0c4a6e', lineHeight: 16 },
  inputContainer: { marginBottom: 20 },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  inputWrapper: { position: 'relative' },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: '50%',
    marginTop: -10,
    zIndex: 1,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingLeft: 48,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    height: 48,
  },
  dropdownButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    justifyContent: 'center',
  },
  dropdownButtonSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#F0F9FF',
  },
  dropdownButtonContent: { flexDirection: 'row', alignItems: 'center' },
  dropdownButtonText: {
    flex: 1,
    fontSize: 15,
    marginLeft: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  dropdownButtonTextSelected: { color: '#111827', fontWeight: '500' },
  dropdownButtonTextPlaceholder: { color: '#9CA3AF', fontWeight: '400' },
  uploadButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  uploadButtonSuccess: { backgroundColor: '#10B981', borderColor: '#10B981' },
  uploadIcon: { marginRight: 12 },
  uploadArrow: { opacity: 0.8 },
  uploadText: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'left',
  },
  uploadHint: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 6,
    fontWeight: '500',
    marginLeft: 4,
  },
  termsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  termsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  termsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 12,
  },
  termsScroll: { maxHeight: 160, marginBottom: 20 },
  termsContent: { paddingRight: 8 },
  termsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 12,
  },
  termsPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  termsPointText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginLeft: 10,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  checkboxTextContainer: { flex: 1 },
  checkboxText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 22,
    marginBottom: 2,
  },
  checkboxSubtext: { fontSize: 12, color: '#6B7280', fontWeight: '400' },
  agreementCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
  },
  agreementTextContainer: { flex: 1, marginLeft: 12 },
  agreementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 2,
  },
  agreementText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '500',
    lineHeight: 16,
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 18,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#A5B4FC',
    borderColor: '#A5B4FC',
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  buttonTextContainer: { flex: 1 },
  submitButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  submitButtonSubtext: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
  },
  buttonArrow: { opacity: 0.9 },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EDE9FE',
    marginBottom: 20,
  },
  helpIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  helpTextContainer: { flex: 1 },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  helpText: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  modalSafeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalBackButton: { padding: 4, marginRight: 12 },
  modalTitleContainer: { flex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  modalList: { paddingBottom: 16 },
  modalItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedModalItem: { backgroundColor: '#F0F9FF' },
  modalItemContent: { flexDirection: 'row', alignItems: 'center' },
  modalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalItemText: { flex: 1, fontSize: 16, color: '#1F2937', fontWeight: '500' },
  selectedModalItemText: { color: '#4F46E5', fontWeight: '600' },
});

export default RiderRegistrationScreen;
