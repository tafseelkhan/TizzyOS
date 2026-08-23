// src/constants/config.ts

// ============================================================
// CONFIG
// ============================================================

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

  // Socket Heartbeat
  SOCKET_HEARTBEAT_INTERVAL: 15000,
};

// ============================================================
// RIDE STATUS
// ============================================================

export const RIDE_STATUS = {
  SEARCHING: 'searching',
  ACCEPTED: 'accepted',
  ARRIVED: 'arrived',
  PICKUP_VERIFIED: 'pickupVerified',
  IN_TRANSIT: 'inTransit',
  DROP_VERIFIED: 'dropVerified',
  PAYMENT_PENDING: 'paymentPending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_DRIVER_FOUND: 'no_driver_found',
} as const;

export type RideStatus = typeof RIDE_STATUS[keyof typeof RIDE_STATUS];

// ============================================================
// TRACKING STATUS
// ============================================================

export const TRACKING_STATUS = {
  ACCEPTED: 'accepted',
  ARRIVED: 'arrived',
  PICKUP_VERIFIED: 'pickupVerified',
  IN_TRANSIT: 'inTransit',
  DROP_VERIFIED: 'dropVerified',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// ============================================================
// DRIVER STATUS
// ============================================================

export const DRIVER_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AVAILABLE: 'available',
  BUSY: 'busy',
  ON_TRIP: 'on-trip',
} as const;

// ============================================================
// SOCKET EVENTS - COMPLETE (Old + New)
// ============================================================

export const SOCKET_EVENTS = {
  // ============================================================
  // AUTHENTICATION
  // ============================================================
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  AUTH_ERROR: 'auth-error',

  // ============================================================
  // DRIVER STATUS (Old + New)
  // ============================================================
  DRIVER_REGISTER: 'driver:register',
  DRIVER_REGISTERED: 'driver:registered',
  DRIVER_STATUS_UPDATE: 'driver-status-update', // ✅ OLD
  DRIVER_STATUS_CHANGED: 'driver:status-changed', // ✅ NEW
  DRIVER_LOCATION_UPDATE: 'driver-location-update', // ✅ OLD
  DRIVER_ERROR: 'driver:error',
  DRIVER_WELCOME: 'welcome',

  // ============================================================
  // RIDE REQUEST (Old + New)
  // ============================================================
  NEW_RIDE_REQUEST: 'new-ride-request', // ✅ OLD (keep)
  NEW_RIDE_REQUEST_ALT: 'NEW_RIDE_REQUEST', // ✅ NEW (uppercase)
  RIDE_ACCEPTED: 'accept', // ✅ OLD
  RIDE_ACCEPTED_ALT: 'RIDE_ACCEPTED', // ✅ NEW (uppercase)
  RIDE_REJECTED: 'reject', // ✅ OLD
  RIDE_REJECTED_ALT: 'RIDE_REJECTED', // ✅ NEW (uppercase)
  DRIVER_TIMEOUT: 'driver-timeout', // ✅ OLD
  DRIVER_TIMEOUT_ALT: 'DRIVER_TIMEOUT', // ✅ NEW (uppercase)
  DRIVER_RESPONSE: 'driver-response', // ✅ OLD
  RESPONSE_PROCESSED: 'response-processed',
  NO_DRIVER_FOUND: 'no-driver-found',

  // ============================================================
  // RIDE STATUS
  // ============================================================
  RIDE_STATUS_CHANGE: 'ride-status-change', // ✅ OLD

  // ============================================================
  // LIVE TRACKING - NEW
  // ============================================================
  // Customer Side
  CUSTOMER_TRACK_START: 'customer:track:start',
  CUSTOMER_TRACK_SUCCESS: 'customer:track:success',
  CUSTOMER_TRACK_ERROR: 'customer:track:error',
  CUSTOMER_TRACK_STOP: 'customer:track:stop',
  CUSTOMER_TRACK_STOPPED: 'customer:track:stopped',

  // Driver Live
  DRIVER_LIVE_START: 'driver:live:start',
  DRIVER_LIVE_STARTED: 'driver:live:started',
  DRIVER_LIVE_UPDATE: 'driver:live:update',
  DRIVER_LIVE_ACK: 'driver:live:ack',
  DRIVER_LIVE_STOP: 'driver:live:stop',
  DRIVER_LIVE_STOPPED: 'driver:live:stopped',
  DRIVER_LIVE_LOCATION: 'driver:live:location',
  DRIVER_LIVE_ERROR: 'driver:live:error',

  // ============================================================
  // GENERIC / LEGACY
  // ============================================================
  CANCEL_RIDE: 'cancel-ride',
  DRIVER_LOCATION_UPDATED: 'driver-location-updated',
  SOCKET_ERROR: 'socket-error',
};

// ============================================================
// SOCKET EVENT ALIASES (For backward compatibility)
// ============================================================

// Map old event names to new ones
export const SOCKET_EVENT_ALIASES = {
  'new-ride-request': SOCKET_EVENTS.NEW_RIDE_REQUEST_ALT,
  'accept': SOCKET_EVENTS.RIDE_ACCEPTED_ALT,
  'reject': SOCKET_EVENTS.RIDE_REJECTED_ALT,
  'driver-timeout': SOCKET_EVENTS.DRIVER_TIMEOUT_ALT,
  'driver-status-update': SOCKET_EVENTS.DRIVER_STATUS_CHANGED,
  'driver-location-update': SOCKET_EVENTS.DRIVER_LIVE_LOCATION,
  'ride-status-change': SOCKET_EVENTS.RIDE_STATUS_CHANGE,
};

// ============================================================
// TRACKABLE STATUSES
// ============================================================

export const TRACKABLE_STATUSES = [
  RIDE_STATUS.ACCEPTED,
  RIDE_STATUS.ARRIVED,
  RIDE_STATUS.PICKUP_VERIFIED,
  RIDE_STATUS.IN_TRANSIT,
  RIDE_STATUS.DROP_VERIFIED,
  RIDE_STATUS.PAYMENT_PENDING,
];

export const COMPLETED_STATUSES = [
  RIDE_STATUS.COMPLETED,
  RIDE_STATUS.CANCELLED,
  RIDE_STATUS.NO_DRIVER_FOUND,
];

// ============================================================
// SOCKET ERROR MESSAGES
// ============================================================

export const SOCKET_ERRORS = {
  CONNECTION_FAILED: 'Connection failed',
  CONNECTION_TIMEOUT: 'Connection timeout',
  AUTH_FAILED: 'Authentication failed',
  TOKEN_EXPIRED: 'Token expired',
  TOKEN_INVALID: 'Invalid token',
  SOCKET_DISCONNECTED: 'Socket disconnected',
  RECONNECT_FAILED: 'Reconnection failed',
  REQUEST_ALREADY_PROCESSED: 'Request is no longer pending',
  DRIVER_NOT_FOUND: 'Driver not found',
  BOOKING_NOT_FOUND: 'Booking not found',
  TRACKING_NOT_FOUND: 'Tracking not found',
  UNAUTHORIZED: 'Unauthorized',
};

// ============================================================
// HELPER: Get event name (with fallback)
// ============================================================

export const getEventName = (eventKey: keyof typeof SOCKET_EVENTS): string => {
  return SOCKET_EVENTS[eventKey] || eventKey;
};