// utils/location/LocationService.ts

import { Platform, AppState, AppStateStatus } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  Permission,
} from 'react-native-permissions';
import Geolocation from 'react-native-get-location';
import BackgroundActions from 'react-native-background-actions';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// 📋 TYPES
// ============================================================

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  altitude: number;
  provider: string;
  timestamp: number;
  isFresh: boolean;
  isCached: boolean;
  cacheAge?: number;
}

export interface LocationWithMetadata extends LocationData {
  batteryLevel: number;
  networkType: string;
}

export type LocationSubscriber = (location: LocationWithMetadata) => void;

// ============================================================
// 📋 CONFIGURATION
// ============================================================

const LOCATION_CONFIG = {
  enableHighAccuracy: true,
  timeout: 15000,
  maxAge: 0,
};

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

const CACHE_CONFIG = {
  maxAgeMs: 30000,
  staleAgeMs: 60000,
};

const TRACKING_CONFIG = {
  intervalMs: 5000,
  maxConsecutiveErrors: 3,
  errorBackoffMs: 5000,
};

const API_BASE_URL = 'http://10.194.138.121:5000';

const backgroundOptions = {
  taskName: 'DriverLocationTracking',
  taskTitle: 'Tracking Location',
  taskDesc: 'Driver location tracking is active in background',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#4A90E2',
  linkingURI: 'tizzyos://driver/location',
  parameters: {
    delay: TRACKING_CONFIG.intervalMs,
  },
};

// ============================================================
// 📊 STATE MANAGEMENT
// ============================================================

let subscribers: Map<string, LocationSubscriber> = new Map();
let subscriberIdCounter = 0;

let lastLocationData: LocationData | null = null;
let lastLocationTime: number = 0;

// ✅ Single in-flight promise for location requests
let locationRequestPromise: Promise<LocationData | null> | null = null;

// ✅ GPS provider state (device location ON/OFF)
let isGpsProviderAvailable: boolean = true;
let gpsCheckInProgress: boolean = false;

// ✅ TRACKING STATE
let activeShippingId: string | null = null;
let activeAuthToken: string | null = null;
let isTrackingActive = false;

// ✅ State Machine - Using string union type instead of enum
type TrackingState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING';
let currentState: TrackingState = 'STOPPED';

// ============================================================
// 🔄 BACKGROUND TASK - Module Level
// ============================================================

export function locationTask(taskData: any) {
  console.log('==================================================');
  console.log('🔵 [BACKGROUND] ════════════════════════════════════');
  console.log('🔵 [BACKGROUND] 🚀 TASK STARTED');
  console.log(`🔵 [BACKGROUND] 📅 Time: ${new Date().toISOString()}`);
  console.log(
    `🔵 [BACKGROUND] ⏱️ Delay: ${taskData?.delay || TRACKING_CONFIG.intervalMs}ms`,
  );
  console.log('🔵 [BACKGROUND] ════════════════════════════════════');
  console.log('==================================================');

  return new Promise<void>(resolve => {
    const { delay } = taskData;
    let consecutiveErrors = 0;
    let locationCount = 0;

    const runTask = async () => {
      try {
        while (await BackgroundActions.isRunning()) {
          try {
            // Check if GPS provider is available
            if (!isGpsProviderAvailable) {
              console.log(
                '🔵 [BACKGROUND] 📡 GPS provider unavailable, checking...',
              );
              await checkGpsProvider();
              await new Promise<void>(res => setTimeout(res, 5000));
              continue;
            }

            // Check if a request is already in progress
            if (locationRequestPromise) {
              console.log(
                '🔵 [BACKGROUND] ⏳ Location request in progress, waiting...',
              );
              const location = await locationRequestPromise;
              if (location) {
                consecutiveErrors = 0;
                console.log(
                  `🔵 [BACKGROUND] ✅ Location #${++locationCount} obtained from in-flight request:`,
                  {
                    lat: location.latitude,
                    lng: location.longitude,
                  },
                );
                await handleLocationAcquired(location);
              }
              await new Promise<void>(res =>
                setTimeout(res, delay || TRACKING_CONFIG.intervalMs),
              );
              continue;
            }

            console.log(
              `🔵 [BACKGROUND] 📍 Fetching location #${++locationCount}...`,
            );
            const result = await getFreshLocationWithRetry();

            if (result) {
              consecutiveErrors = 0;
              console.log(
                `🔵 [BACKGROUND] ✅ Location #${locationCount} obtained:`,
                {
                  lat: result.latitude,
                  lng: result.longitude,
                  acc: result.accuracy,
                },
              );
              await handleLocationAcquired(result);
            } else {
              consecutiveErrors++;
              console.log(
                `🔵 [BACKGROUND] ❌ Location fetch failed (${consecutiveErrors}/${TRACKING_CONFIG.maxConsecutiveErrors})`,
              );

              if (consecutiveErrors >= TRACKING_CONFIG.maxConsecutiveErrors) {
                console.log(
                  '🔵 [BACKGROUND] 🔄 Too many errors, marking GPS provider unavailable',
                );
                isGpsProviderAvailable = false;
                consecutiveErrors = 0;
                await new Promise<void>(res =>
                  setTimeout(res, TRACKING_CONFIG.errorBackoffMs),
                );
              }
            }

            await new Promise<void>(res =>
              setTimeout(res, delay || TRACKING_CONFIG.intervalMs),
            );
          } catch (error) {
            console.error('🔵 [BACKGROUND] ❌ Error in poll loop:', error);
            await new Promise<void>(res =>
              setTimeout(res, TRACKING_CONFIG.errorBackoffMs),
            );
          }
        }
      } catch (error) {
        console.error('🔵 [BACKGROUND] 💀 Fatal error:', error);
      } finally {
        console.log('==================================================');
        console.log('🔵 [BACKGROUND] 🛑 TASK FINISHED');
        console.log(
          `🔵 [BACKGROUND] 📊 Total locations sent: ${locationCount}`,
        );
        console.log('🔵 [BACKGROUND] ════════════════════════════════════');
        console.log('==================================================');
        resolve();
      }
    };

    runTask();
  });
}

