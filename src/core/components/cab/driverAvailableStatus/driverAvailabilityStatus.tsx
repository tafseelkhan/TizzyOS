// components/DriverStatus/DriverStatusScreen.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  StatusBar,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { driverStatusApi } from '../../../../api/features/private/driverLocationOnlinePrivateSlice';
import { checkDriverStatus } from '../../../../api/features/private/driverCabRegisterPrivateSlice';

// ============================================
// 🔌 TWO DIFFERENT SOCKET SERVICES
// ============================================
import SocketService from '../../../utils/socket/socketUtils'; // Driver Status Socket
import { socketService } from '../../../utils/socket/rideRequestUtils'; // Ride Request Socket

import LocationService from '../../../utils/cab/driverAvailability';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

// ============================================
// 🚗 RIDE REQUEST IMPORTS
// ============================================
import RideRequestPopup from '../../../components/cab/rideRequest/RideRequestPopup';
import { useRideRequest } from '../../../hooks/cab/useRideRequest';
import { rideRequestHandler } from '../../../utils/socket/rideRequestHandler';

const { width } = Dimensions.get('window');

// ---- Design tokens (White Theme) ----
const COLORS = {
  bg: '#F5F7FA',
  bgElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: 'rgba(0,0,0,0.06)',
  textPrimary: '#1A1D26',
  textSecondary: '#5A6178',
  textMuted: '#8B93A7',
  accent: '#6C5CE7',
  accentSoft: 'rgba(108,92,231,0.12)',
  success: '#2ED573',
  successSoft: 'rgba(46,213,115,0.12)',
  danger: '#FF5E7A',
  dangerSoft: 'rgba(255,94,122,0.12)',
  warning: '#FFB443',
  warningSoft: 'rgba(255,180,67,0.12)',
  info: '#4FA8FF',
  infoSoft: 'rgba(79,168,255,0.12)',
  shadow: 'rgba(0,0,0,0.08)',
};

