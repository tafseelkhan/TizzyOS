// RideTrackingScreen.tsx — corrected implementation

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
  Image,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { driverRideApi } from '../../../../../api/features/private/driverRidePrivateSlice';
import {
  registerSocketHandlers,
  rideLiveTrackingHandler,
  socketService,
} from '../../../../utils/socket';
import { Booking, LiveTrackingData } from '../../../../types/RideTypes';
import { RootStackParamList } from '../../../../../navigations/RootStackParamList';
import { StackScreenProps } from '@react-navigation/stack';
import { NavigationProvider } from '@googlemaps/react-native-navigation-sdk';
import {
  NavigationControllerWrapper,
  type DriverRawLocation,
} from '../../../../../navigations/google/NavigationControllerWrapper';

type RideTrackingScreenProps = StackScreenProps<
  RootStackParamList,
  'RideTracking'
>;

type NavTarget = 'pickup' | 'destination';

interface NavigationState {
  status: 'idle' | 'navigating' | 'rerouting' | 'arrived' | 'error';
  currentInstruction: string;
  remainingDistance: number | null;
  eta: number;
  /** Confirmed route target the remainingDistance belongs to. */
  target: NavTarget | null;
  /** Timestamp when the distance was accepted. */
  lastDistanceAt: number;
}

interface GpsProximity {
  pickupMeters: number | null;
  destinationMeters: number | null;
  lastUpdate: number;
  isValid: boolean;
}

const TERMS_DIALOG_OPTIONS = {
  title: 'Terms & Conditions',
  companyName: 'TizzyOS',
  showOnlyDisclaimer: true,
};

const PICKUP_QR_DISTANCE_METERS = 50;
const DROP_QR_DISTANCE_METERS = 50;
const LOCATION_MAX_AGE_MS = 20000;

// How long an SDK distance update is considered fresh for QR eligibility.
// 15s tolerates the SDK's low-frequency updates while stopped at a pickup.
const NAV_DISTANCE_MAX_AGE_MS = 15000;

// Lightweight ticker so QR visibility reacts when a snapshot expires,
// even if no new SDK callback arrives.
const NAV_DISTANCE_TICK_MS = 1000;

const SWIPE_TRACK_WIDTH = 260;
const SWIPE_THUMB_SIZE = 44;
const SWIPE_COMPLETION_THRESHOLD = SWIPE_TRACK_WIDTH - SWIPE_THUMB_SIZE - 12;

// ⚠️ UNVERIFIED: These status strings come from the existing codebase.
// Backend status transitions were not provided for review.
// If the backend emits different statuses, QR will stay hidden (fail-closed).
// Add statuses here only after confirming the actual backend flow.
const PICKUP_STATUSES = ['accepted', 'arrived'];
const DROP_STATUSES = ['pickupVerified', 'inTransit'];

const isPickupPhase = (status?: string): boolean => {
  if (!status) return false;
  return PICKUP_STATUSES.includes(status);
};

const isDropPhase = (status?: string): boolean => {
  if (!status) return false;
  return DROP_STATUSES.includes(status);
};

/**
 * Classify the booking status into a navigation phase.
 * Unknown statuses return 'unknown' — callers must treat this as "no target"
 * and must not enable QR eligibility.
 */
const classifyPhase = (
  status?: string,
): 'pickup' | 'drop' | 'unknown' => {
  if (!status) return 'unknown';
  if (PICKUP_STATUSES.includes(status)) return 'pickup';
  if (DROP_STATUSES.includes(status)) return 'drop';
  return 'unknown';
};

const haversineMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number | null => {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }
  if (
    Math.abs(lat1) > 90 ||
    Math.abs(lat2) > 90 ||
    Math.abs(lon1) > 180 ||
    Math.abs(lon2) > 180
  ) {
    return null;
  }
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const RideTrackingScreen: React.FC<RideTrackingScreenProps> = ({
  route,
  navigation,
}) => {
  const { trackingId, bookingId, quoteId } = route.params || {};

  const [booking, setBooking] = useState<Booking | null>(null);
  const [liveTracking, setLiveTracking] = useState<LiveTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [navState, setNavState] = useState<NavigationState>({
    status: 'idle',
    currentInstruction: 'Loading navigation...',
    remainingDistance: null,
    eta: 0,
    target: null,
    lastDistanceAt: 0,
  });

  const [gpsProximity, setGpsProximity] = useState<GpsProximity>({
    pickupMeters: null,
    destinationMeters: null,
    lastUpdate: 0,
    isValid: false,
  });

  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [collectingCash, setCollectingCash] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // React state mirror of the SDK distance snapshot. Used for rendering so
  // the QR button reacts to distance updates; `navDistanceRef` remains the
  // synchronous source used by onPress.
  const [navDistanceState, setNavDistanceState] = useState<{
    meters: number;
    target: NavTarget;
    timestamp: number;
  } | null>(null);

  // Ticker so QR visibility reacts to snapshot expiry even without new
  // SDK callbacks.
  const [navDistanceTick, setNavDistanceTick] = useState(0);

  const pan = useRef(new Animated.ValueXY({ x: 20, y: 500 })).current;
  const lastTapRef = useRef<number>(0);

  const callSwipeX = useRef(new Animated.Value(0)).current;
  const callSwipeCompletedRef = useRef(false);
  const [callSwipeDisabled, setCallSwipeDisabled] = useState(false);

  const cashSwipeX = useRef(new Animated.Value(0)).current;
  const cashSwipeCompletedRef = useRef(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  const bookingRef = useRef<Booking | null>(null);
  const liveTrackingRef = useRef<LiveTrackingData | null>(null);
  const quoteIdRef = useRef<string | null>(quoteId || null);
  const driverIdRef = useRef<string | null>(null);
  const locationEmitThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmitLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const subscriptionSetupRef = useRef(false);
  const socketReadyRef = useRef(false);
  const isFirstFocusRef = useRef(true);

  // Raw location refs — still used for proximity display & socket emission,
  // NOT for QR eligibility.
  const lastRawLocationRef = useRef<DriverRawLocation | null>(null);
  const lastRawLocationSequenceRef = useRef(0);
  const lastKnownStatusRef = useRef<string | undefined>(undefined);

  // Expected navigation target derived from booking status. `null` when the
  // status is unknown or out of a ride phase.
  const expectedTargetRef = useRef<NavTarget | null>(null);

  // Timestamp of the last route-target change. SDK distance snapshots older
  // than this are rejected as stale.
  const routeTransitionAtRef = useRef<number>(0);

  // Authoritative SDK route-distance snapshot for synchronous QR click checks.
  const navDistanceRef = useRef<{
    meters: number;
    target: NavTarget;
    timestamp: number;
  } | null>(null);

  // Sequenced booking load — the newest request wins.
  const loadTripDetailsRequestIdRef = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () => pan.extractOffset(),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => pan.flattenOffset(),
    }),
  ).current;

  const handlePillPress = () => {
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 300) {
      setIsCardExpanded(true);
    } else {
      lastTapRef.current = now;
    }
  };

  // SINGLE SOURCE OF TRUTH for effective target.
  // Returns null for unknown/missing/terminal statuses — never guesses.
  const getEffectiveTarget = useCallback(
    (status?: string): NavTarget | null => {
      const phase = classifyPhase(status);
      if (phase === 'pickup') return 'pickup';
      if (phase === 'drop') return 'destination';
      return null;
    },
    [],
  );

  const getCustomerName = useCallback((): string => {
    if (booking && 'customer' in booking && booking.customer?.name) {
      return booking.customer.name;
    }
    return 'Customer';
  }, [booking]);

  const getCustomerPhone = useCallback((): string | undefined => {
    if (!booking) return undefined;
    if ('customer' in booking && booking.customer?.phone) {
      return booking.customer.phone;
    }
    const anyBooking = booking as any;
    if (anyBooking?.customerPhone) return anyBooking.customerPhone;
    if (anyBooking?.customer) {
      const c = anyBooking.customer;
      const possible = [
        c.phone,
        c.phoneNumber,
        c.mobile,
        c.mobileNumber,
        c.contactNumber,
      ];
      for (const p of possible) {
        if (p && typeof p === 'string' && p.trim().length > 0) return p;
      }
    }
    return undefined;
  }, [booking]);

  const getCustomerAvatar = useCallback((): string | undefined => {
    if (booking && 'customer' in booking && booking.customer?.image) {
      return booking.customer.image;
    }
    return undefined;
  }, [booking]);

  const getAddressForTarget = useCallback(
    (target: NavTarget | null): string => {
      if (target === 'pickup') {
        return booking?.pickup?.address || 'Pickup address unavailable';
      }
      if (target === 'destination') {
        return booking?.destination?.address || 'Drop address unavailable';
      }
      return 'Location unavailable';
    },
    [booking],
  );

  const displayRideCode = booking?.rideCode || '—';

  const clearNavDistance = useCallback((reason: string) => {
    navDistanceRef.current = null;
    setNavDistanceState(null);
    routeTransitionAtRef.current = Date.now();
    console.log(`[QR] NAV_DISTANCE_CLEARED: ${reason}`);
  }, []);

  // ---------------------------------------------------------------------
  // QR ELIGIBILITY — driven ONLY by the SDK route distance.
  // ---------------------------------------------------------------------

  /**
   * Synchronous QR eligibility check used by the click handler to prevent
   * a stale UI render from bypassing the distance gate.
   */
  const isQREligibleNow = useCallback(
    (scanType: 'pickup' | 'drop'): boolean => {
      const b = bookingRef.current;
      if (!b) return false;

      const expectedNavTarget: NavTarget =
        scanType === 'pickup' ? 'pickup' : 'destination';

      // 1. Status gate.
      if (scanType === 'pickup' && !isPickupPhase(b.status)) return false;
      if (scanType === 'drop' && !isDropPhase(b.status)) return false;

      // 2. Expected-target alignment — protects against booking/wrapper lag.
      if (expectedTargetRef.current !== expectedNavTarget) return false;

      // 3. Distance snapshot exists and matches expected target.
      const snap = navDistanceRef.current;
      if (!snap) return false;
      if (snap.target !== expectedNavTarget) return false;

      // 4. Snapshot must not predate the last route transition.
      if (snap.timestamp < routeTransitionAtRef.current) return false;

      // 5. Freshness gate.
      const age = Date.now() - snap.timestamp;
      if (age < 0 || age > NAV_DISTANCE_MAX_AGE_MS) return false;

      // 6. Distance gate — inclusive 50 m, non-negative finite.
      if (!Number.isFinite(snap.meters) || snap.meters < 0) return false;

      const threshold =
        scanType === 'pickup'
          ? PICKUP_QR_DISTANCE_METERS
          : DROP_QR_DISTANCE_METERS;
      return snap.meters <= threshold;
    },
    [],
  );

  /**
   * Proximity is computed for display/telemetry only — NOT used for QR
   * eligibility.
   *
   * `bookingOverride` allows callers that just fetched a booking object
   * to avoid the React state async-update lag (which would otherwise make
   * `booking` still reference the previous value).
   */
  const recomputeProximity = useCallback(
    (bookingOverride?: Booking | null) => {
      const b = bookingOverride !== undefined ? bookingOverride : booking;
      const raw = lastRawLocationRef.current;

      if (!b || !raw) {
        setGpsProximity({
          pickupMeters: null,
          destinationMeters: null,
          lastUpdate: raw?.timestamp ?? 0,
          isValid: false,
        });
        return;
      }

      const age = Date.now() - raw.timestamp;
      const fresh = age >= 0 && age <= LOCATION_MAX_AGE_MS;

      const pickupMeters =
        b.pickup?.latitude != null && b.pickup?.longitude != null
          ? haversineMeters(
              raw.lat,
              raw.lng,
              b.pickup.latitude,
              b.pickup.longitude,
            )
          : null;

      const destinationMeters =
        b.destination?.latitude != null &&
        b.destination?.longitude != null
          ? haversineMeters(
              raw.lat,
              raw.lng,
              b.destination.latitude,
              b.destination.longitude,
            )
          : null;

      const isValid =
        fresh && (pickupMeters !== null || destinationMeters !== null);

      setGpsProximity({
        pickupMeters,
        destinationMeters,
        lastUpdate: raw.timestamp,
        isValid,
      });
    },
    [booking],
  );

  const handleDriverRawLocationUpdate = useCallback(
    (loc: DriverRawLocation) => {
      lastRawLocationRef.current = loc;
      lastRawLocationSequenceRef.current += 1;
      recomputeProximity();
    },
    [recomputeProximity],
  );

  // Display-only QR config (for rendering the button).
  // Reads `navDistanceState` and `navDistanceTick` so the render is reactive
  // both to new snapshots and to snapshot expiry.
  const getQRScanConfig = useCallback((): {
    show: boolean;
    label: string;
    scanType: 'pickup' | 'drop';
    icon: string;
    color: string;
  } | null => {
    if (!booking?.status) return null;

    const target = getEffectiveTarget(booking.status);
    if (target === null) return null;

    // Touch state so React re-renders on distance updates and on tick expiry.
    void navDistanceState;
    void navDistanceTick;

    if (isPickupPhase(booking.status) && target === 'pickup') {
      if (isQREligibleNow('pickup')) {
        return {
          show: true,
          label: 'Scan for Pickup',
          scanType: 'pickup',
          icon: 'qr-code-scanner',
          color: '#10b981',
        };
      }
      return null;
    }

    if (isDropPhase(booking.status) && target === 'destination') {
      if (isQREligibleNow('drop')) {
        return {
          show: true,
          label: 'Scan for Drop',
          scanType: 'drop',
          icon: 'qr-code-scanner',
          color: '#3b82f6',
        };
      }
      return null;
    }

    return null;
  }, [
    booking,
    getEffectiveTarget,
    isQREligibleNow,
    navDistanceState,
    navDistanceTick,
  ]);

  const handleOpenQRScanner = useCallback(
    (scanType: 'pickup' | 'drop') => {
      if (!bookingRef.current) {
        Alert.alert('Error', 'Booking details not loaded');
        return;
      }

      // Fresh synchronous check — no React state dependency.
      if (!isQREligibleNow(scanType)) {
        const snap = navDistanceRef.current;
        const expectedTarget =
          scanType === 'pickup' ? 'pickup' : 'destination';

        if (!snap) {
          Alert.alert(
            'Navigation Not Ready',
            'Waiting for the navigation SDK to provide a route distance.',
          );
        } else if (snap.target !== expectedTarget) {
          Alert.alert(
            'Not Available',
            'Navigation target has changed. Waiting for fresh route distance.',
          );
        } else if (snap.timestamp < routeTransitionAtRef.current) {
          Alert.alert(
            'Route Changing',
            'Waiting for the new route to settle.',
          );
        } else if (Date.now() - snap.timestamp > NAV_DISTANCE_MAX_AGE_MS) {
          Alert.alert(
            'Distance Stale',
            'Waiting for a fresh route distance update.',
          );
        } else {
          Alert.alert(
            'Not in Range',
            `You must be within ${
              scanType === 'pickup'
                ? PICKUP_QR_DISTANCE_METERS
                : DROP_QR_DISTANCE_METERS
            }m of the ${
              scanType === 'pickup' ? 'pickup' : 'destination'
            } (route distance).`,
          );
        }
        return;
      }

      try {
        navigation.navigate('RideQRScanner', {
          scanType,
          bookingId: bookingId || '',
          trackingId: trackingId || '',
          quoteId: quoteIdRef.current || '',
        });
      } catch (err) {
        Alert.alert('Error', 'Could not open QR scanner. Please try again.');
      }
    },
    [bookingId, trackingId, navigation, isQREligibleNow],
  );

  const callPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !callSwipeDisabled,
      onMoveShouldSetPanResponder: (_, g) =>
        !callSwipeDisabled && Math.abs(g.dx) > 5,
      onPanResponderMove: (_, g) => {
        const clampedX = Math.max(
          0,
          Math.min(g.dx, SWIPE_COMPLETION_THRESHOLD),
        );
        callSwipeX.setValue(clampedX);
      },
      onPanResponderRelease: (_, g) => {
        if (callSwipeCompletedRef.current) return;
        if (g.dx >= SWIPE_COMPLETION_THRESHOLD) {
          callSwipeCompletedRef.current = true;
          setCallSwipeDisabled(true);
          Animated.timing(callSwipeX, {
            toValue: SWIPE_COMPLETION_THRESHOLD,
            duration: 120,
            useNativeDriver: true,
          }).start(async () => {
            const rawPhone = getCustomerPhone();
            if (!rawPhone) {
              Alert.alert('Info', 'Customer phone number is unavailable.');
            } else {
              let normalized = rawPhone.trim().replace(/[\s\-()]/g, '');
              if (normalized.startsWith('0')) normalized = normalized.slice(1);
              if (!normalized.startsWith('+')) {
                if (normalized.length === 10) normalized = `+91${normalized}`;
                else if (!normalized.startsWith('91'))
                  normalized = `+91${normalized}`;
                else normalized = `+${normalized}`;
              }
              const url = `tel:${normalized}`;
              try {
                const supported = await Linking.canOpenURL(url);
                if (supported) await Linking.openURL(url);
                else Alert.alert('Error', 'This device cannot make calls.');
              } catch {
                Alert.alert('Error', 'Failed to open dialler.');
              }
            }
            setTimeout(() => {
              Animated.timing(callSwipeX, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }).start(() => {
                callSwipeCompletedRef.current = false;
                setCallSwipeDisabled(false);
              });
            }, 800);
          });
        } else {
          Animated.spring(callSwipeX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 6,
          }).start();
        }
      },
    }),
  ).current;

  const resetCashSwipe = useCallback(() => {
    Animated.timing(cashSwipeX, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      cashSwipeCompletedRef.current = false;
    });
  }, [cashSwipeX]);

  const cashPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !collectingCash,
      onMoveShouldSetPanResponder: (_, g) =>
        !collectingCash && Math.abs(g.dx) > 5,
      onPanResponderMove: (_, g) => {
        const clampedX = Math.max(
          0,
          Math.min(g.dx, SWIPE_COMPLETION_THRESHOLD),
        );
        cashSwipeX.setValue(clampedX);
      },
      onPanResponderRelease: (_, g) => {
        if (cashSwipeCompletedRef.current || collectingCash) return;
        if (g.dx >= SWIPE_COMPLETION_THRESHOLD) {
          cashSwipeCompletedRef.current = true;
          Animated.timing(cashSwipeX, {
            toValue: SWIPE_COMPLETION_THRESHOLD,
            duration: 120,
            useNativeDriver: true,
          }).start(() => {
            handleCollectCash();
          });
        } else {
          Animated.spring(cashSwipeX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 6,
          }).start();
        }
      },
    }),
  ).current;

  const initializeSocket = useCallback(async () => {
    try {
      await registerSocketHandlers();
      const result = await socketService.waitForReady(15000);
      socketReadyRef.current = result.authenticated;
      return result.socketId && result.authenticated;
    } catch {
      return false;
    }
  }, []);

  const emitDriverLocation = useCallback(
    (latitude: number, longitude: number, heading?: number, speed?: number) => {
      const driverId = driverIdRef.current;
      const currentQuoteId = quoteIdRef.current;
      if (!driverId || !currentQuoteId) return;

      if (locationEmitThrottleRef.current) {
        clearTimeout(locationEmitThrottleRef.current);
      }

      locationEmitThrottleRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;

        if (lastEmitLocationRef.current) {
          const last = lastEmitLocationRef.current;
          const latDiff = Math.abs(latitude - last.lat) * 111000;
          const lngDiff =
            Math.abs(longitude - last.lng) *
            111000 *
            Math.cos((last.lat * Math.PI) / 180);
          const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
          if (distance < 10) return;
        }
        lastEmitLocationRef.current = { lat: latitude, lng: longitude };
        rideLiveTrackingHandler.emitDriverLocation({
          driverId,
          quoteId: currentQuoteId,
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
          accuracy: 10,
        });
      }, 1000);
    },
    [],
  );

  const cleanupSubscription = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    subscriptionSetupRef.current = false;
  }, []);

  const setupLiveTrackingSubscription = useCallback(() => {
    cleanupSubscription();
    if (!trackingId || subscriptionSetupRef.current) return;
    const currentQuoteId = quoteIdRef.current;
    if (!currentQuoteId) return;

    subscriptionSetupRef.current = true;
    unsubscribeRef.current = rideLiveTrackingHandler.subscribe(
      trackingId,
      bookingId || trackingId,
      currentQuoteId,
      {
        onLocationUpdate: data => {
          if (!isMountedRef.current) return;
          setLiveTracking(prev =>
            prev
              ? {
                  ...prev,
                  driver: {
                    ...prev.driver,
                    location: {
                      latitude: data.latitude,
                      longitude: data.longitude,
                    },
                    heading: data.heading,
                    speed: data.speed,
                    accuracy: data.accuracy,
                    locationUpdatedAt: data.timestamp,
                  },
                }
              : prev,
          );
        },
        onTrackingSuccess: data => {
          if (!isMountedRef.current) return;
          setLiveTracking(data as any);
          if (data.quoteId) quoteIdRef.current = data.quoteId;
          if (data.driver?.userId) driverIdRef.current = data.driver.userId;
        },
        onDriverStarted: () => {},
        onDriverAck: () => {},
        onDriverStopped: () => {},
        onError: error => {
          if (error.message?.includes('Unauthorized')) {
            subscriptionSetupRef.current = false;
            Alert.alert('Session Expired', 'Please login again');
          }
        },
      },
    );
  }, [trackingId, bookingId, cleanupSubscription]);

  const loadTripDetails = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!trackingId || !bookingId) return;
      const currentQuoteId = quoteIdRef.current;
      if (!currentQuoteId) return;

      // Request sequencing — newest wins.
      loadTripDetailsRequestIdRef.current += 1;
      const requestId = loadTripDetailsRequestIdRef.current;

      try {
        if (!options?.silent) setLoading(true);

        const [liveData, bookingData] = await Promise.all([
          driverRideApi.getLiveTracking(bookingId, trackingId, currentQuoteId),
          driverRideApi.getTripDetails(bookingId),
        ]);

        if (!isMountedRef.current) return;
        if (requestId !== loadTripDetailsRequestIdRef.current) {
          // Superseded by a newer request; discard.
          return;
        }

        const oldStatus = lastKnownStatusRef.current;
        const newStatus = bookingData.status;
        const oldTarget = getEffectiveTarget(oldStatus);
        const newTarget = getEffectiveTarget(newStatus);

        setLiveTracking(liveData);
        liveTrackingRef.current = liveData;
        if (liveData.driver?.userId)
          driverIdRef.current = liveData.driver.userId;
        if (liveData.quoteId) quoteIdRef.current = liveData.quoteId;

        setBooking(bookingData);
        bookingRef.current = bookingData;
        if (bookingData.quoteId) quoteIdRef.current = bookingData.quoteId;

        // Phase / target transition — invalidate SDK distance immediately.
        if (oldTarget !== newTarget) {
          expectedTargetRef.current = newTarget;
          clearNavDistance(
            `target ${oldTarget ?? 'null'} → ${newTarget ?? 'null'}`,
          );
          setGpsProximity({
            pickupMeters: null,
            destinationMeters: null,
            lastUpdate: 0,
            isValid: false,
          });
          setNavState(prev => ({
            ...prev,
            status: 'navigating',
            remainingDistance: null,
            target: null,
            lastDistanceAt: 0,
          }));
        } else {
          expectedTargetRef.current = newTarget;
          setNavState(prev => ({ ...prev, status: 'navigating' }));
        }
        lastKnownStatusRef.current = newStatus;

        // Fix for stale-closure bug: pass the freshly-fetched booking so
        // proximity is computed against the new coordinates.
        recomputeProximity(bookingData);
      } catch (error: any) {
        if (requestId !== loadTripDetailsRequestIdRef.current) return;
        if (isMountedRef.current && !options?.silent) {
          Alert.alert('Error', error.message || 'Failed to load trip');
          navigation.goBack();
        }
      } finally {
        if (
          isMountedRef.current &&
          !options?.silent &&
          requestId === loadTripDetailsRequestIdRef.current
        ) {
          setLoading(false);
        }
      }
    },
    [
      trackingId,
      bookingId,
      navigation,
      recomputeProximity,
      getEffectiveTarget,
      clearNavDistance,
    ],
  );

  const handleCollectCash = useCallback(async () => {
    const b = bookingRef.current;
    if (!b || collectingCash) return;
    if (b.paymentMethod !== 'COC') return;
    if (b.status !== 'dropVerified') return;
    if (b.paymentStatus !== 'PENDING') return;

    setCollectingCash(true);
    setPaymentError(null);

    try {
      await driverRideApi.collectCashPayment(b.bookingId);
      setPaymentSuccess(true);
      await loadTripDetails({ silent: true });
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to collect cash');
      resetCashSwipe();
    } finally {
      setCollectingCash(false);
    }
  }, [collectingCash, loadTripDetails, resetCashSwipe]);

  const handleArrival = useCallback(() => {
    setNavState(prev => ({ ...prev, status: 'arrived' }));
  }, []);

  const handleRerouting = useCallback(() => {
    setNavState(prev => ({ ...prev, status: 'rerouting' }));
  }, []);

  /**
   * Receives SDK-authoritative remaining route distance.
   * Validates, gates by confirmed target + expected target, updates both
   * the synchronous snapshot and the visible React state.
   */
  const handleNavigationStateUpdate = useCallback(
    (data: {
      distance: number;
      eta: number;
      instruction: string;
      target: NavTarget;
    }) => {
      const validDistance =
        typeof data.distance === 'number' &&
        Number.isFinite(data.distance) &&
        data.distance >= 0;
      if (!validDistance) return;

      if (data.target !== 'pickup' && data.target !== 'destination') return;

      // Reject when expected target is null or mismatched.
      const expected = expectedTargetRef.current;
      if (expected === null) return;
      if (data.target !== expected) return;

      const now = Date.now();
      const snap = {
        meters: data.distance,
        target: data.target,
        timestamp: now,
      };
      navDistanceRef.current = snap;
      setNavDistanceState(snap);

      setNavState(prev => ({
        ...prev,
        remainingDistance: data.distance,
        eta:
          typeof data.eta === 'number' && Number.isFinite(data.eta)
            ? data.eta
            : prev.eta,
        currentInstruction: data.instruction || prev.currentInstruction,
        status: 'navigating',
        target: data.target,
        lastDistanceAt: now,
      }));
    },
    [],
  );

  const handleNavReady = useCallback(() => {}, []);

  const handleDriverLocationUpdate = useCallback(
    (loc: { lat: number; lng: number }) => {
      if (!driverIdRef.current || !quoteIdRef.current) return;
      emitDriverLocation(loc.lat, loc.lng, 0, 0);
    },
    [emitDriverLocation],
  );

  useEffect(() => {
    isMountedRef.current = true;
    if (!trackingId || !quoteId) return;

    const setup = async () => {
      await initializeSocket();
      if (socketReadyRef.current) setupLiveTrackingSubscription();
      await loadTripDetails();
    };
    setup();

    return () => {
      isMountedRef.current = false;
      cleanupSubscription();
      if (locationEmitThrottleRef.current)
        clearTimeout(locationEmitThrottleRef.current);
      subscriptionSetupRef.current = false;
    };
  }, [
    trackingId,
    bookingId,
    quoteId,
    initializeSocket,
    setupLiveTrackingSubscription,
    loadTripDetails,
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      loadTripDetails({ silent: true });
    });
    return unsubscribe;
  }, [navigation, loadTripDetails]);

  useEffect(() => {
    if (!trackingId) {
      Alert.alert('Error', 'No tracking ID provided');
      navigation.goBack();
      return;
    }
    if (!quoteId) {
      Alert.alert('Error', 'Missing quoteId');
      navigation.goBack();
      return;
    }
    quoteIdRef.current = quoteId;
  }, [trackingId, bookingId, quoteId, navigation]);

  useEffect(() => {
    bookingRef.current = booking;
    if (booking?.quoteId) quoteIdRef.current = booking.quoteId;

    // Keep expected target in sync if `booking` mutated without loadTripDetails.
    if (booking) {
      const newTarget = getEffectiveTarget(booking.status);
      if (newTarget !== expectedTargetRef.current) {
        expectedTargetRef.current = newTarget;
        clearNavDistance(
          `booking mutation → target ${newTarget ?? 'null'}`,
        );
        setNavState(prev => ({
          ...prev,
          remainingDistance: null,
          target: null,
          lastDistanceAt: 0,
        }));
      }
    }
  }, [booking, getEffectiveTarget, clearNavDistance]);

  useEffect(() => {
    liveTrackingRef.current = liveTracking;
    if (liveTracking?.driver?.userId)
      driverIdRef.current = liveTracking.driver.userId;
    if (liveTracking?.quoteId) quoteIdRef.current = liveTracking.quoteId;
  }, [liveTracking]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      recomputeProximity();
    }, 3000);
    return () => clearInterval(interval);
  }, [recomputeProximity]);

  // Ticker: forces a re-render at a low frequency so the QR button hides
  // when the SDK distance snapshot expires even if no new SDK callback
  // arrives within the freshness window.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isMountedRef.current) return;
      setNavDistanceTick(t => (t + 1) % 1000000);
    }, NAV_DISTANCE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  if (loading && !booking) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Trip not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const effectiveTarget = getEffectiveTarget(booking.status);
  const customerName = getCustomerName();
  const customerPhone = getCustomerPhone();
  const customerAvatar = getCustomerAvatar();
  const addressText = getAddressForTarget(effectiveTarget);
  const addressLabel =
    effectiveTarget === 'pickup'
      ? 'Pickup Location'
      : effectiveTarget === 'destination'
      ? 'Drop Location'
      : 'Navigation';

  const rawDistance = navState.remainingDistance;
  let distanceDisplay = '—';
  if (
    typeof rawDistance === 'number' &&
    Number.isFinite(rawDistance) &&
    rawDistance >= 0
  ) {
    if (rawDistance >= 1000) {
      distanceDisplay = `${(rawDistance / 1000).toFixed(2)} km`;
    } else {
      distanceDisplay = `${Math.round(rawDistance)} m`;
    }
  }

  const rawEta = navState.eta;
  let etaDisplay = '—';
  if (typeof rawEta === 'number' && Number.isFinite(rawEta) && rawEta > 0) {
    const minutes = rawEta > 180 ? Math.ceil(rawEta / 60) : Math.ceil(rawEta);
    etaDisplay = `${minutes} min`;
  }

  const qrScanConfig = getQRScanConfig();

  const showCallControl = isPickupPhase(booking.status);
  const showPaymentCard =
    booking.paymentMethod === 'COC' &&
    booking.status === 'dropVerified' &&
    booking.paymentStatus === 'PENDING' &&
    !paymentSuccess;

  const showOnlinePaymentInfo =
    booking.paymentMethod === 'ONLINE' &&
    (booking.status === 'dropVerified' ||
      booking.status === 'paymentPending');

  const showPaymentCompleted =
    paymentSuccess || booking.paymentStatus === 'COMPLETED';

  const navigationLiveTracking: LiveTrackingData = (liveTracking ||
    (booking as unknown as LiveTrackingData)) as LiveTrackingData;

  return (
    <NavigationProvider
      termsAndConditionsDialogOptions={TERMS_DIALOG_OPTIONS}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.navigationContainer}>
          <NavigationControllerWrapper
            booking={booking}
            liveTracking={navigationLiveTracking}
            target={effectiveTarget}
            onArrival={handleArrival}
            onRerouting={handleRerouting}
            onNavigationStateUpdate={handleNavigationStateUpdate}
            onReady={handleNavReady}
            onDriverLocationUpdate={handleDriverLocationUpdate}
            onDriverRawLocationUpdate={handleDriverRawLocationUpdate}
          />
        </View>

        {isCardExpanded ? (
          <View style={styles.expandedCardContainer}>
            <View style={styles.cardHeaderHandle}>
              <TouchableOpacity
                style={styles.collapseHandleBar}
                onPress={() => setIsCardExpanded(false)}
              />
            </View>

            <View style={styles.topInfoRow}>
              <View style={styles.customerCard}>
                <View style={styles.profileHeader}>
                  {customerAvatar ? (
                    <Image
                      source={{ uri: customerAvatar }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Icon name="person" size={22} color="#e5e7eb" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleTitle}>Customer</Text>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {customerName}
                    </Text>
                  </View>
                </View>

                <View style={styles.rideMetaRow}>
                  <View style={styles.rideMetaItem}>
                    <Icon name="confirmation-number" size={12} color="#6b7280" />
                    <Text style={styles.rideMetaText} numberOfLines={1}>
                      Ride: {displayRideCode}
                    </Text>
                  </View>
                  <View style={styles.rideMetaItem}>
                    <Icon name="receipt-long" size={12} color="#6b7280" />
                    <Text style={styles.rideMetaText} numberOfLines={1}>
                      Booking: {bookingId || '—'}
                    </Text>
                  </View>
                  <View style={styles.rideMetaItem}>
                    <Icon name="track-changes" size={12} color="#6b7280" />
                    <Text style={styles.rideMetaText} numberOfLines={1}>
                      Tracking: {trackingId || '—'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoCard}>
                <View style={styles.infoSection}>
                  <Text style={styles.sectionLabel}>{addressLabel}</Text>
                  <View style={styles.infoRow}>
                    <Icon
                      name="place"
                      size={16}
                      color="#9ca3af"
                      style={styles.infoIcon}
                    />
                    <Text style={styles.infoValueText} numberOfLines={3}>
                      {addressText}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metricBox}>
                    <Icon name="near-me" size={14} color="#10b981" />
                    <Text style={styles.metricLabel}>Distance</Text>
                    <Text style={styles.metricValue}>{distanceDisplay}</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricBox}>
                    <Icon name="access-time" size={14} color="#f59e0b" />
                    <Text style={styles.metricLabel}>ETA</Text>
                    <Text style={styles.metricValue}>{etaDisplay}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.bottomActionsContainer}>
              {showCallControl && (
                <View style={styles.swipeCallTrack}>
                  <View style={styles.swipeCallTrackBg}>
                    <Text style={styles.swipeCallText}>
                      {customerPhone
                        ? 'Swipe right to call customer'
                        : 'Customer phone unavailable'}
                    </Text>
                    <Icon name="chevron-right" size={18} color="#9ca3af" />
                    <Icon
                      name="chevron-right"
                      size={18}
                      color="#d1d5db"
                      style={{ marginLeft: -10 }}
                    />
                  </View>
                  <Animated.View
                    {...callPanResponder.panHandlers}
                    style={[
                      styles.swipeCallThumb,
                      {
                        transform: [{ translateX: callSwipeX }],
                        opacity: customerPhone ? 1 : 0.4,
                      },
                    ]}
                  >
                    <Icon name="call" size={18} color="#111827" />
                  </Animated.View>
                </View>
              )}

              {qrScanConfig?.show && (
                <TouchableOpacity
                  style={[
                    styles.qrScanButton,
                    { backgroundColor: qrScanConfig.color },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleOpenQRScanner(qrScanConfig.scanType)}
                >
                  <View style={styles.qrIconCircle}>
                    <Icon name={qrScanConfig.icon} size={20} color="#111827" />
                  </View>
                  <Text style={styles.qrScanText}>{qrScanConfig.label}</Text>
                  <Icon
                    name="chevron-right"
                    size={22}
                    color="#ffffff"
                    style={{ marginLeft: 'auto' }}
                  />
                </TouchableOpacity>
              )}

              {showPaymentCard && (
                <View style={styles.paymentCard}>
                  <View style={styles.paymentHeaderRow}>
                    <Icon name="payments" size={20} color="#10b981" />
                    <Text style={styles.paymentTitle}>Collect Cash</Text>
                    <Text style={styles.paymentAmountInline}>
                      ₹{booking.fare.totalFare.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.paymentInstruction}>
                    Collect exact fare from customer, then swipe to confirm.
                  </Text>

                  {paymentError && (
                    <Text style={styles.paymentErrorText}>{paymentError}</Text>
                  )}

                  <View style={styles.swipeCashTrack}>
                    <View style={styles.swipeCashTrackBg}>
                      <Text style={styles.swipeCashText}>
                        {collectingCash
                          ? 'Confirming...'
                          : 'Swipe to confirm cash'}
                      </Text>
                      <Icon name="chevron-right" size={18} color="#d1fae5" />
                    </View>
                    <Animated.View
                      {...cashPanResponder.panHandlers}
                      style={[
                        styles.swipeCashThumb,
                        {
                          transform: [{ translateX: cashSwipeX }],
                          opacity: collectingCash ? 0.5 : 1,
                        },
                      ]}
                    >
                      {collectingCash ? (
                        <ActivityIndicator size="small" color="#065f46" />
                      ) : (
                        <Icon name="check" size={20} color="#065f46" />
                      )}
                    </Animated.View>
                  </View>
                </View>
              )}

              {showOnlinePaymentInfo && !showPaymentCompleted && (
                <View style={styles.onlinePaymentCard}>
                  <Icon name="hourglass-empty" size={20} color="#f59e0b" />
                  <Text style={styles.onlinePaymentText}>
                    Waiting for customer payment
                  </Text>
                </View>
              )}

              {showPaymentCompleted &&
                booking.paymentStatus !== 'PENDING' && (
                  <View style={styles.paymentCompletedCard}>
                    <Icon name="check-circle" size={22} color="#10b981" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paymentCompletedTitle}>
                        Payment Completed
                      </Text>
                      <Text style={styles.paymentCompletedSub}>
                        {booking.paymentMethod === 'COC'
                          ? `Cash collected — ₹${booking.fare.totalFare.toFixed(2)}`
                          : `Paid Online — ₹${booking.fare.totalFare.toFixed(2)}`}
                      </Text>
                    </View>
                  </View>
                )}
            </View>
          </View>
        ) : (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.minimizedPillBar,
              { transform: pan.getTranslateTransform() },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handlePillPress}
              style={styles.pillContent}
            >
              <Icon name="drag-indicator" size={20} color="#9ca3af" />
              <Text style={styles.pillText}>Double Tap to Expand</Text>
              <Icon name="unfold-more" size={20} color="#ffffff" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>
    </NavigationProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: { marginTop: 12, fontSize: 16, color: '#ffffff' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  errorText: { fontSize: 18, color: '#ffffff', marginTop: 12 },
  navigationContainer: { flex: 1, backgroundColor: '#1a1a2e' },
  backButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

  expandedCardContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#000000',
    borderRadius: 28,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 999,
  },
  cardHeaderHandle: { alignItems: 'center', marginBottom: 4 },
  collapseHandleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#4b5563',
    borderRadius: 2,
  },

  topInfoRow: { flexDirection: 'row', gap: 10 },
  customerCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    justifyContent: 'space-between',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#9ca3af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleTitle: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  nameText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rideMetaRow: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
    marginTop: 4,
  },
  rideMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rideMetaText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    flexShrink: 1,
  },

  infoCard: {
    flex: 1,
    backgroundColor: '#1b1b1b',
    borderRadius: 18,
    padding: 12,
    justifyContent: 'space-between',
  },
  infoSection: { marginBottom: 6 },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoIcon: { marginRight: 4, marginTop: 1 },
  infoValueText: {
    color: '#e5e7eb',
    fontSize: 12,
    flexShrink: 1,
    lineHeight: 16,
    fontWeight: '600',
  },

  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  metricBox: { flex: 1, alignItems: 'center', gap: 2 },
  metricLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  metricValue: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#374151',
    marginHorizontal: 6,
  },

  bottomActionsContainer: { gap: 8 },

  swipeCallTrack: {
    height: SWIPE_THUMB_SIZE + 8,
    backgroundColor: '#262626',
    borderRadius: 26,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swipeCallTrackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SWIPE_THUMB_SIZE + 14,
    paddingRight: 12,
  },
  swipeCallText: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  swipeCallThumb: {
    width: SWIPE_THUMB_SIZE,
    height: SWIPE_THUMB_SIZE,
    borderRadius: SWIPE_THUMB_SIZE / 2,
    backgroundColor: '#ffffff',
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },

  qrScanButton: {
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qrIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrScanText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
  },

  paymentCard: {
    backgroundColor: '#064e3b',
    borderRadius: 18,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentTitle: {
    color: '#d1fae5',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },
  paymentAmountInline: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18,
  },
  paymentInstruction: {
    color: '#a7f3d0',
    fontSize: 11,
    lineHeight: 15,
  },
  paymentErrorText: {
    color: '#fecaca',
    fontSize: 11,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 6,
    borderRadius: 6,
  },

  swipeCashTrack: {
    height: SWIPE_THUMB_SIZE + 4,
    backgroundColor: '#065f46',
    borderRadius: 26,
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  swipeCashTrackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SWIPE_THUMB_SIZE + 14,
    paddingRight: 12,
  },
  swipeCashText: {
    flex: 1,
    color: '#d1fae5',
    fontSize: 12,
    fontWeight: '600',
  },
  swipeCashThumb: {
    width: SWIPE_THUMB_SIZE,
    height: SWIPE_THUMB_SIZE,
    borderRadius: SWIPE_THUMB_SIZE / 2,
    backgroundColor: '#ffffff',
    marginLeft: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  onlinePaymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#78350f',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  onlinePaymentText: {
    color: '#fef3c7',
    fontSize: 12,
    fontWeight: '600',
  },
  paymentCompletedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#064e3b',
    padding: 12,
    borderRadius: 14,
  },
  paymentCompletedTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  paymentCompletedSub: {
    color: '#a7f3d0',
    fontSize: 11,
    marginTop: 2,
  },

  minimizedPillBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
    backgroundColor: '#111827',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  pillContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
});

export default RideTrackingScreen;