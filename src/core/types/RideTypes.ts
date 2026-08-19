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

export interface Location {
  address: string;
  latitude: number;
  longitude: number;
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
