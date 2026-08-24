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

// Navigation lifecycle states
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
}

// Location permission helpers
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
}) => {
  const {
    navigationController,
    removeAllListeners,
    setOnArrival,
    setOnRouteChanged,
    setOnNavigationReady,
    setOnLocationChanged,
  } = useNavigation();

  // Refs
  const isMountedRef = useRef(true);
  const lifecycleRef = useRef<NavigationLifecycle>('idle');
  const initStartedRef = useRef(false);
  const isGuidanceStartedRef = useRef(false);
  const currentTargetRef = useRef<'pickup' | 'destination'>(target);
  const pendingTargetRef = useRef<'pickup' | 'destination' | null>(null);
  const isNavigatorReadyRef = useRef(false);
  const routeSetupInProgressRef = useRef(false);
  const targetChangeInProgressRef = useRef(false);
  const initAttemptedRef = useRef(false);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const locationReceivedRef = useRef(false);
  const permissionsCheckedRef = useRef(false);
  const termsHandledRef = useRef(false);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State
  const [lifecycle, setLifecycle] = useState<NavigationLifecycle>('idle');
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showTermsUI, setShowTermsUI] = useState(false);
  const [showPermissionUI, setShowPermissionUI] = useState(false);

  // Helper to update lifecycle
  const updateLifecycle = useCallback((newState: NavigationLifecycle) => {
    if (!isMountedRef.current) return;
    lifecycleRef.current = newState;
    setLifecycle(newState);
    console.log(`[Navigation] 🔄 Lifecycle: ${newState}`);
  }, []);

  // Get target coordinates
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

  // -------- Step 1: Location Permission Flow --------
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

    // Permission denied - check if permanently denied
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

  // -------- Step 2: Terms Flow --------
  const handleTermsFlow = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;
    if (!navigationController) return false;

    // If terms already handled in this session, skip
    if (termsHandledRef.current) {
      console.log('[Navigation] 📜 Terms already handled in this session');
      return true;
    }

    console.log('[Navigation] 📜 Checking terms acceptance...');
    updateLifecycle('checkingTerms');

    try {
      // Per SDK docs: Show terms dialog BEFORE init
      console.log('[Navigation] 📜 Showing Terms and Conditions dialog');
      const termsAccepted =
        await navigationController.showTermsAndConditionsDialog();

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
  }, [navigationController, updateLifecycle]);

  // -------- Step 3: SDK Initialization --------
  const initializeSDK = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;
    if (!navigationController) {
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
      const status = await navigationController.init();
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
  }, [navigationController, updateLifecycle]);

  // -------- Step 4: Setup Navigation Listeners --------
  const setupNavigationListeners = useCallback(() => {
    if (!navigationController) return;

    console.log('[Navigation] 📡 Registering navigation listeners');

    // On Navigation Ready
    setOnNavigationReady(() => {
      if (!isMountedRef.current) return;
      console.log('[Navigation] 🧭 NAVIGATOR_READY_EVENT');
      isNavigatorReadyRef.current = true;
      updateLifecycle('navigatorReady');

      // Clear safety timeout
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }

      // Start route setup if location already received
      if (locationReceivedRef.current) {
        startRouteSetup();
      }
    });

    // On Location Changed
    setOnLocationChanged((location: LatLng) => {
      if (!isMountedRef.current) return;

      if (!locationReceivedRef.current) {
        locationReceivedRef.current = true;
        console.log(
          `[Navigation] 📍 First location received: ${location.lat}, ${location.lng}`,
        );
        updateLifecycle('locationReady');

        // If navigator is ready, start route setup
        if (isNavigatorReadyRef.current) {
          startRouteSetup();
        }
      }
    });

    // On Arrival
    setOnArrival((event: ArrivalEvent) => {
      if (!isMountedRef.current) return;
      console.log('[Navigation] 🏁 ARRIVAL_EVENT:', event);

      if (event.isFinalDestination) {
        updateLifecycle('arrived');
        onArrival();
      } else {
        console.log('[Navigation] 📍 Continuing to next destination');
        navigationController.continueToNextDestination();
      }
    });

    // On Route Changed
    setOnRouteChanged(() => {
      if (!isMountedRef.current) return;
      console.log('[Navigation] 🔄 ROUTE_CHANGED (rerouting)');
      onRerouting();
    });

    console.log('[Navigation] ✅ Listeners registered successfully');
  }, [
    navigationController,
    setOnArrival,
    setOnRouteChanged,
    setOnNavigationReady,
    setOnLocationChanged,
    onArrival,
    onRerouting,
    updateLifecycle,
  ]);

  // -------- Step 5: Start Route Setup --------
  const startRouteSetup = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (!isNavigatorReadyRef.current) {
      console.log('[Navigation] ⏳ Navigator not ready, waiting...');
      return;
    }
    if (routeSetupInProgressRef.current) {
      console.log('[Navigation] ⏳ Route setup already in progress');
      return;
    }
    if (isGuidanceStartedRef.current) {
      console.log('[Navigation] ℹ️ Guidance already running');
      return;
    }

    // Need location before route calculation
    if (!locationReceivedRef.current) {
      console.log('[Navigation] ⏳ Waiting for location before route setup...');
      return;
    }

    console.log('[Navigation] 🎯 Setting destination...');
    updateLifecycle('settingDestination');
    routeSetupInProgressRef.current = true;

    try {
      // Set audio guidance
      await navigationController.setAudioGuidanceType(
        AudioGuidance.VOICE_ALERTS_AND_GUIDANCE,
      );
      console.log('[Navigation] 🔊 AUDIO_READY');

      // Calculate route
      const waypoint = getWaypoint();
      const routingOptions = getRoutingOptions();
      console.log(`[Navigation] 🎯 Destination: ${target}`);

      const routeStatus = await navigationController.setDestinations(
        [waypoint],
        { routingOptions },
      );

      console.log(`[Navigation] 🛣️ ROUTE_STATUS: ${routeStatus}`);

      if (routeStatus !== RouteStatus.OK) {
        console.error('[Navigation] ❌ Route calculation failed:', routeStatus);
        setInitError(`Route calculation failed: ${routeStatus}`);
        updateLifecycle('error');
        routeSetupInProgressRef.current = false;
        return;
      }

      updateLifecycle('routeReady');
      console.log('[Navigation] ✅ ROUTE_CALCULATED');

      // Start guidance
      await startGuidance();
    } catch (error: any) {
      console.error(
        '[Navigation] ❌ Route setup error:',
        error?.message || error,
      );
      setInitError(error?.message || 'Route setup failed');
      updateLifecycle('error');
    } finally {
      routeSetupInProgressRef.current = false;
    }
  }, [
    navigationController,
    getWaypoint,
    getRoutingOptions,
    target,
    updateLifecycle,
  ]);

  // -------- Step 6: Start Guidance --------
  const startGuidance = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (isGuidanceStartedRef.current) {
      console.log('[Navigation] ℹ️ Guidance already started');
      return;
    }

    console.log('[Navigation] 🚀 START_GUIDANCE');
    updateLifecycle('startingGuidance');

    try {
      await navigationController.startGuidance();
      isGuidanceStartedRef.current = true;
      updateLifecycle('navigating');
      console.log('[Navigation] ✅ TURN_BY_TURN_ACTIVE');
      console.log('[Navigation] 🔊 VOICE_NAVIGATION_ACTIVE');
      onReady();
    } catch (error: any) {
      console.error(
        '[Navigation] ❌ Start guidance error:',
        error?.message || error,
      );
      setInitError(error?.message || 'Failed to start guidance');
      updateLifecycle('error');
    }
  }, [navigationController, updateLifecycle, onReady]);

  // -------- Complete Navigation Initialization --------
  const initializeNavigation = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (!navigationController) {
      console.log('[Navigation] ⏳ No controller yet');
      return;
    }

    // Prevent multiple initialization attempts
    if (initAttemptedRef.current) {
      console.log('[Navigation] ⏳ Init already attempted');
      return;
    }

    console.log('[Navigation] 🚀 Starting navigation initialization');

    try {
      // Step 1: Check/request location permission
      const hasPermission = await handleLocationPermission();
      if (!hasPermission) {
        console.log('[Navigation] ❌ Stopping - location permission required');
        return;
      }

      // Step 2: Handle Terms
      const termsAccepted = await handleTermsFlow();
      if (!termsAccepted) {
        console.log('[Navigation] ❌ Stopping - terms required');
        return;
      }

      // Step 3: Setup listeners
      setupNavigationListeners();

      // Step 4: Initialize SDK
      const initSuccess = await initializeSDK();
      if (!initSuccess) {
        console.log('[Navigation] ❌ SDK initialization failed');
        return;
      }

      // Step 5: Wait for navigator and location
      // Safety timeout for navigator ready event
      safetyTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        if (!isNavigatorReadyRef.current) {
          console.warn(
            '[Navigation] ⚠️ Navigator ready timeout - assuming ready',
          );
          isNavigatorReadyRef.current = true;
          updateLifecycle('navigatorReady');
          if (locationReceivedRef.current) {
            startRouteSetup();
          }
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
    navigationController,
    handleLocationPermission,
    handleTermsFlow,
    setupNavigationListeners,
    initializeSDK,
    updateLifecycle,
    startRouteSetup,
  ]);

  // -------- Target Change Handler --------
  const handleTargetChange = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (targetChangeInProgressRef.current) {
      console.log('[Navigation] ⏳ Target change already in progress');
      return;
    }

    // Only handle target change when navigation is active or ready
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
    currentTargetRef.current = target;
    targetChangeInProgressRef.current = true;

    try {
      // Stop current guidance if active
      if (isGuidanceStartedRef.current) {
        console.log('[Navigation] ⏹️ Stopping guidance...');
        await navigationController.stopGuidance();
        isGuidanceStartedRef.current = false;
        console.log('[Navigation] ⏹️ Guidance stopped');
      }

      // Set new destination
      const waypoint = getWaypoint();
      const routingOptions = getRoutingOptions();
      console.log(`[Navigation] 🎯 Setting new destination: ${target}`);

      const routeStatus = await navigationController.setDestinations(
        [waypoint],
        { routingOptions },
      );
      console.log(`[Navigation] 🛣️ New ROUTE_STATUS: ${routeStatus}`);

      if (routeStatus === RouteStatus.OK) {
        // Restart guidance
        await navigationController.startGuidance();
        isGuidanceStartedRef.current = true;
        updateLifecycle('navigating');
        console.log(`[Navigation] ✅ Target switched to: ${target}`);
        onReady();
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

    // Process any pending target
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
    navigationController,
    getWaypoint,
    getRoutingOptions,
    updateLifecycle,
    onReady,
  ]);

  // -------- Effects --------

  // Effect: Initialize when controller is ready
  useEffect(() => {
    if (
      navigationController &&
      lifecycleRef.current === 'idle' &&
      !initAttemptedRef.current
    ) {
      initializeNavigation();
    }
  }, [navigationController, initializeNavigation]);

  // Effect: Handle target changes
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

  // Effect: Process pending target when lifecycle becomes ready
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

  // Effect: App state change
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && lifecycleRef.current === 'navigating') {
        console.log('[Navigation] 📱 App became active');
      }
    });
    return () => subscription.remove();
  }, []);

  // Effect: Cleanup
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      console.log('[Navigation] 🧹 CLEANUP_START');
      isMountedRef.current = false;

      // Clear safety timeout
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }

      // Remove all listeners
      try {
        removeAllListeners();
        console.log('[Navigation] 🧹 Listeners removed');
      } catch (e) {
        console.warn('[Navigation] ⚠️ Remove listeners error:', e);
      }

      // Stop guidance if active
      const stopGuidance = async () => {
        try {
          if (navigationController && isGuidanceStartedRef.current) {
            await navigationController.stopGuidance();
            isGuidanceStartedRef.current = false;
            console.log('[Navigation] 🧹 Guidance stopped');
          }
        } catch (e) {
          console.warn('[Navigation] ⚠️ Stop guidance error:', e);
        }
      };
      stopGuidance();

      // Reset refs
      updateLifecycle('destroyed');
      initStartedRef.current = false;
      isGuidanceStartedRef.current = false;
      initPromiseRef.current = null;
      isNavigatorReadyRef.current = false;
      initAttemptedRef.current = false;
      locationReceivedRef.current = false;
      permissionsCheckedRef.current = false;
      termsHandledRef.current = false;
      routeSetupInProgressRef.current = false;
      targetChangeInProgressRef.current = false;

      console.log('[Navigation] 🧹 CLEANUP_COMPLETE');
    };
  }, [navigationController, removeAllListeners, updateLifecycle]);

  // -------- NavigationView Controller Creation --------
  const onNavigationViewControllerCreated = useCallback((controller: any) => {
    console.log('[Navigation] 📱 CONTROLLER_CREATED');
  }, []);

  // -------- Render --------

  // Show Permission UI if needed
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

  // Show Terms UI if needed
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

  // Show error state
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

  // Main render
  return (
    <View style={styles.container}>
      <NavigationView
        style={styles.navigationView}
        onNavigationViewControllerCreated={onNavigationViewControllerCreated}
      />
      {isInitializing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>
            {lifecycleRef.current === 'checkingLocationPermission' &&
              'Checking location permission...'}
            {lifecycleRef.current === 'checkingTerms' && 'Checking terms...'}
            {lifecycleRef.current === 'initializing' &&
              'Initializing navigation...'}
            {lifecycleRef.current === 'initialized' && 'Loading navigation...'}
            {lifecycleRef.current === 'navigatorReady' &&
              'Getting your location...'}
            {lifecycleRef.current === 'settingDestination' &&
              'Calculating route...'}
            {lifecycleRef.current === 'startingGuidance' &&
              'Starting guidance...'}
            {![
              'checkingLocationPermission',
              'checkingTerms',
              'initializing',
              'initialized',
              'navigatorReady',
              'settingDestination',
              'startingGuidance',
            ].includes(lifecycleRef.current) && 'Loading...'}
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
