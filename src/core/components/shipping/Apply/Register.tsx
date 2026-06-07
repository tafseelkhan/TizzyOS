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
  LogBox,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
// ✅ CORRECT IMPORT FOR FONTSITO
import Fontisto from 'react-native-vector-icons/Fontisto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  launchImageLibrary,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import DeviceInfo from 'react-native-device-info';
import { vehicleOptions } from '../../shipping/Apply/vehicleCategory';

// Import location and background packages
import GetLocation from 'react-native-get-location';
import BackgroundService from 'react-native-background-actions';

// Ignore specific warnings
LogBox.ignoreLogs(['new NativeEventEmitter']);

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

// ============================================================
// BATTERY BASED TIMEOUT CALCULATOR
// ============================================================

class BatteryTimeoutCalculator {
  private static readonly MIN_TIMEOUT_MS = 3000;
  private static readonly MAX_TIMEOUT_MS = 25000;
  private static readonly BASE_FOREGROUND_TIMEOUT_MS = 15000;
  private static readonly BASE_BACKGROUND_TIMEOUT_MS = 20000;

  static getForegroundTimeout(batteryLevel: number): number {
    const battery = Math.max(0, Math.min(100, batteryLevel));
    // Linear interpolation: lower battery = lower timeout
    const timeout =
      this.BASE_FOREGROUND_TIMEOUT_MS * (battery / 100) +
      this.MIN_TIMEOUT_MS * ((100 - battery) / 100);
    return Math.floor(
      Math.max(this.MIN_TIMEOUT_MS, Math.min(this.MAX_TIMEOUT_MS, timeout)),
    );
  }

  static getBackgroundTimeout(batteryLevel: number): number {
    const battery = Math.max(0, Math.min(100, batteryLevel));
    const timeout =
      this.BASE_BACKGROUND_TIMEOUT_MS * (battery / 100) +
      this.MIN_TIMEOUT_MS * ((100 - battery) / 100);
    return Math.floor(
      Math.max(this.MIN_TIMEOUT_MS, Math.min(this.MAX_TIMEOUT_MS, timeout)),
    );
  }

  static getPollingInterval(
    batteryLevel: number,
    isBackground: boolean,
  ): number {
    const battery = Math.max(0, Math.min(100, batteryLevel));
    if (isBackground) {
      // Background: 5s to 20s
      return Math.floor(5000 + 15000 * (battery / 100));
    } else {
      // Foreground: 3s to 12s
      return Math.floor(3000 + 9000 * (battery / 100));
    }
  }

  static getAccuracyMode(batteryLevel: number): 'high' | 'balanced' | 'low' {
    if (batteryLevel > 50) return 'high';
    if (batteryLevel > 20) return 'balanced';
    return 'low';
  }

  // 🔥 FONTOSTO BATTERY ICONS 🔥
  static getBatteryIconName(batteryLevel: number): string {
    // Fontisto battery icons
    if (batteryLevel > 90) return 'battery-full';
    if (batteryLevel > 70) return 'battery-three-quarters';
    if (batteryLevel > 50) return 'battery-half';
    if (batteryLevel > 30) return 'battery-quarter';
    if (batteryLevel > 15) return 'battery-empty';
    return 'battery-warning';
  }

  static getBatteryColor(batteryLevel: number): string {
    if (batteryLevel > 50) return '#10B981';
    if (batteryLevel > 20) return '#F59E0B';
    return '#EF4444';
  }

  static getAccuracyIconName(mode: string): string {
    if (mode === 'high') return 'gps-fixed';
    if (mode === 'balanced') return 'gps-not-fixed';
    return 'gps-off';
  }

  static getAccuracyColor(mode: string): string {
    if (mode === 'high') return '#10B981';
    if (mode === 'balanced') return '#F59E0B';
    return '#EF4444';
  }
}

// ============================================================
// LOGGING UTILITY
// ============================================================

const Logger = {
  FOREGROUND: '🟢',
  BACKGROUND: '🔵',
  GPS: '📍',
  API: '🌐',
  PERMISSION: '🔐',
  TRACKER: '🎯',
  BATTERY: '🔋',
  ERROR: '❌',
  SUCCESS: '✅',
  WARNING: '⚠️',
  INFO: '📘',

  log: (tag: string, message: string, data?: any) => {
    console.log(
      `${tag} [${new Date().toLocaleTimeString()}] ${message}`,
      data ? data : '',
    );
  },
  logForeground: (message: string, data?: any) =>
    Logger.log(Logger.FOREGROUND, message, data),
  logBackground: (message: string, data?: any) =>
    Logger.log(Logger.BACKGROUND, message, data),
  logGPS: (message: string, coords?: any) => {
    if (coords?.lat) {
      Logger.log(
        Logger.GPS,
        `${message} | Lat:${coords.lat.toFixed(6)} Lng:${coords.lng.toFixed(
          6,
        )} Acc:${(coords.acc || 0).toFixed(1)}m`,
      );
    } else {
      Logger.log(Logger.GPS, message);
    }
  },
  logAPI: (message: string, data?: any) =>
    Logger.log(Logger.API, message, data),
  logPermission: (message: string, granted?: boolean) =>
    Logger.log(
      Logger.PERMISSION,
      message,
      granted !== undefined ? `Granted: ${granted}` : '',
    ),
  logTracker: (message: string, data?: any) =>
    Logger.log(Logger.TRACKER, message, data),
  logBattery: (
    level: number,
    fgTimeout?: number,
    bgTimeout?: number,
    interval?: number,
  ) => {
    let msg = `Level: ${level.toFixed(0)}%`;
    if (fgTimeout) msg += ` | FG:${(fgTimeout / 1000).toFixed(0)}s`;
    if (bgTimeout) msg += ` | BG:${(bgTimeout / 1000).toFixed(0)}s`;
    if (interval) msg += ` | Interval:${(interval / 1000).toFixed(0)}s`;
    Logger.log(Logger.BATTERY, msg);
  },
  logError: (message: string, error?: any) =>
    console.error(`${Logger.ERROR} ${message}`, error || ''),
  logSuccess: (message: string, data?: any) =>
    Logger.log(Logger.SUCCESS, message, data),
  logWarning: (message: string, data?: any) =>
    Logger.log(Logger.WARNING, message, data),
  logInfo: (message: string, data?: any) =>
    Logger.log(Logger.INFO, message, data),
};

