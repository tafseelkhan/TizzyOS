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
import { driverStatusApi } from '../../../api/features/private/driverLocationOnlinePrivateSlice';
import { getToken } from '../../../api/connections/token/tokenSlice';
import DeviceInfo from 'react-native-device-info';
import { decode as base64Decode } from 'base-64';

// Background task configuration
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
    delay: 5000,
  },
};

// State management
let isLocationFetching = false;
let lastLocationData: any = null;
let lastLocationTime: number = 0;

// Task function - MUST be at module root for HeadlessJS
export function locationTask(taskData: any) {
  console.log(`[Background] Task started`);

  return new Promise<void>(async resolve => {
    const { delay } = taskData;
    let consecutiveErrors = 0;

    try {
      while (await BackgroundActions.isRunning()) {
        try {
          if (isLocationFetching) {
            await new Promise<void>(resolve => setTimeout(resolve, 2000));
            continue;
          }

          const location = await getCurrentLocation();

          if (location) {
            consecutiveErrors = 0;
            await sendLocationToBackend(location);
          } else {
            consecutiveErrors++;
            if (consecutiveErrors > 5) {
              await new Promise<void>(resolve => setTimeout(resolve, 10000));
              consecutiveErrors = 0;
            }
          }

          await new Promise<void>(resolve =>
            setTimeout(resolve, delay || 5000),
          );
        } catch (error) {
          console.error('[Background] Error:', error);
          await new Promise<void>(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error('[Background] Fatal error:', error);
    } finally {
      console.log('[Background] Task finished');
      resolve();
    }
  });
}

// Location helpers
const getCurrentLocation = async (): Promise<any> => {
  if (isLocationFetching) {
    if (lastLocationData && Date.now() - lastLocationTime < 30000) {
      return lastLocationData;
    }
    return null;
  }

  isLocationFetching = true;

  try {
    const location = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10000,
    });

    lastLocationData = location;
    lastLocationTime = Date.now();

    return location;
  } catch (error: any) {
    if (error.code === 'CANCELLED') {
      return lastLocationData || null;
    }
    console.error('[Location] Error:', error?.message);
    return null;
  } finally {
    isLocationFetching = false;
  }
};

const getBatteryLevel = async (): Promise<number> => {
  try {
    return Math.round((await DeviceInfo.getBatteryLevel()) * 100);
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

const getUserId = async (): Promise<string | null> => {
  try {
    const token = await getToken();
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = base64Decode(payload);
    const parsed = JSON.parse(decoded);

    return parsed.userId || parsed.id || parsed.sub || null;
  } catch {
    return null;
  }
};

const sendLocationToBackend = async (location: any): Promise<void> => {
  try {
    const token = await getToken();
    if (!token) return;

    const userId = await getUserId();
    if (!userId) return;

    const [batteryLevel, networkType] = await Promise.all([
      getBatteryLevel(),
      getNetworkType(),
    ]);

    const locationData = {
      latitude: location.latitude,
      longitude: location.longitude,
      isTrackingOn: true,
      heading: location.heading || 0,
      speed: location.speed || 0,
      accuracy: location.accuracy || 0,
      bearing: location.bearing || 0,
      altitude: location.altitude || 0,
      provider: location.provider || 'gps',
      batteryLevel,
      networkType,
      isMockLocation: false,
    };

    const response = await driverStatusApi.updateDriverLocation(locationData);

    if (!response.success) {
      console.warn('[Backend] Update failed:', response.message);
    }
  } catch (error) {
    console.error('[Backend] Error:', error);
  }
};

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

// Main service class
class LocationService {
  private isTracking = false;
  private intervalId: number | null = null;
  private appState: AppStateStatus = AppState.currentState || 'active';
  private isBackgroundRunning = false;
  private isForeground = false;
  private isTransitioning = false;

  constructor() {
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    try {
      this.appState = nextAppState;

      if (nextAppState === 'background' && this.isTracking) {
        await this.startBackgroundTracking();
      } else if (nextAppState === 'active' && this.isTracking) {
        await this.startForegroundTracking();
      }
    } finally {
      this.isTransitioning = false;
    }
  };

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const permissions: Permission[] = [
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ];

      if (Platform.Version >= 29) {
        permissions.push(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
      }

      const results = await Promise.all(
        permissions.map(permission => request(permission)),
      );

      const locationGranted = results.every(
        status => status === RESULTS.GRANTED,
      );

      if (!locationGranted) {
        console.warn('[Permissions] Location permissions not fully granted');
        return false;
      }

      await requestNotificationPermission();
      return true;
    } catch (error) {
      console.error('[Permissions] Error:', error);
      return false;
    }
  }

  async startTracking(): Promise<boolean> {
    try {
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        this.isTracking = false;
        return false;
      }

      this.isTracking = true;

      if (AppState.currentState === 'background') {
        return await this.startBackgroundTracking();
      }
      return await this.startForegroundTracking();
    } catch (error) {
      console.error('[Service] Start tracking failed:', error);
      this.isTracking = false;
      return false;
    }
  }

  private async startForegroundTracking(): Promise<boolean> {
    if (this.isBackgroundRunning) {
      await this.stopBackgroundTracking();
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isForeground = true;
    this.isTracking = true;

    const location = await getCurrentLocation();
    if (location) {
      await sendLocationToBackend(location);
    }

    this.intervalId = setInterval(() => {
      void (async () => {
        if (!this.isTracking || !this.isForeground) return;

        const newLocation = await getCurrentLocation();
        if (newLocation) {
          await sendLocationToBackend(newLocation);
        }
      })();
    }, 5000);

    return true;
  }

  private async startBackgroundTracking(): Promise<boolean> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isForeground = false;
    }

    if (await BackgroundActions.isRunning()) {
      this.isBackgroundRunning = true;
      this.isTracking = true;
      return true;
    }

    try {
      const options = {
        ...backgroundOptions,
        foregroundServiceType: ['location'] as any,
      };

      console.log(
        '[Background] Starting with options:',
        JSON.stringify(options),
      );

      await BackgroundActions.start(locationTask, options);

      const isRunning = await BackgroundActions.isRunning();
      if (!isRunning) {
        console.error('[Background] Service failed to start');
        return false;
      }

      this.isBackgroundRunning = true;
      this.isTracking = true;
      console.log('[Background] Started successfully');
      return true;
    } catch (error) {
      console.error('[Background] Start failed:', error);
      return false;
    }
  }

  private async stopBackgroundTracking(): Promise<void> {
    try {
      if (await BackgroundActions.isRunning()) {
        await BackgroundActions.stop();
      }
      this.isBackgroundRunning = false;
    } catch (error) {
      console.error('[Background] Stop failed:', error);
    }
  }

  async stopTracking(): Promise<void> {
    this.isTracking = false;
    this.isForeground = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.isBackgroundRunning) {
      await this.stopBackgroundTracking();
    }

    lastLocationData = null;
    lastLocationTime = 0;
  }

  isTrackingActive(): boolean {
    return this.isTracking;
  }

  isBackgroundActive(): boolean {
    return this.isBackgroundRunning;
  }
}

export default new LocationService();
