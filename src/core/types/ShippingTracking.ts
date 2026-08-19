// src/types/TrackingTypes.ts

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isBackground?: boolean;
  speed?: number;
  altitude?: number;
  heading?: number;
}

export interface BatteryInfo {
  level: number; // 0-100
  fgTimeout: number; // Foreground timeout in ms
  bgTimeout: number; // Background timeout in ms
  interval: number; // Polling interval in ms
  accuracyMode: 'high' | 'balanced' | 'low';
  isCharging?: boolean;
}

export interface TrackingState {
  isTracking: boolean;
  isOnline: boolean;
  isBackground: boolean;
  shippingId: string | null;
  authToken: string | null;
  lastLocation: LocationData | null;
  batteryInfo: BatteryInfo;
  permissions: {
    fineLocation: boolean;
    backgroundLocation: boolean;
    notification: boolean;
  };
}

export interface TrackingConfig {
  minRequestInterval: number; // Minimum time between GPS requests
  maxRetries: number; // Max retries for GPS
  retryDelay: number; // Delay between retries
  minDistanceChange: number; // Minimum distance to trigger update (meters)
  apiEndpoint: string;
}

export interface TrackingCallbacks {
  onLocationUpdate?: (location: LocationData) => void;
  onError?: (error: Error) => void;
  onBatteryChange?: (info: BatteryInfo) => void;
  onTrackingStart?: () => void;
  onTrackingStop?: () => void;
}

export enum TrackingMode {
  FOREGROUND = 'foreground',
  BACKGROUND = 'background',
  INACTIVE = 'inactive',
}

export interface LocationError {
  code: string;
  message: string;
  timestamp: number;
}
