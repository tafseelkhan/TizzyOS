// src/types/ride.ts

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  googlePlaceId?: string;
}

export interface Fare {
  baseFare: number;
  classFare: number;
  distanceFare: number;
  timeFare: number;
  platformFees: number;
  subTotal: number;
  gstFare: number;
  totalFare: number;
  gstPercentage: number;
  perKmRate: number;
  perMinuteRate: number;
}

export interface RideRequest {
  requestId: string;

  customer: {
    customerId: string;
    name: string;
    profilePicture?: string;
  };

  booking: {
    bookingId: string;
    rideCode?: string;
    serviceType?: string;
    quoteId?: string;
    fwsAirportRideId?: string;
  };

  fare: number;
  distance: number;

  pickup: {
    address: string;
    latitude: number;
    longitude: number;
  };

  destination: {
    address: string;
    latitude: number;
    longitude: number;
  };

  expiresAt?: string;
  isRetry?: boolean;
  batchNumber?: string;
}

// ============================================================
// USER & DRIVER TYPES
// ============================================================

export interface UserInfo {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  image?: string;
  roles?: 'BUYER' | 'SELLER' | 'FWS' | 'SHIPPING' | 'CAB' | 'RENT';
  theme?: 'light' | 'dark' | 'system';
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
}

export interface VehicleInfo {
  categoryCode: string;
  companyCode: string;
  modelCode: string;
  vehicleNumber: string;
  vehicleColor: string;
  manufacturingYear: number;
  vehicleType: string;
  vehicleClass: string;
  baseFare: number;
  classFare: number;
  maxPassengers: number;
  hasAC: boolean;
  luggageCapacity: number;
  handBagCapacity?: number;
  seatCapacity: number;
  passengerCapacity: number;
}

export interface DriverProfile {
  driverCode: string;
  rideTypeCode: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  licenceNumber: string;
  licenceExpiryDate: string;
  licenceFront: string;
  licenceBack: string;
  vehicle: VehicleInfo;
  documents?: {
    rcFront: string;
    rcBack: string;
    insurance?: string;
    pollutionCertificate?: string;
  };
}

export interface DriverInfo extends UserInfo {
  driverProfile?: DriverProfile;
}

export interface CustomerInfo extends UserInfo {}

// ============================================================
// ENRICHED BOOKING (with customer & driver)
// ============================================================

export interface EnrichedBooking extends Omit<
  Booking,
  'customerId' | 'driverId'
> {
  customerId: string | UserInfo; // Can be string (ID) or populated UserInfo
  driverId: string | DriverInfo | null; // Can be string (ID) or populated DriverInfo
  customer?: CustomerInfo | null;
  driver?: DriverInfo | null;
}

// ============================================================
// BASE BOOKING (Original)
// ============================================================

export interface Booking {
  bookingId: string;
  trackingId: string;
  rideCode: string;
  customerId: string;
  driverId: string | null;
  status: string;
  pickup: Location;
  destination: Location;
  fare: Fare;
  quoteId?: string;
  distance: number;
  duration: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  // Optional enriched fields (backward compatible)
  customer?: CustomerInfo | null;
  driver?: DriverInfo | null;
}

// ============================================================
// TRACKING
// ============================================================

export interface Tracking {
  trackingId: string;
  bookingId: string;
  rideId: string;
  rideCode: string;
  customerId: string;
  driverId: string;
  rideStatus: string;
  pickupVerified: boolean;
  dropVerified: boolean;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  distanceFromPickup: number;
  distanceToDestination: number;
  tripDistanceCovered: number;
  tripDuration: number;
  lastLocationUpdate: string;
}

// ============================================================
// LIVE TRACKING
// ============================================================

export interface LiveTrackingData {
  bookingId: string;
  trackingId?: string;
  rideCode: string;
  quoteId?: string;
  status: string;

  pickup: {
    latitude: number;
    longitude: number;
    address: string;
    googlePlaceId?: string;
  };

  destination: {
    latitude: number;
    longitude: number;
    address: string;
    googlePlaceId?: string;
  };

  driver: {
    userId: string;
    driverCode?: string;
    location: {
      latitude: number;
      longitude: number;
    } | null;
    heading?: number;
    speed?: number;
    accuracy?: number;
    bearing?: number;
    altitude?: number;
    provider?: string;
    batteryLevel?: number;
    networkType?: string;
    isMockLocation?: boolean;
    locationUpdatedAt?: string;
    isTrackingOn: boolean;
    cachedLocation?: {
      latitude: number;
      longitude: number;
      heading: number;
      speed: number;
      timestamp: string;
    } | null;
  };

