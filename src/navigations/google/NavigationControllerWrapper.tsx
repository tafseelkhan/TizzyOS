// src/navigations/google/NavigationControllerWrapper.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Dimensions,
  Platform,
  Alert,
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

const { height } = Dimensions.get('window');

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

interface NavigationControllerWrapperProps {
  booking: Booking;
  liveTracking: LiveTrackingData;
  target: 'pickup' | 'destination';
  onArrival: () => void;
  onRerouting: () => void;
  onNavigationStateUpdate: (data: {
    distance: number;
    eta: number;
    instruction: string;
    maneuver?: string;
  }) => void;
  onReady: () => void;
  onDriverLocationUpdate?: (location: { lat: number; lng: number }) => void;
}

const checkLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted;
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
}) => {
  // ============================================================
  // HOOKS & REFS
  // ============================================================
  const {
    navigationController,
    removeAllListeners,
    setOnArrival,
    setOnRouteChanged,
    setOnNavigationReady,
    setOnLocationChanged,
  } = useNavigation();

  // ✅ FIX: Store navigationController in ref for stable access
  const navigationControllerRef = useRef(navigationController);
  useEffect(() => {
    navigationControllerRef.current = navigationController;
  }, [navigationController]);

  // ✅ FIX: Store removeAllListeners in ref
  const removeAllListenersRef = useRef(removeAllListeners);
  useEffect(() => {
    removeAllListenersRef.current = removeAllListeners;
  }, [removeAllListeners]);

  // ✅ FIX: Store callback setters in refs
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

  // ✅ FIX: Store props callbacks in refs
  const onArrivalRef = useRef(onArrival);
  const onReroutingRef = useRef(onRerouting);
  const onReadyRef = useRef(onReady);
  const onDriverLocationUpdateRef = useRef(onDriverLocationUpdate);
  const onNavigationStateUpdateRef = useRef(onNavigationStateUpdate);

  useEffect(() => {
    onArrivalRef.current = onArrival;
    onReroutingRef.current = onRerouting;
    onReadyRef.current = onReady;
    onDriverLocationUpdateRef.current = onDriverLocationUpdate;
    onNavigationStateUpdateRef.current = onNavigationStateUpdate;
  }, [
    onArrival,
    onRerouting,
    onReady,
    onDriverLocationUpdate,
    onNavigationStateUpdate,
  ]);

  // State
  const [lifecycle, setLifecycle] = useState<NavigationLifecycle>('idle');
  const [initError, setInitError] = useState<string | null>(null);
  const [showTermsUI, setShowTermsUI] = useState(false);
  const [showPermissionUI, setShowPermissionUI] = useState(false);

  // ✅ FIX: All refs for tracking state
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
  const currentTargetRef = useRef<'pickup' | 'destination'>(target);
  const pendingTargetRef = useRef<'pickup' | 'destination' | null>(null);
  const permissionsCheckedRef = useRef(false);
  const termsHandledRef = useRef(false);
  const listenersRegisteredRef = useRef(false);
  const guidanceCleanupRef = useRef<(() => void) | null>(null);

  // Timers
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const locationEmitThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastEmitLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // ============================================================
  // UPDATE LIFECYCLE
  // ============================================================
  const updateLifecycle = useCallback((newState: NavigationLifecycle) => {
    if (!isMountedRef.current) return;
    lifecycleRef.current = newState;
    setLifecycle(newState);
    console.log(`[Navigation] 🔄 Lifecycle: ${newState}`);
  }, []);

  // ============================================================
  // HELPERS
  // ============================================================
  const getTargetCoords = useCallback(() => {
    return target === 'pickup' ? booking.pickup : booking.destination;
  }, [target, booking]);

  const getLatLng = useCallback((): LatLng => {
    const coords = getTargetCoords();
    return { lat: coords.latitude, lng: coords.longitude };
  }, [getTargetCoords]);

  const getWaypoint = useCallback(
    (): Waypoint => ({
      title: target === 'pickup' ? 'Pickup Location' : 'Destination',
      position: getLatLng(),
    }),
    [target, getLatLng],
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

  // ============================================================
  // LOCATION EMIT - ✅ FIXED with null check
  // ============================================================
  const emitDriverLocation = useCallback(
    (latitude: number, longitude: number) => {
      if (locationEmitThrottleRef.current) {
        clearTimeout(locationEmitThrottleRef.current);
      }

      locationEmitThrottleRef.current = setTimeout(() => {
        if (lastEmitLocationRef.current) {
          const last = lastEmitLocationRef.current;
          const latDiff = Math.abs(latitude - last.lat) * 111000;
          const lngDiff =
            Math.abs(longitude - last.lng) *
            111000 *
            Math.cos((last.lat * Math.PI) / 180);
          const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

          if (distance < 10) {
            return;
          }
        }

        lastEmitLocationRef.current = { lat: latitude, lng: longitude };
        // ✅ FIX: Safe call with optional chaining
        if (onDriverLocationUpdateRef.current) {
          onDriverLocationUpdateRef.current({ lat: latitude, lng: longitude });
        }
      }, 1000);
    },
    [],
  );

  // ============================================================
  // PERMISSION & TERMS
  // ============================================================
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
      console.log('[Navigation] ❌ Location permission permanently denied');
      setInitError(
        'Location permission permanently denied. Please enable it in settings.',
      );
      updateLifecycle('locationPermissionDenied');
      setShowPermissionUI(true);
    } else {
      console.log('[Navigation] ❌ Location permission denied');
      setInitError('Location permission required for navigation.');
      updateLifecycle('locationPermissionDenied');
      setShowPermissionUI(true);
    }

    return false;
  }, [updateLifecycle]);

  const handleTermsFlow = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;
    const controller = navigationControllerRef.current;
    if (!controller) return false;

    if (termsHandledRef.current) {
      console.log('[Navigation] 📜 Terms already handled in this session');
      return true;
    }

    console.log('[Navigation] 📜 Checking terms acceptance...');
    updateLifecycle('checkingTerms');

    try {
      console.log('[Navigation] 📜 Showing Terms and Conditions dialog');
      const termsAccepted = await controller.showTermsAndConditionsDialog();

      if (!termsAccepted) {
        console.log('[Navigation] ❌ User declined Terms and Conditions');
        updateLifecycle('termsRequired');
        setShowTermsUI(true);
        return false;
      }

      console.log('[Navigation] ✅ Terms and Conditions accepted');
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

  // ============================================================
  // SDK INIT
  // ============================================================
  const initializeSDK = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;
    const controller = navigationControllerRef.current;
    if (!controller) {
      console.log('[Navigation] ❌ No navigation controller available');
      return false;
    }

    if (initStartedRef.current) {
      console.log('[Navigation] ⏳ Init already started');
      return false;
    }

    console.log('[Navigation] 📡 SDK_INIT_START');
    updateLifecycle('initializing');
    initStartedRef.current = true;

    try {
      const status = await controller.init();
      console.log(`[Navigation] 📡 SDK_INIT_STATUS: ${status}`);

      if (status === NavigationSessionStatus.OK) {
        console.log('[Navigation] ✅ SDK_INIT_SUCCESS');
        updateLifecycle('initialized');
        return true;
      } else {
        console.error('[Navigation] ❌ Init failed with status:', status);
        setInitError(`Navigation initialization failed: ${status}`);
        updateLifecycle('error');
        return false;
      }
    } catch (error: any) {
      console.error('[Navigation] ❌ Init error:', error?.message || error);
      setInitError(error?.message || 'Unknown initialization error');
      updateLifecycle('error');
      return false;
    } finally {
      initStartedRef.current = false;
    }
  }, [updateLifecycle]);

  // ============================================================
  // AUDIO GUIDANCE
  // ============================================================
  const setAudioGuidance = useCallback(async (): Promise<boolean> => {
    const controller = navigationControllerRef.current;
    if (!controller) return false;

    console.log('[Navigation] 🔊 Setting audio guidance...');

    try {
      await controller.setAudioGuidanceType(
        AudioGuidance.VOICE_ALERTS_AND_GUIDANCE,
      );
      console.log('[Navigation] ✅ Audio set to VOICE_ALERTS_AND_GUIDANCE');
      return true;
    } catch (error) {
      console.warn('[Navigation] ⚠️ Failed to set audio guidance:', error);
      return false;
    }
  }, []);

  // ============================================================
  // ROUTE SETUP
  // ============================================================
  const startRouteSetup = useCallback(() => {
    if (!isMountedRef.current) return;
    if (routeSetupTriggeredRef.current) {
      console.log('[Navigation] ⏳ Route setup already triggered');
      return;
    }

    if (routeSetupInProgressRef.current) {
      console.log('[Navigation] ⏳ Route setup already in progress');
      return;
    }

    if (!isNavigatorReadyRef.current) {
      console.log('[Navigation] ⏳ Navigator not ready');
      return;
    }

    if (!locationReceivedRef.current) {
      console.log('[Navigation] ⏳ Waiting for location...');
      if (locationFallbackTimerRef.current) {
        clearTimeout(locationFallbackTimerRef.current);
      }
      locationFallbackTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        if (!locationReceivedRef.current && isNavigatorReadyRef.current) {
          console.warn(
            '[Navigation] ⚠️ Location timeout - forcing route setup without location callback',
          );
          locationReceivedRef.current = true;
          updateLifecycle('locationReady');
          startRouteSetup();
        }
      }, 5000);
      return;
    }

    if (isGuidanceStartedRef.current) {
      console.log('[Navigation] ℹ️ Guidance already active');
      return;
    }

    routeSetupTriggeredRef.current = true;
    routeSetupInProgressRef.current = true;

    console.log('[Navigation] 🎯 Setting destination...');
    updateLifecycle('settingDestination');

    const performRouteSetup = async () => {
      try {
        const controller = navigationControllerRef.current;
        if (!controller) {
          console.error('[Navigation] ❌ No controller for route setup');
          return;
        }

        await setAudioGuidance();

        const waypoint = getWaypoint();
        const routingOptions = getRoutingOptions();
        console.log(`[Navigation] 🎯 Destination: ${target}`);

        const routeStatus = await controller.setDestinations([waypoint], {
          routingOptions,
        });

        console.log(`[Navigation] 🛣️ ROUTE_STATUS: ${routeStatus}`);

        if (routeStatus !== RouteStatus.OK) {
          console.error(
            '[Navigation] ❌ Route calculation failed:',
            routeStatus,
          );
          setInitError(`Route calculation failed: ${routeStatus}`);
          updateLifecycle('error');
          routeSetupTriggeredRef.current = false;
          routeSetupInProgressRef.current = false;
          return;
        }

        updateLifecycle('routeReady');
        console.log('[Navigation] ✅ ROUTE_CALCULATED');

        console.log('[Navigation] 🚀 START_GUIDANCE');
        updateLifecycle('startingGuidance');

        await controller.startGuidance();
        isGuidanceStartedRef.current = true;
        updateLifecycle('navigating');
        console.log('[Navigation] ✅ TURN_BY_TURN_ACTIVE');
        console.log(
          '[Navigation] 🔊 Voice will trigger when vehicle starts moving and approaches a maneuver',
        );
        console.log('[Navigation] ✅ GUIDANCE_ACTIVE');

        if (onReadyRef.current) {
          onReadyRef.current();
        }
        console.log('[Navigation] ✅ SDK_READY');

        routeSetupTriggeredRef.current = false;
        routeSetupInProgressRef.current = false;
      } catch (error: any) {
        console.error(
          '[Navigation] ❌ Route setup error:',
          error?.message || error,
        );
        setInitError(error?.message || 'Route setup failed');
        updateLifecycle('error');
        routeSetupTriggeredRef.current = false;
        routeSetupInProgressRef.current = false;
      }
    };

    performRouteSetup();
  }, [
    getWaypoint,
    getRoutingOptions,
    target,
    updateLifecycle,
    setAudioGuidance,
  ]);

  // ============================================================
  // NAVIGATION LISTENERS - REGISTER ONCE
  // ============================================================
  const registerListeners = useCallback(() => {
    if (listenersRegisteredRef.current) {
      console.log('[Navigation] ℹ️ Listeners already registered');
      return;
    }

    const controller = navigationControllerRef.current;
    if (!controller) {
      console.log('[Navigation] ⏳ No controller for listeners');
      return;
    }

    console.log('[Navigation] 📡 Registering navigation listeners');
    console.log('[Navigation] 📡 LISTENERS_REGISTERED');

    // ✅ NAVIGATOR READY
    setOnNavigationReadyRef.current?.(() => {
      if (!isMountedRef.current) return;
      console.log('[Navigation] 🧭 NAVIGATOR_READY_EVENT');
      isNavigatorReadyRef.current = true;
      updateLifecycle('navigatorReady');

      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }

      startRouteSetup();
    });

    // ✅ LOCATION CHANGED
    setOnLocationChangedRef.current?.((location: LatLng) => {
      if (!isMountedRef.current) return;

      // ✅ FIX: Safe call with optional chaining
      if (onDriverLocationUpdateRef.current) {
        onDriverLocationUpdateRef.current({
          lat: location.lat,
          lng: location.lng,
        });
      }

      if (!locationReceivedRef.current) {
        locationReceivedRef.current = true;
        console.log(
          `[Navigation] 📍 First location received: ${location.lat}, ${location.lng}`,
        );
        updateLifecycle('locationReady');
        startRouteSetup();
      }
    });

    // ✅ ARRIVAL
    setOnArrivalRef.current?.((event: ArrivalEvent) => {
      if (!isMountedRef.current) return;
      console.log('[Navigation] 🏁 ARRIVAL_EVENT:', event);

      if (event.isFinalDestination) {
        updateLifecycle('arrived');
        if (onArrivalRef.current) {
          onArrivalRef.current();
        }
      } else {
        console.log('[Navigation] 📍 Continuing to next destination');
        controller.continueToNextDestination();
      }
    });

    // ✅ ROUTE CHANGED
    setOnRouteChangedRef.current?.(() => {
      if (!isMountedRef.current) return;
      console.log('[Navigation] 🔄 ROUTE_CHANGED (rerouting)');
      if (onReroutingRef.current) {
        onReroutingRef.current();
      }
    });

    listenersRegisteredRef.current = true;
    console.log('[Navigation] ✅ Listeners registered successfully');
  }, [updateLifecycle, emitDriverLocation, startRouteSetup]);

  // ============================================================
  // UNREGISTER LISTENERS - ONLY ON MOUNT
  // ============================================================
  const unregisterListeners = useCallback(() => {
    if (!listenersRegisteredRef.current) {
      console.log('[Navigation] ℹ️ Listeners already unregistered');
      return;
    }

    console.log('[Navigation] 📡 LISTENERS_REMOVED');
    try {
      removeAllListenersRef.current?.();
      console.log('[Navigation] 🧹 Listeners removed');
    } catch (e) {
      console.warn('[Navigation] ⚠️ Remove listeners error:', e);
    }
    listenersRegisteredRef.current = false;
  }, []);

  // ============================================================
  // INTENTIONAL STOP GUIDANCE
  // ============================================================
  const stopGuidanceIntentional = useCallback(async (reason: string) => {
    const controller = navigationControllerRef.current;
    if (!controller) return;

    if (!isGuidanceStartedRef.current) {
      console.log(`[Navigation] ℹ️ No guidance to stop for: ${reason}`);
      return;
    }

    console.log(`[Navigation] 🛑 INTENTIONAL_STOP_GUIDANCE: ${reason}`);
    try {
      await controller.stopGuidance();
      isGuidanceStartedRef.current = false;
      console.log('[Navigation] 🧹 GUIDANCE_STOPPED');
    } catch (e) {
      console.warn('[Navigation] ⚠️ Stop guidance error:', e);
    }
  }, []);

  // ============================================================
  // TARGET CHANGE
  // ============================================================
  const handleTargetChange = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (targetChangeInProgressRef.current) {
      console.log('[Navigation] ⏳ Target change already in progress');
      return;
    }

    if (
      lifecycleRef.current !== 'navigating' &&
      lifecycleRef.current !== 'routeReady' &&
      lifecycleRef.current !== 'navigatorReady'
    ) {
      console.log(
        `[Navigation] ⏳ Target change queued (${lifecycleRef.current})`,
      );
      pendingTargetRef.current = target;
      return;
    }

    if (!isNavigatorReadyRef.current) {
      console.log('[Navigation] ⏳ Target change queued (navigator not ready)');
      pendingTargetRef.current = target;
      return;
    }

    if (currentTargetRef.current === target) {
      console.log('[Navigation] ℹ️ Target unchanged');
      return;
    }

    console.log(
      `[Navigation] 🔄 TARGET_CHANGE: ${currentTargetRef.current} → ${target}`,
    );
    console.log('[Navigation] 📡 TARGET_CHANGE');

    currentTargetRef.current = target;
    targetChangeInProgressRef.current = true;

    try {
      const controller = navigationControllerRef.current;
      if (!controller) {
        console.error('[Navigation] ❌ No controller for target change');
        return;
      }

      // ✅ Intentional stop guidance for target change
      await stopGuidanceIntentional('target change');

      const waypoint = getWaypoint();
      const routingOptions = getRoutingOptions();
      console.log(`[Navigation] 🎯 Setting new destination: ${target}`);

      const routeStatus = await controller.setDestinations([waypoint], {
        routingOptions,
      });
      console.log(`[Navigation] 🛣️ New ROUTE_STATUS: ${routeStatus}`);

      if (routeStatus === RouteStatus.OK) {
        await setAudioGuidance();

        await controller.startGuidance();
        isGuidanceStartedRef.current = true;
        updateLifecycle('navigating');
        console.log('[Navigation] ✅ TURN_BY_TURN_ACTIVE');
        console.log(`[Navigation] ✅ Target switched to: ${target}`);
        if (onReadyRef.current) {
          onReadyRef.current();
        }
        console.log('[Navigation] ✅ GUIDANCE_ACTIVE');
      } else {
        console.warn(
          '[Navigation] ⚠️ Route calculation failed for target change',
        );
        setInitError(`Route calculation failed: ${routeStatus}`);
        updateLifecycle('error');
      }
    } catch (error) {
      console.error('[Navigation] ❌ Target change error:', error);
      setInitError('Failed to change target');
      updateLifecycle('error');
    } finally {
      targetChangeInProgressRef.current = false;
    }

    if (
      pendingTargetRef.current &&
      pendingTargetRef.current !== currentTargetRef.current
    ) {
      const pending = pendingTargetRef.current;
      pendingTargetRef.current = null;
      handleTargetChange();
    }
  }, [
    target,
    getWaypoint,
    getRoutingOptions,
    updateLifecycle,
    setAudioGuidance,
    stopGuidanceIntentional,
  ]);

  // ============================================================
  // INITIALIZE NAVIGATION - ONLY ONCE
  // ============================================================
  const initializeNavigation = useCallback(async () => {
    if (!isMountedRef.current) return;
    const controller = navigationControllerRef.current;
    if (!controller) {
      console.log('[Navigation] ⏳ No controller yet');
      return;
    }

    if (initAttemptedRef.current) {
      console.log('[Navigation] ⏳ Init already attempted');
      return;
    }

    console.log('[Navigation] 🚀 SESSION_MOUNT');
    console.log('[Navigation] 🚀 Starting navigation initialization');

    try {
      await checkAudioSettings();

      const hasPermission = await handleLocationPermission();
      if (!hasPermission) {
        console.log('[Navigation] ❌ Stopping - location permission required');
        return;
      }

      const termsAccepted = await handleTermsFlow();
      if (!termsAccepted) {
        console.log('[Navigation] ❌ Stopping - terms required');
        return;
      }

      registerListeners();

      const initSuccess = await initializeSDK();
      if (!initSuccess) {
        console.log('[Navigation] ❌ SDK initialization failed');
        return;
      }

      safetyTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        if (!isNavigatorReadyRef.current) {
          console.warn(
            '[Navigation] ⚠️ Navigator ready timeout - assuming ready',
          );
          isNavigatorReadyRef.current = true;
          updateLifecycle('navigatorReady');
          startRouteSetup();
        }
      }, 10000);

      initAttemptedRef.current = true;
      console.log(
        '[Navigation] ✅ Init flow completed, waiting for navigator/location...',
      );
    } catch (error: any) {
      console.error(
        '[Navigation] ❌ Init flow error:',
        error?.message || error,
      );
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

  // ============================================================
  // EFFECTS
  // ============================================================

  // ✅ EFFECT 1: Initialize navigation - runs only when controller becomes available
  useEffect(() => {
    if (
      navigationControllerRef.current &&
      lifecycleRef.current === 'idle' &&
      !initAttemptedRef.current
    ) {
      initializeNavigation();
    }
    // ✅ Intentionally empty dependency array - only runs on mount/controller change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ EFFECT 2: Handle target changes
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (
      lifecycleRef.current === 'navigating' ||
      lifecycleRef.current === 'routeReady' ||
      lifecycleRef.current === 'navigatorReady'
    ) {
      handleTargetChange();
    } else {
      pendingTargetRef.current = target;
    }
  }, [target, handleTargetChange]);

  // ✅ EFFECT 3: Process pending target changes
  useEffect(() => {
    if (
      (lifecycleRef.current === 'navigatorReady' ||
        lifecycleRef.current === 'navigating' ||
        lifecycleRef.current === 'routeReady') &&
      pendingTargetRef.current
    ) {
      const pending = pendingTargetRef.current;
      pendingTargetRef.current = null;
      if (pending !== currentTargetRef.current) {
        handleTargetChange();
      }
    }
  }, [lifecycle, handleTargetChange]);

  // ✅ EFFECT 4: App state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && lifecycleRef.current === 'navigating') {
        console.log('[Navigation] 📱 App became active');
      }
    });
    return () => subscription.remove();
  }, []);

  // ✅ EFFECT 5: CLEANUP - ONLY ON UNMOUNT (EMPTY DEPENDENCIES)
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      console.log('[Navigation] 🧹 SESSION_UNMOUNT');
      console.log('[Navigation] 🧹 CLEANUP_START');

      isMountedRef.current = false;

      // Clear timers
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      if (locationFallbackTimerRef.current) {
        clearTimeout(locationFallbackTimerRef.current);
        locationFallbackTimerRef.current = null;
      }
      if (locationEmitThrottleRef.current) {
        clearTimeout(locationEmitThrottleRef.current);
        locationEmitThrottleRef.current = null;
      }

      // Unregister listeners
      unregisterListeners();

      // Stop guidance if active
      if (isGuidanceStartedRef.current) {
        console.log(
          '[Navigation] 🛑 INTENTIONAL_STOP_GUIDANCE: component unmount',
        );
        const controller = navigationControllerRef.current;
        if (controller) {
          controller.stopGuidance().catch((e: any) => {
            console.warn('[Navigation] ⚠️ Stop guidance error on unmount:', e);
          });
          isGuidanceStartedRef.current = false;
          console.log('[Navigation] 🧹 GUIDANCE_STOPPED');
        }
      }

      // Reset refs
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

      updateLifecycle('destroyed');

      console.log('[Navigation] 🧹 CLEANUP_COMPLETE');
    };
    // ✅ EMPTY DEPENDENCY ARRAY - runs only on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // RENDER
  // ============================================================
  const onNavigationViewControllerCreated = useCallback((controller: any) => {
    console.log('[Navigation] 📱 CONTROLLER_CREATED');
  }, []);

  if (showPermissionUI || lifecycleRef.current === 'locationPermissionDenied') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Location Permission Required</Text>
        <Text style={styles.errorSubtext}>
          Turn-by-turn navigation requires access to your device location.
          {'\n\n'}
          Please allow location access to continue.
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
          Please accept the Google Navigation Terms of Use to start turn-by-turn
          navigation.
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
            initializeNavigation();
          }}
        >
          <Text style={styles.primaryButtonText}>Retry</Text>
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
            {lifecycle === 'navigatorReady' && 'Getting your location...'}
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
  container: {
    flex: 1,
    position: 'relative',
  },
  navigationView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
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