const DriverStatusScreen: React.FC = () => {
  const navigation = useNavigation();

  // ============================================
  // 🚗 RIDE REQUEST HOOK (NEW)
  // ============================================
  const {
    currentRequest,
    isRequestActive,
    acceptRide,
    rejectRide,
    dismissRequest,
  } = useRideRequest();

  // State
  const [userId, setUserId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [socketRegistered, setSocketRegistered] = useState<boolean>(false);

  // Driver registration state
  const [isDriverRegistered, setIsDriverRegistered] = useState<boolean>(false);
  const [driverRegistrationStatus, setDriverRegistrationStatus] = useState<
    string | null
  >(null);

  // Location tracking state
  const [isLocationTracking, setIsLocationTracking] = useState<boolean>(false);
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState<boolean>(false);
  const [isLocationLoading, setIsLocationLoading] = useState<boolean>(false);

  // Animation Values
  const [pulseAnim] = useState(new Animated.Value(1));
  const [glowAnim] = useState(new Animated.Value(0.4));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(20));

  // Refs
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isMounted = useRef<boolean>(true);

  // ============================================
  // ✅ CONNECT BOTH SOCKETS
  // ============================================
  const initBothSockets = async () => {
    console.log('[Screen] Initializing both sockets...');

    try {
      // 1️⃣ Connect Driver Status Socket (SocketUtils)
      const driverSocket = await SocketService.connect();
      console.log('[Screen] ✅ Driver Status Socket connected');

      // 2️⃣ Connect Ride Request Socket (SocketService)
      await socketService.connect();
      console.log('[Screen] ✅ Ride Request Socket connected');

      // Setup listeners for both
      setupDriverSocketListeners(driverSocket);
      setupRideSocketListeners();

      // Check connection status after 1 second
      setTimeout(() => {
        if (!isMounted.current) return;

        const connected = SocketService.isSocketConnected();
        const id = SocketService.getSocketId();
        setSocketConnected(connected);
        setSocketId(id);
        console.log(
          '[Screen] Driver Status Socket - Connected:',
          connected,
          'ID:',
          id,
        );

        const rideConnected = socketService.isSocketConnected();
        console.log('[Screen] Ride Request Socket - Connected:', rideConnected);
      }, 1000);
    } catch (error) {
      console.error('[Screen] Failed to init sockets:', error);
      Alert.alert(
        'Socket Error',
        'Failed to connect to server. Please try again.',
      );
    }
  };

  // ============================================
  // 🎯 DRIVER STATUS SOCKET LISTENERS (SocketUtils)
  // ============================================
  const setupDriverSocketListeners = (socket: any) => {
    socket.on('connect', () => {
      console.log('[Screen] Driver Status Socket CONNECT event');
      if (!isMounted.current) return;
      setSocketConnected(true);
      const id = socket.id;
      setSocketId(id);

      const extractedUserId = SocketService.getUserId();
      if (extractedUserId) {
        setUserId(extractedUserId);
        socket.emit('driver:register', { userId: extractedUserId });
      }
    });

    socket.on('disconnect', () => {
      console.log('[Screen] Driver Status Socket DISCONNECT event');
      if (!isMounted.current) return;
      setSocketConnected(false);
      setSocketId(null);
      setSocketRegistered(false);
    });

    socket.on('driver:registered', (data: any) => {
      console.log('[Screen] DRIVER:REGISTERED event:', data);
      if (!isMounted.current) return;
      setSocketRegistered(true);
      if (data.data?.socketId) {
        setSocketId(data.data.socketId);
      }
      if (data.data?.userId) {
        setUserId(data.data.userId);
      }
    });

    socket.on('driver:status-changed', (data: any) => {
      console.log('[Screen] DRIVER:STATUS-CHANGED:', data);
      if (!isMounted.current) return;
      const currentUserId = SocketService.getUserId();
      if (data.userId === currentUserId) {
        setIsOnline(data.isOnline);
        setIsAvailable(data.isAvailable);
        if (data.lastSeen) {
          setLastSeen(data.lastSeen);
        }
      }
    });

    socket.on('driver:error', (data: any) => {
      console.error('[Screen] DRIVER:ERROR:', data);
      Alert.alert('Socket Error', data.message || 'Something went wrong');
    });

    socket.on('welcome', (data: any) => {
      console.log('[Screen] Welcome from server:', data);
    });
  };

  // ============================================
  // 🎯 RIDE REQUEST SOCKET LISTENERS (SocketService)
  // ============================================
  const setupRideSocketListeners = () => {
    // Ride request handler already handles these
    // But we can add additional logging
    console.log('[Screen] Ride Request Socket listeners ready');
  };

  // ✅ Initialize on Mount
  useEffect(() => {
    isMounted.current = true;
    console.log('[Screen] Mounted');

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start();

    // ============================================
    // 🔌 CONNECT BOTH SOCKETS
    // ============================================
    initBothSockets();

    fetchDriverStatus();
    checkDriverRegistration();
    startPulseAnimation();
    startGlowAnimation();
    checkLocationPermissions();
    checkLocationStatus();

    // ============================================
    // 🚗 SETUP RIDE REQUEST HANDLER
    // ============================================
    rideRequestHandler.setup();

    return () => {
      isMounted.current = false;

      // Cleanup Driver Status Socket
      const driverSocket = SocketService.getSocket();
      if (driverSocket) {
        driverSocket.off('driver:status-changed');
        driverSocket.off('connect');
        driverSocket.off('disconnect');
        driverSocket.off('driver:registered');
        driverSocket.off('driver:error');
      }

      // Cleanup Ride Request Socket
      socketService.cleanup();

      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }

      rideRequestHandler.cleanup();
    };
  }, []);

  // ✅ Jab screen focus mein aaye, status check karo (tracking continue rahegi)
  useFocusEffect(
    useCallback(() => {
      console.log('[Screen] Focused - Checking location status');
      checkLocationStatus();
      return () => {
        console.log('[Screen] Unfocused - Location tracking continues...');
      };
    }, []),
  );

  // ✅ Check location status
  const checkLocationStatus = async () => {
    try {
      const isActive = LocationService.isTrackingActive();
      if (isMounted.current) {
        setIsLocationTracking(isActive);
        console.log('[Screen] Location tracking status:', isActive);
      }
    } catch (error) {
      console.log('Error checking location status:', error);
    }
  };

  // Check driver registration
  const checkDriverRegistration = async () => {
    try {
      const result = await checkDriverStatus();
      if (isMounted.current) {
        setIsDriverRegistered(result.isRegistered);
        if (result.driver) {
          setDriverRegistrationStatus(result.driver.status || 'pending');
        }
      }
      console.log('[Screen] Driver registration status:', result);
    } catch (error) {
      console.error('[Screen] Error checking driver registration:', error);
    }
  };

  // Check location permissions
  const checkLocationPermissions = async () => {
    const granted = await LocationService.requestPermissions();
    if (isMounted.current) {
      setLocationPermissionGranted(granted);
    }
  };

  // Navigate to registration screen
  const navigateToRegistration = () => {
    try {
      navigation.navigate('DriverRegistration' as never);
    } catch (error) {
      console.error('[Screen] Navigation error:', error);
      Alert.alert(
        'Navigation Error',
        'Could not navigate to registration screen. Please try again.',
      );
    }
  };

  // Animation Functions
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const startGlowAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const fetchDriverStatus = async () => {
    try {
      setError(null);
      console.log('[Screen] Fetching driver status...');
      const response = await driverStatusApi.getDriverStatus();

      if (!isMounted.current) return;

      if (response.success && response.data) {
        setIsOnline(response.data.isOnline);
        setIsAvailable(response.data.isAvailable);
        setLastSeen(response.data.lastSeen);
        if (response.data.userId) {
          setUserId(response.data.userId);
        }
      } else {
        setError('Failed to fetch driver status');
      }
    } catch (err: any) {
      console.error('[Screen] Error fetching status:', err);
      if (isMounted.current) {
        setError(err.message || 'An error occurred');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Toggle Status
  const handleToggleStatus = async () => {
    if (!isDriverRegistered) {
      Alert.alert(
        'Registration Required',
        'You have not registered as a driver yet. Please complete your driver registration to access online services.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Register Now', onPress: navigateToRegistration },
        ],
      );
      return;
    }

    if (driverRegistrationStatus !== 'approved') {
      let message =
        'Your driver registration is pending approval. Please wait for admin approval.';
      if (driverRegistrationStatus === 'rejected') {
        message =
          'Your driver registration has been rejected. Please contact support.';
      } else if (driverRegistrationStatus === 'incomplete') {
        message =
          'Your driver registration is incomplete. Please complete all required fields.';
      }
      Alert.alert('Registration Status', message);
      return;
    }

    setUpdating(true);
    try {
      const socketId = SocketService.getSocketId();
      const response = await driverStatusApi.toggleDriverStatus(socketId);

      if (!isMounted.current) return;

      if (response.success) {
        const newStatus = response.data.isOnline;
        setIsOnline(newStatus);
        setIsAvailable(response.data.isAvailable);
        setLastSeen(response.data.lastSeen);

        if (newStatus) {
          Alert.alert(
            'Enable Location',
            'You are ready for FWS services. Please enable location before starting your work.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Enable', onPress: handleEnableLocation },
            ],
          );
        } else {
          await LocationService.stopTracking();
          if (isMounted.current) {
            setIsLocationTracking(false);
          }
        }
      } else {
        Alert.alert('Error', response.message || 'Failed to toggle status');
      }
    } catch (err: any) {
      console.error('[Screen] Error toggling:', err);
      Alert.alert('Error', err.message || 'Failed to toggle status');
    } finally {
      if (isMounted.current) {
        setUpdating(false);
      }
    }
  };

  // Enable Location Button Handler
  const handleEnableLocation = async () => {
    if (isLocationLoading) return;

    setIsLocationLoading(true);

    try {
      const hasPermissions = await LocationService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert(
          'Permission Required',
          'Please grant location permissions in settings.',
          [{ text: 'OK' }],
        );
        setIsLocationLoading(false);
        return;
      }

      if (isMounted.current) {
        setLocationPermissionGranted(true);
      }

      const started = await LocationService.startTracking();

      if (isMounted.current) {
        if (started) {
          setIsLocationTracking(true);
          Alert.alert(
            'Success',
            'Location tracking enabled (works in background)',
          );
        } else {
          Alert.alert('Error', 'Failed to start location tracking');
        }
      }
    } catch (error) {
      console.error('Error enabling location:', error);
      Alert.alert('Error', 'Failed to enable location tracking');
    } finally {
      if (isMounted.current) {
        setIsLocationLoading(false);
      }
    }
  };

  // Stop Location
  const handleStopLocation = async () => {
    if (isLocationLoading) return;

    setIsLocationLoading(true);
    try {
      await LocationService.stopTracking();
      if (isMounted.current) {
        setIsLocationTracking(false);
        Alert.alert('Location Disabled', 'Location tracking disabled');
      }
    } catch (error) {
      console.error('Error stopping location:', error);
      Alert.alert('Error', 'Failed to disable location tracking');
    } finally {
      if (isMounted.current) {
        setIsLocationLoading(false);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDriverStatus();
    await checkDriverRegistration();

    // Check both sockets
    const connected = SocketService.isSocketConnected();
    const id = SocketService.getSocketId();
    const uid = SocketService.getUserId();
    setSocketConnected(connected);
    setSocketId(id);
    if (uid) setUserId(uid);

    // Check ride socket
    const rideConnected = socketService.isSocketConnected();
    console.log('[Screen] Ride Socket connected:', rideConnected);

    setRefreshing(false);
  }, []);

  const formatLastSeen = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const canGoActive =
    isDriverRegistered && driverRegistrationStatus === 'approved';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <View style={styles.loadingSpinnerWrap}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
        <Text style={styles.loadingText}>Fetching your status…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <View style={styles.errorIconWrap}>
          <Icon name="alert-circle" size={38} color={COLORS.danger} />
        </View>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchDriverStatus}
          activeOpacity={0.85}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerEyebrow}>FWS-SERVICES</Text>
              <Text style={styles.headerTitle}>Driver Status</Text>
            </View>
            <View
              style={[
                styles.connDot,
                {
                  backgroundColor: socketConnected
                    ? COLORS.successSoft
                    : COLORS.dangerSoft,
                },
              ]}
            >
              <View
                style={[
                  styles.connDotCore,
                  {
                    backgroundColor: socketConnected
                      ? COLORS.success
                      : COLORS.danger,
                  },
                ]}
              />
            </View>
          </View>

          {/* Chips row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipRowContent}
          >
            <Chip
              icon={socketConnected ? 'radio' : 'radio-outline'}
              label={socketConnected ? 'Live Connection' : 'No Connection'}
              tone={socketConnected ? 'success' : 'danger'}
            />
            {socketRegistered && (
              <Chip icon="link" label="Socket Registered" tone="info" />
            )}
            {isLocationTracking && (
              <Chip icon="navigate" label="Location Live" tone="success" />
            )}
            {canGoActive && (
              <Chip icon="shield-checkmark" label="Approved" tone="success" />
            )}
          </ScrollView>

          {/* Registration Card */}
          <View
            style={[
              styles.card,
              !isDriverRegistered && styles.cardWarningBorder,
            ]}
          >
            <View style={styles.cardRow}>
              <View
                style={[
                  styles.cardIconBadge,
                  {
                    backgroundColor: isDriverRegistered
                      ? COLORS.successSoft
                      : COLORS.warningSoft,
                  },
                ]}
              >
                <Icon
                  name={isDriverRegistered ? 'checkmark-done' : 'document-text'}
                  size={20}
                  color={isDriverRegistered ? COLORS.success : COLORS.warning}
                />
              </View>
              <View style={styles.cardTextBlock}>
                <Text style={styles.cardTitle}>
                  {isDriverRegistered
                    ? 'Driver Registration'
                    : 'Registration Required'}
                </Text>
                {isDriverRegistered ? (
                  <>
                    <Text style={styles.cardSubtitle}>
                      Status:{' '}
                      {driverRegistrationStatus?.toUpperCase() || 'APPROVED'}
                    </Text>
                    {driverRegistrationStatus === 'approved' && (
                      <Text style={styles.cardHintSuccess}>
                        You're cleared to accept rides
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.cardSubtitle}>
                      Complete your driver profile to go online
                    </Text>
                    <TouchableOpacity onPress={navigateToRegistration}>
                      <View style={styles.inlineLinkRow}>
                        <Text style={styles.inlineLink}>
                          Complete Registration
                        </Text>
                        <Icon
                          name="arrow-forward"
                          size={14}
                          color={COLORS.accent}
                        />
                      </View>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Hero Status Card */}
          <LinearGradient
            colors={isOnline ? ['#E8F5E9', '#C8E6C9'] : ['#FFEBEE', '#FFCDD2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>Current Status</Text>
                <Text
                  style={[
                    styles.heroStatus,
                    { color: isOnline ? COLORS.success : COLORS.danger },
                  ]}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>

              <Animated.View
                style={[
                  styles.heroRing,
                  {
                    borderColor: isOnline ? COLORS.success : COLORS.danger,
                    opacity: isOnline ? glowAnim : 0.5,
                    transform: [{ scale: isOnline ? pulseAnim : 1 }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.heroRingCore,
                    {
                      backgroundColor: isOnline
                        ? COLORS.successSoft
                        : COLORS.dangerSoft,
                    },
                  ]}
                >
                  <Icon
                    name={isOnline ? 'wifi' : 'wifi-outline'}
                    size={26}
                    color={isOnline ? COLORS.success : COLORS.danger}
                  />
                </View>
              </Animated.View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroBottomRow}>
              <View style={styles.heroMetaItem}>
                <Icon
                  name="time-outline"
                  size={14}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.heroMetaText}>
                  {formatLastSeen(lastSeen)}
                </Text>
              </View>
              <View style={styles.heroMetaItem}>
                <View
                  style={[
                    styles.heroMetaDot,
                    {
                      backgroundColor: isAvailable
                        ? COLORS.success
                        : COLORS.danger,
                    },
                  ]}
                />
                <Text style={styles.heroMetaText}>
                  {isAvailable ? 'Available for rides' : 'Not available'}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Toggle Button */}
          <TouchableOpacity
            style={[styles.toggleButton, !canGoActive && styles.disabledCard]}
            onPress={handleToggleStatus}
            disabled={updating || !canGoActive}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={
                isOnline ? ['#FF5E7A', '#C62839'] : ['#6C5CE7', '#4834D4']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.toggleGradient}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon
                    name={isOnline ? 'power' : 'power-outline'}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.toggleButtonText}>
                    {isOnline ? 'Go Offline' : 'Go Online'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Location Section */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>LOCATION TRACKING</Text>
          </View>

          {isLocationLoading ? (
            <View style={[styles.card, styles.locationLoadingCard]}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.locationLoadingText}>Please wait…</Text>
            </View>
          ) : isLocationTracking ? (
            <TouchableOpacity
              style={styles.card}
              onPress={handleStopLocation}
              activeOpacity={0.8}
            >
              <View style={styles.cardRow}>
                <View
                  style={[
                    styles.cardIconBadge,
                    { backgroundColor: COLORS.successSoft },
                  ]}
                >
                  <Icon name="location" size={20} color={COLORS.success} />
                </View>
                <View style={styles.cardTextBlock}>
                  <Text style={styles.cardTitle}>Location Active</Text>
                  <Text style={styles.cardSubtitle}>
                    Tap to disable tracking
                  </Text>
                </View>
                <Icon
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textMuted}
                />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.card, !isOnline && styles.disabledCard]}
              onPress={handleEnableLocation}
              disabled={!isOnline || !canGoActive}
              activeOpacity={0.8}
            >
              <View style={styles.cardRow}>
                <View
                  style={[
                    styles.cardIconBadge,
                    {
                      backgroundColor:
                        isOnline && canGoActive
                          ? COLORS.infoSoft
                          : 'rgba(0,0,0,0.06)',
                    },
                  ]}
                >
                  <Icon
                    name="location-outline"
                    size={20}
                    color={
                      isOnline && canGoActive ? COLORS.info : COLORS.textMuted
                    }
                  />
                </View>
                <View style={styles.cardTextBlock}>
                  <Text style={styles.cardTitle}>
                    {isOnline && canGoActive
                      ? 'Enable Location'
                      : 'Go Online First'}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {isOnline && canGoActive
                      ? 'Turn on tracking to receive ride requests'
                      : 'Location can be enabled once you are online'}
                  </Text>
                </View>
                <Icon
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textMuted}
                />
              </View>
            </TouchableOpacity>
          )}

          {!locationPermissionGranted && (
            <TouchableOpacity
              style={styles.permissionRow}
              onPress={checkLocationPermissions}
            >
              <Icon name="settings-outline" size={14} color={COLORS.accent} />
              <Text style={styles.permissionText}>
                Grant Location Permission
              </Text>
            </TouchableOpacity>
          )}

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Icon name="information-circle" size={18} color={COLORS.info} />
            <Text style={styles.infoBannerText}>
              You are ready for FWS services. Enable location before starting
              your work.
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>OVERVIEW</Text>
          </View>

          <View style={styles.statsRow}>
            <StatTile
              icon="pulse-outline"
              label="Status"
              value={isOnline ? 'Active' : 'Inactive'}
              tone={isOnline ? 'success' : 'danger'}
            />
            <StatTile
              icon="checkbox-outline"
              label="Availability"
              value={isAvailable ? 'Yes' : 'No'}
              tone={isAvailable ? 'success' : 'danger'}
            />
            <StatTile
              icon="navigate-outline"
              label="Tracking"
              value={isLocationTracking ? 'On' : 'Off'}
              tone={isLocationTracking ? 'success' : 'danger'}
            />
          </View>
        </Animated.View>
      </ScrollView>

      {/* ============================================
          🚗 RIDE REQUEST POPUP - GLOBAL OVERLAY
          Shows on ANY screen when ride request arrives
          ============================================ */}
      {currentRequest && isRequestActive && (
        <RideRequestPopup
          visible={true}
          requestData={currentRequest}
          onAccept={acceptRide}
          onReject={rejectRide}
          onTimeout={dismissRequest}
        />
      )}
    </View>
  );
};