// ============================================================
// LOCATION TRACKER WITH BATTERY-BASED TIMEOUTS
// ============================================================

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isBackground?: boolean;
  speed?: number;
}

type BatteryUpdateCallback = (info: {
  level: number;
  fgTimeout: number;
  bgTimeout: number;
  interval: number;
  accuracyMode: string;
}) => void;

class LocationTracker {
  private static instance: LocationTracker;
  private isTracking = false;
  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private riderId: string | null = null;
  private authToken: string | null = null;
  private lastLocation: LocationData | null = null;
  private appStateSubscription: any = null;
  private backgroundMode = false;
  private batteryLevel = 100;
  private batteryInterval: ReturnType<typeof setInterval> | null = null;
  private isPollingInProgress = false;
  private currentIntervalMs = 10000;
  private appState: AppStateStatus = 'active';
  private isStarting = false;
  private isStopping = false;
  private isBackgroundTaskRunning = false;
  private pollCount = 0;
  private successCount = 0;
  private failCount = 0;
  private isLocationRequestInProgress = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000;
  private batteryUpdateCallback: BatteryUpdateCallback | null = null;

  private constructor() {
    Logger.logTracker('Initializing LocationTracker');
    try {
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.onAppStateChange.bind(this),
      );
      this.startBatteryMonitoring();
      Logger.logSuccess('LocationTracker initialized');
    } catch (error) {
      Logger.logError('Constructor error:', error);
    }
  }

  static getInstance(): LocationTracker {
    if (!LocationTracker.instance)
      LocationTracker.instance = new LocationTracker();
    return LocationTracker.instance;
  }

  setBatteryUpdateCallback(callback: BatteryUpdateCallback | null) {
    this.batteryUpdateCallback = callback;
    if (callback && this.batteryLevel) {
      callback(this.getBatteryInfo());
    }
  }

  getBatteryInfo() {
    return {
      level: this.batteryLevel,
      fgTimeout: BatteryTimeoutCalculator.getForegroundTimeout(
        this.batteryLevel,
      ),
      bgTimeout: BatteryTimeoutCalculator.getBackgroundTimeout(
        this.batteryLevel,
      ),
      interval: BatteryTimeoutCalculator.getPollingInterval(
        this.batteryLevel,
        this.backgroundMode,
      ),
      accuracyMode: BatteryTimeoutCalculator.getAccuracyMode(this.batteryLevel),
    };
  }

  private backgroundTask = async (taskData: any) => {
    const { delay, riderId, authToken } = taskData;
    if (riderId && authToken) {
      this.riderId = riderId;
      this.authToken = authToken;
    }
    let bgPollCount = 0;

    while (BackgroundService.isRunning()) {
      if (!this.isTracking) {
        await this.sleep(delay);
        continue;
      }
      bgPollCount++;
      Logger.logBackground(`Poll #${bgPollCount}`);
      try {
        const startTime = Date.now();
        const location = await this.getCurrentLocationWithRetry(true);
        const elapsed = Date.now() - startTime;
        Logger.logBackground(`Location fetch: ${elapsed}ms`);
        if (location) {
          location.isBackground = true;
          Logger.logGPS(`BACKGROUND SUCCESS`, {
            lat: location.latitude,
            lng: location.longitude,
            acc: location.accuracy,
          });
          await this.sendLocationToBackend(
            location.latitude,
            location.longitude,
            location.accuracy,
            true,
          );
        }
      } catch (error) {
        Logger.logError('Background error:', error);
      }
      await this.sleep(delay);
    }
    Logger.logBackground('Task ended');
  };

  private sleep = (ms: number) =>
    new Promise(resolve => setTimeout(() => resolve(undefined), ms));

  async startBackgroundTask(): Promise<boolean> {
    if (this.isBackgroundTaskRunning) return true;
    if (!this.riderId || !this.authToken) return false;
    const interval = BatteryTimeoutCalculator.getPollingInterval(
      this.batteryLevel,
      true,
    );
    const options = {
      taskName: 'RiderLocationTracking',
      taskTitle: 'TizzyGo',
      taskDesc: `Tracking | Battery:${this.batteryLevel.toFixed(0)}%`,
      taskIcon: { name: 'ic_launcher', type: 'mipmap' },
      color: '#4F46E5',
      linkingURI: 'yourapp://home',
      parameters: {
        delay: interval,
        riderId: this.riderId,
        authToken: this.authToken,
      },
    };
    try {
      await BackgroundService.start(this.backgroundTask, options);
      this.isBackgroundTaskRunning = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  async stopBackgroundTask(): Promise<boolean> {
    if (!this.isBackgroundTaskRunning) return true;
    try {
      await BackgroundService.stop();
      this.isBackgroundTaskRunning = false;
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getCurrentLocationWithRetry(
    isBackground: boolean = false,
  ): Promise<LocationData | null> {
    const mode = isBackground ? 'BACKGROUND' : 'FOREGROUND';
    if (this.isLocationRequestInProgress) {
      Logger.logWarning(`${mode} request in progress, skipping`);
      return null;
    }

    const now = Date.now();
    if (now - this.lastRequestTime < this.MIN_REQUEST_INTERVAL)
      await this.sleep(
        this.MIN_REQUEST_INTERVAL - (now - this.lastRequestTime),
      );
    this.isLocationRequestInProgress = true;
    this.lastRequestTime = Date.now();

    let attempt = 0;
    const maxRetries = 2;
    try {
      while (attempt <= maxRetries) {
        try {
          const startTime = Date.now();
          const location = await this.getCurrentLocationPromise(isBackground);
          if (location && this.isValidLocation(location)) {
            Logger.logGPS(`${mode} FOUND in ${Date.now() - startTime}ms`, {
              lat: location.latitude,
              lng: location.longitude,
              acc: location.accuracy,
            });
            return location;
          }
        } catch (error: any) {
          if (!error?.message?.includes('CANCELLED'))
            Logger.logError(
              `${mode} attempt ${attempt + 1} failed:`,
              error?.message,
            );
        }
        attempt++;
        if (attempt <= maxRetries) await this.sleep(2000);
      }
      Logger.logError(`${mode} all attempts failed`);
      return null;
    } finally {
      this.isLocationRequestInProgress = false;
    }
  }

  private getCurrentLocationPromise(
    isBackground: boolean = false,
  ): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      let timeoutId: any = null;
      let resolved = false;
      const mode = isBackground ? 'BACKGROUND' : 'FOREGROUND';
      const timeoutMs = isBackground
        ? BatteryTimeoutCalculator.getBackgroundTimeout(this.batteryLevel)
        : BatteryTimeoutCalculator.getForegroundTimeout(this.batteryLevel);

      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Location timeout'));
        }
      }, timeoutMs);

      const accuracyMode = BatteryTimeoutCalculator.getAccuracyMode(
        this.batteryLevel,
      );
      const useHighAccuracy = !isBackground && accuracyMode === 'high';
      const options = {
        enableHighAccuracy: useHighAccuracy,
        timeout: Math.min(timeoutMs - 1000, 10000),
        maxAge: 0,
      };

      try {
        GetLocation.getCurrentPosition(options)
          .then((loc: any) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              resolve({
                latitude: loc.latitude,
                longitude: loc.longitude,
                accuracy: loc.accuracy || 0,
                timestamp: Date.now(),
                speed: loc.speed,
              });
            }
          })
          .catch((err: any) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              reject(err);
            }
          });
      } catch (err) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          reject(err);
        }
      }
    });
  }

  private isValidLocation(loc: LocationData): boolean {
    return (
      !(loc.latitude === 0 && loc.longitude === 0) &&
      loc.latitude >= -90 &&
      loc.latitude <= 90 &&
      loc.longitude >= -180 &&
      loc.longitude <= 180
    );
  }

  async checkRealPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const fine = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      let bg = true;
      if (Platform.Version >= 29)
        bg = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        );
      return fine && bg;
    } catch {
      return false;
    }
  }

  async requestRealPermissions(): Promise<boolean> {
    if (this.appState !== 'active') return false;
    if (Platform.OS !== 'android') return this.requestIOSPermissions();
    try {
      let fine = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      let bg = true;
      if (Platform.Version >= 29)
        bg = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        );
      if (fine && bg) return true;

      const fineResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'App needs location access to track deliveries',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      if (fineResult !== PermissionsAndroid.RESULTS.GRANTED) return false;

      if (Platform.Version >= 29) {
        const bgResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          {
            title: 'Background Location',
            message: 'App needs background location even when screen is locked',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        bg = bgResult === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async requestIOSPermissions(): Promise<boolean> {
    return new Promise(resolve => {
      GetLocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
      })
        .then(() => resolve(true))
        .catch(() => resolve(false));
    });
  }

  async startTracking(riderId: string, authToken: string): Promise<boolean> {
    if (!(await this.checkRealPermissions())) return false;
    if (this.isStarting || this.isTracking) return false;
    this.isStarting = true;
    try {
      this.stopPollingLoop();
      this.isTracking = true;
      this.riderId = riderId;
      this.authToken = authToken;
      this.pollCount = this.successCount = this.failCount = 0;
      await this.updateBatteryLevel();
      this.startPollingLoop();
      await this.startBackgroundTask();
      return true;
    } catch (error) {
      return false;
    } finally {
      this.isStarting = false;
    }
  }

  async stopTracking(): Promise<void> {
    if (this.isStopping) return;
    this.isStopping = true;
    try {
      this.isTracking = false;
      this.stopPollingLoop();
      await this.stopBackgroundTask();
      this.riderId = null;
      this.authToken = null;
      this.lastLocation = null;
    } finally {
      this.isStopping = false;
    }
  }

  private onAppStateChange(nextState: AppStateStatus) {
    this.appState = nextState;
    this.backgroundMode = nextState === 'background';
    if (this.isTracking) this.restartPollingWithNewInterval();
  }

  private restartPollingWithNewInterval() {
    if (this.isTracking) {
      this.stopPollingLoop();
      this.startPollingLoop();
    }
  }

  private startPollingLoop() {
    if (this.pollingIntervalId) this.stopPollingLoop();
    const interval = BatteryTimeoutCalculator.getPollingInterval(
      this.batteryLevel,
      this.backgroundMode,
    );
    this.currentIntervalMs = interval;
    if (this.batteryUpdateCallback)
      this.batteryUpdateCallback(this.getBatteryInfo());
    this.executeLocationPoll();
    this.pollingIntervalId = setInterval(
      () => this.executeLocationPoll(),
      interval,
    );
  }

  private stopPollingLoop() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }

  private async executeLocationPoll() {
    if (!this.isTracking || this.isPollingInProgress) return;
    this.pollCount++;
    this.isPollingInProgress = true;
    try {
      const location = await this.getCurrentLocationWithRetry(false);
      if (location) {
        this.successCount++;
        await this.handleLocationUpdate(location);
      } else {
        this.failCount++;
      }
    } finally {
      this.isPollingInProgress = false;
    }
  }

  private startBatteryMonitoring() {
    this.batteryInterval = setInterval(async () => {
      await this.updateBatteryLevel();
      if (this.isTracking) {
        const newInterval = BatteryTimeoutCalculator.getPollingInterval(
          this.batteryLevel,
          this.backgroundMode,
        );
        if (newInterval !== this.currentIntervalMs)
          this.restartPollingWithNewInterval();
      }
    }, 60000);
    this.updateBatteryLevel();
  }

  private async updateBatteryLevel() {
    try {
      const level = await DeviceInfo.getBatteryLevel();
      this.batteryLevel = level * 100;
    } catch {
      this.batteryLevel = 50;
    }
    if (this.batteryUpdateCallback)
      this.batteryUpdateCallback(this.getBatteryInfo());
  }

  private async handleLocationUpdate(location: LocationData) {
    if (!this.isTracking || !this.riderId || !this.authToken) return;
    const { latitude, longitude, accuracy } = location;
    if (latitude === 0 && longitude === 0) return;
    if (this.lastLocation) {
      const distance = Math.hypot(
        (latitude - this.lastLocation.latitude) * 111000,
        (longitude - this.lastLocation.longitude) * 111000,
      );
      if (distance < 10 && Math.abs(accuracy - this.lastLocation.accuracy) < 5)
        return;
    }
    this.lastLocation = {
      latitude,
      longitude,
      accuracy,
      timestamp: Date.now(),
    };
    await this.sendLocationToBackend(latitude, longitude, accuracy, false);
  }

  private async sendLocationToBackend(
    lat: number,
    lng: number,
    acc: number,
    isBg: boolean = false,
  ) {
    if (!this.riderId || !this.authToken) return;
    try {
      await fetch(`${API_BASE_URL}/api/shipping/rider/location`, {
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
          accuracy: acc,
          timestamp: new Date().toISOString(),
          updateType: 'tracking',
          batteryLevel: this.batteryLevel,
          isBackground: isBg,
        }),
      });
    } catch (error) {
      Logger.logError('Send failed:', error);
    }
  }

  destroy() {
    this.stopTracking();
    if (this.appStateSubscription) this.appStateSubscription.remove();
    if (this.batteryInterval) clearInterval(this.batteryInterval);
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
  }
}