// ============================================================
// 📍 GPS PROVIDER CHECK
// ============================================================

const checkGpsProvider = async (): Promise<boolean> => {
  if (gpsCheckInProgress) {
    return isGpsProviderAvailable;
  }

  gpsCheckInProgress = true;

  try {
    const location = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 3000,
    });

    if (location) {
      if (!isGpsProviderAvailable) {
        console.log('📡 [GPS] ✅ GPS provider became available');
        isGpsProviderAvailable = true;
      }
      return true;
    }
    return isGpsProviderAvailable;
  } catch (error) {
    if (isGpsProviderAvailable) {
      console.log('📡 [GPS] ❌ GPS provider became unavailable');
      isGpsProviderAvailable = false;
    }
    return false;
  } finally {
    gpsCheckInProgress = false;
  }
};

// ============================================================
// 📍 LOCATION HELPERS
// ============================================================

const getLocationMetadata = async (
  location: LocationData,
): Promise<LocationWithMetadata> => {
  const [batteryLevel, networkType] = await Promise.all([
    getBatteryLevel(),
    getNetworkType(),
  ]);

  return {
    ...location,
    batteryLevel,
    networkType,
  };
};

const getFreshLocationWithRetry = async (): Promise<LocationData | null> => {
  if (locationRequestPromise) {
    console.log('📍 [LOCATION] ⏳ Using in-flight promise');
    return await locationRequestPromise;
  }

  locationRequestPromise = getFreshLocationWithBackoff();

  try {
    const result = await locationRequestPromise;
    return result;
  } finally {
    locationRequestPromise = null;
    console.log('📍 [LOCATION] 🔓 In-flight promise cleared');
  }
};

