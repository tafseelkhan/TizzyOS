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
import { RootStackParamList } from '../../../../../navigations/index';
import { StackScreenProps } from '@react-navigation/stack';
import { NavigationProvider } from '@googlemaps/react-native-navigation-sdk';
import { NavigationControllerWrapper } from '../../../../../navigations/google/NavigationControllerWrapper';

type RideTrackingScreenProps = StackScreenProps<
  RootStackParamList,
  'RideTracking'
>;

interface NavigationState {
  status: 'idle' | 'navigating' | 'rerouting' | 'arrived' | 'error';
  currentInstruction: string;
  remainingDistance: number;
  eta: number;
  target: 'pickup' | 'destination';
}

const RideTrackingScreen: React.FC<RideTrackingScreenProps> = ({
  route,
  navigation,
}) => {
  const { trackingId, bookingId, quoteId } = route.params || {};

  // ============================================================
  // STATE
  // ============================================================
  const [booking, setBooking] = useState<Booking | null>(null);
  const [liveTracking, setLiveTracking] = useState<LiveTrackingData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navState, setNavState] = useState<NavigationState>({
    status: 'idle',
    currentInstruction: 'Loading navigation...',
    remainingDistance: 0,
    eta: 0,
    target: 'pickup',
  });

  // Floating Card Expand / Collapse State (Initially Collapsed)
  const [isCardExpanded, setIsCardExpanded] = useState(false);

  // Floating Minimized Bar Drag Animation Position
  const pan = useRef(new Animated.ValueXY({ x: 20, y: 500 })).current;
  const lastTapRef = useRef<number>(0);

  // Setup PanResponder for Draggable Minimized Bar
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    }),
  ).current;

  // Double Click Handler to Expand Minimized Bar
  const handlePillPress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTapRef.current && now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      setIsCardExpanded(true);
    } else {
      lastTapRef.current = now;
    }
  };

  // Refs
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  const bookingRef = useRef<Booking | null>(null);
  const liveTrackingRef = useRef<LiveTrackingData | null>(null);
  const navStateRef = useRef<NavigationState>(navState);
  const quoteIdRef = useRef<string | null>(quoteId || null);
  const driverIdRef = useRef<string | null>(null);
  const locationEmitThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastEmitLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const subscriptionSetupRef = useRef(false);
  const socketReadyRef = useRef(false);

  // ============================================================
  // NAVIGATION TARGET
  // ============================================================
  const getNavigationTarget = useCallback(
    (status: string): 'pickup' | 'destination' => {
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
    },
    [],
  );

  // ============================================================
  // HELPER FUNCTIONS FOR TYPE-SAFE DATA ACCESS - MOVED BEFORE RETURNS
  // ============================================================

  // Get customer name - use customerId since Booking doesn't have user field
  const getCustomerName = useCallback((): string => {
    if (booking?.customerId) {
      return `Customer ${booking.customerId.slice(0, 8)}`;
    }
    return 'Johan Smith';
  }, [booking]);

  // Get customer phone - not available in Booking type
  const getCustomerPhone = useCallback((): string | undefined => {
    return undefined;
  }, []);

  // Get customer avatar - not available in Booking type
  const getCustomerAvatar = useCallback((): string | undefined => {
    return undefined;
  }, []);

  // Get address from booking based on target
  // NOTE: target is computed in render, so we need to compute this differently
  const getAddressForTarget = useCallback(
    (target: 'pickup' | 'destination'): string => {
      if (target === 'pickup') {
        return booking?.pickup?.address || 'Housing Estate, Lan 9,25/3';
      } else {
        return booking?.destination?.address || 'Housing Estate, Lan 9,25/3';
      }
    },
    [booking],
  );

  // ============================================================
  // SOCKET INITIALIZATION
  // ============================================================
  const initializeSocket = useCallback(async () => {
    try {
      console.log('[RideTracking] 🔌 Initializing socket...');
      await registerSocketHandlers();
      const result = await socketService.waitForReady(15000);
      socketReadyRef.current = result.authenticated;

      if (result.socketId && result.authenticated) {
        console.log('[RideTracking] ✅ Socket ready');
        return true;
      } else {
        console.warn('[RideTracking] ⚠️ Socket not authenticated');
        return false;
      }
    } catch (error) {
      console.error('[RideTracking] ❌ Socket error:', error);
      return false;
    }
  }, []);

  // ============================================================
  // DRIVER LOCATION EMISSION
  // ============================================================
  const emitDriverLocation = useCallback(
    (latitude: number, longitude: number, heading?: number, speed?: number) => {
      const driverId = driverIdRef.current;
      const currentQuoteId = quoteIdRef.current;

      if (!driverId || !currentQuoteId) {
        console.warn(
          '[RideTracking] ⚠️ Cannot emit - missing driverId or quoteId',
        );
        return;
      }

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

  // ============================================================
  // LIVE TRACKING SUBSCRIPTION
  // ============================================================
  const setupLiveTrackingSubscription = useCallback(() => {
    cleanupSubscription();

    if (!trackingId || subscriptionSetupRef.current) return;

    const currentQuoteId = quoteIdRef.current;
    if (!currentQuoteId) {
      console.error('[RideTracking] ❌ No quoteId for subscription');
      return;
    }

    console.log('[RideTracking] 📡 Subscribing to live tracking');
    subscriptionSetupRef.current = true;

    unsubscribeRef.current = rideLiveTrackingHandler.subscribe(
      trackingId,
      bookingId || trackingId,
      currentQuoteId,
      {
        onLocationUpdate: data => {
          if (!isMountedRef.current) return;
          setLiveTracking(prev => {
            if (!prev) return prev;
            return {
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
            };
          });
        },
        onTrackingSuccess: data => {
          if (!isMountedRef.current) return;
          console.log('[RideTracking] ✅ Tracking success');
          setLiveTracking(data as any);
          if (data.quoteId) {
            quoteIdRef.current = data.quoteId;
            setBooking(prev =>
              prev ? { ...prev, quoteId: data.quoteId } : prev,
            );
          }
          if (data.driver?.userId) {
            driverIdRef.current = data.driver.userId;
          }
        },
        onDriverStarted: data => {
          console.log('[RideTracking] 🚗 Driver started:', data);
        },
        onDriverAck: data => {
          console.log('[RideTracking] ✅ Driver ACK:', data);
        },
        onDriverStopped: data => {
          console.log('[RideTracking] ⏹️ Driver stopped:', data);
        },
        onError: error => {
          console.error('[RideTracking] ❌ Tracking error:', error);
          if (error.message?.includes('Unauthorized')) {
            subscriptionSetupRef.current = false;
            Alert.alert('Session Expired', 'Please login again');
          }
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
    subscriptionSetupRef.current = false;
  }, []);

  // ============================================================
  // LOAD TRIP DETAILS
  // ============================================================
  const loadTripDetails = useCallback(async () => {
    if (!trackingId || !bookingId) {
      console.error('[RideTracking] ❌ Missing trackingId or bookingId');
      return;
    }

    const currentQuoteId = quoteIdRef.current;
    if (!currentQuoteId) {
      console.error('[RideTracking] ❌ No quoteId available');
      return;
    }

    try {
      setLoading(true);

      console.log('[RideTracking] 📡 Loading trip details...');

      const [liveData, bookingData] = await Promise.all([
        driverRideApi.getLiveTracking(bookingId, trackingId, currentQuoteId),
        driverRideApi.getTripDetails(bookingId),
      ]);

      if (isMountedRef.current) {
        setLiveTracking(liveData);
        liveTrackingRef.current = liveData;

        if (liveData.driver?.userId) {
          driverIdRef.current = liveData.driver.userId;
        }
        if (liveData.quoteId) {
          quoteIdRef.current = liveData.quoteId;
        }

        setBooking(bookingData);
        bookingRef.current = bookingData;
        if (bookingData.quoteId) {
          quoteIdRef.current = bookingData.quoteId;
        }

        const target = getNavigationTarget(bookingData.status);
        setNavState({
          status: 'navigating',
          currentInstruction: 'Navigating...',
          remainingDistance: 0,
          eta: 0,
          target,
        });
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
  // NAVIGATION CALLBACKS
  // ============================================================
  const handleArrival = useCallback(() => {
    console.log('[RideTracking] 🏁 Arrived at target');
    setNavState(prev => ({ ...prev, status: 'arrived' }));
  }, []);

  const handleRerouting = useCallback(() => {
    console.log('[RideTracking] 🔄 Rerouting');
    setNavState(prev => ({ ...prev, status: 'rerouting' }));
  }, []);

  const handleNavigationStateUpdate = useCallback(
    (data: { distance: number; eta: number; instruction: string }) => {
      setNavState(prev => ({
        ...prev,
        remainingDistance: data.distance,
        eta: data.eta,
        currentInstruction: data.instruction,
        status: 'navigating',
      }));
    },
    [],
  );

  const handleNavReady = useCallback(() => {
    console.log('[RideTracking] ✅ Navigation ready');
  }, []);

  const handleDriverLocationUpdate = useCallback(
    (location: { lat: number; lng: number }) => {
      if (!driverIdRef.current || !quoteIdRef.current) {
        return;
      }
      emitDriverLocation(location.lat, location.lng, 0, 0);
    },
    [emitDriverLocation],
  );

  const handleMakeCall = useCallback((phoneNumber?: string) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert('Info', 'Phone number not available');
    }
  }, []);

  // ============================================================
  // EFFECTS
  // ============================================================
  useEffect(() => {
    isMountedRef.current = true;

    if (!trackingId || !quoteId) {
      return;
    }

    const setup = async () => {
      await initializeSocket();
      if (socketReadyRef.current) {
        setupLiveTrackingSubscription();
      }
      await loadTripDetails();
    };

    setup();

    return () => {
      isMountedRef.current = false;
      cleanupSubscription();
      if (locationEmitThrottleRef.current) {
        clearTimeout(locationEmitThrottleRef.current);
        locationEmitThrottleRef.current = null;
      }
      subscriptionSetupRef.current = false;
    };
  }, [trackingId, bookingId, quoteId]);

  // ============================================================
  // VALIDATE REQUIRED PARAMS
  // ============================================================
  useEffect(() => {
    if (!trackingId) {
      console.error('[RideTracking] ❌ No trackingId provided');
      Alert.alert('Error', 'No tracking ID provided for this trip');
      navigation.goBack();
      return;
    }

    if (!quoteId) {
      console.error('[RideTracking] ❌ No quoteId provided');
      Alert.alert('Error', 'Missing quoteId for this trip');
      navigation.goBack();
      return;
    }

    console.log('[RideTracking] 📍 Starting with:', {
      trackingId,
      bookingId,
      quoteId,
    });
    quoteIdRef.current = quoteId;
  }, [trackingId, bookingId, quoteId, navigation]);

  // ============================================================
  // SYNC REFS
  // ============================================================
  useEffect(() => {
    bookingRef.current = booking;
    if (booking?.quoteId) {
      quoteIdRef.current = booking.quoteId;
    }
  }, [booking]);

  useEffect(() => {
    liveTrackingRef.current = liveTracking;
    if (liveTracking?.driver?.userId) {
      driverIdRef.current = liveTracking.driver.userId;
    }
    if (liveTracking?.quoteId) {
      quoteIdRef.current = liveTracking.quoteId;
    }
  }, [liveTracking]);

  useEffect(() => {
    navStateRef.current = navState;
  }, [navState]);

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

  // Compute target and address text in render (not in hooks)
  const target = getNavigationTarget(booking.status);
  const customerName = getCustomerName();
  const customerPhone = getCustomerPhone();
  const customerAvatar = getCustomerAvatar();
  const addressText = getAddressForTarget(target);
  const etaMinutes = navState.eta
    ? `${Math.ceil(navState.eta / 60)} minutes`
    : '30 minutes';

  return (
    <NavigationProvider
      termsAndConditionsDialogOptions={{
        title: 'Terms & Conditions',
        companyName: 'TizzyOS',
        showOnlyDisclaimer: true,
      }}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        {/* Full Screen Navigation SDK */}
        <View style={styles.navigationContainer}>
          <NavigationControllerWrapper
            booking={booking}
            liveTracking={liveTracking}
            target={target}
            onArrival={handleArrival}
            onRerouting={handleRerouting}
            onNavigationStateUpdate={handleNavigationStateUpdate}
            onReady={handleNavReady}
            onDriverLocationUpdate={handleDriverLocationUpdate}
          />
        </View>

        {/* FLOATING OVERLAY CARD DESIGN */}
        {isCardExpanded ? (
          /* EXPANDED CARD VIEW */
          <View style={styles.expandedCardContainer}>
            <View style={styles.cardHeaderHandle}>
              <TouchableOpacity
                style={styles.collapseHandleBar}
                onPress={() => setIsCardExpanded(false)}
              />
            </View>

            <View style={styles.cardInnerContent}>
              {/* Left Box: Courier Details & Call */}
              <View style={styles.leftProfileContainer}>
                <View style={styles.whiteProfileBox}>
                  <View style={styles.profileHeader}>
                    {customerAvatar ? (
                      <Image
                        source={{ uri: customerAvatar }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Icon name="person" size={24} color="#e5e7eb" />
                      </View>
                    )}
                    <Text style={styles.roleTitle}>Courier</Text>
                  </View>
                  <Text style={styles.idText} numberOfLines={1}>
                    ID: {booking.customerId || '98745-56432'}
                  </Text>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {customerName}
                  </Text>
                </View>

                {/* Call Button */}
                <TouchableOpacity
                  style={styles.callButton}
                  activeOpacity={0.8}
                  onPress={() => handleMakeCall(customerPhone)}
                >
                  <View style={styles.phoneIconCircle}>
                    <Icon name="call" size={18} color="#111827" />
                  </View>
                  <View style={styles.callArrows}>
                    <Icon name="chevron-right" size={16} color="#9ca3af" />
                    <Icon
                      name="chevron-right"
                      size={16}
                      color="#d1d5db"
                      style={{ marginLeft: -8 }}
                    />
                  </View>
                  <Text style={styles.callText}>Call</Text>
                </TouchableOpacity>
              </View>

              {/* Right Box: Address & Estimated Time */}
              <View style={styles.rightInfoContainer}>
                {/* Address Section */}
                <View style={styles.infoSection}>
                  <Text style={styles.sectionLabel}>Address</Text>
                  <View style={styles.infoRow}>
                    <Icon
                      name="place"
                      size={18}
                      color="#9ca3af"
                      style={styles.infoIcon}
                    />
                    <Text style={styles.infoValueText} numberOfLines={3}>
                      {addressText}
                    </Text>
                  </View>
                </View>

                {/* Estimate Time Section */}
                <View style={styles.infoSection}>
                  <Text style={styles.sectionLabel}>Estimate Time</Text>
                  <View style={styles.infoRow}>
                    <Icon
                      name="access-time"
                      size={16}
                      color="#9ca3af"
                      style={styles.infoIcon}
                    />
                    <Text style={styles.infoValueText}>{etaMinutes}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          /* MINIMIZED FLOATING DRAGGABLE BAR (Initial State) */
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.minimizedPillBar,
              {
                transform: pan.getTranslateTransform(),
              },
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
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  errorText: {
    fontSize: 18,
    color: '#ffffff',
    marginTop: 12,
  },
  navigationContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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

  /* FLOATING EXPANDED CARD STYLES */
  expandedCardContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#000000',
    borderRadius: 28,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 999,
  },
  cardHeaderHandle: {
    alignItems: 'center',
    marginBottom: 8,
  },
  collapseHandleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#4b5563',
    borderRadius: 2,
  },
  cardInnerContent: {
    flexDirection: 'row',
    gap: 12,
  },

  /* Left Side: Profile & Call */
  leftProfileContainer: {
    flex: 1.1,
    gap: 8,
  },
  whiteProfileBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 12,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#9ca3af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  idText: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 2,
  },
  nameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  callButton: {
    backgroundColor: '#262626',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callArrows: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    marginRight: 6,
  },

  /* Right Side: Details */
  rightInfoContainer: {
    flex: 1,
    backgroundColor: '#1b1b1b',
    borderRadius: 20,
    padding: 14,
    justifyContent: 'space-between',
  },
  infoSection: {
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  infoValueText: {
    color: '#d1d5db',
    fontSize: 12,
    flexShrink: 1,
    lineHeight: 16,
  },

  /* MINIMIZED DRAGGABLE PILL STYLES */
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#374151',
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default RideTrackingScreen;