const getLocationOnce = (): Promise<{ lat: number; lng: number }> =>
  new Promise((res, rej) => {
    GetLocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 15000,
    })
      .then(loc => res({ lat: loc.latitude, lng: loc.longitude }))
      .catch(rej);
  });

function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): T {
  const timer = useRef<any>(null);
  return useCallback(
    (...args: any[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay],
  ) as T;
}

export async function requestLocationPermission(): Promise<boolean> {
  return await LocationTracker.getInstance().requestRealPermissions();
}

async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs storage to upload images',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }
  return true;
}

// ============================================================
// BATTERY INFO CARD COMPONENT
// ============================================================

const BatteryInfoCard: React.FC<{
  batteryLevel: number;
  fgTimeout: number;
  bgTimeout: number;
  interval: number;
  accuracyMode: string;
}> = ({ batteryLevel, fgTimeout, bgTimeout, interval, accuracyMode }) => {
  return (
    <View style={styles.batteryCard}>
      <View style={styles.batteryCardHeader}>
        <Icon name="battery-charging-full" size={20} color="#4F46E5" />
        <Text style={styles.batteryCardTitle}>Battery & Performance</Text>
      </View>

      <View style={styles.batteryStatsRow}>
        <View style={styles.batteryStatItem}>
          <Fontisto
            name={BatteryTimeoutCalculator.getBatteryIconName(batteryLevel)}
            size={28}
            color={BatteryTimeoutCalculator.getBatteryColor(batteryLevel)}
          />
          <Text
            style={[
              styles.batteryStatValue,
              { color: BatteryTimeoutCalculator.getBatteryColor(batteryLevel) },
            ]}
          >
            {batteryLevel.toFixed(0)}%
          </Text>
          <Text style={styles.batteryStatLabel}>Battery Level</Text>
        </View>

        <View style={styles.batteryStatItem}>
          <Icon
            name={BatteryTimeoutCalculator.getAccuracyIconName(accuracyMode)}
            size={28}
            color={BatteryTimeoutCalculator.getAccuracyColor(accuracyMode)}
          />
          <Text
            style={[
              styles.batteryStatValue,
              {
                color: BatteryTimeoutCalculator.getAccuracyColor(accuracyMode),
              },
            ]}
          >
            {accuracyMode.toUpperCase()}
          </Text>
          <Text style={styles.batteryStatLabel}>Accuracy Mode</Text>
        </View>
      </View>

      <View style={styles.batteryProgressBar}>
        <View
          style={[
            styles.batteryProgressFill,
            {
              width: `${batteryLevel}%`,
              backgroundColor:
                BatteryTimeoutCalculator.getBatteryColor(batteryLevel),
            },
          ]}
        />
      </View>

      <View style={styles.timeoutRow}>
        <View style={styles.timeoutItem}>
          <Icon name="gps-fixed" size={18} color="#6B7280" />
          <Text style={styles.timeoutLabel}>FG Timeout</Text>
          <Text style={styles.timeoutValue}>
            {(fgTimeout / 1000).toFixed(0)}s
          </Text>
        </View>
        <View style={styles.timeoutItem}>
          <Icon name="nightlight-round" size={18} color="#6B7280" />
          <Text style={styles.timeoutLabel}>BG Timeout</Text>
          <Text style={styles.timeoutValue}>
            {(bgTimeout / 1000).toFixed(0)}s
          </Text>
        </View>
        <View style={styles.timeoutItem}>
          <Icon name="update" size={18} color="#6B7280" />
          <Text style={styles.timeoutLabel}>Interval</Text>
          <Text style={styles.timeoutValue}>
            {(interval / 1000).toFixed(0)}s
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.batteryModeBadge,
          {
            backgroundColor:
              BatteryTimeoutCalculator.getBatteryColor(batteryLevel) + '20',
          },
        ]}
      >
        <Icon
          name={
            batteryLevel > 50
              ? 'speed'
              : batteryLevel > 20
              ? 'balance'
              : 'battery-saver'
          }
          size={16}
          color={BatteryTimeoutCalculator.getBatteryColor(batteryLevel)}
        />
        <Text
          style={[
            styles.batteryModeText,
            { color: BatteryTimeoutCalculator.getBatteryColor(batteryLevel) },
          ]}
        >
          {batteryLevel > 50
            ? 'High Performance Mode'
            : batteryLevel > 20
            ? 'Balanced Mode'
            : 'Battery Saver Mode'}
        </Text>
      </View>
    </View>
  );
};