  customer: {
    userId: string;
    location: {
      latitude: number;
      longitude: number;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      pinCode?: string;
      landmark?: string;
    } | null;
  };
}

export interface DriverStatus {
  isOnline: boolean;
  isAvailable: boolean;
  lastSeen: string | null;
  socketId: string | null;
}

// ============================================================
// API RESPONSE WRAPPERS
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface EnrichedBookingResponse extends ApiResponse<EnrichedBooking> {}

export interface BookingResponse extends ApiResponse<Booking> {}

export interface LiveTrackingResponse extends ApiResponse<LiveTrackingData> {}

// ============================================================
// TYPE GUARDS
// ============================================================

export function isEnrichedBooking(
  booking: Booking | EnrichedBooking,
): booking is EnrichedBooking {
  return (
    !!(booking as EnrichedBooking).customer ||
    !!(booking as EnrichedBooking).driver
  );
}

export function hasCustomerInfo(
  booking: Booking,
): booking is Booking & { customer: CustomerInfo } {
  return !!(booking as any).customer?.name;
}

export function hasDriverInfo(
  booking: Booking,
): booking is Booking & { driver: DriverInfo } {
  return !!(booking as any).driver?.name;
}

// ============================================================
// HELPER FUNCTIONS FOR TYPE SAFETY
// ============================================================

export function getCustomerName(
  booking: Booking | EnrichedBooking | null,
): string {
  if (!booking) return 'Unknown Customer';

  // Check for enriched data first
  if ('customer' in booking && booking.customer?.name) {
    return booking.customer.name;
  }

  return 'Unknown Customer';
}

export function getCustomerPhone(
  booking: Booking | EnrichedBooking | null,
): string | undefined {
  if (!booking) return undefined;

  if ('customer' in booking && booking.customer?.phone) {
    return booking.customer.phone;
  }

  return undefined;
}

export function getCustomerAvatar(
  booking: Booking | EnrichedBooking | null,
): string | undefined {
  if (!booking) return undefined;

  if ('customer' in booking && booking.customer?.image) {
    return booking.customer.image;
  }

  return undefined;
}

export function getDriverName(
  booking: Booking | EnrichedBooking | null,
): string {
  if (!booking) return 'No driver assigned';

  if ('driver' in booking && booking.driver?.name) {
    return booking.driver.name;
  }

  return 'No driver assigned';
}

export function getDriverPhone(
  booking: Booking | EnrichedBooking | null,
): string | undefined {
  if (!booking) return undefined;

  if ('driver' in booking && booking.driver?.phone) {
    return booking.driver.phone;
  }

  return undefined;
}

export function getVehicleInfo(
  booking: Booking | EnrichedBooking | null,
): string {
  if (!booking) return 'No vehicle';

  const driver = 'driver' in booking ? booking.driver : null;
  const vehicle = driver?.driverProfile?.vehicle;

  if (vehicle) {
    return `${vehicle.companyCode} ${vehicle.modelCode} (${vehicle.vehicleNumber})`;
  }

  return 'No vehicle';
}

export function getVehicleDetails(
  booking: Booking | EnrichedBooking | null,
): VehicleInfo | null {
  if (!booking) return null;

  const driver = 'driver' in booking ? booking.driver : null;
  return driver?.driverProfile?.vehicle || null;
}

export function isDriverAssigned(
  booking: Booking | EnrichedBooking | null,
): boolean {
  if (!booking) return false;

  if ('driver' in booking && booking.driver) {
    return true;
  }

  return !!booking.driverId;
}

export function getDriverId(
  booking: Booking | EnrichedBooking | null,
): string | null {
  if (!booking) return null;

  if ('driver' in booking && booking.driver?._id) {
    return booking.driver._id;
  }

  if (typeof booking.driverId === 'string') {
    return booking.driverId;
  }

  return null;
}

export function getCustomerId(
  booking: Booking | EnrichedBooking | null,
): string | null {
  if (!booking) return null;

  if ('customer' in booking && booking.customer?._id) {
    return booking.customer._id;
  }

  if (typeof booking.customerId === 'string') {
    return booking.customerId;
  }

  return null;
}
