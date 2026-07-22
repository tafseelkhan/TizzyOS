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
  ScrollView,
  Modal,
  Alert,
  Switch,
  PermissionsAndroid,
  AppState,
  AppStateStatus,
  LogBox,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Fontisto from 'react-native-vector-icons/Fontisto';
import FWSOnboardingScreen from '../FWSOnboardingScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import DeviceInfo from 'react-native-device-info';
import { vehicleOptions } from './vehicleCategory';
import GetLocation from 'react-native-get-location';
import BackgroundService from 'react-native-background-actions';

const { width } = Dimensions.get('window');
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
type ShippingType = 'TRUCK' | 'RIDER';

const API_BASE_URL = 'http://172.20.245.121:5000';

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
    if (isBackground) return Math.floor(5000 + 15000 * (battery / 100));
    else return Math.floor(3000 + 9000 * (battery / 100));
  }

  static getAccuracyMode(batteryLevel: number): 'high' | 'balanced' | 'low' {
    if (batteryLevel > 50) return 'high';
    if (batteryLevel > 20) return 'balanced';
    return 'low';
  }

  static getBatteryIconName(batteryLevel: number): string {
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
  log: (tag: string, message: string, data?: any) =>
    console.log(
      `${tag} [${new Date().toLocaleTimeString()}] ${message}`,
      data ? data : '',
    ),
  logForeground: (message: string, data?: any) =>
    Logger.log(Logger.FOREGROUND, message, data),
  logBackground: (message: string, data?: any) =>
    Logger.log(Logger.BACKGROUND, message, data),
  logGPS: (message: string, coords?: any) => {
    if (coords?.lat)
      Logger.log(
        Logger.GPS,
        `${message} | Lat:${coords.lat.toFixed(6)} Lng:${coords.lng.toFixed(
          6,
        )} Acc:${(coords.acc || 0).toFixed(1)}m`,
      );
    else Logger.log(Logger.GPS, message);
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
// LOCATION TRACKER - FIXED TO MATCH BACKEND
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
  private shippingId: string | null = null;
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
    if (callback && this.batteryLevel) callback(this.getBatteryInfo());
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
    const { delay, shippingId, authToken } = taskData;
    if (shippingId && authToken) {
      this.shippingId = shippingId;
      this.authToken = authToken;
    }
    let bgPollCount = 0;

    console.log('🔵 BACKGROUND TASK STARTED 🔵');
    console.log(`🔵 Shipping ID: ${this.shippingId}`);
    console.log(`🔵 Delay: ${delay}ms`);

    while (BackgroundService.isRunning()) {
      if (!this.isTracking) {
        console.log('🔵 Tracking is off, waiting...');
        await this.sleep(delay);
        continue;
      }
      bgPollCount++;
      console.log(
        `🔵 BACKGROUND POLL #${bgPollCount} at ${new Date().toISOString()}`,
      );

      try {
        const location = await this.getCurrentLocationWithRetry(true);
        if (location) {
          location.isBackground = true;
          console.log(
            `🔵📍 BACKGROUND LOCATION: ${location.latitude}, ${location.longitude}`,
          );
          console.log(`🔵📍 Accuracy: ${location.accuracy}m`);

          await this.sendLocationToBackend(
            location.latitude,
            location.longitude,
            location.accuracy,
            true,
          );
        } else {
          console.log('🔵❌ Failed to get background location');
        }
      } catch (error) {
        console.log('🔵❌ Background location error:', error);
      }
      await this.sleep(delay);
    }
    console.log('🔵 BACKGROUND TASK ENDED 🔵');
    return;
  };

  private sleep = (ms: number) =>
    new Promise(resolve => setTimeout(() => resolve(undefined), ms));

  async startBackgroundTask(): Promise<boolean> {
    if (this.isBackgroundTaskRunning) {
      console.log('🔵 Background task already running');
      return true;
    }
    if (!this.shippingId || !this.authToken) {
      console.log(
        '🔵 Cannot start background task: missing shippingId or authToken',
      );
      return false;
    }

    const interval = BatteryTimeoutCalculator.getPollingInterval(
      this.batteryLevel,
      true,
    );
    console.log(`🔵 Starting background task with interval: ${interval}ms`);

    const options = {
      taskName: 'RiderLocationTracking',
      taskTitle: 'TizzyGo',
      taskDesc: `Tracking | Battery:${this.batteryLevel.toFixed(0)}%`,
      taskIcon: { name: 'ic_launcher', type: 'mipmap' },
      color: '#2563EB',
      linkingURI: 'yourapp://home',
      parameters: {
        delay: interval,
        shippingId: this.shippingId,
        authToken: this.authToken,
      },
    };
    try {
      await BackgroundService.start(this.backgroundTask, options);
      this.isBackgroundTaskRunning = true;
      console.log('🔵 Background task started successfully');
      return true;
    } catch (error) {
      console.log('🔵 Failed to start background task:', error);
      return false;
    }
  }

  async stopBackgroundTask(): Promise<boolean> {
    if (!this.isBackgroundTaskRunning) return true;
    try {
      await BackgroundService.stop();
      this.isBackgroundTaskRunning = false;
      console.log('🔵 Background task stopped');
      return true;
    } catch (error) {
      console.log('🔵 Failed to stop background task:', error);
      return false;
    }
  }

  private async getCurrentLocationWithRetry(
    isBackground: boolean = false,
  ): Promise<LocationData | null> {
    const mode = isBackground ? 'BACKGROUND' : 'FOREGROUND';
    if (this.isLocationRequestInProgress) {
      console.log(`${mode} request in progress, skipping`);
      return null;
    }

    const now = Date.now();
    if (now - this.lastRequestTime < this.MIN_REQUEST_INTERVAL) {
      console.log(`${mode} rate limited, waiting...`);
      await this.sleep(
        this.MIN_REQUEST_INTERVAL - (now - this.lastRequestTime),
      );
    }

    this.isLocationRequestInProgress = true;
    this.lastRequestTime = Date.now();

    let attempt = 0;
    const maxRetries = 2;
    try {
      while (attempt <= maxRetries) {
        try {
          const startTime = Date.now();
          console.log(`${mode} getting location (attempt ${attempt + 1})...`);
          const location = await this.getCurrentLocationPromise(isBackground);
          const elapsed = Date.now() - startTime;

          if (location && this.isValidLocation(location)) {
            console.log(`${mode} location obtained in ${elapsed}ms`);
            return location;
          } else {
            console.log(`${mode} invalid location received`);
          }
        } catch (error: any) {
          console.log(`${mode} attempt ${attempt + 1} failed:`, error?.message);
        }
        attempt++;
        if (attempt <= maxRetries) {
          console.log(`${mode} retrying in 2 seconds...`);
          await this.sleep(2000);
        }
      }
      console.log(`${mode} all attempts failed`);
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
          console.log(`${mode} location timeout after ${timeoutMs}ms`);
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

      console.log(`${mode} requesting location with options:`, options);

      try {
        GetLocation.getCurrentPosition(options)
          .then((loc: any) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              console.log(`${mode} location received:`, {
                lat: loc.latitude,
                lng: loc.longitude,
                acc: loc.accuracy,
              });
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
              console.log(`${mode} location error:`, err?.message);
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
      console.log(`🔐 Permissions - Fine: ${fine}, Background: ${bg}`);
      return fine && bg;
    } catch (error) {
      console.log('🔐 Permission check error:', error);
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
    } catch (error) {
      console.log('🔐 Permission request error:', error);
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

  async startTracking(shippingId: string, authToken: string): Promise<boolean> {
    console.log('🎯 START TRACKING CALLED 🎯');
    console.log(`🎯 Shipping ID: ${shippingId}`);
    console.log(`🎯 Has Auth Token: ${!!authToken}`);

    if (!(await this.checkRealPermissions())) {
      console.log('🎯 Permission check failed');
      return false;
    }
    if (this.isStarting || this.isTracking) {
      console.log(
        `🎯 Already tracking or starting - isStarting: ${this.isStarting}, isTracking: ${this.isTracking}`,
      );
      return false;
    }

    this.isStarting = true;
    try {
      this.stopPollingLoop();
      this.isTracking = true;
      this.shippingId = shippingId;
      this.authToken = authToken;
      this.pollCount = this.successCount = this.failCount = 0;

      console.log('🎯 Tracking started successfully');
      console.log(`🎯 Shipping ID set: ${this.shippingId}`);

      await this.updateBatteryLevel();
      this.startPollingLoop();
      await this.startBackgroundTask();

      console.log('🎯 FOREGROUND TRACKING ACTIVE 🎯');
      return true;
    } catch (error) {
      console.log('🎯 Error starting tracking:', error);
      return false;
    } finally {
      this.isStarting = false;
    }
  }

  async stopTracking(): Promise<void> {
    console.log('🛑 STOP TRACKING CALLED 🛑');
    if (this.isStopping) return;
    this.isStopping = true;
    try {
      this.isTracking = false;
      this.stopPollingLoop();
      await this.stopBackgroundTask();
      this.shippingId = null;
      this.authToken = null;
      this.lastLocation = null;
      console.log('🛑 Tracking stopped successfully');
    } finally {
      this.isStopping = false;
    }
  }

  private onAppStateChange(nextState: AppStateStatus) {
    console.log(`📱 App state changed to: ${nextState}`);
    this.appState = nextState;
    this.backgroundMode = nextState === 'background';

    if (nextState === 'active') {
      console.log('🟢 App in FOREGROUND - Active tracking');
    } else {
      console.log('🔵 App in BACKGROUND - Background tracking active');
    }

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

    const mode = this.backgroundMode ? 'BACKGROUND' : 'FOREGROUND';
    console.log(
      `🔄 Starting ${mode} polling loop with interval: ${interval}ms`,
    );

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
      console.log('🔄 Polling loop stopped');
    }
  }

  private async executeLocationPoll() {
    if (!this.isTracking || this.isPollingInProgress) return;
    this.pollCount++;
    this.isPollingInProgress = true;

    const mode = this.backgroundMode ? 'BACKGROUND' : 'FOREGROUND';
    console.log(
      `📍 ${mode} POLL #${this.pollCount} at ${new Date().toISOString()}`,
    );

    try {
      const location = await this.getCurrentLocationWithRetry(false);
      if (location) {
        this.successCount++;
        console.log(
          `✅ ${mode} location successful - Total success: ${this.successCount}`,
        );
        await this.handleLocationUpdate(location);
      } else {
        this.failCount++;
        console.log(
          `❌ ${mode} location failed - Total fails: ${this.failCount}`,
        );
      }
    } catch (error) {
      console.log(`❌ ${mode} location error:`, error);
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
        if (newInterval !== this.currentIntervalMs) {
          console.log(
            `🔋 Battery level changed to ${this.batteryLevel}%, updating interval to ${newInterval}ms`,
          );
          this.restartPollingWithNewInterval();
        }
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
    if (!this.isTracking || !this.shippingId || !this.authToken) {
      console.log('⚠️ Cannot handle location update - missing data');
      return;
    }

    const { latitude, longitude, accuracy } = location;
    if (latitude === 0 && longitude === 0) {
      console.log('⚠️ Invalid location (0,0), skipping');
      return;
    }

    if (this.lastLocation) {
      const distance = Math.hypot(
        (latitude - this.lastLocation.latitude) * 111000,
        (longitude - this.lastLocation.longitude) * 111000,
      );
      if (
        distance < 10 &&
        Math.abs(accuracy - this.lastLocation.accuracy) < 5
      ) {
        console.log(
          `📍 Location change < 10m (${distance.toFixed(1)}m), skipping update`,
        );
        return;
      }
      console.log(`📍 Location changed by ${distance.toFixed(1)}m`);
    }

    this.lastLocation = {
      latitude,
      longitude,
      accuracy,
      timestamp: Date.now(),
    };

    const mode = this.backgroundMode ? 'BACKGROUND' : 'FOREGROUND';
    console.log(
      `📤 Sending ${mode} location to backend: ${latitude}, ${longitude}`,
    );

    await this.sendLocationToBackend(latitude, longitude, accuracy, false);
  }

  private async sendLocationToBackend(
    lat: number,
    lng: number,
    acc: number,
    isBg: boolean = false,
  ) {
    if (!this.shippingId || !this.authToken) {
      console.log('⚠️ Cannot send location - missing shippingId or authToken');
      return;
    }

    const mode = isBg ? 'BACKGROUND' : 'FOREGROUND';
    console.log(`🌐 Sending ${mode} location to API...`);
    console.log(`🌐 URL: ${API_BASE_URL}/api/v0/track/rider/location`);
    console.log(`🌐 Payload:`, {
      shippingId: this.shippingId,
      action: 'update',
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      timestamp: new Date().toISOString(),
      updateType: 'tracking',
      batteryLevel: this.batteryLevel,
      isBackground: isBg,
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/v0/track/rider/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          shippingId: this.shippingId,
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

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`✅ ${mode} location sent successfully!`);
        console.log(`✅ Response:`, data);
      } else {
        console.log(`❌ ${mode} location send failed:`, data);
      }
    } catch (error) {
      console.log(`❌ ${mode} location network error:`, error);
    }
  }

  destroy() {
    console.log('🗑️ Destroying LocationTracker');
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
// FULL SCREEN LOADER COMPONENT
// ============================================================
const FullScreenLoader: React.FC<{ visible: boolean; message?: string }> = ({
  visible,
  message = 'Submitting your application...',
}) => {
  if (!visible) return null;

  return (
    <View style={styles.fullScreenLoader}>
      <View style={styles.loaderCard}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loaderTitle}>Please Wait</Text>
        <Text style={styles.loaderMessage}>{message}</Text>
        <View style={styles.loaderDots}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
    </View>
  );
};

// ============================================================
// UI COMPONENTS - PURE BLUE THEME
// ============================================================

const FormCard: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <View style={styles.formCard}>
    <View style={styles.formCardHeader}>
      <Icon name={icon} size={22} color="#2563EB" />
      <Text style={styles.formCardTitle}>{title}</Text>
    </View>
    <View style={styles.formCardContent}>{children}</View>
  </View>
);

const InputField: React.FC<{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  icon: string;
  required?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
}> = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  required = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  maxLength,
}) => (
  <View style={styles.inputFieldContainer}>
    <View style={styles.inputLabelRow}>
      <Text style={styles.inputLabelText}>{label}</Text>
      {required && <Text style={styles.requiredStar}>*</Text>}
    </View>
    <View style={styles.inputFieldWrapper}>
      <Icon
        name={icon}
        size={20}
        color="#2563EB"
        style={styles.inputFieldIcon}
      />
      <TextInput
        style={styles.inputField}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
    </View>
  </View>
);

const SelectField: React.FC<{
  label: string;
  value: string | null;
  onPress: () => void;
  placeholder: string;
  icon: string;
  required?: boolean;
}> = ({ label, value, onPress, placeholder, icon, required = false }) => (
  <View style={styles.inputFieldContainer}>
    <View style={styles.inputLabelRow}>
      <Text style={styles.inputLabelText}>{label}</Text>
      {required && <Text style={styles.requiredStar}>*</Text>}
    </View>
    <TouchableOpacity style={styles.selectField} onPress={onPress}>
      <Icon
        name={value ? 'check-circle' : icon}
        size={20}
        color={value ? '#10B981' : '#2563EB'}
        style={styles.selectFieldIcon}
      />
      <Text
        style={[
          styles.selectFieldText,
          !value && styles.selectFieldPlaceholder,
        ]}
      >
        {value || placeholder}
      </Text>
      <Icon name="keyboard-arrow-down" size={22} color="#2563EB" />
    </TouchableOpacity>
  </View>
);

const UploadField: React.FC<{
  label: string;
  imageUri: string | null;
  onPress: () => void;
  uploading: boolean;
  required?: boolean;
}> = ({ label, imageUri, onPress, uploading, required = false }) => (
  <View style={styles.inputFieldContainer}>
    <View style={styles.inputLabelRow}>
      <Text style={styles.inputLabelText}>{label}</Text>
      {required && <Text style={styles.requiredStar}>*</Text>}
    </View>
    <TouchableOpacity
      style={[styles.uploadField, imageUri && styles.uploadFieldSuccess]}
      onPress={onPress}
      disabled={uploading}
    >
      {uploading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <>
          <Icon
            name={imageUri ? 'check-circle' : 'cloud-upload'}
            size={22}
            color="#FFFFFF"
          />
          <Text style={styles.uploadFieldText}>
            {imageUri ? 'Uploaded Successfully' : `Upload ${label}`}
          </Text>
        </>
      )}
    </TouchableOpacity>
  </View>
);