const getFreshLocationWithBackoff = async (): Promise<LocationData | null> => {
  let attempt = 0;
  let delay = RETRY_CONFIG.baseDelayMs;

  while (attempt < RETRY_CONFIG.maxAttempts) {
    attempt++;
    console.log(
      `📍 [LOCATION] 🔄 Attempt ${attempt}/${RETRY_CONFIG.maxAttempts}`,
    );

    try {
      console.log(
        '📍 [LOCATION] 📡 Calling Geolocation.getCurrentPosition()...',
      );
      const location = await Geolocation.getCurrentPosition(LOCATION_CONFIG);

      if (!isGpsProviderAvailable) {
        isGpsProviderAvailable = true;
        console.log('📍 [LOCATION] ✅ GPS provider became available');
      }

      console.log('📍 [LOCATION] ✅ Location received:', {
        lat: location.latitude,
        lng: location.longitude,
        acc: location.accuracy,
        speed: location.speed,
      });

      const locationData: LocationData = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0,
        speed: location.speed || 0,
        heading: 0,
        altitude: 0,
        provider: 'gps',
        timestamp: Date.now(),
        isFresh: true,
        isCached: false,
      };

      lastLocationData = locationData;
      lastLocationTime = Date.now();
      console.log('📍 [LOCATION] 💾 Location cached (fresh)');

      return locationData;
    } catch (error: any) {
      console.error(
        `📍 [LOCATION] ❌ Attempt ${attempt} failed:`,
        error?.message || error,
      );

      if (error.message?.includes('timeout') || error.code === 'TIMEOUT') {
        console.log(
          '📍 [LOCATION] ⏰ Location timeout - GPS may be unavailable',
        );
        if (attempt >= RETRY_CONFIG.maxAttempts) {
          isGpsProviderAvailable = false;
          console.log('📍 [LOCATION] 📡 Marking GPS provider unavailable');
        }
      }

      if (error.code === 'CANCELLED') {
        console.log('📍 [LOCATION] ⏹️ Request cancelled');
        return null;
      }

      if (attempt < RETRY_CONFIG.maxAttempts) {
        console.log(`📍 [LOCATION] ⏳ Waiting ${delay}ms before retry...`);
        await new Promise<void>(res => setTimeout(res, delay));
        delay = Math.min(
          delay * RETRY_CONFIG.backoffMultiplier,
          RETRY_CONFIG.maxDelayMs,
        );
      }
    }
  }

  console.log('📍 [LOCATION] ❌ All attempts failed');
  return null;
};

const getLastKnownLocation = (): LocationData | null => {
  if (!lastLocationData) return null;

  const age = (Date.now() - lastLocationTime) / 1000;

  if (age < CACHE_CONFIG.maxAgeMs / 1000) {
    return {
      ...lastLocationData,
      isFresh: false,
      isCached: true,
      cacheAge: age,
    };
  }

  console.log(`📍 [CACHE] ❌ Cache expired (${age}s old)`);
  return null;
};

// ============================================================
// 🌐 API HELPERS
// ============================================================

const getAuthToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    console.log(`🔑 [AUTH] Token present: ${!!token}`);
    return token;
  } catch (error) {
    console.error('🔑 [AUTH] Error getting token:', error);
    return null;
  }
};

const handleLocationAcquired = async (
  location: LocationData,
): Promise<void> => {
  // 1. Notify UI subscribers
  const metadata = await getLocationMetadata(location);
  notifySubscribers(metadata);

  // 2. Upload to backend (LocationService owns this)
  await uploadLocationToBackend(location);
};