// ---- Small reusable pieces ----

const Chip: React.FC<{
  icon: string;
  label: string;
  tone: 'success' | 'danger' | 'info';
}> = ({ icon, label, tone }) => {
  const toneMap = {
    success: { bg: COLORS.successSoft, fg: COLORS.success },
    danger: { bg: COLORS.dangerSoft, fg: COLORS.danger },
    info: { bg: COLORS.infoSoft, fg: COLORS.info },
  } as const;
  const c = toneMap[tone];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <Icon name={icon} size={13} color={c.fg} />
      <Text style={[styles.chipText, { color: c.fg }]}>{label}</Text>
    </View>
  );
};

const StatTile: React.FC<{
  icon: string;
  label: string;
  value: string;
  tone: 'success' | 'danger';
}> = ({ icon, label, value, tone }) => {
  const color = tone === 'success' ? COLORS.success : COLORS.danger;
  return (
    <View style={styles.statTile}>
      <View style={styles.statIconWrap}>
        <Icon name={icon} size={18} color={COLORS.accent} />
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={[styles.statTileValue, { color }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 48,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  loadingSpinnerWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: COLORS.bg,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.dangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 36,
    paddingVertical: 13,
    borderRadius: 14,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  connDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connDotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Chips
  chipRow: {
    marginBottom: 18,
  },
  chipRowContent: {
    paddingRight: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '700',
    marginLeft: 5,
  },

  // Generic card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardWarningBorder: {
    borderColor: 'rgba(255,180,67,0.35)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  cardTextBlock: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  cardHintSuccess: {
    fontSize: 12,
    color: COLORS.success,
    marginTop: 3,
    fontWeight: '600',
  },
  inlineLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  inlineLink: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '700',
    marginRight: 4,
  },
  disabledCard: {
    opacity: 0.5,
  },

  // Hero
  heroCard: {
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroStatus: {
    fontSize: 32,
    fontWeight: '800',
  },
  heroRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroRingCore: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 18,
  },
  heroBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetaDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 7,
  },
  heroMetaText: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginLeft: 5,
  },

  // Toggle
  toggleButton: {
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 9,
  },

  // Section label
  sectionLabel: {
    marginBottom: 10,
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },

  // Location loading
  locationLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLoadingText: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginLeft: 10,
  },

  // Permission
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.infoSoft,
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
    marginBottom: 24,
  },
  infoBannerText: {
    fontSize: 12.5,
    color: COLORS.info,
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statTile: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTileLabel: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 3,
  },
  statTileValue: {
    fontSize: 15,
    fontWeight: '800',
  },
});

export default DriverStatusScreen;
