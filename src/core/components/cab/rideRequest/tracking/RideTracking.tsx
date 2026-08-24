// src/core/screens/cab/driver/RideTracking.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { driverRideApi } from '../../../../../api/features/private/driverRidePrivateSlice';
import {
  registerSocketHandlers,
  rideLiveTrackingHandler,
} from '../../../../utils/socket';
import { Booking, LiveTrackingData } from '../../../../types/RideTypes';
import { RootStackParamList } from '../../../../../navigations/index';
import { StackScreenProps } from '@react-navigation/stack';
import { NavigationProvider } from '@googlemaps/react-native-navigation-sdk';
import { NavigationControllerWrapper } from '../../../../../navigations/google/NavigationControllerWrapper';

const { height } = Dimensions.get('window');

type RideTrackingScreenProps = StackScreenProps<
  RootStackParamList,
  'RideTracking'
>;

interface NavigationState {
  status: 'idle' | 'initializing' | 'navigating' | 'rerouting' | 'arrived' | 'error';
  currentInstruction: string;
  remainingDistance: number;
  eta: number;
  isVoiceEnabled: boolean;
  target: 'pickup' | 'destination';
}

const RideTrackingScreen: React.FC<RideTrackingScreenProps> = ({
  route,
  navigation,
}) => {
  const { trackingId, bookingId } = route.params || {};

  // ============================================================
  // STATE
  // ============================================================
  const [booking, setBooking] = useState<Booking | null>(null);
  const [liveTracking, setLiveTracking] = useState<LiveTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isNavReady, setIsNavReady] = useState(false);

  const [navState, setNavState] = useState<NavigationState>({
    status: 'idle',
    currentInstruction: 'Loading navigation...',
    remainingDistance: 0,
    eta: 0,
    isVoiceEnabled: true,
    target: 'pickup',
  });

  // Refs
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  const bookingRef = useRef<Booking | null>(null);
  const liveTrackingRef = useRef<LiveTrackingData | null>(null);
  const navStateRef = useRef<NavigationState>(navState);

  // ============================================================
  // SYNC REFS
  // ============================================================
  useEffect(() => {
    bookingRef.current = booking;
  }, [booking]);

  useEffect(() => {
    liveTrackingRef.current = liveTracking;
  }, [liveTracking]);

  useEffect(() => {
    navStateRef.current = navState;
  }, [navState]);

  // ============================================================
  // NAVIGATION TARGET
  // ============================================================
  const getNavigationTarget = useCallback((status: string): 'pickup' | 'destination' => {
    const pickupStatuses = ['accepted', 'arrived'];
    const destinationStatuses = [
      'pickupVerified',
      'inTransit',
      'dropVerified',
      'paymentPending',
    ];

    if (pickupStatuses.includes(status)) return 'pickup';
    if (destinationStatuses.includes(status)) return 'destination';
    return 'pickup';
  }, []);

  // ============================================================
  // EFFECTS
  // ============================================================
  useEffect(() => {
    isMountedRef.current = true;

    if (!trackingId) {
      console.error('[RideTracking] ❌ No trackingId provided');
      Alert.alert('Error', 'No tracking ID provided for this trip');
      navigation.goBack();
      return;
    }

    console.log('[RideTracking] 📍 Starting with:', { trackingId, bookingId });

    registerSocketHandlers();
    setupLiveTrackingSubscription();
    loadTripDetails();

    return () => {
      isMountedRef.current = false;
      cleanupSubscription();
    };
  }, [trackingId, bookingId]);

  // ============================================================
  // LIVE TRACKING SUBSCRIPTION
  // ============================================================
  const setupLiveTrackingSubscription = useCallback(() => {
    cleanupSubscription();

    console.log('[RideTracking] 📡 Subscribing to live tracking...');

    unsubscribeRef.current = rideLiveTrackingHandler.subscribe(
      trackingId,
      bookingId || trackingId,
      {
        onLocationUpdate: (data) => {
          if (isMountedRef.current) {
            console.log('[RideTracking] 📍 Driver location update');
          }
        },
        onTrackingSuccess: (data) => {
          console.log('[RideTracking] ✅ Tracking success');
          if (isMountedRef.current) {
            setLiveTracking(data as any);
          }
        },
        onDriverStarted: () => console.log('[RideTracking] 🚗 Driver started'),
        onDriverAck: () => console.log('[RideTracking] ✅ Driver ACK'),
        onDriverStopped: () => console.log('[RideTracking] ⏹️ Driver stopped'),
        onError: (error) => {
          console.error('[RideTracking] ❌ Tracking error:', error);
        },
      },
    );
  }, [trackingId, bookingId]);

  const cleanupSubscription = useCallback(() => {
    if (unsubscribeRef.current) {
      console.log('[RideTracking] 🧹 Cleaning up subscription');
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  // ============================================================
  // LOAD TRIP DETAILS
  // ============================================================
  const loadTripDetails = useCallback(async () => {
    if (!trackingId) {
      console.error('[RideTracking] ❌ No trackingId provided');
      return;
    }

    try {
      setLoading(true);

      if (!bookingId) {
        throw new Error('Booking ID is required for live tracking');
      }

      const liveData = await driverRideApi.getLiveTracking(
        bookingId,
        trackingId,
      );
      if (isMountedRef.current) {
        setLiveTracking(liveData);
        liveTrackingRef.current = liveData;
      }

      const bookingData = await driverRideApi.getTripDetails(bookingId);
      if (isMountedRef.current) {
        setBooking(bookingData);
        bookingRef.current = bookingData;

        const target = getNavigationTarget(bookingData.status);
        setNavState(prev => ({
          ...prev,
          target,
          status: 'navigating',
        }));
        setIsNavigating(true);
      }
    } catch (error: any) {
      console.error('[RideTracking] ❌ Failed to load trip:', error);
      if (isMountedRef.current) {
        Alert.alert('Error', error.message || 'Failed to load trip details');
        navigation.goBack();
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [trackingId, bookingId, navigation, getNavigationTarget]);

  // ============================================================
  // UPDATE RIDE STATUS
  // ============================================================
  const updateRideStatus = useCallback(async (status: string) => {
    if (!trackingId) return;

    try {
      setUpdating(true);
      console.log('[RideTracking] 📡 Updating ride status to:', status);
      await driverRideApi.updateRideStatus(trackingId, status);

      await loadTripDetails();

      const target = getNavigationTarget(status);
      setNavState(prev => ({ ...prev, target }));

      if (status === 'completed') {
        setIsNavigating(false);
        setNavState(prev => ({ ...prev, status: 'idle' }));
      }
    } catch (error: any) {
      console.error('[RideTracking] Failed to update status:', error);
      Alert.alert('Error', error.message || 'Failed to update ride status');
    } finally {
      setUpdating(false);
    }
  }, [trackingId, loadTripDetails, getNavigationTarget]);

  // ============================================================
  // HANDLE CANCEL TRIP
  // ============================================================
  const handleCancelTrip = useCallback(() => {
    if (!bookingId) {
      Alert.alert('Error', 'Booking ID not available');
      return;
    }

    Alert.alert('Cancel Trip', 'Are you sure you want to cancel this trip?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setUpdating(true);
            await driverRideApi.cancelBooking(bookingId, 'Driver cancelled');
            setNavState(prev => ({ ...prev, status: 'idle' }));
            setIsNavigating(false);
            Alert.alert('Success', 'Trip cancelled successfully');
            navigation.goBack();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to cancel trip');
          } finally {
            setUpdating(false);
          }
        },
      },
    ]);
  }, [bookingId, navigation]);

  // ============================================================
  // NAVIGATION CALLBACKS
  // ============================================================
  const handleArrival = useCallback(() => {
    console.log('[RideTracking] 🏁 Arrived at target');
    const target = navStateRef.current.target;
    const targetName = target === 'pickup' ? 'pickup location' : 'destination';
    setNavState(prev => ({ ...prev, status: 'arrived' }));
    Alert.alert('Arrived', `You have arrived at the ${targetName}`);
  }, []);

  const handleRerouting = useCallback(() => {
    console.log('[RideTracking] 🔄 Rerouting');
    setNavState(prev => ({ ...prev, status: 'rerouting' }));
  }, []);

  const handleNavigationStateUpdate = useCallback((data: {
    distance: number;
    eta: number;
    instruction: string;
  }) => {
    setNavState(prev => ({
      ...prev,
      remainingDistance: data.distance,
      eta: data.eta,
      currentInstruction: data.instruction,
      status: 'navigating',
    }));
  }, []);

  const handleNavReady = useCallback(() => {
    console.log('[RideTracking] ✅ Navigation ready');
    setIsNavReady(true);
  }, []);

  // ============================================================
  // RENDER STATUS BUTTONS
  // ============================================================
  const renderStatusButtons = useCallback(() => {
    const currentStatus = booking?.status || '';

    switch (currentStatus) {
      case 'accepted':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.arrivedButton]}
            onPress={() => updateRideStatus('arrived')}
            disabled={updating}
          >
            <Icon name="location-on" size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>I've Arrived</Text>
          </TouchableOpacity>
        );

      case 'arrived':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={() => updateRideStatus('inTransit')}
            disabled={updating}
          >
            <Icon name="play-arrow" size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Start Ride</Text>
          </TouchableOpacity>
        );

      case 'inTransit':
      case 'pickupVerified':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => updateRideStatus('dropVerified')}
            disabled={updating}
          >
            <Icon name="flag" size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Complete Ride</Text>
          </TouchableOpacity>
        );

      case 'dropVerified':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.completedButton]}
            onPress={() => updateRideStatus('completed')}
            disabled={updating}
          >
            <Icon name="check-circle" size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Confirm Payment</Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  }, [booking?.status, updating, updateRideStatus]);

  // ============================================================
  // RENDER NAVIGATION CARD
  // ============================================================
  const renderNavigationCard = useCallback(() => {
    if (!isNavigating || navState.status === 'idle') return null;

    const getStatusColor = () => {
      switch (navState.status) {
        case 'rerouting': return '#f59e0b';
        case 'arrived': return '#10b981';
        case 'error': return '#ef4444';
        default: return '#3b82f6';
      }
    };

    const targetName = navState.target === 'pickup' ? 'Pickup' : 'Destination';

    return (
      <View style={styles.navigationCard}>
        <View style={styles.navigationCardHeader}>
          <Text style={[styles.navigationCardStatus, { color: getStatusColor() }]}>
            {navState.status.toUpperCase()}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setNavState(prev => ({ ...prev, isVoiceEnabled: !prev.isVoiceEnabled }));
            }}
          >
            <Icon
              name={navState.isVoiceEnabled ? 'volume-up' : 'volume-off'}
              size={20}
              color="#6b7280"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.navigationCardContent}>
          <Text style={styles.navigationInstruction}>
            {navState.currentInstruction || 'Follow the route'}
          </Text>
          <View style={styles.navigationMeta}>
            <Text style={styles.navigationMetaText}>
              📏 {(navState.remainingDistance / 1000).toFixed(1)} km
            </Text>
            <Text style={styles.navigationMetaText}>
              ⏱️ {Math.round(navState.eta)} min
            </Text>
            <Text style={styles.navigationMetaText}>📍 {targetName}</Text>
          </View>
        </View>
      </View>
    );
  }, [isNavigating, navState]);

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </SafeAreaView>
    );
  }

  if (!booking || !liveTracking) {
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

  const target = getNavigationTarget(booking.status);

  return (
    <NavigationProvider
      termsAndConditionsDialogOptions={{
        title: 'Terms & Conditions',
        companyName: 'TizzyOS',
        showOnlyDisclaimer: true,
      }}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButtonHeader}
          >
            <Icon name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Active Trip</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.navigationContainer}>
          <NavigationControllerWrapper
            booking={booking}
            liveTracking={liveTracking}
            target={target}
            onArrival={handleArrival}
            onRerouting={handleRerouting}
            onNavigationStateUpdate={handleNavigationStateUpdate}
            onReady={handleNavReady}
          />
        </View>

        {renderNavigationCard()}

        <ScrollView
          style={styles.detailsContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.tripCodeCard}>
            <Text style={styles.tripCodeLabel}>Trip Code</Text>
            <Text style={styles.tripCode}>{booking.rideCode}</Text>
            <View style={styles.tripStatusBadge}>
              <Text style={styles.tripStatusText}>
                {booking.status?.toUpperCase() || 'ACTIVE'}
              </Text>
            </View>
          </View>

          <View style={styles.actionContainer}>
            {renderStatusButtons()}

            {(booking.status === 'accepted' || booking.status === 'arrived') && (
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancelTrip}
                disabled={updating}
              >
                <Icon name="cancel" size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>Cancel Trip</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </NavigationProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#1f2937',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1f2937',
  },
  backButtonHeader: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  navigationContainer: {
    height: height * 0.5,
    backgroundColor: '#1a1a2e',
    position: 'relative',
  },
  detailsContainer: {
    flex: 1,
  },
  tripCodeCard: {
    backgroundColor: '#ffffff',
    margin: 12,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tripCodeLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  tripCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 3,
    letterSpacing: 2,
  },
  tripStatusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 5,
  },
  tripStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
  },
  navigationCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  navigationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  navigationCardStatus: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  navigationCardContent: {
    gap: 3,
  },
  navigationInstruction: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  navigationMeta: {
    flexDirection: 'row',
    gap: 14,
  },
  navigationMetaText: {
    fontSize: 11,
    color: '#6b7280',
  },
  actionContainer: {
    padding: 12,
    paddingBottom: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 6,
    minWidth: '45%',
  },
  arrivedButton: {
    backgroundColor: '#6366f1',
  },
  startButton: {
    backgroundColor: '#10b981',
  },
  completeButton: {
    backgroundColor: '#8b5cf6',
  },
  completedButton: {
    backgroundColor: '#059669',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    flex: 1,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RideTrackingScreen;