const BatteryInfoCard: React.FC<{
  batteryLevel: number;
  fgTimeout: number;
  bgTimeout: number;
  interval: number;
  accuracyMode: string;
}> = ({ batteryLevel, fgTimeout, bgTimeout, interval, accuracyMode }) => (
  <View style={styles.batteryCard}>
    <View style={styles.batteryCardHeader}>
      <Icon name="battery-charging-full" size={22} color="#2563EB" />
      <Text style={styles.batteryCardTitle}>Battery & Performance</Text>
    </View>
    <View style={styles.batteryStatsRow}>
      <View style={styles.batteryStatItem}>
        <Fontisto
          name={BatteryTimeoutCalculator.getBatteryIconName(batteryLevel)}
          size={32}
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
        <Text style={styles.batteryStatLabel}>Battery</Text>
      </View>
      <View style={styles.batteryStatItem}>
        <Icon
          name={BatteryTimeoutCalculator.getAccuracyIconName(accuracyMode)}
          size={32}
          color={BatteryTimeoutCalculator.getAccuracyColor(accuracyMode)}
        />
        <Text
          style={[
            styles.batteryStatValue,
            { color: BatteryTimeoutCalculator.getAccuracyColor(accuracyMode) },
          ]}
        >
          {accuracyMode.toUpperCase()}
        </Text>
        <Text style={styles.batteryStatLabel}>Accuracy</Text>
      </View>
      <View style={styles.batteryStatItem}>
        <Icon name="speed" size={32} color="#2563EB" />
        <Text style={[styles.batteryStatValue, { color: '#2563EB' }]}>
          {Math.round(interval / 1000)}s
        </Text>
        <Text style={styles.batteryStatLabel}>Interval</Text>
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
  </View>
);

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
  shippingType?: string;
  city?: string;
  state?: string;
  vehicleCategory?: string;
  vehicleNumber?: string;
  maxOrdersPerDay?: number;
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
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [fgTimeout, setFgTimeout] = useState<number>(15000);
  const [bgTimeout, setBgTimeout] = useState<number>(20000);
  const [pollingInterval, setPollingInterval] = useState<number>(10000);
  const [accuracyMode, setAccuracyMode] = useState<string>('high');

  const [shippingType, setShippingType] = useState<ShippingType | null>(null);
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
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
  const [showShippingTypeModal, setShowShippingTypeModal] =
    useState<boolean>(false);
  const [allModels, setAllModels] = useState<ModelItem[]>([]);
  const [allBrands, setAllBrands] = useState<ItemType<string>[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>(
    'Submitting your application...',
  );
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState<boolean>(true);
  const [shippingData, setShippingData] = useState<ShippingData | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

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
  const shippingTypes: ItemType<ShippingType>[] = [
    { label: 'Truck / Heavy Vehicle', value: 'TRUCK' },
    { label: 'Rider / Bike / Scooter', value: 'RIDER' },
  ];

  const checkPermissionStatus = useCallback(async () => {
    const tracker = LocationTracker.getInstance();
    const hasPermission = await tracker.checkRealPermissions();
    setHasLocationPermission(hasPermission);
    console.log(`🔐 Permission status: ${hasPermission}`);
  }, []);

  const loadVehicleBrands = useCallback((category: VehicleCategory) => {
    if (vehicleOptions[category])
      setAllBrands(
        Object.keys(vehicleOptions[category]).map(b => ({
          label: b,
          value: b,
        })),
      );
    else setAllBrands([]);
    setVehicleBrand(null);
    setVehicleModel(null);
    setAllModels([]);
  }, []);

  const loadVehicleModels = useCallback(
    (category: VehicleCategory, brand: string) => {
      if (vehicleOptions[category]?.[brand])
        setAllModels(
          vehicleOptions[category][brand].map((m: string, i: number) => ({
            label: m,
            value: m,
            originalIndex: i,
          })),
        );
      else setAllModels([]);
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
    console.log('🔐 Requesting location permissions...');
    const granted = await requestLocationPermission();
    setHasLocationPermission(granted);
    console.log(`🔐 Permission granted: ${granted}`);
    Toast.show({
      type: granted ? 'success' : 'error',
      text1: granted ? 'Permission Granted' : 'Permission Required',
      text2: granted ? 'Location access enabled' : 'Location access is needed',
    });
  };

  const goOnlineWithLocation = async (
    shippingId: string,
    authToken: string,
  ): Promise<boolean> => {
    console.log('🟢 GOING ONLINE WITH LOCATION 🟢');
    console.log(`🟢 Shipping ID: ${shippingId}`);

    try {
      console.log('📍 Getting initial location...');
      const { lat, lng } = await getLocationOnce();
      console.log(`📍 Initial location: ${lat}, ${lng}`);

      console.log('🌐 Sending start action to backend...');
      await fetch(`${API_BASE_URL}/api/v0/track/rider/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          shippingId: shippingId,
          action: 'start',
          latitude: lat,
          longitude: lng,
        }),
      });
      console.log('✅ Start action sent successfully');
    } catch (error) {
      console.log('⚠️ Error sending start action:', error);
    }

    console.log('🎯 Starting continuous tracking...');
    const success = await LocationTracker.getInstance().startTracking(
      shippingId,
      authToken,
    );

    if (isMounted.current && success) {
      setIsTrackingOn(true);
      console.log('✅ Tracking started successfully');
    } else {
      console.log('❌ Failed to start tracking');
    }
    return success;
  };

  const startLiveTracking = async (
    shippingId: string,
    authToken: string,
  ): Promise<boolean> => {
    console.log('📍 START LIVE TRACKING 📍');
    console.log(`📍 Shipping ID: ${shippingId}`);

    const tracker = LocationTracker.getInstance();
    if (!(await tracker.checkRealPermissions())) {
      console.log('❌ No location permission');
      Toast.show({
        type: 'error',
        text1: 'Permission Required',
        text2: 'Please grant location permission first',
      });
      return false;
    }

    const success = await tracker.startTracking(shippingId, authToken);
    if (success && isMounted.current) {
      setIsTrackingOn(true);
      console.log('✅ Live tracking started');
      Toast.show({
        type: 'success',
        text1: 'Location Tracking Started',
        text2: 'Continuous tracking active',
      });
      return true;
    }
    console.log('❌ Failed to start live tracking');
    return false;
  };

  const stopLiveTracking = async (): Promise<boolean> => {
    console.log('📍 STOP LIVE TRACKING 📍');
    await LocationTracker.getInstance().stopTracking();
    if (isMounted.current) {
      setIsTrackingOn(false);
      console.log('✅ Live tracking stopped');
    }
    return true;
  };

  useFocusEffect(
    useCallback(() => {
      console.log('📱 Screen focused - fetching shipping data');
      fetchShippingData();
      checkPermissionStatus();
    }, []),
  );

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      console.log(`🔑 Auth token present: ${!!token}`);
      return token;
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
        console.log('No auth token found');
        setCheckingExisting(false);
        setShowOnboarding(true);
        return;
      }

      console.log('Fetching shipping data from backend...');
      const res = await fetch(`${API_BASE_URL}/api/v0/shipping/form/check`, {
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
          console.log(`✅ Shipping data found: ${reg._id}`);
          setShippingId(reg._id);
          setShippingData(reg);
          setIsOnline(reg.isOnline || false);
          setLastOnlineAt(reg.lastOnlineAt || null);
          setLastOfflineAt(reg.lastOfflineAt || null);
          setShowOnboarding(false);

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
            console.log('🔄 Restarting tracking for existing online session');
            await LocationTracker.getInstance().startTracking(reg._id, token);
            if (isMounted.current) setIsTrackingOn(true);
          }
        } else {
          console.log('No shipping data found');
          setShowOnboarding(true);
        }
      } else if (res.status === 404) {
        console.log('No shipping registration found (404)');
        if (isMounted.current) {
          setShippingData(null);
          setShowOnboarding(true);
        }
      }
    } catch (error) {
      console.log('Error fetching shipping data:', error);
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
      console.log(`🔄 Toggling online status to: ${newStatus}`);
      setIsOnline(newStatus);

      const res = await fetch(`${API_BASE_URL}/api/v0/shipper/online-status`, {
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
          console.log('🟢 Going online - starting location tracking');
          await goOnlineWithLocation(shippingData._id, token);
          Toast.show({
            type: 'success',
            text1: 'You are now Online',
            text2: 'Location tracking enabled',
          });
        } else {
          console.log('🔴 Going offline - stopping location tracking');
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
      console.log('Error toggling online status:', error);
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
        console.log('📍 Starting location tracking');
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
        console.log('📍 Stopping location tracking');
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
      console.log('Error toggling tracking:', error);
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
      [!name.trim(), 'Enter full name'],
      [!shippingType, 'Select shipping type'],
      [!city.trim(), 'Enter city'],
      [!state.trim(), 'Enter state'],
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
    const res = await fetch(`${API_BASE_URL}/api/v0/shipping/register`, {
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
      shippingType: shippingType,
      city: city.trim(),
      state: state.trim(),
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

  const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoadingMessage('Validating your information...');
    setLoading(true);

    try {
      setLoadingMessage('Uploading documents to secure server...');
      await delay(500);
      setLoadingMessage('Submitting registration to authorities...');
      await proceedWithRegistration();
      setLoadingMessage('Registration successful! Redirecting...');
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
    setShippingType(null);
    setCity('');
    setState('');
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.checkingText}>
            Checking registration status...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showOnboarding)
    return <FWSOnboardingScreen onComplete={() => setShowOnboarding(false)} />;

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
          <View style={styles.dashboardHeader}>
            <View style={styles.dashboardHeaderContent}>
              <View style={styles.dashboardHeaderIcon}>
                <Icon
                  name={showSwiper ? 'verified' : 'pending'}
                  size={32}
                  color="#FFFFFF"
                />
              </View>
              <View>
                <Text style={styles.dashboardHeaderTitle}>
                  Delivery Partner
                </Text>
                <Text style={styles.dashboardHeaderSub}>
                  {showSwiper ? '✓ Account Active' : '⏳ Awaiting Verification'}
                </Text>
              </View>
            </View>
          </View>

          <BatteryInfoCard
            batteryLevel={batteryLevel}
            fgTimeout={fgTimeout}
            bgTimeout={bgTimeout}
            interval={pollingInterval}
            accuracyMode={accuracyMode}
          />

          <View style={styles.dashboardCard}>
            <View style={styles.profileRow}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {shippingData.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{shippingData.name}</Text>
                <Text style={styles.profileVehicle}>
                  {shippingData.vehicleBrand} {shippingData.vehicleModel}
                </Text>
              </View>
              <View
                style={[
                  styles.statusChip,
                  shippingData.status === 'approved'
                    ? styles.statusChipApproved
                    : shippingData.status === 'pending'
                    ? styles.statusChipPending
                    : styles.statusChipDeclined,
                ]}
              >
                <Text style={styles.statusChipText}>
                  {shippingData.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {shippingData.kyc && (
              <View style={styles.kycSection}>
                <View style={styles.kycSectionHeader}>
                  <Icon
                    name="verified-user"
                    size={20}
                    color={isKycVerified ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={styles.kycSectionTitle}>KYC Verification</Text>
                  <View
                    style={[
                      styles.kycBadge,
                      isKycVerified
                        ? styles.kycBadgeVerified
                        : styles.kycBadgePending,
                    ]}
                  >
                    <Text style={styles.kycBadgeText}>
                      {isKycVerified ? 'VERIFIED' : 'PENDING'}
                    </Text>
                  </View>
                </View>
                <View style={styles.kycDetailBox}>
                  <View style={styles.kycDetailRow}>
                    <Text style={styles.kycDetailLabel}>DL Number</Text>
                    <Text style={styles.kycDetailValue}>
                      {shippingData.kyc.drivingLicenseNumber}
                    </Text>
                  </View>
                  {shippingData.kyc.identityType && (
                    <View style={styles.kycDetailRow}>
                      <Text style={styles.kycDetailLabel}>ID Type</Text>
                      <Text style={styles.kycDetailValue}>
                        {shippingData.kyc.identityType}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {!hasLocationPermission && (
              <View style={styles.permissionBox}>
                <Icon name="location-disabled" size={28} color="#EF4444" />
                <Text style={styles.permissionBoxTitle}>
                  Location Access Required
                </Text>
                <Text style={styles.permissionBoxText}>
                  To track deliveries, we need location permission
                </Text>
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={handleRequestPermissions}
                >
                  <Text style={styles.permissionButtonText}>Grant Access</Text>
                </TouchableOpacity>
              </View>
            )}

            {showSwiper ? (
              <>
                <View style={styles.switchCard}>
                  <View style={styles.switchCardHeader}>
                    <Icon
                      name="wifi"
                      size={22}
                      color={isOnline ? '#10B981' : '#94A3B8'}
                    />
                    <Text style={styles.switchCardTitle}>Online Status</Text>
                    <View
                      style={[
                        styles.switchStatusBadge,
                        isOnline
                          ? styles.switchStatusOnlineBadge
                          : styles.switchStatusOfflineBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.switchStatusText,
                          isOnline
                            ? styles.switchStatusOnline
                            : styles.switchStatusOffline,
                        ]}
                      >
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>
                      Go {isOnline ? 'Offline' : 'Online'}
                    </Text>
                    <Switch
                      value={isOnline}
                      onValueChange={toggleOnlineStatus}
                      disabled={isUpdatingOnlineStatus}
                      trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.switchDescription}>
                    {isOnline
                      ? 'Ready to accept orders'
                      : 'Will not receive orders'}
                  </Text>
                </View>

                {isOnline && hasLocationPermission && (
                  <View style={styles.switchCard}>
                    <View style={styles.switchCardHeader}>
                      <Icon
                        name="location-on"
                        size={22}
                        color={isTrackingOn ? '#2563EB' : '#94A3B8'}
                      />
                      <Text style={styles.switchCardTitle}>Live Tracking</Text>
                      <View
                        style={[
                          styles.switchStatusBadge,
                          isTrackingOn
                            ? styles.switchStatusTrackingBadge
                            : styles.switchStatusOfflineBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.switchStatusText,
                            isTrackingOn
                              ? styles.switchStatusTracking
                              : styles.switchStatusOffline,
                          ]}
                        >
                          {isTrackingOn ? 'ACTIVE' : 'OFF'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>
                        {isTrackingOn ? 'Stop Tracking' : 'Start Tracking'}
                      </Text>
                      <Switch
                        value={isTrackingOn}
                        onValueChange={toggleLocationTracking}
                        disabled={isUpdatingTrackingStatus || !isOnline}
                        trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    <Text style={styles.switchDescription}>
                      {isTrackingOn
                        ? 'Tracking in background & lock screen'
                        : 'Location sharing stopped'}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.pendingCard}>
                <View style={styles.pendingCardInner}>
                  <Icon
                    name={isApproved ? 'pending-actions' : 'hourglass-empty'}
                    size={40}
                    color="#D97706"
                  />
                  <Text style={styles.pendingCardTitle}>
                    {!isApproved
                      ? 'Registration Under Review'
                      : 'KYC Verification Pending'}
                  </Text>
                  <Text style={styles.pendingCardText}>
                    {!isApproved
                      ? 'We will notify you once approved'
                      : 'Complete KYC to go online'}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.viewStatusBtn}
              onPress={handleViewStatus}
            >
              <Text style={styles.viewStatusBtnText}>
                View Application Status
              </Text>
              <Icon name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.newRegBtn}
              onPress={handleNewRegistration}
            >
              <Icon name="add-circle-outline" size={20} color="#2563EB" />
              <Text style={styles.newRegBtnText}>Register Another Vehicle</Text>
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
          contentContainerStyle={styles.formScrollContainer}
        >
          <Animated.View
            style={[
              styles.formHeader,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.formHeaderGradient}>
              <View style={styles.formHeaderContent}>
                <View style={styles.formHeaderIcon}>
                  <Icon name="delivery-dining" size={32} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.formHeaderTitle}>Become a Partner</Text>
                  <Text style={styles.formHeaderSubtitle}>
                    Join India's fastest delivery network
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <View style={styles.progressSteps}>
            <View style={styles.progressStepActive}>
              <Text style={styles.progressStepText}>1</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={styles.progressStep}>
              <Text style={styles.progressStepText}>2</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={styles.progressStep}>
              <Text style={styles.progressStepText}>3</Text>
            </View>
          </View>
          <Text style={styles.progressLabel}>Step 1 of 3: Basic Details</Text>

          <FormCard title="Shipping Details" icon="local-shipping">
            <SelectField
              label="Shipping Type"
              value={shippingType}
              onPress={() => setShowShippingTypeModal(true)}
              placeholder="Select shipping type"
              icon="local-shipping"
              required
            />
            <InputField
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="Enter your city"
              icon="location-city"
              required
            />
            <InputField
              label="State"
              value={state}
              onChangeText={setState}
              placeholder="Enter your state"
              icon="map"
              required
            />
          </FormCard>

          <FormCard title="Personal Information" icon="person">
            <InputField
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              icon="person-outline"
              required
            />
          </FormCard>

          <FormCard title="KYC Documents" icon="verified-user">
            <InputField
              label="Driving License Number"
              value={drivingLicenseNumber}
              onChangeText={setDrivingLicenseNumber}
              placeholder="Enter license number"
              icon="credit-card"
              required
              autoCapitalize="characters"
            />
            <UploadField
              label="Driving License"
              imageUri={drivingLicenseImage}
              onPress={() => pickImage('license')}
              uploading={uploadingImage === 'license'}
              required
            />
            <SelectField
              label="Identity Document"
              value={identityType}
              onPress={() => setShowIdentityModal(true)}
              placeholder="Select identity type"
              icon="fingerprint"
            />
            {identityType && (
              <>
                <InputField
                  label={`${identityType} Number`}
                  value={identityNumber}
                  onChangeText={setIdentityNumber}
                  placeholder={`Enter ${identityType} number`}
                  icon="fingerprint"
                />
                <UploadField
                  label={`${identityType} Document`}
                  imageUri={identityImage}
                  onPress={() => pickImage('identity')}
                  uploading={uploadingImage === 'identity'}
                />
              </>
            )}
          </FormCard>

          <FormCard title="Vehicle Information" icon="directions-car">
            <InputField
              label="Vehicle Number"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              placeholder="e.g., MH12AB1234"
              icon="confirmation-number"
              required
              autoCapitalize="characters"
            />
            <SelectField
              label="Vehicle Category"
              value={vehicleCategory}
              onPress={() => setShowCategoryModal(true)}
              placeholder="Select category"
              icon="category"
              required
            />
            {vehicleCategory && (
              <SelectField
                label="Vehicle Brand"
                value={vehicleBrand}
                onPress={() => setShowBrandModal(true)}
                placeholder="Select brand"
                icon="directions-car"
                required
              />
            )}
            {vehicleBrand && (
              <SelectField
                label="Vehicle Model"
                value={vehicleModel}
                onPress={() => setShowModelModal(true)}
                placeholder="Select model"
                icon="directions-car"
                required
              />
            )}
            <UploadField
              label="Vehicle Image"
              imageUri={vehicleImage}
              onPress={() => pickImage('vehicle')}
              uploading={uploadingImage === 'vehicle'}
              required
            />
            <InputField
              label="Max Orders Per Day"
              value={maxOrdersPerDay}
              onChangeText={setMaxOrdersPerDay}
              placeholder="25"
              icon="local-offer"
              keyboardType="numeric"
              maxLength={3}
            />
          </FormCard>

          <View style={styles.termsContainer}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
                setAgreedToTerms(!agreedToTerms);
              }}
            >
              <View
                style={[
                  styles.checkboxBox,
                  agreedToTerms && styles.checkboxBoxChecked,
                ]}
              >
                {agreedToTerms && (
                  <Icon name="check" size={14} color="#FFFFFF" />
                )}
              </View>
              <View>
                <Text style={styles.checkboxText}>
                  I agree to the Terms & Conditions
                </Text>
                <Text style={styles.checkboxSubtext}>
                  Read our terms and privacy policy
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!agreedToTerms || loading) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!agreedToTerms || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.submitBtnContent}>
                <Text style={styles.submitBtnText}>Submit Registration</Text>
                <Icon name="arrow-forward" size={20} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.noteText}>
            Application reviewed within 24 hours
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Full Screen Loader */}
      <FullScreenLoader visible={loading} message={loadingMessage} />

      {/* Modals */}
      <Modal
        visible={showShippingTypeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShippingTypeModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowShippingTypeModal(false)}
              style={styles.modalClose}
            >
              <Icon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Shipping Type</Text>
          </View>
          <FlatList
            data={shippingTypes}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  shippingType === item.value && styles.modalItemSelected,
                ]}
                onPress={() => {
                  setShippingType(item.value);
                  setShowShippingTypeModal(false);
                  ReactNativeHapticFeedback.trigger(
                    'impactMedium',
                    hapticOptions,
                  );
                }}
              >
                <Icon
                  name={
                    item.value === 'TRUCK' ? 'local-shipping' : 'motorcycle'
                  }
                  size={24}
                  color={shippingType === item.value ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    shippingType === item.value && styles.modalItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {shippingType === item.value && (
                  <Icon name="check-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowCategoryModal(false)}
              style={styles.modalClose}
            >
              <Icon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Vehicle Category</Text>
          </View>
          <FlatList
            data={vehicleCategories}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  vehicleCategory === item.value && styles.modalItemSelected,
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
                  size={24}
                  color={vehicleCategory === item.value ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    vehicleCategory === item.value &&
                      styles.modalItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {vehicleCategory === item.value && (
                  <Icon name="check-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showBrandModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBrandModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowBrandModal(false)}
              style={styles.modalClose}
            >
              <Icon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Brand</Text>
            <Text style={styles.modalSubtitle}>{vehicleCategory}</Text>
          </View>
          <FlatList
            data={allBrands}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  vehicleBrand === item.value && styles.modalItemSelected,
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
                <Icon
                  name="directions-car"
                  size={24}
                  color={vehicleBrand === item.value ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    vehicleBrand === item.value && styles.modalItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {vehicleBrand === item.value && (
                  <Icon name="check-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showModelModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModelModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowModelModal(false)}
              style={styles.modalClose}
            >
              <Icon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Model</Text>
            <Text style={styles.modalSubtitle}>{vehicleBrand}</Text>
          </View>
          <FlatList
            data={allModels}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  vehicleModel === item.value && styles.modalItemSelected,
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
                <Icon
                  name="directions-car"
                  size={24}
                  color={vehicleModel === item.value ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    vehicleModel === item.value && styles.modalItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {vehicleModel === item.value && (
                  <Icon name="check-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showIdentityModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowIdentityModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowIdentityModal(false)}
              style={styles.modalClose}
            >
              <Icon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Identity Type</Text>
          </View>
          <FlatList
            data={identityTypes}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  identityType === item.value && styles.modalItemSelected,
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
                  size={24}
                  color={identityType === item.value ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    identityType === item.value && styles.modalItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {identityType === item.value && (
                  <Icon name="check-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  scrollContainer: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 },
  formScrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  checkingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },

  // Full Screen Loader Styles
  fullScreenLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: width - 80,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 20,
    marginBottom: 8,
  },
  loaderMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  loaderDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginHorizontal: 4,
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },

  // Form Header - Pure Blue
  formHeader: { marginBottom: 24, marginTop: 8 },
  formHeaderGradient: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    padding: 20,
  },
  formHeaderContent: { flexDirection: 'row', alignItems: 'center' },
  formHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  formHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  formHeaderSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },

  // Progress Steps
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  progressStepActive: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 8,
  },
  progressLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '500',
    marginBottom: 20,
  },

  // Form Card
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  formCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
    marginLeft: 10,
  },
  formCardContent: { padding: 20 },

  // Input Fields
  inputFieldContainer: { marginBottom: 18 },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabelText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  requiredStar: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    marginLeft: 4,
  },
  inputFieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 52,
  },
  inputFieldIcon: { marginLeft: 16 },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 52,
  },
  selectFieldIcon: { marginRight: 12 },
  selectFieldText: { flex: 1, fontSize: 15, color: '#1E293B' },
  selectFieldPlaceholder: { color: '#94A3B8' },
  uploadField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  uploadFieldSuccess: { backgroundColor: '#10B981' },
  uploadFieldText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },

  // Terms
  termsContainer: { marginVertical: 16 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxBoxChecked: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkboxText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  checkboxSubtext: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // Submit Button
  submitBtn: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    gap: 12,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  submitBtnDisabled: { opacity: 0.6 },
  noteText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
  },

  // Dashboard Styles
  dashboardHeader: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    marginBottom: 16,
    padding: 20,
  },
  dashboardHeaderContent: { flexDirection: 'row', alignItems: 'center' },
  dashboardHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dashboardHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  dashboardHeaderSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  dashboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  profileVehicle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusChipApproved: { backgroundColor: '#D1FAE5' },
  statusChipPending: { backgroundColor: '#FEF3C7' },
  statusChipDeclined: { backgroundColor: '#FEE2E2' },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  kycSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  kycSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  kycSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 10,
    flex: 1,
  },
  kycBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  kycBadgeVerified: { backgroundColor: '#D1FAE5' },
  kycBadgePending: { backgroundColor: '#FEF3C7' },
  kycBadgeText: { fontSize: 11, fontWeight: '700' },
  kycDetailBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14 },
  kycDetailRow: { flexDirection: 'row', marginBottom: 8 },
  kycDetailLabel: { fontSize: 12, color: '#64748B', width: 100 },
  kycDetailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
    flex: 1,
  },
  permissionBox: {
    margin: 20,
    padding: 20,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    alignItems: 'center',
  },
  permissionBoxTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginTop: 12,
    marginBottom: 6,
  },
  permissionBoxText: {
    fontSize: 13,
    color: '#7F1D1D',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  permissionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  switchCard: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  switchCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 10,
    flex: 1,
  },
  switchStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  switchStatusOnlineBadge: { backgroundColor: '#D1FAE5' },
  switchStatusOfflineBadge: { backgroundColor: '#F1F5F9' },
  switchStatusTrackingBadge: { backgroundColor: '#DBEAFE' },
  switchStatusText: { fontSize: 11, fontWeight: '700' },
  switchStatusOnline: { color: '#10B981' },
  switchStatusOffline: { color: '#64748B' },
  switchStatusTracking: { color: '#2563EB' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  switchLabel: { fontSize: 14, fontWeight: '500', color: '#334155' },
  switchDescription: { fontSize: 12, color: '#64748B' },
  pendingCard: { margin: 20 },
  pendingCardInner: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
  },
  pendingCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 14,
    marginBottom: 6,
  },
  pendingCardText: { fontSize: 13, color: '#92400E', textAlign: 'center' },
  viewStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    margin: 20,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  viewStatusBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  newRegBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  newRegBtnText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },

  // Battery Card
  batteryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
  },
  batteryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  batteryCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  batteryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  batteryStatItem: { alignItems: 'center' },
  batteryStatValue: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  batteryStatLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  batteryProgressBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  batteryProgressFill: { height: '100%', borderRadius: 3 },

  // Modals
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalClose: { marginRight: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', flex: 1 },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginLeft: 8 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalItemSelected: { backgroundColor: '#EFF6FF' },
  modalItemText: { flex: 1, fontSize: 15, color: '#1E293B', marginLeft: 14 },
  modalItemTextSelected: { color: '#2563EB', fontWeight: '600' },
});

export default RiderRegistrationScreen;