// ============================================================
// MAIN SCREEN COMPONENT
// ============================================================

interface ModelItem {
  label: string;
  value: string;
  originalIndex?: number;
}
interface ShippingData {
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

  // Battery state
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [fgTimeout, setFgTimeout] = useState<number>(15000);
  const [bgTimeout, setBgTimeout] = useState<number>(20000);
  const [pollingInterval, setPollingInterval] = useState<number>(10000);
  const [accuracyMode, setAccuracyMode] = useState<string>('high');

  // Form state
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
  const [shippingData, setShippingData] = useState<ShippingData | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);

  const vehicleCategories: ItemType<VehicleCategory>[] = [
    { label: 'Car', value: 'Car' },
    { label: 'Bike', value: 'Bike' },
    { label: 'Scooter', value: 'Scooter' },
    { label: 'Auto', value: 'Auto' },
    { label: 'Tempo', value: 'Tempo' },
  ];
  const identityTypes: ItemType<IdentityType>[] = [
    { label: 'Aadhaar Card', value: 'Aadhaar' },
    { label: 'Voter ID', value: 'VoterID' },
    { label: 'Passport', value: 'Passport' },
    { label: 'PAN Card', value: 'PAN' },
  ];

  const checkPermissionStatus = useCallback(async () => {
    const tracker = LocationTracker.getInstance();
    setHasLocationPermission(await tracker.checkRealPermissions());
  }, []);

  const loadVehicleBrands = useCallback((category: VehicleCategory) => {
    if (vehicleOptions[category]) {
      setAllBrands(
        Object.keys(vehicleOptions[category]).map(b => ({
          label: b,
          value: b,
        })),
      );
    } else {
      setAllBrands([]);
    }
    setVehicleBrand(null);
    setVehicleModel(null);
    setAllModels([]);
  }, []);

  const loadVehicleModels = useCallback(
    (category: VehicleCategory, brand: string) => {
      if (vehicleOptions[category]?.[brand]) {
        setAllModels(
          vehicleOptions[category][brand].map((m: string, i: number) => ({
            label: m,
            value: m,
            originalIndex: i,
          })),
        );
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

    const tracker = LocationTracker.getInstance();
    tracker.setBatteryUpdateCallback(info => {
      setBatteryLevel(info.level);
      setFgTimeout(info.fgTimeout);
      setBgTimeout(info.bgTimeout);
      setPollingInterval(info.interval);
      setAccuracyMode(info.accuracyMode);
    });

    return () => {
      isMounted.current = false;
      tracker.destroy();
    };
  }, []);

  const handleRequestPermissions = async () => {
    const granted = await requestLocationPermission();
    setHasLocationPermission(granted);
    Toast.show({
      type: granted ? 'success' : 'error',
      text1: granted ? 'Permission Granted' : 'Permission Required',
      text2: granted ? 'Location access enabled' : 'Location access is needed',
    });
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
    } catch (error) {}
    const success = await LocationTracker.getInstance().startTracking(
      riderId,
      authToken,
    );
    if (isMounted.current && success) setIsTrackingOn(true);
    return success;
  };

  const startLiveTracking = async (
    riderId: string,
    authToken: string,
  ): Promise<boolean> => {
    const tracker = LocationTracker.getInstance();
    if (!(await tracker.checkRealPermissions())) {
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
      Toast.show({
        type: 'success',
        text1: 'Location Tracking Started',
        text2: 'Continuous tracking active',
      });
      return true;
    }
    return false;
  };

  const stopLiveTracking = async (): Promise<boolean> => {
    await LocationTracker.getInstance().stopTracking();
    if (isMounted.current) setIsTrackingOn(false);
    return true;
  };

  useFocusEffect(
    useCallback(() => {
      fetchShippingData();
      checkPermissionStatus();
    }, []),
  );

  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch {
      return null;
    }
  };

  const fetchShippingData = async () => {
    if (!isMounted.current) return;
    try {
      setCheckingExisting(true);
      const token = await getAuthToken();
      if (!token) {
        setCheckingExisting(false);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/shipping/form/check`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.shippingData) {
          const reg = data.shippingData;
          setShippingId(reg._id);
          setShippingData(reg);
          setIsOnline(reg.isOnline || false);
          setLastOnlineAt(reg.lastOnlineAt || null);
          setLastOfflineAt(reg.lastOfflineAt || null);
          if (reg.kyc && isMounted.current) {
            setDrivingLicenseNumber(reg.kyc.drivingLicenseNumber || '');
            setIdentityType((reg.kyc.identityType as IdentityType) || null);
            setIdentityNumber(reg.kyc.identityNumber || '');
            if (reg.kyc.drivingLicenseImage)
              setDrivingLicenseImage(reg.kyc.drivingLicenseImage);
            if (reg.kyc.identityImage) setIdentityImage(reg.kyc.identityImage);
          }
          const approved = reg.status === 'approved';
          const kycVerified =
            reg.kyc?.status === 'verified' ||
            reg.kyc?.verified === true ||
            reg.kycVerified === true;
          if (approved && kycVerified && reg.isOnline) {
            await LocationTracker.getInstance().startTracking(reg._id, token);
            if (isMounted.current) setIsTrackingOn(true);
          }
        }
      } else if (res.status === 404) {
        if (isMounted.current) setShippingData(null);
      }
    } finally {
      if (isMounted.current) setCheckingExisting(false);
    }
  };

  const toggleOnlineStatusCore = async () => {
    if (!shippingData) {
      Toast.show({
        type: 'error',
        text1: 'No Registration',
        text2: 'Register first',
      });
      return;
    }
    const approved = shippingData.status === 'approved';
    const kycVerified =
      shippingData.kyc?.status === 'verified' ||
      shippingData.kyc?.verified === true ||
      shippingData.kycVerified === true;
    if (!approved || !kycVerified) {
      Toast.show({
        type: 'error',
        text1: 'Verification Pending',
        text2: 'Need approval & KYC verification',
      });
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      return;
    }
    if (isUpdatingOnlineStatus) return;
    setIsUpdatingOnlineStatus(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        navigation.navigate('Login');
        return;
      }
      const newStatus = !isOnline;
      setIsOnline(newStatus);
      const res = await fetch(`${API_BASE_URL}/api/shipper/online-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isOnline: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const now = new Date().toISOString();
        if (data.data) {
          setLastOnlineAt(data.data.lastOnlineAt || now);
          setLastOfflineAt(data.data.lastOfflineAt || now);
        } else {
          if (newStatus) setLastOnlineAt(now);
          else setLastOfflineAt(now);
        }
        ReactNativeHapticFeedback.trigger(
          newStatus ? 'notificationSuccess' : 'notificationWarning',
          hapticOptions,
        );
        if (newStatus) {
          await goOnlineWithLocation(shippingData._id, token);
          Toast.show({
            type: 'success',
            text1: 'You are now Online',
            text2: 'Location tracking enabled',
          });
        } else {
          await stopLiveTracking();
          Toast.show({
            type: 'info',
            text1: 'You are now Offline',
            text2: 'Tracking stopped',
          });
        }
      } else {
        setIsOnline(!newStatus);
        throw new Error(data.message || 'Failed to update');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.message,
      });
    } finally {
      if (isMounted.current) setIsUpdatingOnlineStatus(false);
    }
  };

  const toggleOnlineStatus = useDebounce(toggleOnlineStatusCore, 1500);

  const toggleLocationTrackingCore = async () => {
    if (!shippingData) {
      Toast.show({
        type: 'error',
        text1: 'No Registration',
        text2: 'Register first',
      });
      return;
    }
    if (!isOnline) {
      Toast.show({
        type: 'error',
        text1: 'Go Online First',
        text2: 'Need to be online',
      });
      return;
    }
    if (isUpdatingTrackingStatus) return;
    setIsUpdatingTrackingStatus(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        navigation.navigate('Login');
        return;
      }
      if (!isTrackingOn) {
        const success = await startLiveTracking(shippingData._id, token);
        if (success && isMounted.current) {
          ReactNativeHapticFeedback.trigger(
            'notificationSuccess',
            hapticOptions,
          );
          Toast.show({
            type: 'success',
            text1: 'Location Tracking ON',
            text2: 'Location being shared',
          });
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
            text2: 'Sharing stopped',
          });
        }
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.message,
      });
    } finally {
      if (isMounted.current) setIsUpdatingTrackingStatus(false);
    }
  };

  const toggleLocationTracking = useDebounce(toggleLocationTrackingCore, 2000);

  const formatDate = (d: string | null) => {
    if (!d) return 'Never';
    try {
      return new Date(d).toLocaleString('en-IN', {
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

  const pickImage = async (type: 'vehicle' | 'license' | 'identity') => {
    try {
      ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
      setUploadingImage(type);
      await requestStoragePermission();
      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
      });
      if (result.didCancel) {
        setUploadingImage(null);
        return;
      }
      if (result.errorCode) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: result.errorMessage || 'Failed',
        });
        setUploadingImage(null);
        return;
      }
      if (result.assets?.[0]?.base64) {
        const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        if (type === 'vehicle') setVehicleImage(base64);
        else if (type === 'license') setDrivingLicenseImage(base64);
        else setIdentityImage(base64);
        Toast.show({
          type: 'success',
          text1: 'Image Selected',
          text2: 'Uploaded',
        });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed' });
    } finally {
      setUploadingImage(null);
    }
  };

  const validateForm = (): boolean => {
    const checks: [boolean, string][] = [
      [!name.trim(), 'Enter name'],
      [!vehicleCategory, 'Select vehicle category'],
      [!vehicleBrand, 'Select brand'],
      [!vehicleModel, 'Select model'],
      [!vehicleNumber.trim(), 'Enter vehicle number'],
      [!vehicleImage, 'Upload vehicle image'],
      [!drivingLicenseNumber.trim(), 'Enter license number'],
      [!drivingLicenseImage, 'Upload license image'],
      [!!identityType && !identityNumber.trim(), 'Enter identity number'],
      [!!identityNumber && !identityImage, 'Upload identity image'],
      [!agreedToTerms, 'Agree to terms'],
    ];
    for (const [invalid, msg] of checks)
      if (invalid) {
        Toast.show({ type: 'error', text1: 'Required', text2: msg });
        return false;
      }
    return true;
  };

  const submitRegistration = async (formData: any) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Auth token missing');
    const res = await fetch(`${API_BASE_URL}/api/shipping/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 409) throw new Error('Already registered');
      if (res.status === 401) {
        await AsyncStorage.removeItem('authToken');
        throw new Error('Session expired');
      }
      throw new Error(err);
    }
    return await res.json();
  };

  const proceedWithRegistration = async () => {
    const formData = {
      name: name.trim(),
      vehicleCategory,
      vehicleBrand,
      vehicleModel,
      vehicleNumber: vehicleNumber.toUpperCase().replace(/\s/g, ''),
      vehicleImage: vehicleImage?.split(',')[1] || '',
      maxOrdersPerDay: parseInt(maxOrdersPerDay) || 25,
      kyc: {
        drivingLicenseNumber: drivingLicenseNumber.toUpperCase(),
        drivingLicenseImage: drivingLicenseImage?.split(',')[1] || '',
        identityType: identityType || null,
        identityNumber: identityNumber || null,
        identityImage: identityImage?.split(',')[1] || null,
      },
      agreedToTerms: true,
      agreedAt: new Date().toISOString(),
    };
    const res = await submitRegistration(formData);
    const newId = res.shipping?._id || res._id || res.id;
    if (!newId) throw new Error('No ID received');
    navigation.navigate('RegistrationSuccess', { shippingId: newId });
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      await proceedWithRegistration();
    } catch (error: any) {
      if (error.message.includes('already'))
        Alert.alert('Duplicate', error.message);
      else if (error.message.includes('expired')) {
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: 'Login again',
        });
        setTimeout(() => navigation.navigate('Login'), 1500);
      } else
        Toast.show({ type: 'error', text1: 'Failed', text2: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleViewStatus = () => {
    if (shippingId) navigation.navigate('RegistrationSuccess', { shippingId });
  };
  const handleNewRegistration = () => {
    setShippingData(null);
    setShippingId(null);
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
    setIsOnline(false);
    setIsTrackingOn(false);
    setLastOnlineAt(null);
    setLastOfflineAt(null);
  };

  if (checkingExisting) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.checkingText}>Checking registration status...</Text>
      </SafeAreaView>
    );
  }

  if (shippingData) {
    const isApproved = shippingData.status === 'approved';
    const isKycVerified =
      shippingData.kyc?.status === 'verified' ||
      shippingData.kyc?.verified === true ||
      shippingData.kycVerified === true;
    const showSwiper = isApproved && isKycVerified;

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Header */}
          <View style={styles.statusHeader}>
            <View style={styles.statusHeaderIcon}>
              <Icon
                name={showSwiper ? 'verified' : 'pending'}
                size={28}
                color="#FFF"
              />
            </View>
            <View>
              <Text style={styles.statusHeaderTitle}>
                Delivery Partner Dashboard
              </Text>
              <Text style={styles.statusHeaderSub}>
                {showSwiper ? 'Account activated' : 'Complete verification'}
              </Text>
            </View>
          </View>

          {/* Battery Info Card */}
          <BatteryInfoCard
            batteryLevel={batteryLevel}
            fgTimeout={fgTimeout}
            bgTimeout={bgTimeout}
            interval={pollingInterval}
            accuracyMode={accuracyMode}
          />

          <View style={styles.statusCard}>
            <View style={styles.profileSection}>
              <Icon name="person" size={24} color="#4F46E5" />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{shippingData.name}</Text>
                <Text style={styles.profileVehicle}>
                  {shippingData.vehicleBrand} • {shippingData.vehicleModel}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  shippingData.status === 'approved'
                    ? styles.statusApproved
                    : shippingData.status === 'pending'
                    ? styles.statusPending
                    : styles.statusDeclined,
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {shippingData.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {shippingData.kyc && (
              <View style={styles.kycCard}>
                <View style={styles.kycHeader}>
                  <Icon
                    name={isKycVerified ? 'verified-user' : 'pending-actions'}
                    size={22}
                    color={isKycVerified ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={styles.kycTitle}>KYC Status</Text>
                  <View
                    style={[
                      styles.kycStatusBadge,
                      isKycVerified
                        ? styles.kycStatusVerified
                        : styles.kycStatusPending,
                    ]}
                  >
                    <Text style={styles.kycStatusText}>
                      {isKycVerified ? 'VERIFIED' : 'PENDING'}
                    </Text>
                  </View>
                </View>
                <View style={styles.kycDetails}>
                  <View style={styles.kycDetailRow}>
                    <Text style={styles.kycDetailLabel}>Driving License:</Text>
                    <Text style={styles.kycDetailValue}>
                      {shippingData.kyc.drivingLicenseNumber}
                    </Text>
                  </View>
                  {shippingData.kyc.identityType && (
                    <View style={styles.kycDetailRow}>
                      <Text style={styles.kycDetailLabel}>ID Type:</Text>
                      <Text style={styles.kycDetailValue}>
                        {shippingData.kyc.identityType}
                      </Text>
                    </View>
                  )}
                  {shippingData.kyc.identityNumber && (
                    <View style={styles.kycDetailRow}>
                      <Text style={styles.kycDetailLabel}>ID Number:</Text>
                      <Text style={styles.kycDetailValue}>
                        {shippingData.kyc.identityNumber}
                      </Text>
                    </View>
                  )}
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
                  To track deliveries, we need location access.
                </Text>
                <TouchableOpacity
                  style={styles.permissionWarningButton}
                  onPress={handleRequestPermissions}
                >
                  <Text style={styles.permissionWarningButtonText}>
                    Grant Location Access
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {hasLocationPermission && (
              <View style={styles.permissionGrantedCard}>
                <Icon name="location-on" size={24} color="#10B981" />
                <Text style={styles.permissionGrantedText}>
                  ✓ Location access granted
                </Text>
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
                        ? 'Online & ready to accept orders'
                        : 'Offline - will not receive orders'}
                    </Text>
                    <View style={styles.swiperContainer}>
                      <Text style={styles.swiperLabel}>
                        Go {isOnline ? 'Offline' : 'Online'}
                      </Text>
                      <Switch
                        value={isOnline}
                        onValueChange={toggleOnlineStatus}
                        disabled={isUpdatingOnlineStatus}
                        trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                        thumbColor="#FFF"
                      />
                    </View>
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
                          ? 'Tracking continuously (even when screen locked)'
                          : 'Tracking turned off'}
                      </Text>
                      <View style={styles.swiperContainer}>
                        <Text style={styles.swiperLabel}>
                          {isTrackingOn ? 'Stop Tracking' : 'Start Tracking'}
                        </Text>
                        <Switch
                          value={isTrackingOn}
                          onValueChange={toggleLocationTracking}
                          disabled={isUpdatingTrackingStatus || !isOnline}
                          trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                          thumbColor="#FFF"
                        />
                      </View>
                      {isTrackingOn && (
                        <View style={styles.lastStatusContainer}>
                          <Icon name="info" size={16} color="#3B82F6" />
                          <Text
                            style={[
                              styles.lastStatusText,
                              { color: '#3B82F6' },
                            ]}
                          >
                            Tracking works in background & lock screen
                          </Text>
                        </View>
                      )}
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
                    ? 'Registration Pending'
                    : 'KYC Verification Pending'}
                </Text>
                <Text style={styles.verificationText}>
                  {!isApproved ? 'Under review' : 'KYC verification pending'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.viewStatusButton}
              onPress={handleViewStatus}
            >
              <View style={styles.buttonIconContainer}>
                <Icon name="visibility" size={22} color="#FFF" />
              </View>
              <Text style={styles.viewStatusButtonText}>View Status</Text>
              <Icon name="chevron-right" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.newRegistrationButton}
              onPress={handleNewRegistration}
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

  // Registration Form
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.formContainer}
        >
          <Animated.View
            style={[
              styles.header,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerIconContainer}>
                <Icon name="directions-bike" size={28} color="#FFF" />
              </View>
              <View>
                <Text style={styles.title}>Become a Delivery Partner</Text>
                <Text style={styles.subtitle}>Register your vehicle</Text>
              </View>
            </View>
          </Animated.View>

          <View style={styles.checkInfoCard}>
            <Icon name="verified-user" size={20} color="#3b82f6" />
            <View style={styles.checkInfoContent}>
              <Text style={styles.checkInfoTitle}>New Registration</Text>
              <Text style={styles.checkInfoText}>Fill details to register</Text>
            </View>
          </View>

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
                  placeholder="Enter full name"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                  maxLength={100}
                />
              </View>
            </View>
          </Animated.View>

          <View style={styles.sectionHeader}>
            <Icon
              name="verified-user"
              size={20}
              color="#2563EB"
              style={styles.sectionIcon}
            />
            <Text style={styles.sectionHeaderText}>KYC Documents</Text>
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
                  placeholder="License number"
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
              >
                {uploadingImage === 'license' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon
                      name={drivingLicenseImage ? 'check-circle' : 'badge'}
                      size={22}
                      color="#fff"
                      style={styles.uploadIcon}
                    />
                    <Text style={styles.uploadText}>
                      {drivingLicenseImage ? 'Uploaded ✓' : 'Upload License'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Identity Document Type</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownButton,
                  identityType && styles.dropdownButtonSelected,
                ]}
                onPress={() => setShowIdentityModal(true)}
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
                  >
                    {uploadingImage === 'identity' ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Icon
                          name={identityImage ? 'check-circle' : 'description'}
                          size={22}
                          color="#fff"
                          style={styles.uploadIcon}
                        />
                        <Text style={styles.uploadText}>
                          {identityImage
                            ? 'Uploaded ✓'
                            : `Upload ${identityType}`}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>

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
                    {vehicleCategory || 'Select type'}
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
                      {vehicleBrand || 'Select brand'}
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
                      {vehicleModel || 'Select model'}
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
              >
                {uploadingImage === 'vehicle' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon
                      name={vehicleImage ? 'check-circle' : 'add-a-photo'}
                      size={22}
                      color="#fff"
                      style={styles.uploadIcon}
                    />
                    <Text style={styles.uploadText}>
                      {vehicleImage ? 'Uploaded ✓' : 'Upload Vehicle'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

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
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => {
                ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
                setAgreedToTerms(!agreedToTerms);
              }}
            >
              <View
                style={[
                  styles.checkbox,
                  agreedToTerms && styles.checkboxChecked,
                ]}
              >
                {agreedToTerms && <Icon name="check" size={16} color="#fff" />}
              </View>
              <View>
                <Text style={styles.checkboxText}>I agree to the terms</Text>
                <Text style={styles.checkboxSubtext}>Required to proceed</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!agreedToTerms || loading) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!agreedToTerms || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <View style={styles.buttonIconContainer}>
                  <Icon name="send" size={22} color="#fff" />
                </View>
                <View>
                  <Text style={styles.submitButtonText}>
                    Submit Registration
                  </Text>
                  <Text style={styles.submitButtonSubtext}>
                    Reviewed within 24 hours
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
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
              <View>
                <Text style={styles.modalTitle}>Select Category</Text>
                <Text style={styles.modalSubtitle}>Choose vehicle type</Text>
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
              <View>
                <Text style={styles.modalTitle}>Select Brand</Text>
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
              <View>
                <Text style={styles.modalTitle}>Select Model</Text>
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
              <View>
                <Text style={styles.modalTitle}>Select Identity</Text>
                <Text style={styles.modalSubtitle}>Choose document type</Text>
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

  // Battery Card Styles
  batteryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
  },
  batteryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  batteryCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  batteryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  batteryStatItem: { alignItems: 'center' },
  batteryStatValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  batteryStatLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  batteryProgressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  batteryProgressFill: { height: '100%', borderRadius: 3 },
  timeoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  timeoutItem: { alignItems: 'center' },
  timeoutLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  timeoutValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 2,
  },
  batteryModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  batteryModeText: { fontSize: 12, fontWeight: '500', marginLeft: 6 },

  // Status Card Styles
  statusHeader: {
    backgroundColor: '#4F46E5',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
  },
  statusHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  statusHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  statusHeaderSub: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  profileName: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  profileVehicle: { fontSize: 14, color: '#6B7280' },
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
  kycStatusText: { fontSize: 12, fontWeight: '700' },
  kycDetails: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  kycDetailRow: { flexDirection: 'row', marginBottom: 8 },
  kycDetailLabel: { fontSize: 13, color: '#6B7280', width: 120 },
  kycDetailValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
  },
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
  permissionGrantedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 12,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
  },
  permissionGrantedText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '600',
    marginLeft: 8,
  },
  verificationCard: {
    padding: 24,
    margin: 20,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
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
  verificationText: { fontSize: 14, color: '#92400E', textAlign: 'center' },
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
  swiperStatusText: { fontSize: 12, fontWeight: '700' },
  swiperStatusOnline: { color: '#10B981' },
  swiperStatusOffline: { color: '#6B7280' },
  swiperStatusTracking: { color: '#3B82F6' },
  swiperStatusNotTracking: { color: '#6B7280' },
  swiperBody: { marginTop: 4 },
  swiperDescription: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  swiperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  swiperLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
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
  },
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

  // Form Styles
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
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
  sectionHeaderText: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  checkInfoText: { fontSize: 12, color: '#0c4a6e' },
  inputContainer: { marginBottom: 20 },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
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
  dropdownButtonText: { flex: 1, fontSize: 15, marginLeft: 12 },
  dropdownButtonTextSelected: { color: '#111827', fontWeight: '500' },
  dropdownButtonTextPlaceholder: { color: '#9CA3AF' },
  uploadButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  uploadButtonSuccess: { backgroundColor: '#10B981' },
  uploadIcon: { marginRight: 12 },
  uploadText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  termsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    elevation: 3,
  },
  termsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  termsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 12,
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
  checkboxText: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  checkboxSubtext: { fontSize: 12, color: '#6B7280' },
  submitButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 18,
    borderRadius: 14,
    marginBottom: 16,
    elevation: 6,
  },
  submitButtonDisabled: { backgroundColor: '#A5B4FC', opacity: 0.7 },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  submitButtonSubtext: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    textAlign: 'center',
  },

  // Modal Styles
  modalSafeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalBackButton: { padding: 4, marginRight: 12 },
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
