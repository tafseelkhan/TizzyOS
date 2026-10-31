// src/navigations/google/NavigationControllerWrapper.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Platform,
  TouchableOpacity,
  AppState,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import {
  NavigationView,
  useNavigation,
  TravelMode,
  AudioGuidance,
  type Waypoint,
  type LatLng,
  type ArrivalEvent,
  NavigationSessionStatus,
  RouteStatus,
} from '@googlemaps/react-native-navigation-sdk';
import { Booking, LiveTrackingData } from '../../core/types/RideTypes';

type NavigationLifecycle =
  | 'idle'
  | 'checkingLocationPermission'
  | 'locationPermissionDenied'
  | 'locationPermissionGranted'
  | 'checkingTerms'
  | 'termsRequired'
  | 'termsAccepted'
  | 'initializing'
  | 'initialized'
  | 'navigatorReady'
  | 'locationReady'
  | 'settingDestination'
  | 'routeReady'
  | 'startingGuidance'
  | 'navigating'
  | 'arrived'
  | 'error'
  | 'destroyed';

export interface DriverRawLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

interface NavigationControllerWrapperProps {
  booking: Booking;
  liveTracking: LiveTrackingData;
  /**
   * Confirmed navigation target. `null` disables route setup and QR
   * eligibility — used when the booking status is unknown or not in a
   * ride phase.
   */
  target: 'pickup' | 'destination' | null;
  onArrival: () => void;
  onRerouting: () => void;
  onNavigationStateUpdate: (data: {
    distance: number;
    eta: number;
    instruction: string;
    maneuver?: string;
    /** Confirmed route target the distance belongs to. */
    target: 'pickup' | 'destination';
  }) => void;
  onReady: () => void;
  onDriverLocationUpdate?: (location: { lat: number; lng: number }) => void;
  onDriverRawLocationUpdate?: (location: DriverRawLocation) => void;
}

// GPS jump filter constants
const GPS_JUMP_MAX_DISTANCE_METERS = 500;
const GPS_JUMP_MAX_TIME_MS = 2000;
const MAX_PLAUSIBLE_SPEED_MPS = 60; // 216 km/h — generous for ride-hailing
const LOCATION_MAX_AGE_MS = 20000;

// Route-distance settling window after setDestinations + startGuidance.
// NOTE: this delay alone does NOT prove callback-route attribution —
// SDK 0.18.0 provides no route id in `setOnRemainingTimeOrDistanceChanged`.
// It is only one of several guards (see target change invalidation +
// routeTransitionSeqRef + confirmedRouteTargetRef tagging).
const ROUTE_DISTANCE_SETTLE_MS = 1500;

const checkLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const fineGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      console.log('[Navigation] 🔐 Fine location:', fineGranted);
      return fineGranted;
    } catch (error) {
      console.warn('[Navigation] Permission check error:', error);
      return false;
    }
  }
  return true;
};

const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message:
            'Navigation requires access to your location to provide turn-by-turn guidance.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
          buttonNeutral: 'Ask Me Later',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.warn('[Navigation] Permission request error:', error);
      return false;
    }
  }
  return true;
};

const checkAudioSettings = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    console.log('[Navigation] 🔊 Audio settings configured');
    return true;
  }
  return true;
};

const openSettings = () => {
  Linking.openSettings();
};

const isValidLat = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;

const isValidLng = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;

const haversineDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
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

export const NavigationControllerWrapper: React.FC<
  NavigationControllerWrapperProps