const uploadLocationToBackend = async (
  location: LocationData,
): Promise<void> => {
  const shippingId = activeShippingId;
  const authToken = activeAuthToken;

  if (!shippingId) {
    console.error('📍 [LOCATION_API] ❌ No shipping ID available for upload');
    return;
  }

  if (!authToken) {
    console.error('📍 [LOCATION_API] ❌ No auth token available for upload');
    return;
  }

  // Get fresh token if needed
  const token = await getAuthToken();
  if (!token) {
    console.error('📍 [LOCATION_API] ❌ Failed to get auth token');
    return;
  }

  const [batteryLevel, networkType] = await Promise.all([
    getBatteryLevel(),
    getNetworkType(),
  ]);

  console.log('📍 [LOCATION_API] 🚀 Sending location');
  console.log(`📍 [LOCATION_API] shippingId: ${shippingId}`);
  console.log(`📍 [LOCATION_API] lat: ${location.latitude}`);
  console.log(`📍 [LOCATION_API] lng: ${location.longitude}`);
  console.log(`📍 [LOCATION_API] accuracy: ${location.accuracy}`);
  console.log(`📍 [LOCATION_API] battery: ${batteryLevel}%`);

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v0/track/rider/location`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shippingId: shippingId,
          action: 'update',
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading || 0,
          altitude: location.altitude || 0,
          provider: location.provider || 'gps',
          batteryLevel,
          networkType,
          timestamp: location.timestamp,
        }),
      },
    );

    if (response.ok) {
      console.log('📍 [LOCATION_API] ✅ Location uploaded successfully');
    } else {
      console.log(`📍 [LOCATION_API] ❌ Upload failed: ${response.status}`);
      const text = await response.text();
      console.log(`📍 [LOCATION_API] Error: ${text}`);
    }
  } catch (error) {
    console.error('📍 [LOCATION_API] ❌ Upload error:', error);
  }
};

// ============================================================
// 🔋 BATTERY & NETWORK HELPERS
// ============================================================

const getBatteryLevel = async (): Promise<number> => {
  try {
    const level = await DeviceInfo.getBatteryLevel();
    return Math.round(level * 100);
  } catch {
    return 75;
  }
};

const getNetworkType = async (): Promise<string> => {
  try {
    return (await DeviceInfo.getCarrier()) || 'unknown';
  } catch {
    return 'unknown';
  }
};

// ============================================================
// 📢 SUBSCRIBER HELPERS
// ============================================================

const notifySubscribers = (location: LocationWithMetadata) => {
  console.log(`📢 [SUBSCRIBERS] Notifying ${subscribers.size} subscribers`);
  subscribers.forEach((callback, id) => {
    try {
      callback(location);
    } catch (error) {
      console.error(`📢 [SUBSCRIBERS] Error in subscriber ${id}:`, error);
    }
  });
};

// ============================================================
// 🔔 PERMISSION HELPERS
// ============================================================

const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const sdkVersion = Platform.Version as number;
  if (sdkVersion < 33) return true;

  try {
    const permission = 'android.permission.POST_NOTIFICATIONS' as Permission;
    const status = await check(permission);
    if (status === RESULTS.GRANTED) return true;

    const result = await request(permission);
    return result === RESULTS.GRANTED;
  } catch {
    return false;
  }
};

// ============================================================
// 🎯 MAIN SERVICE CLASS
// ============================================================

class LocationService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private appState: AppStateStatus = AppState.currentState || 'active';
  private isBackgroundRunning = false;
  private isForeground = false;
  private isTransitioning = false;

  constructor() {
    console.log('==================================================');
    console.log('🟢 [SERVICE] ════════════════════════════════════');
    console.log('🟢 [SERVICE] 🏗️ CONSTRUCTOR');
    console.log(`🟢 [SERVICE] 📱 Platform: ${Platform.OS}`);
    console.log(`🟢 [SERVICE] 📱 App State: ${this.appState}`);
    console.log(`🟢 [SERVICE] 📱 Version: ${Platform.Version}`);
    console.log('🟢 [SERVICE] ════════════════════════════════════');
    console.log('==================================================');

    AppState.addEventListener('change', this.handleAppStateChange);
  }

  // ============================================================
  // 📞 SUBSCRIBER API
  // ============================================================

  subscribeToLocation(callback: LocationSubscriber): () => void {
    const id = `sub_${++subscriberIdCounter}`;
    subscribers.set(id, callback);
    console.log(
      `📢 [SUBSCRIBER] ✅ Registered subscriber: ${id} (total: ${subscribers.size})`,
    );

    const cached = getLastKnownLocation();
    if (cached) {
      console.log(`📢 [SUBSCRIBER] 📤 Sending last known location to ${id}`);
      this.getBatteryAndNetwork().then(({ batteryLevel, networkType }) => {
        callback({
          ...cached,
          batteryLevel,
          networkType,
        });
      });
    }

    return () => {
      subscribers.delete(id);
      console.log(
        `📢 [SUBSCRIBER] ❌ Unregistered subscriber: ${id} (remaining: ${subscribers.size})`,
      );
    };
  }

  getLastLocation(): LocationWithMetadata | null {
    const cached = getLastKnownLocation();
    if (!cached) return null;

    return {
      ...cached,
      batteryLevel: 75,
      networkType: 'unknown',
    };
  }

  // ============================================================
  // 🔋 GET BATTERY & NETWORK
  // ============================================================

  async getBatteryAndNetwork(): Promise<{
    batteryLevel: number;
    networkType: string;
  }> {
    const [batteryLevel, networkType] = await Promise.all([
      getBatteryLevel(),
      getNetworkType(),
    ]);
    return { batteryLevel, networkType };
  }

  // ============================================================
  // 📱 APP STATE HANDLER
  // ============================================================

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    console.log('==================================================');
    console.log(
      `📱 [APP_STATE] 🔄 CHANGED: ${this.appState} → ${nextAppState}`,
    );
    console.log(`📱 [APP_STATE] isTracking: ${isTrackingActive}`);
    console.log(`📱 [APP_STATE] isForeground: ${this.isForeground}`);
    console.log(
      `📱 [APP_STATE] isBackgroundRunning: ${this.isBackgroundRunning}`,
    );
    console.log(`📱 [APP_STATE] isTransitioning: ${this.isTransitioning}`);
    console.log('==================================================');

    if (this.isTransitioning) {
      console.log('📱 [APP_STATE] ⏳ Already transitioning, ignoring...');
      return;
    }

    this.isTransitioning = true;

    try {
      this.appState = nextAppState;

      if (nextAppState === 'background' && isTrackingActive) {
        console.log(
          '📱 [APP_STATE] 🔵 App → BACKGROUND, starting background tracking...',
        );
        await this.startBackgroundTracking();
      } else if (nextAppState === 'active' && isTrackingActive) {
        console.log(
          '📱 [APP_STATE] 🟢 App → FOREGROUND, starting foreground tracking...',
        );
        await this.startForegroundTracking();
      } else {
        console.log(
          `📱 [APP_STATE] ⏸️ No action needed (tracking: ${isTrackingActive})`,
        );
      }
    } catch (error) {
      console.error('📱 [APP_STATE] ❌ Error during transition:', error);
    } finally {
      this.isTransitioning = false;
      console.log('📱 [APP_STATE] ✅ Transition complete');
    }
  };

  // ============================================================
  // 🔐 PERMISSIONS
  // ============================================================

  async requestPermissions(): Promise<boolean> {
    console.log('==================================================');
    console.log('🔐 [PERMISSIONS] ════════════════════════════════════');
    console.log('🔐 [PERMISSIONS] 📋 Requesting all permissions...');
    console.log(`🔐 [PERMISSIONS] 📱 Android Version: ${Platform.Version}`);
    console.log('==================================================');

    if (Platform.OS !== 'android') {
      console.log('🔐 [PERMISSIONS] ✅ Not Android, skipping');
      return true;
    }

    try {
      const permissions: Permission[] = [
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ];

      if (Platform.Version >= 29) {
        console.log(
          `🔐 [PERMISSIONS] 📱 Android ${Platform.Version} >= 29, adding BACKGROUND_LOCATION`,
        );
        permissions.push(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
      }

      const statuses = await Promise.all(permissions.map(p => check(p)));
      const allGranted = statuses.every(s => s === RESULTS.GRANTED);

      if (allGranted) {
        console.log('🔐 [PERMISSIONS] ✅ All permissions already granted');
        await requestNotificationPermission();
        return true;
      }

      console.log(
        `🔐 [PERMISSIONS] 📋 Requesting ${permissions.length} permissions...`,
      );
      const results = await Promise.all(
        permissions.map(permission => request(permission)),
      );

      const locationGranted = results.every(
        status => status === RESULTS.GRANTED,
      );

      if (!locationGranted) {
        console.warn(
          '🔐 [PERMISSIONS] ❌ Location permissions not fully granted',
        );
        results.forEach((status, index) => {
          console.log(`🔐 [PERMISSIONS] ${permissions[index]} = ${status}`);
        });
        return false;
      }

      console.log('🔐 [PERMISSIONS] ✅ Location permissions granted');
      await requestNotificationPermission();
      console.log('🔐 [PERMISSIONS] ✅ All permissions granted');
      return true;
    } catch (error) {
      console.error('🔐 [PERMISSIONS] ❌ Error:', error);
      return false;
    }
  }

  // ============================================================
  // ▶️ START TRACKING - MAIN PUBLIC API
  // ============================================================

  async startTracking(shippingId: string): Promise<boolean> {
    console.log('==================================================');
    console.log(`🟢 [SERVICE] ════════════════════════════════════`);
    console.log(`🟢 [SERVICE] ▶️ START TRACKING`);
    console.log(`🟢 [SERVICE] 📦 shippingId: ${shippingId}`);
    console.log(`🟢 [SERVICE] 📱 Current App State: ${AppState.currentState}`);
    console.log(`🟢 [SERVICE] 📊 Current State: ${currentState}`);
    console.log(`🟢 [SERVICE] 📊 isTracking: ${isTrackingActive}`);
    console.log('==================================================');

    // ✅ Validate shippingId
    if (!shippingId || shippingId.trim() === '') {
      console.error('🟢 [SERVICE] ❌ Invalid shippingId provided');
      return false;
    }

    // ✅ State Machine: Already RUNNING
    if (currentState === 'RUNNING') {
      console.log('🟢 [SERVICE] ⏳ Already tracking, returning success');
      return true;
    }

    // ✅ State Machine: Already STARTING - wait for it to complete
    if (currentState === 'STARTING') {
      console.log('🟢 [SERVICE] ⏳ Already starting, waiting...');
      let waitCount = 0;
      while (currentState === 'STARTING' && waitCount < 30) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      // After waiting, check if we're now RUNNING
      // Using type assertion to avoid TypeScript narrowing issue
      if ((currentState as TrackingState) === 'RUNNING') {
        return true;
      }
      console.log("🟢 [SERVICE] ⚠️ Start didn't complete, proceeding...");
    }

    // ✅ State Machine: STARTING
    currentState = 'STARTING';

    try {
      // ✅ Store shipping ID and get auth token
      activeShippingId = shippingId;
      console.log(`🟢 [SERVICE] ✅ shippingId stored: ${activeShippingId}`);

      const token = await getAuthToken();
      if (!token) {
        console.error('🟢 [SERVICE] ❌ Failed to get auth token');
        currentState = 'STOPPED';
        activeShippingId = null;
        return false;
      }
      activeAuthToken = token;
      console.log('🟢 [SERVICE] ✅ Auth token stored');

      // ✅ Check permissions
      console.log('🟢 [SERVICE] 🔐 Checking permissions...');
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.log('🟢 [SERVICE] ❌ Permissions denied');
        currentState = 'STOPPED';
        activeShippingId = null;
        activeAuthToken = null;
        return false;
      }

      // ✅ Check GPS
      await checkGpsProvider();
      if (!isGpsProviderAvailable) {
        console.log('🟢 [SERVICE] ⚠️ GPS provider unavailable, but will retry');
      }

      // ✅ Set tracking active
      isTrackingActive = true;

      // ✅ Start appropriate tracking
      let result = false;
      if (AppState.currentState === 'background') {
        console.log(
          '🟢 [SERVICE] 🔵 App is in BACKGROUND, starting background tracking...',
        );
        result = await this.startBackgroundTracking();
      } else {
        console.log(
          '🟢 [SERVICE] 🟢 App is in FOREGROUND, starting foreground tracking...',
        );
        result = await this.startForegroundTracking();
      }

      if (result) {
        currentState = 'RUNNING';
        console.log('🟢 [SERVICE] ✅ Tracking started successfully');
      } else {
        currentState = 'STOPPED';
        isTrackingActive = false;
        activeShippingId = null;
        activeAuthToken = null;
        console.log('🟢 [SERVICE] ❌ Tracking start failed');
      }

      return result;
    } catch (error) {
      console.error('🟢 [SERVICE] ❌ Start tracking failed:', error);
      currentState = 'STOPPED';
      isTrackingActive = false;
      activeShippingId = null;
      activeAuthToken = null;
      return false;
    }
  }

  // ============================================================
  // 🟢 FOREGROUND TRACKING
  // ============================================================

  private async startForegroundTracking(): Promise<boolean> {
    console.log('==================================================');
    console.log('🟢 [FOREGROUND] ════════════════════════════════════');
    console.log('🟢 [FOREGROUND] 🚀 STARTING FOREGROUND TRACKING');
    console.log(`🟢 [FOREGROUND] 📅 Time: ${new Date().toISOString()}`);
    console.log(
      `🟢 [FOREGROUND] isBackgroundRunning: ${this.isBackgroundRunning}`,
    );
    console.log(
      `🟢 [FOREGROUND] intervalId: ${this.intervalId ? 'EXISTS' : 'NULL'}`,
    );
    console.log('==================================================');

    // Stop background if running
    if (this.isBackgroundRunning) {
      console.log('🟢 [FOREGROUND] 🔄 Background running, stopping it...');
      await this.stopBackgroundTracking();
    }

    // Clear existing interval
    if (this.intervalId) {
      console.log('🟢 [FOREGROUND] 🧹 Clearing existing interval...');
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🟢 [FOREGROUND] ✅ Interval cleared');
    }

    this.isForeground = true;
    console.log('🟢 [FOREGROUND] ✅ isForeground set to true');

    // Get initial location
    console.log('🟢 [FOREGROUND] 📍 Getting initial location...');
    const location = await getFreshLocationWithRetry();
    if (location) {
      console.log('🟢 [FOREGROUND] 📤 Sending initial location...');
      await handleLocationAcquired(location);
      console.log('🟢 [FOREGROUND] ✅ Initial location sent');
    } else {
      console.log('🟢 [FOREGROUND] ❌ No initial location available');
    }

    // Start interval
    console.log(
      `🟢 [FOREGROUND] ⏰ Setting interval to ${TRACKING_CONFIG.intervalMs}ms...`,
    );
    this.intervalId = setInterval(() => {
      void (async () => {
        if (!isTrackingActive || !this.isForeground) {
          console.log(
            `🟢 [FOREGROUND] ⏸️ Skipping interval (tracking: ${isTrackingActive}, foreground: ${this.isForeground})`,
          );
          return;
        }

        // Check GPS provider - but don't block if check fails
        if (!isGpsProviderAvailable) {
          console.log(
            '🟢 [FOREGROUND] 📡 GPS provider unavailable, checking...',
          );
          await checkGpsProvider();
          if (!isGpsProviderAvailable) {
            console.log(
              '🟢 [FOREGROUND] ⏸️ GPS provider still unavailable, skipping',
            );
            return;
          }
          console.log('🟢 [FOREGROUND] ✅ GPS provider available, continuing');
        }

        console.log('🟢 [FOREGROUND] 📍 Interval: Getting location...');
        const newLocation = await getFreshLocationWithRetry();
        if (newLocation) {
          console.log('🟢 [FOREGROUND] 📤 Sending location...');
          await handleLocationAcquired(newLocation);
          console.log('🟢 [FOREGROUND] ✅ Location sent successfully');
        } else {
          console.log('🟢 [FOREGROUND] ❌ No location available');
          if (isGpsProviderAvailable) {
            console.log(
              '🟢 [FOREGROUND] 📡 GPS provider may be unavailable, checking...',
            );
            await checkGpsProvider();
          }
        }
      })();
    }, TRACKING_CONFIG.intervalMs);

    console.log('🟢 [FOREGROUND] ✅ Foreground tracking started successfully');
    console.log(
      `🟢 [FOREGROUND] 📊 intervalId: ${this.intervalId ? 'SET' : 'NULL'}`,
    );
    console.log('🟢 [FOREGROUND] ════════════════════════════════════');
    console.log('==================================================');
    return true;
  }

  // ============================================================
  // 🔵 BACKGROUND TRACKING
  // ============================================================

  private async startBackgroundTracking(): Promise<boolean> {
    console.log('==================================================');
    console.log('🔵 [BACKGROUND] ════════════════════════════════════');
    console.log('🔵 [BACKGROUND] 🚀 STARTING BACKGROUND TRACKING');
    console.log(`🔵 [BACKGROUND] 📅 Time: ${new Date().toISOString()}`);
    console.log(`🔵 [BACKGROUND] isForeground: ${this.isForeground}`);
    console.log(
      `🔵 [BACKGROUND] intervalId: ${this.intervalId ? 'EXISTS' : 'NULL'}`,
    );
    console.log('==================================================');

    // Clear foreground interval
    if (this.intervalId) {
      console.log('🔵 [BACKGROUND] 🧹 Clearing foreground interval...');
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isForeground = false;
      console.log('🔵 [BACKGROUND] ✅ Foreground cleared');
    }

    // Check if background is already running
    const isRunning = await BackgroundActions.isRunning();
    console.log(
      `🔵 [BACKGROUND] 📊 BackgroundActions.isRunning(): ${isRunning}`,
    );

    if (isRunning) {
      console.log('🔵 [BACKGROUND] ⏳ Background already running');
      this.isBackgroundRunning = true;
      console.log('🔵 [BACKGROUND] ✅ Using existing background service');
      return true;
    }

    try {
      const options = {
        ...backgroundOptions,
        foregroundServiceType: ['location'] as any,
      };

      console.log('🔵 [BACKGROUND] 📡 Starting BackgroundActions...');
      await BackgroundActions.start(locationTask, options);
      console.log('🔵 [BACKGROUND] ✅ BackgroundActions.start() completed');

      const isRunningAfterStart = await BackgroundActions.isRunning();
      console.log(
        `🔵 [BACKGROUND] 📊 After start, isRunning: ${isRunningAfterStart}`,
      );

      if (!isRunningAfterStart) {
        console.error('🔵 [BACKGROUND] ❌ Service failed to start');
        return false;
      }

      this.isBackgroundRunning = true;
      console.log(
        '🔵 [BACKGROUND] ✅ Background tracking started successfully',
      );
      console.log(
        `🔵 [BACKGROUND] 📊 Status: isRunning=${isRunningAfterStart}, isBackgroundRunning=${this.isBackgroundRunning}`,
      );
      console.log('🔵 [BACKGROUND] ════════════════════════════════════');
      console.log('==================================================');
      return true;
    } catch (error) {
      console.error('🔵 [BACKGROUND] ❌ Start failed:', error);
      return false;
    }
  }

  // ============================================================
  // 🛑 STOP BACKGROUND TRACKING
  // ============================================================

  private async stopBackgroundTracking(): Promise<void> {
    console.log('==================================================');
    console.log('🔴 [BACKGROUND] ════════════════════════════════════');
    console.log('🔴 [BACKGROUND] 🛑 STOPPING BACKGROUND TRACKING');
    console.log(`🔴 [BACKGROUND] 📅 Time: ${new Date().toISOString()}`);
    console.log('==================================================');

    try {
      const isRunning = await BackgroundActions.isRunning();
      console.log(`🔴 [BACKGROUND] 📊 Background is running: ${isRunning}`);

      if (isRunning) {
        console.log('🔴 [BACKGROUND] 📡 Calling BackgroundActions.stop()...');
        await BackgroundActions.stop();
        console.log('🔴 [BACKGROUND] ✅ Background stopped successfully');
      } else {
        console.log('🔴 [BACKGROUND] ⏳ Background already stopped');
      }

      this.isBackgroundRunning = false;
      console.log('🔴 [BACKGROUND] ✅ Cleanup complete');
      console.log('🔴 [BACKGROUND] ════════════════════════════════════');
      console.log('==================================================');
    } catch (error) {
      console.error('🔴 [BACKGROUND] ❌ Stop failed:', error);
    }
  }

  // ============================================================
  // 🛑 STOP TRACKING - PUBLIC API
  // ============================================================

  async stopTracking(): Promise<boolean> {
    console.log('==================================================');
    console.log('🔴 [SERVICE] ════════════════════════════════════');
    console.log('🔴 [SERVICE] 🛑 STOP TRACKING');
    console.log(`🔴 [SERVICE] 📅 Time: ${new Date().toISOString()}`);
    console.log(`🔴 [SERVICE] 📊 Current State: ${currentState}`);
    console.log(`🔴 [SERVICE] 📊 isTracking: ${isTrackingActive}`);
    console.log('==================================================');

    // ✅ Already stopped - capture current state to avoid narrowing
    const stateAtEntry: TrackingState = currentState;

    if (stateAtEntry === 'STOPPED') {
      console.log('🔴 [SERVICE] ⏳ Already stopped, returning');
      return true;
    }

    // ✅ Already stopping - wait using a separate check loop
    if (stateAtEntry === 'STOPPING') {
      console.log('🔴 [SERVICE] ⏳ Already stopping, waiting...');
      let waitCount = 0;
      // Wait until state changes from STOPPING
      while (currentState === 'STOPPING' && waitCount < 30) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      // Now check if we reached STOPPED - use type assertion
      if ((currentState as TrackingState) === 'STOPPED') {
        return true;
      }
      console.log("🔴 [SERVICE] ⚠️ Stop didn't complete, proceeding...");
    }

    // Set to STOPPING
    currentState = 'STOPPING';

    try {
      // Clear foreground interval
      if (this.intervalId) {
        console.log('🔴 [SERVICE] 🧹 Clearing foreground interval...');
        clearInterval(this.intervalId);
        this.intervalId = null;
        console.log('🔴 [SERVICE] ✅ Interval cleared');
      }

      // Stop background
      if (this.isBackgroundRunning) {
        console.log('🔴 [SERVICE] 🔵 Stopping background tracking...');
        await this.stopBackgroundTracking();
      }

      // Clear all state
      isTrackingActive = false;
      this.isForeground = false;
      activeShippingId = null;
      activeAuthToken = null;
      locationRequestPromise = null;
      lastLocationData = null;
      lastLocationTime = 0;

      currentState = 'STOPPED';
      console.log('🔴 [SERVICE] ✅ Tracking stopped successfully');
      console.log('🔴 [SERVICE] ════════════════════════════════════');
      console.log('==================================================');
      return true;
    } catch (error) {
      console.error('🔴 [SERVICE] ❌ Error during stop:', error);
      currentState = 'STOPPED';
      return false;
    }
  }

  // ============================================================
  // 📊 STATUS METHODS
  // ============================================================

  isTrackingActive(): boolean {
    return isTrackingActive;
  }

  isBackgroundActive(): boolean {
    return this.isBackgroundRunning;
  }

  isGpsAvailable(): boolean {
    return isGpsProviderAvailable;
  }

  getActiveShippingId(): string | null {
    return activeShippingId;
  }

  getTrackingState(): TrackingState {
    return currentState;
  }

  async getCurrentLocationOnce(): Promise<LocationWithMetadata | null> {
    console.log('📍 [SERVICE] Getting current location once...');
    const location = await getFreshLocationWithRetry();
    if (!location) return null;
    return await getLocationMetadata(location);
  }
}

export default new LocationService();
