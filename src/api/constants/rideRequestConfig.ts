// src/constants/config.ts

export const CONFIG = {
  // Socket
  SOCKET_RECONNECTION_ATTEMPTS: 5,
  SOCKET_RECONNECTION_DELAY: 1000,
  SOCKET_TIMEOUT: 10000,

  // Ride Request
  RIDE_REQUEST_TIMEOUT_SECONDS: 20,
  RIDE_REQUEST_COUNTDOWN_INTERVAL: 1000,

  // Audio
  RINGTONE_VOLUME: 1.0,
  RINGTONE_LOOP: true,

  // Vibration
  VIBRATION_PATTERN: [1000, 500],
  VIBRATION_INTERVAL: 1500,

  // Location
  LOCATION_UPDATE_INTERVAL: 5000,
  LOCATION_DISTANCE_FILTER: 10,

  // API
  API_TIMEOUT: 30000,
  API_RETRY_ATTEMPTS: 2,
};

export const RIDE_STATUS = {
  SEARCHING: 'searching',
  ACCEPTED: 'accepted',
  ARRIVED: 'arrived',
  PICKUP_VERIFIED: 'pickupVerified',
  IN_TRANSIT: 'inTransit',
  DROP_VERIFIED: 'dropVerified',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_DRIVER_FOUND: 'no_driver_found',
} as const;

export const TRACKING_STATUS = {
  ACCEPTED: 'accepted',
  ARRIVED: 'arrived',
  PICKUP_VERIFIED: 'pickupVerified',
  IN_TRANSIT: 'inTransit',
  DROP_VERIFIED: 'dropVerified',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const SOCKET_EVENTS = {
  AUTHENTICATE: 'authenticate',
  DRIVER_STATUS_UPDATE: 'driver-status-update',
  DRIVER_LOCATION_UPDATE: 'driver-location-update',
  DRIVER_RESPONSE: 'driver-response',
  NEW_RIDE_REQUEST: 'new-ride-request',
  RIDE_ACCEPTED: 'ride-accepted',
  RIDE_REJECTED: 'ride-rejected',
  DRIVER_TIMEOUT: 'driver-timeout',
  RIDE_STATUS_CHANGE: 'ride-status-change',
} as const;
