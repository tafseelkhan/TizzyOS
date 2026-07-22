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
  bookingId: string;
  fare: number;
  pickup: Location;
  destination: Location;
  distance: number;
  isRetry: boolean;
  batchNumber: number;
  expiresAt: string;
}

export interface Booking {
  bookingId: string;
  rideCode: string;
  customerId: string;
  driverId: string | null;
  status: string;
  pickup: Location;
  destination: Location;
  fare: Fare;
  distance: number;
  duration: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface DriverStatus {
  isOnline: boolean;
  isAvailable: boolean;
  lastSeen: string | null;
  socketId: string | null;
}
