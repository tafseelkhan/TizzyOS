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

// ✅ NEW — API slice (auto refresh + retry)
import { updateRiderLocation } from '../../../api/features/private/riderLocationPrivateSlice';
import { ApiError } from '../../../core/utils/handler/apiClient';

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

// ✅ Removed hardcoded TIZZYOS_API_BASE_URL — now inside slice

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
let isTrackingActive = false;

// ✅ State Machine
type TrackingState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING';
let currentState: TrackingState = 'STOPPED';

// ============================================================
// 🔄 BACKGROUND TASK — Module Level
//
// ✅ Uses `updateRiderLocation` slice (apiClient).
// Safe because apiClient is React-independent.
// ============================================================

export function locationTask(taskData: any) {
  console.log('==================================================');
  console.log('🔵 [BACKGROUND] 🚀 TASK STARTED');
  console.log(`🔵 [BACKGROUND] 📅 Time: ${new Date().toISOString()}`);
  console.log(
    `🔵 [BACKGROUND] ⏱️ Delay: ${taskData?.delay || TRACKING_CONFIG.intervalMs}ms`,
  );
  console.log('==================================================');

  return new Promise<void>(resolve => {
    const { delay } = taskData;
    let consecutiveErrors = 0;
    let locationCount = 0;

    const runTask = async () => {
      try {
        while (await BackgroundActions.isRunning()) {
          try {
            if (!isGpsProviderAvailable) {
              console.log(
                '🔵 [BACKGROUND] 📡 GPS provider unavailable, checking...',
              );
              await checkGpsProvider();
              await new Promise<void>(res => setTimeout(res, 5000));
              continue;
            }

            if (locationRequestPromise) {
              console.log(
                '🔵 [BACKGROUND] ⏳ Location request in progress, waiting...',
              );
              const location = await locationRequestPromise;
              if (location) {
                consecutiveErrors = 0;
                console.log(
                  `🔵 [BACKGROUND] ✅ Location #${++locationCount} obtained from in-flight request`,
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
                `🔵 [BACKGROUND] ✅ Location #${locationCount} obtained`,
              );
              await handleLocationAcquired(result);
            } else {
              consecutiveErrors++;
              console.log(
                `🔵 [BACKGROUND] ❌ Location fetch failed (${consecutiveErrors}/${TRACKING_CONFIG.maxConsecutiveErrors})`,
              );

              if (consecutiveErrors >= TRACKING_CONFIG.maxConsecutiveErrors) {
                console.log(
                  '🔵 [BACKGROUND] 🔄 Too many errors, marking GPS unavailable',
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
    return await locationRequestPromise;
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
      const location = await Geolocation.getCurrentPosition(LOCATION_CONFIG);

      if (!isGpsProviderAvailable) {
        isGpsProviderAvailable = true;
        console.log('📍 [LOCATION] ✅ GPS provider became available');
      }

      console.log('📍 [LOCATION] ✅ Location received:', {
        lat: location.latitude,
        lng: location.longitude,
        acc: location.accuracy,
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

      return locationData;
    } catch (error: any) {
      console.error(
        `📍 [LOCATION] ❌ Attempt ${attempt} failed:`,
        error?.message || error,
      );

      if (error.message?.includes('timeout') || error.code === 'TIMEOUT') {
        if (attempt >= RETRY_CONFIG.maxAttempts) {
          isGpsProviderAvailable = false;
          console.log('📍 [LOCATION] 📡 Marking GPS unavailable');
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

const handleLocationAcquired = async (
  location: LocationData,
): Promise<void> => {
  // 1. Notify UI subscribers
  const metadata = await getLocationMetadata(location);
  notifySubscribers(metadata);

  // 2. Upload to backend via slice
  await uploadLocationToBackend(location);
};

/**
 * ✅ Upload via riderLocationPrivateSlice
 * - apiClient handles token retrieval + auto refresh
 * - No manual AsyncStorage, no manual fetch
 */
const uploadLocationToBackend = async (
  location: LocationData,
): Promise<void> => {
  const shippingId = activeShippingId;

  if (!shippingId) {
    console.error('📍 [LOCATION_API] ❌ No shipping ID available for upload');
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

  try {
    const response = await updateRiderLocation({
      shippingId,
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
    });

    if (response.success) {
      console.log('📍 [LOCATION_API] ✅ Location uploaded');
    } else {
      console.log(
        `📍 [LOCATION_API] ⚠️ Upload returned success:false — ${response.message}`,
      );
    }
  } catch (err) {
    if (err instanceof ApiError) {
      console.error(
        `📍 [LOCATION_API] ❌ API error [${err.status}]: ${err.message}`,
      );
    } else {
      console.error('📍 [LOCATION_API] ❌ Upload error:', err);
    }
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
  private appState: AppStateStatus = (AppState.currentState ||
    'active') as AppStateStatus;
  private isBackgroundRunning = false;
  private isForeground = false;
  private isTransitioning = false;

  constructor() {
    console.log('🟢 [SERVICE] 🏗️ CONSTRUCTOR');
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  // ============================================================
  // 📞 SUBSCRIBER API
  // ============================================================

  subscribeToLocation(callback: LocationSubscriber): () => void {
    const id = `sub_${++subscriberIdCounter}`;
    subscribers.set(id, callback);
    console.log(
      `📢 [SUBSCRIBER] ✅ Registered ${id} (total: ${subscribers.size})`,
    );

    const cached = getLastKnownLocation();
    if (cached) {
      console.log(`📢 [SUBSCRIBER] 📤 Sending last known to ${id}`);
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
        `📢 [SUBSCRIBER] ❌ Unregistered ${id} (remaining: ${subscribers.size})`,
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
    console.log(`📱 [APP_STATE] 🔄 ${this.appState} → ${nextAppState}`);

    if (this.isTransitioning) {
      console.log('📱 [APP_STATE] ⏳ Transition in progress, ignoring');
      return;
    }

    this.isTransitioning = true;

    try {
      this.appState = nextAppState;

      if (nextAppState === 'background' && isTrackingActive) {
        console.log('📱 [APP_STATE] 🔵 → BACKGROUND');
        await this.startBackgroundTracking();
      } else if (nextAppState === 'active' && isTrackingActive) {
        console.log('📱 [APP_STATE] 🟢 → FOREGROUND');
        await this.startForegroundTracking();
      }
    } catch (error) {
      console.error('📱 [APP_STATE] ❌ Error:', error);
    } finally {
      this.isTransitioning = false;
    }
  };

  // ============================================================
  // 🔐 PERMISSIONS
  // ============================================================

  async requestPermissions(): Promise<boolean> {
    console.log('🔐 [PERMISSIONS] Requesting...');

    if (Platform.OS !== 'android') return true;

    try {
      const permissions: Permission[] = [
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ];

      if (Platform.Version >= 29) {
        permissions.push(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
      }

      const statuses = await Promise.all(permissions.map(p => check(p)));
      const allGranted = statuses.every(s => s === RESULTS.GRANTED);

      if (allGranted) {
        await requestNotificationPermission();
        return true;
      }

      const results = await Promise.all(
        permissions.map(permission => request(permission)),
      );

      const locationGranted = results.every(
        status => status === RESULTS.GRANTED,
      );

      if (!locationGranted) {
        console.warn('🔐 [PERMISSIONS] ❌ Denied');
        return false;
      }

      await requestNotificationPermission();
      return true;
    } catch (error) {
      console.error('🔐 [PERMISSIONS] ❌ Error:', error);
      return false;
    }
  }

  // ============================================================
  // ▶️ START TRACKING
  // ============================================================

  async startTracking(shippingId: string): Promise<boolean> {
    console.log(`🟢 [SERVICE] ▶️ START TRACKING: ${shippingId}`);

    if (!shippingId || shippingId.trim() === '') {
      console.error('🟢 [SERVICE] ❌ Invalid shippingId');
      return false;
    }

    if (currentState === 'RUNNING') {
      console.log('🟢 [SERVICE] ⏳ Already tracking');
      return true;
    }

    if (currentState === 'STARTING') {
      let waitCount = 0;
      while (currentState === 'STARTING' && waitCount < 30) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      if ((currentState as TrackingState) === 'RUNNING') return true;
    }

    currentState = 'STARTING';

    try {
      activeShippingId = shippingId;

      // ✅ Permissions
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        currentState = 'STOPPED';
        activeShippingId = null;
        return false;
      }

      // ✅ GPS check
      await checkGpsProvider();

      isTrackingActive = true;

      let result = false;
      if (AppState.currentState === 'background') {
        result = await this.startBackgroundTracking();
      } else {
        result = await this.startForegroundTracking();
      }

      if (result) {
        currentState = 'RUNNING';
        console.log('🟢 [SERVICE] ✅ Tracking started');
      } else {
        currentState = 'STOPPED';
        isTrackingActive = false;
        activeShippingId = null;
      }

      return result;
    } catch (error) {
      console.error('🟢 [SERVICE] ❌ Start failed:', error);
      currentState = 'STOPPED';
      isTrackingActive = false;
      activeShippingId = null;
      return false;
    }
  }

  // ============================================================
  // 🟢 FOREGROUND TRACKING
  // ============================================================

  private async startForegroundTracking(): Promise<boolean> {
    console.log('🟢 [FOREGROUND] 🚀 STARTING');

    if (this.isBackgroundRunning) {
      await this.stopBackgroundTracking();
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isForeground = true;

    const location = await getFreshLocationWithRetry();
    if (location) {
      await handleLocationAcquired(location);
    }

    this.intervalId = setInterval(() => {
      void (async () => {
        if (!isTrackingActive || !this.isForeground) return;

        if (!isGpsProviderAvailable) {
          await checkGpsProvider();
          if (!isGpsProviderAvailable) return;
        }

        const newLocation = await getFreshLocationWithRetry();
        if (newLocation) {
          await handleLocationAcquired(newLocation);
        } else {
          if (isGpsProviderAvailable) {
            await checkGpsProvider();
          }
        }
      })();
    }, TRACKING_CONFIG.intervalMs);

    console.log('🟢 [FOREGROUND] ✅ Started');
    return true;
  }

  // ============================================================
  // 🔵 BACKGROUND TRACKING
  // ============================================================

  private async startBackgroundTracking(): Promise<boolean> {
    console.log('🔵 [BACKGROUND] 🚀 STARTING');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isForeground = false;
    }

    const isRunning = await BackgroundActions.isRunning();
    if (isRunning) {
      this.isBackgroundRunning = true;
      return true;
    }

    try {
      const options = {
        ...backgroundOptions,
        foregroundServiceType: ['location'] as any,
      };

      await BackgroundActions.start(locationTask, options);

      const isRunningAfter = await BackgroundActions.isRunning();
      if (!isRunningAfter) {
        console.error('🔵 [BACKGROUND] ❌ Failed to start');
        return false;
      }

      this.isBackgroundRunning = true;
      console.log('🔵 [BACKGROUND] ✅ Started');
      return true;
    } catch (error) {
      console.error('🔵 [BACKGROUND] ❌ Start failed:', error);
      return false;
    }
  }

  // ============================================================
  // 🛑 STOP BACKGROUND
  // ============================================================

  private async stopBackgroundTracking(): Promise<void> {
    try {
      const isRunning = await BackgroundActions.isRunning();
      if (isRunning) {
        await BackgroundActions.stop();
      }
      this.isBackgroundRunning = false;
    } catch (error) {
      console.error('🔴 [BACKGROUND] ❌ Stop failed:', error);
    }
  }

  // ============================================================
  // 🛑 STOP TRACKING
  // ============================================================

  async stopTracking(): Promise<boolean> {
    console.log('🔴 [SERVICE] 🛑 STOP TRACKING');

    const stateAtEntry: TrackingState = currentState;

    if (stateAtEntry === 'STOPPED') return true;

    if (stateAtEntry === 'STOPPING') {
      let waitCount = 0;
      while (currentState === 'STOPPING' && waitCount < 30) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      if ((currentState as TrackingState) === 'STOPPED') return true;
    }

    currentState = 'STOPPING';

    try {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      if (this.isBackgroundRunning) {
        await this.stopBackgroundTracking();
      }

      isTrackingActive = false;
      this.isForeground = false;
      activeShippingId = null;
      locationRequestPromise = null;
      lastLocationData = null;
      lastLocationTime = 0;

      currentState = 'STOPPED';
      console.log('🔴 [SERVICE] ✅ Stopped');
      return true;
    } catch (error) {
      console.error('🔴 [SERVICE] ❌ Stop error:', error);
      currentState = 'STOPPED';
      return false;
    }
  }

  // ============================================================
  // 📊 STATUS
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
    const location = await getFreshLocationWithRetry();
    if (!location) return null;
    return await getLocationMetadata(location);
  }
}

export default new LocationService();