> = ({
  booking,
  liveTracking,
  target,
  onArrival,
  onRerouting,
  onNavigationStateUpdate,
  onReady,
  onDriverLocationUpdate,
  onDriverRawLocationUpdate,
}) => {
  const {
    navigationController,
    removeAllListeners,
    setOnArrival,
    setOnRouteChanged,
    setOnNavigationReady,
    setOnLocationChanged,
    setOnRemainingTimeOrDistanceChanged,
  } = useNavigation();

  const navigationControllerRef = useRef(navigationController);
  useEffect(() => {
    navigationControllerRef.current = navigationController;
  }, [navigationController]);

  const removeAllListenersRef = useRef(removeAllListeners);
  useEffect(() => {
    removeAllListenersRef.current = removeAllListeners;
  }, [removeAllListeners]);

  const setOnRemainingTimeOrDistanceChangedRef = useRef(
    setOnRemainingTimeOrDistanceChanged,
  );
  useEffect(() => {
    setOnRemainingTimeOrDistanceChangedRef.current =
      setOnRemainingTimeOrDistanceChanged;
  }, [setOnRemainingTimeOrDistanceChanged]);

  const setOnArrivalRef = useRef(setOnArrival);
  const setOnRouteChangedRef = useRef(setOnRouteChanged);
  const setOnNavigationReadyRef = useRef(setOnNavigationReady);
  const setOnLocationChangedRef = useRef(setOnLocationChanged);

  useEffect(() => {
    setOnArrivalRef.current = setOnArrival;
    setOnRouteChangedRef.current = setOnRouteChanged;
    setOnNavigationReadyRef.current = setOnNavigationReady;
    setOnLocationChangedRef.current = setOnLocationChanged;
  }, [
    setOnArrival,
    setOnRouteChanged,
    setOnNavigationReady,
    setOnLocationChanged,
  ]);

  const onArrivalRef = useRef(onArrival);
  const onReroutingRef = useRef(onRerouting);
  const onReadyRef = useRef(onReady);
  const onDriverLocationUpdateRef = useRef(onDriverLocationUpdate);
  const onDriverRawLocationUpdateRef = useRef(onDriverRawLocationUpdate);
  const onNavigationStateUpdateRef = useRef(onNavigationStateUpdate);

  useEffect(() => {
    onArrivalRef.current = onArrival;
    onReroutingRef.current = onRerouting;
    onReadyRef.current = onReady;
    onDriverLocationUpdateRef.current = onDriverLocationUpdate;
    onDriverRawLocationUpdateRef.current = onDriverRawLocationUpdate;
    onNavigationStateUpdateRef.current = onNavigationStateUpdate;
  }, [
    onArrival,
    onRerouting,
    onReady,
    onDriverLocationUpdate,
    onDriverRawLocationUpdate,
    onNavigationStateUpdate,
  ]);

  const [lifecycle, setLifecycle] = useState<NavigationLifecycle>('idle');
  const [initError, setInitError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [showTermsUI, setShowTermsUI] = useState(false);
  const [showPermissionUI, setShowPermissionUI] = useState(false);

  const isMountedRef = useRef(true);
  const lifecycleRef = useRef<NavigationLifecycle>('idle');
  const isGuidanceStartedRef = useRef(false);
  const initStartedRef = useRef(false);
  const isNavigatorReadyRef = useRef(false);
  const locationReceivedRef = useRef(false);
  const initAttemptedRef = useRef(false);
  const routeSetupInProgressRef = useRef(false);
  const routeSetupTriggeredRef = useRef(false);
  const targetChangeInProgressRef = useRef(false);
  const currentTargetRef = useRef<'pickup' | 'destination' | null>(target);
  const pendingTargetRef = useRef<'pickup' | 'destination' | null>(null);
  const permissionsCheckedRef = useRef(false);
  const termsHandledRef = useRef(false);
  const listenersRegisteredRef = useRef(false);
  const confirmedRouteTargetRef = useRef<'pickup' | 'destination' | null>(
    null,
  );
  const lastInstructionRef = useRef<string>('');

  // Route transition / distance validity.
  // `routeTransitionInProgressRef` — true while setDestinations/startGuidance
  // is running; distance callbacks are dropped until cleared.
  // `routeDistanceValidRef` — true only after the settling window passes
  // for the current confirmed route.
  const routeTransitionInProgressRef = useRef(false);
  const routeDistanceValidRef = useRef(false);
  const routeDistanceSettlingRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Local operation sequence — used to prevent a slow async route setup
  // from publishing a result after it was superseded. NOT a substitute for
  // an SDK route id (which SDK 0.18.0 does not provide).
  const routeTransitionSeqRef = useRef(0);

  // GPS jump filter
  const lastValidLocationRef = useRef<{
    lat: number;
    lng: number;
    timestamp: number;
  } | null>(null);

  const rawLocationSequenceRef = useRef(0);

  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const locationEmitThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastEmitLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const updateLifecycle = useCallback((newState: NavigationLifecycle) => {
    if (!isMountedRef.current) return;
    lifecycleRef.current = newState;
    setLifecycle(newState);
    console.log(`[Navigation] 🔄 Lifecycle: ${newState}`);
  }, []);

  const getTargetCoords = useCallback(
    (forTarget: 'pickup' | 'destination') => {
      return forTarget === 'pickup' ? booking.pickup : booking.destination;
    },
    [booking],
  );

  const getLatLng = useCallback(
    (forTarget: 'pickup' | 'destination'): LatLng => {
      const coords = getTargetCoords(forTarget);
      return { lat: coords.latitude, lng: coords.longitude };
    },
    [getTargetCoords],
  );

  const getWaypoint = useCallback(
    (forTarget: 'pickup' | 'destination'): Waypoint => ({
      title: forTarget === 'pickup' ? 'Pickup Location' : 'Destination',
      position: getLatLng(forTarget),
    }),
    [getLatLng],
  );

  const getRoutingOptions = useCallback(
    () => ({
      travelMode: TravelMode.DRIVING,
      avoidFerries: false,
      avoidTolls: false,
      avoidHighways: false,
    }),
    [],
  );

  const emitDriverLocation = useCallback(
    (latitude: number, longitude: number) => {
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
        if (onDriverLocationUpdateRef.current) {
          onDriverLocationUpdateRef.current({ lat: latitude, lng: longitude });
        }
      }, 1000);
    },
    [],
  );

  const handleLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;

    console.log('[Navigation] 🔐 Checking location permission...');
    updateLifecycle('checkingLocationPermission');

    const hasPermission = await checkLocationPermission();

    if (hasPermission) {
      console.log('[Navigation] ✅ Location permission already granted');
      updateLifecycle('locationPermissionGranted');
      permissionsCheckedRef.current = true;
      return true;
    }

    console.log('[Navigation] 🔐 Requesting location permission...');
    const granted = await requestLocationPermission();

    if (granted) {
      console.log('[Navigation] ✅ Location permission granted');
      updateLifecycle('locationPermissionGranted');
      permissionsCheckedRef.current = true;
      return true;
    }

    const isPermanentlyDenied =
      Platform.OS === 'android' &&
      !(await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ));

    if (isPermanentlyDenied) {
      setInitError(
        'Location permission permanently denied. Please enable it in settings.',
      );
    } else {
      setInitError('Location permission required for navigation.');
    }
    updateLifecycle('locationPermissionDenied');
    setShowPermissionUI(true);
    return false;
  }, [updateLifecycle]);

  const handleTermsFlow = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;
    const controller = navigationControllerRef.current;
    if (!controller) return false;

    if (termsHandledRef.current) {
      return true;
    }

    console.log('[Navigation] 📜 Checking terms acceptance...');
    updateLifecycle('checkingTerms');

    try {
      const termsAccepted = await controller.showTermsAndConditionsDialog();

      if (!termsAccepted) {
        updateLifecycle('termsRequired');
        setShowTermsUI(true);
        return false;
      }

      termsHandledRef.current = true;
      updateLifecycle('termsAccepted');
      return true;
    } catch (error) {
      console.error('[Navigation] ❌ Error showing terms dialog:', error);
      setInitError('Failed to show Terms and Conditions.');
      updateLifecycle('error');
      return false;
    }
  }, [updateLifecycle]);

  const initializeSDK = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;
    const controller = navigationControllerRef.current;
    if (!controller) return false;

    if (initStartedRef.current) return false;

    console.log('[Navigation] 📡 SDK_INIT_START');
    updateLifecycle('initializing');
    initStartedRef.current = true;

    try {
      const status = await controller.init();
      console.log(`[Navigation] 📡 SDK_INIT_STATUS: ${status}`);

      if (status === NavigationSessionStatus.OK) {
        updateLifecycle('initialized');
        return true;
      } else {
        setInitError(`Navigation initialization failed: ${status}`);
        updateLifecycle('error');
        return false;
      }
    } catch (error: any) {
      setInitError(error?.message || 'Unknown initialization error');
      updateLifecycle('error');
      return false;
    } finally {
      initStartedRef.current = false;
    }
  }, [updateLifecycle]);

  const setAudioGuidance = useCallback(async (): Promise<boolean> => {
    const controller = navigationControllerRef.current;
    if (!controller) return false;

    try {
      await controller.setAudioGuidanceType(
        AudioGuidance.VOICE_ALERTS_AND_GUIDANCE,
      );
      return true;
    } catch (error) {
      console.warn('[Navigation] ⚠️ Failed to set audio guidance:', error);
      return false;
    }
  }, []);

  const stopGuidanceIntentional = useCallback(async (reason: string) => {
    const controller = navigationControllerRef.current;
    if (!controller) return;
    if (!isGuidanceStartedRef.current) return;

    console.log(`[Navigation] 🛑 STOP_GUIDANCE: ${reason}`);
    try {
      await controller.stopGuidance();
      isGuidanceStartedRef.current = false;
    } catch (e) {
      console.warn('[Navigation] ⚠️ Stop guidance error:', e);
    }
  }, []);

  const invalidateRouteDistance = useCallback(() => {
    routeDistanceValidRef.current = false;
    if (routeDistanceSettlingRef.current) {
      clearTimeout(routeDistanceSettlingRef.current);
      routeDistanceSettlingRef.current = null;
    }
  }, []);

  const resetRouteStateForRetry = useCallback(() => {
    confirmedRouteTargetRef.current = null;
    routeTransitionInProgressRef.current = false;
    invalidateRouteDistance();
    if (routeDistanceSettlingRef.current) {
      clearTimeout(routeDistanceSettlingRef.current);
      routeDistanceSettlingRef.current = null;
    }
  }, [invalidateRouteDistance]);

  /**
   * Applies a route to `routeTarget`. Uses a local operation sequence id
   * (`routeTransitionSeqRef`) so a slow operation that has been superseded
   * cannot publish a confirmed target or enable distance validity.
   *
   * SDK 0.18.0 limitation: `setOnRemainingTimeOrDistanceChanged` carries no
   * route id. The seq guard protects wrapper-side async races, not SDK-side
   * callback attribution.
   */
  const applyRouteForTarget = useCallback(
    async (routeTarget: 'pickup' | 'destination'): Promise<boolean> => {
      const controller = navigationControllerRef.current;
      if (!controller) return false;

      // Reject if the intended target has already moved on.
      if (currentTargetRef.current !== routeTarget) {
        console.warn(
          `[Navigation] ⚠️ applyRouteForTarget superseded: wanted=${routeTarget} current=${currentTargetRef.current}`,
        );
        return false;
      }

      // Bump op sequence for this transition. Everything below will check it.
      routeTransitionSeqRef.current += 1;
      const opSeq = routeTransitionSeqRef.current;

      await stopGuidanceIntentional(`route → ${routeTarget}`);

      // Guard between async boundaries.
      if (
        !isMountedRef.current ||
        opSeq !== routeTransitionSeqRef.current ||
        currentTargetRef.current !== routeTarget
      ) {
        console.warn(
          `[Navigation] ⚠️ applyRouteForTarget aborted mid-transition (seq=${opSeq}/${routeTransitionSeqRef.current})`,
        );
        return false;
      }

      // Invalidate everything *before* setting destinations.
      confirmedRouteTargetRef.current = null;
      lastInstructionRef.current = '';
      routeTransitionInProgressRef.current = true;
      invalidateRouteDistance();
      setRouteError(null);

      const waypoint = getWaypoint(routeTarget);
      const routingOptions = getRoutingOptions();
      const waypointPosition = waypoint.position ?? getLatLng(routeTarget);
      const safeWaypoint: Waypoint = {
        ...waypoint,
        position: waypointPosition,
      };

      console.log(
        `[Navigation] 🎯 APPLY_ROUTE: ${routeTarget} → ${waypointPosition.lat},${waypointPosition.lng}`,
      );

      let routeStatus: RouteStatus;
      try {
        routeStatus = await controller.setDestinations([safeWaypoint], {
          routingOptions,
        });
      } catch (err: any) {
        console.error(`[Navigation] ❌ setDestinations threw:`, err);
        if (opSeq === routeTransitionSeqRef.current) {
          routeTransitionInProgressRef.current = false;
          invalidateRouteDistance();
        }
        return false;
      }

      // Guard: superseded while awaiting setDestinations.
      if (
        !isMountedRef.current ||
        opSeq !== routeTransitionSeqRef.current ||
        currentTargetRef.current !== routeTarget
      ) {
        console.warn(
          `[Navigation] ⚠️ setDestinations result discarded (superseded, seq=${opSeq}/${routeTransitionSeqRef.current})`,
        );
        return false;
      }

      console.log(`[Navigation] 🛣️ ROUTE_STATUS(${routeTarget}): ${routeStatus}`);

      if (routeStatus !== RouteStatus.OK) {
        console.error(`[Navigation] ❌ Route failed: ${routeStatus}`);
        routeTransitionInProgressRef.current = false;
        invalidateRouteDistance();
        return false;
      }

      await setAudioGuidance();

      if (
        !isMountedRef.current ||
        opSeq !== routeTransitionSeqRef.current ||
        currentTargetRef.current !== routeTarget
      ) {
        console.warn(
          `[Navigation] ⚠️ startGuidance skipped (superseded, seq=${opSeq}/${routeTransitionSeqRef.current})`,
        );
        return false;
      }

      try {
        await controller.startGuidance();
      } catch (err: any) {
        console.error(`[Navigation] ❌ startGuidance threw:`, err);
        if (opSeq === routeTransitionSeqRef.current) {
          routeTransitionInProgressRef.current = false;
          invalidateRouteDistance();
        }
        return false;
      }

      // Final guard — target must still match and op must still be latest.
      if (
        !isMountedRef.current ||
        opSeq !== routeTransitionSeqRef.current ||
        currentTargetRef.current !== routeTarget
      ) {
        console.warn(
          `[Navigation] ⚠️ Route confirmed for ${routeTarget} but superseded (seq=${opSeq}/${routeTransitionSeqRef.current}); discarding.`,
        );
        return false;
      }

      isGuidanceStartedRef.current = true;
      confirmedRouteTargetRef.current = routeTarget;
      routeTransitionInProgressRef.current = false;

      // Settling window before we accept distance updates.
      // NOTE: this delay alone does NOT prove SDK callback attribution —
      // SDK 0.18.0 provides no route id. Combined with
      // routeTransitionSeqRef + confirmedRouteTargetRef tagging it reduces,
      // but cannot eliminate, stale-callback risk.
      routeDistanceSettlingRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        if (opSeq !== routeTransitionSeqRef.current) return;
        if (confirmedRouteTargetRef.current !== routeTarget) return;
        routeDistanceValidRef.current = true;
        routeDistanceSettlingRef.current = null;
      }, ROUTE_DISTANCE_SETTLE_MS);

      console.log(`[Navigation] ✅ ROUTE_CONFIRMED: ${routeTarget}`);
      return true;
    },
    [
      getWaypoint,
      getLatLng,
      getRoutingOptions,
      setAudioGuidance,
      stopGuidanceIntentional,
      invalidateRouteDistance,
    ],
  );

  const startRouteSetup = useCallback(() => {
    if (!isMountedRef.current) return;
    if (routeSetupTriggeredRef.current) return;
    if (routeSetupInProgressRef.current) return;
    if (!isNavigatorReadyRef.current) return;

    // No target yet — wait for the parent to publish a booking phase.
    if (currentTargetRef.current === null) {
      console.log('[Navigation] ⏸️ No target yet; skipping route setup');
      return;
    }

    if (!locationReceivedRef.current) {
      if (locationFallbackTimerRef.current) {
        clearTimeout(locationFallbackTimerRef.current);
      }
      locationFallbackTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        if (!locationReceivedRef.current && isNavigatorReadyRef.current) {
          console.warn('[Navigation] ⚠️ Location timeout');
          locationReceivedRef.current = true;
          updateLifecycle('locationReady');
          startRouteSetup();
        }
      }, 5000);
      return;
    }

    if (isGuidanceStartedRef.current) return;

    routeSetupTriggeredRef.current = true;
    routeSetupInProgressRef.current = true;
    updateLifecycle('settingDestination');

    const performInitialSetup = async () => {
      try {
        const initialTarget = currentTargetRef.current;
        if (initialTarget === null) {
          routeSetupInProgressRef.current = false;
          routeSetupTriggeredRef.current = false;
          return;
        }
        const success = await applyRouteForTarget(initialTarget);

        if (!success) {
          setRouteError('Initial route setup failed');
          updateLifecycle('error');
          return;
        }

        updateLifecycle('navigating');
        console.log('[Navigation] ✅ INITIAL_ROUTE_ACTIVE');

        if (onReadyRef.current) onReadyRef.current();
      } catch (error: any) {
        console.error('[Navigation] ❌ Initial route error:', error);
        setRouteError(error?.message || 'Route setup failed');
        updateLifecycle('error');
      } finally {
        routeSetupTriggeredRef.current = false;
        routeSetupInProgressRef.current = false;
      }
    };

    performInitialSetup();
  }, [applyRouteForTarget, updateLifecycle]);

  const registerListeners = useCallback(() => {
    if (listenersRegisteredRef.current) return;
    const controller = navigationControllerRef.current;
    if (!controller) return;

    console.log('[Navigation] 📡 LISTENERS_REGISTERED');

    setOnNavigationReadyRef.current?.(() => {
      if (!isMountedRef.current) return;
      console.log('[Navigation] 🧭 NAVIGATOR_READY');
      isNavigatorReadyRef.current = true;
      updateLifecycle('navigatorReady');
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      startRouteSetup();
    });

    setOnLocationChangedRef.current?.((location: LatLng) => {
      if (!isMountedRef.current) return;

      if (!isValidLat(location?.lat) || !isValidLng(location?.lng)) {
        console.warn('[Navigation] 🚫 Invalid location rejected:', location);
        return;
      }

      const now = Date.now();
      const last = lastValidLocationRef.current;

      if (last) {
        const timeDiff = now - last.timestamp;

        if (timeDiff > 0) {
          const dist = haversineDistanceMeters(
            location.lat,
            location.lng,
            last.lat,
            last.lng,
          );

          const maxPlausibleDistance =
            (timeDiff / 1000) * MAX_PLAUSIBLE_SPEED_MPS;

          if (
            dist > GPS_JUMP_MAX_DISTANCE_METERS &&
            dist > maxPlausibleDistance
          ) {
            console.warn(
              `[Navigation] 🚫 GPS JUMP REJECTED: ${Math.round(dist)}m in ${timeDiff}ms`,
            );
            return;
          }

          if (
            timeDiff < GPS_JUMP_MAX_TIME_MS &&
            dist > GPS_JUMP_MAX_DISTANCE_METERS
          ) {
            console.warn(
              `[Navigation] 🚫 GPS JUMP REJECTED (short interval): ${Math.round(
                dist,
              )}m in ${timeDiff}ms`,
            );
            return;
          }
        }
      }

      lastValidLocationRef.current = {
        lat: location.lat,
        lng: location.lng,
        timestamp: now,
      };

      rawLocationSequenceRef.current += 1;

      console.log(
        `[Navigation] 📍 Location: ${location.lat.toFixed(
          6,
        )}, ${location.lng.toFixed(6)}`,
      );

      emitDriverLocation(location.lat, location.lng);

      if (onDriverRawLocationUpdateRef.current) {
        onDriverRawLocationUpdateRef.current({
          lat: location.lat,
          lng: location.lng,
          timestamp: now,
        });
      }

      if (!locationReceivedRef.current) {
        locationReceivedRef.current = true;
        console.log(`[Navigation] 📍 First valid location`);
        updateLifecycle('locationReady');
        startRouteSetup();
      }
    });

    setOnArrivalRef.current?.((event: ArrivalEvent) => {
      if (!isMountedRef.current) return;
      console.log('[Navigation] 🏁 ARRIVAL_EVENT:', event);
      if (event.isFinalDestination) {
        updateLifecycle('arrived');
        if (onArrivalRef.current) onArrivalRef.current();
      } else {
        controller.continueToNextDestination();
      }
    });

    setOnRouteChangedRef.current?.(() => {
      if (!isMountedRef.current) return;
      console.log('[Navigation] 🔄 ROUTE_CHANGED');
      if (onReroutingRef.current) onReroutingRef.current();
    });

    setOnRemainingTimeOrDistanceChangedRef.current?.((timeAndDistance) => {
      if (!isMountedRef.current) return;

      // Reject while a route transition is in progress.
      if (routeTransitionInProgressRef.current) return;

      // Reject until settling window completes.
      if (!routeDistanceValidRef.current) return;

      const confirmedTarget = confirmedRouteTargetRef.current;
      if (confirmedTarget === null) return;

      const meters = timeAndDistance?.meters;
      const seconds = timeAndDistance?.seconds;

      const isValidDistance =
        typeof meters === 'number' &&
        Number.isFinite(meters) &&
        meters >= 0;
      const isValidEta =
        typeof seconds === 'number' &&
        Number.isFinite(seconds) &&
        seconds >= 0;

      if (!isValidDistance) return;

      if (onNavigationStateUpdateRef.current) {
        onNavigationStateUpdateRef.current({
          distance: meters,
          eta: isValidEta ? seconds : 0,
          instruction: lastInstructionRef.current || '',
          target: confirmedTarget,
        });
      }
    });

    listenersRegisteredRef.current = true;
    console.log('[Navigation] ✅ Listeners registered');
  }, [updateLifecycle, startRouteSetup, emitDriverLocation]);

  const unregisterListeners = useCallback(() => {
    if (!listenersRegisteredRef.current) return;
    try {
      removeAllListenersRef.current?.();
    } catch (e) {
      console.warn('[Navigation] ⚠️ Remove listeners error:', e);
    }
    listenersRegisteredRef.current = false;
  }, []);

  // Serialized target switching. Applies the latest pending target directly.
  const handleTargetChange = useCallback(async () => {
    if (!isMountedRef.current) return;

    if (targetChangeInProgressRef.current) {
      pendingTargetRef.current = target;
      return;
    }

    const desiredTarget = pendingTargetRef.current ?? target;
    pendingTargetRef.current = null;

    // If the parent has published `null`, stop guidance and mark distance
    // invalid — QR must remain hidden until a valid target reappears.
    if (desiredTarget === null) {
      // Bump seq so any in-flight route op cannot publish a confirmed target.
      routeTransitionSeqRef.current += 1;
      await stopGuidanceIntentional('target cleared');
      currentTargetRef.current = null;
      resetRouteStateForRetry();
      return;
    }

    if (
      currentTargetRef.current === desiredTarget &&
      confirmedRouteTargetRef.current === desiredTarget
    ) {
      return;
    }

    if (lifecycleRef.current !== 'navigating') {
      pendingTargetRef.current = desiredTarget;
      return;
    }

    if (!isNavigatorReadyRef.current) {
      pendingTargetRef.current = desiredTarget;
      return;
    }

    targetChangeInProgressRef.current = true;

    try {
      console.log(
        `[Navigation] 🔄 TARGET_CHANGE: ${currentTargetRef.current} → ${desiredTarget}`,
      );

      const previousTarget = currentTargetRef.current;
      currentTargetRef.current = desiredTarget;

      const success = await applyRouteForTarget(desiredTarget);

      if (!success) {
        // Roll back on failure so retry starts from a clean state.
        currentTargetRef.current = previousTarget;
        console.error(`[Navigation] ❌ TARGET_CHANGE failed: ${desiredTarget}`);
        setRouteError(`Failed to switch route to ${desiredTarget}`);
        resetRouteStateForRetry();
        updateLifecycle('error');
        return;
      }

      // applyRouteForTarget already rejects if the target changed mid-flight.
      if (currentTargetRef.current !== desiredTarget) {
        console.warn(
          `[Navigation] ⚠️ TARGET_CHANGE superseded: ${desiredTarget} → ${currentTargetRef.current}`,
        );
        return;
      }

      updateLifecycle('navigating');
      console.log(`[Navigation] ✅ TARGET_CHANGE COMPLETE: ${desiredTarget}`);

      if (onReadyRef.current) onReadyRef.current();
    } catch (error: any) {
      console.error('[Navigation] ❌ Target change error:', error);
      setRouteError('Target change failed');
      resetRouteStateForRetry();
      updateLifecycle('error');
    } finally {
      targetChangeInProgressRef.current = false;
    }

    if (
      pendingTargetRef.current !== null &&
      pendingTargetRef.current !== currentTargetRef.current &&
      isMountedRef.current
    ) {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        handleTargetChange();
      }, 0);
    }
  }, [
    target,
    applyRouteForTarget,
    updateLifecycle,
    resetRouteStateForRetry,
    stopGuidanceIntentional,
  ]);

  const initializeNavigation = useCallback(async () => {
    if (!isMountedRef.current) return;
    const controller = navigationControllerRef.current;
    if (!controller) return;
    if (initAttemptedRef.current) return;

    console.log('[Navigation] 🚀 SESSION_MOUNT');

    try {
      await checkAudioSettings();

      const hasPermission = await handleLocationPermission();
      if (!hasPermission) return;

      const termsAccepted = await handleTermsFlow();
      if (!termsAccepted) return;

      registerListeners();

      const initSuccess = await initializeSDK();
      if (!initSuccess) return;

      safetyTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        if (!isNavigatorReadyRef.current) {
          isNavigatorReadyRef.current = true;
          updateLifecycle('navigatorReady');
          startRouteSetup();
        }
      }, 10000);

      initAttemptedRef.current = true;
      console.log('[Navigation] ✅ Init flow completed');
    } catch (error: any) {
      console.error('[Navigation] ❌ Init error:', error);
      setInitError(error?.message || 'Init flow failed');
      updateLifecycle('error');
    }
  }, [
    handleLocationPermission,
    handleTermsFlow,
    registerListeners,
    initializeSDK,
    updateLifecycle,
    startRouteSetup,
  ]);

  useEffect(() => {
    if (
      navigationControllerRef.current &&
      lifecycleRef.current === 'idle' &&
      !initAttemptedRef.current
    ) {
      initializeNavigation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep currentTargetRef in sync with the prop, and invalidate distance
  // IMMEDIATELY when the intended target changes.
  useEffect(() => {
    if (!isMountedRef.current) return;

    // If target actually changed vs the last confirmed/current target,
    // clear distance valid + confirmed route right away so QR cannot be
    // enabled by an old-target snapshot while the wrapper is still
    // transitioning.
    if (target !== currentTargetRef.current) {
      invalidateRouteDistance();
      confirmedRouteTargetRef.current = null;
      routeTransitionSeqRef.current += 1;
    }

    if (lifecycleRef.current === 'navigating') {
      handleTargetChange();
    } else {
      // Pre-navigating: remember the latest prop value.
      currentTargetRef.current = target;
      pendingTargetRef.current = target;
    }
  }, [target, handleTargetChange, invalidateRouteDistance]);

  useEffect(() => {
    if (
      lifecycleRef.current === 'navigating' &&
      pendingTargetRef.current !== null &&
      pendingTargetRef.current !== currentTargetRef.current
    ) {
      handleTargetChange();
    }
  }, [lifecycle, handleTargetChange]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && lifecycleRef.current === 'navigating') {
        console.log('[Navigation] 📱 App active');
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      if (locationFallbackTimerRef.current)
        clearTimeout(locationFallbackTimerRef.current);
      if (locationEmitThrottleRef.current)
        clearTimeout(locationEmitThrottleRef.current);
      if (routeDistanceSettlingRef.current)
        clearTimeout(routeDistanceSettlingRef.current);

      unregisterListeners();

      if (isGuidanceStartedRef.current) {
        const controller = navigationControllerRef.current;
        if (controller) {
          controller.stopGuidance().catch(() => {});
          isGuidanceStartedRef.current = false;
        }
      }

      initStartedRef.current = false;
      isNavigatorReadyRef.current = false;
      initAttemptedRef.current = false;
      locationReceivedRef.current = false;
      permissionsCheckedRef.current = false;
      termsHandledRef.current = false;
      routeSetupInProgressRef.current = false;
      routeSetupTriggeredRef.current = false;
      targetChangeInProgressRef.current = false;
      listenersRegisteredRef.current = false;
      lastEmitLocationRef.current = null;
      lastInstructionRef.current = '';
      confirmedRouteTargetRef.current = null;
      lastValidLocationRef.current = null;
      routeDistanceValidRef.current = false;
      routeTransitionInProgressRef.current = false;
      routeTransitionSeqRef.current = 0;
      rawLocationSequenceRef.current = 0;

      updateLifecycle('destroyed');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNavigationViewControllerCreated = useCallback(() => {
    console.log('[Navigation] 📱 CONTROLLER_CREATED');
  }, []);

  if (showPermissionUI || lifecycleRef.current === 'locationPermissionDenied') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Location Permission Required</Text>
        <Text style={styles.errorSubtext}>
          Turn-by-turn navigation requires access to your device location.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={async () => {
            setShowPermissionUI(false);
            setInitError(null);
            updateLifecycle('idle');
            const granted = await handleLocationPermission();
            if (granted) {
              initAttemptedRef.current = false;
              initializeNavigation();
            }
          }}
        >
          <Text style={styles.primaryButtonText}>Allow Location</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={openSettings}>
          <Text style={styles.secondaryButtonText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showTermsUI || lifecycleRef.current === 'termsRequired') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Terms Required</Text>
        <Text style={styles.errorSubtext}>
          Please accept the Google Navigation Terms of Use.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={async () => {
            setShowTermsUI(false);
            setInitError(null);
            updateLifecycle('idle');
            const accepted = await handleTermsFlow();
            if (accepted) {
              initAttemptedRef.current = false;
              initializeNavigation();
            }
          }}
        >
          <Text style={styles.primaryButtonText}>Accept Terms & Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Navigation Error</Text>
        <Text style={styles.errorSubtext}>{initError}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            setInitError(null);
            updateLifecycle('idle');
            initAttemptedRef.current = false;
            resetRouteStateForRetry();
            initializeNavigation();
          }}
        >
          <Text style={styles.primaryButtonText}>Retry Initialization</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (routeError && lifecycleRef.current === 'error') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Route Error</Text>
        <Text style={styles.errorSubtext}>{routeError}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={async () => {
            setRouteError(null);
            resetRouteStateForRetry();
            routeSetupTriggeredRef.current = false;
            routeSetupInProgressRef.current = false;
            isGuidanceStartedRef.current = false;
            // Restore the current prop target as the desired target.
            currentTargetRef.current = target;
            pendingTargetRef.current = target;
            updateLifecycle('navigating');
            startRouteSetup();
          }}
        >
          <Text style={styles.primaryButtonText}>Retry Route</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBusy = [
    'checkingLocationPermission',
    'checkingTerms',
    'initializing',
    'initialized',
    'navigatorReady',
    'locationReady',
    'settingDestination',
    'startingGuidance',
  ].includes(lifecycle);

  return (
    <View style={styles.container}>
      <NavigationView
        style={styles.navigationView}
        onNavigationViewControllerCreated={onNavigationViewControllerCreated}
      />
      {isBusy && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>
            {lifecycle === 'checkingLocationPermission' &&
              'Checking location permission...'}
            {lifecycle === 'checkingTerms' && 'Checking terms...'}
            {lifecycle === 'initializing' && 'Initializing navigation...'}
            {lifecycle === 'initialized' && 'Loading navigation...'}
            {lifecycle === 'navigatorReady' && 'Acquiring GPS signal...'}
            {lifecycle === 'settingDestination' && 'Calculating route...'}
            {lifecycle === 'startingGuidance' && 'Starting guidance...'}
            {![
              'checkingLocationPermission',
              'checkingTerms',
              'initializing',
              'initialized',
              'navigatorReady',
              'settingDestination',
              'startingGuidance',
            ].includes(lifecycle) && 'Loading...'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  navigationView: { flex: 1, width: '100%', height: '100%' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1a1a2e',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default NavigationControllerWrapper;