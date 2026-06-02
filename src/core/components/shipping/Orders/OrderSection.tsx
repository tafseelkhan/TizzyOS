import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Modal,
  Dimensions,
  Vibration,
  TextInput,
  Platform,
  Linking,
  Animated,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const { width, height } = Dimensions.get('window');

// ============================================
// CONSTANTS
// ============================================

const BASE_URL = 'http://172.20.10.12:5000';
const TRACKING_INTERVAL = 10000; // 10 seconds
const GLOBAL_TRACKING_INTERVAL = 5000; // 5 seconds for global tracking

// ============================================
// BUTTON COMPONENT REPLACING SWIPER
// ============================================

interface ActionButtonProps {
  onPress: () => void;
  title: string;
  iconName: string;
  iconColor: string;
  backgroundColor?: string;
  disabled?: boolean;
  loading?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onPress,
  title,
  iconName = 'arrow-forward',
  iconColor = '#FFFFFF',
  backgroundColor = '#F59E0B',
  disabled = false,
  loading = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!disabled && !loading) {
      Vibration.vibrate(10);
      setIsPressed(true);
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      Vibration.vibrate(50);
      onPress();
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={buttonStyles.buttonContainer}
    >
      <Animated.View
        style={[
          buttonStyles.button,
          {
            backgroundColor,
            opacity: disabled ? 0.6 : 1,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <>
            <View style={buttonStyles.iconContainer}>
              <MaterialIcon
                name={iconName as any}
                size={20}
                color={iconColor}
              />
            </View>
            <Text style={[buttonStyles.buttonText, { color: iconColor }]}>
              {title}
            </Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ============================================
// ENHANCED OTP MODAL COMPONENT WITH TIMER
// ============================================

interface OTPModalProps {
  visible: boolean;
  onClose: () => void;
  onVerify: (otp: string) => void;
  otp: string;
  setOtp: (otp: string) => void;
  loading?: boolean;
  error?: string;
  expiryTime?: number;
  onResendOTP?: () => void;
}

const OTPModal: React.FC<OTPModalProps> = ({
  visible,
  onClose,
  onVerify,
  otp,
  setOtp,
  loading = false,
  error,
  expiryTime = 300,
  onResendOTP,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [timeLeft, setTimeLeft] = useState<number>(expiryTime);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Timer setup
  useEffect(() => {
    if (!visible) return;

    setTimeLeft(expiryTime);
    setIsExpired(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsExpired(true);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [visible, expiryTime]);

  // Format timer display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Focus the hidden input when modal opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    } else {
      setActiveIndex(-1);
    }
  }, [visible]);

  // Handle OTP input change
  const handleOTPChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');

    if (numericText.length <= 6) {
      setOtp(numericText);

      if (numericText.length > 0) {
        setActiveIndex(numericText.length - 1);
      } else {
        setActiveIndex(-1);
      }
    }
  };

  // Handle individual OTP box press
  const handleBoxPress = (index: number) => {
    if (isExpired) return;

    inputRef.current?.focus();

    const newIndex = Math.min(index, otp.length);
    setActiveIndex(newIndex);
  };

  // Handle verify button press
  const handleVerify = () => {
    if (isExpired) {
      // setOtpError('OTP has expired. Please request a new one.');
      return;
    }
    onVerify(otp);
  };

  // Handle resend OTP
  const handleResendOTP = () => {
    if (onResendOTP) {
      onResendOTP();
      setTimeLeft(expiryTime);
      setIsExpired(false);
      setOtp('');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={otpModalStyles.overlay}
      >
        <View style={otpModalStyles.container}>
          {/* Header */}
          <View style={otpModalStyles.header}>
            <TouchableOpacity
              style={otpModalStyles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={26} color="#6B7280" />
            </TouchableOpacity>

            <View style={otpModalStyles.titleContainer}>
              <View style={otpModalStyles.iconCircle}>
                <Icon name="key" size={32} color="#3B82F6" />
              </View>
              <Text style={otpModalStyles.title}>Enter OTP</Text>
              <Text style={otpModalStyles.subtitle}>
                Enter the 6-digit OTP received by the customer
              </Text>
            </View>
          </View>

          {/* Timer Section */}
          <View style={otpModalStyles.timerContainer}>
            <View
              style={[
                otpModalStyles.timerBox,
                isExpired && otpModalStyles.timerBoxExpired,
              ]}
            >
              <Icon
                name="time-outline"
                size={16}
                color={isExpired ? '#EF4444' : '#3B82F6'}
              />
              <Text
                style={[
                  otpModalStyles.timerText,
                  isExpired && otpModalStyles.timerTextExpired,
                ]}
              >
                {isExpired
                  ? 'OTP Expired'
                  : `Expires in: ${formatTime(timeLeft)}`}
              </Text>
            </View>

            {isExpired && onResendOTP && (
              <TouchableOpacity
                style={otpModalStyles.resendButton}
                onPress={handleResendOTP}
                disabled={loading}
              >
                <Icon name="refresh" size={14} color="#3B82F6" />
                <Text style={otpModalStyles.resendText}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* OTP Input Section */}
          <View style={otpModalStyles.otpSection}>
            <View style={otpModalStyles.otpContainer}>
              {[0, 1, 2, 3, 4, 5].map(index => (
                <Pressable
                  key={index}
                  style={[
                    otpModalStyles.otpBox,
                    activeIndex === index && otpModalStyles.otpBoxActive,
                    otp[index] && otpModalStyles.otpBoxFilled,
                    isExpired && otpModalStyles.otpBoxDisabled,
                  ]}
                  onPress={() => handleBoxPress(index)}
                  disabled={isExpired || loading}
                >
                  <Text
                    style={[
                      otpModalStyles.otpText,
                      otp[index] && otpModalStyles.otpTextFilled,
                      isExpired && otpModalStyles.otpTextDisabled,
                    ]}
                  >
                    {otp[index] || ''}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Hidden TextInput for keyboard */}
            <TextInput
              ref={inputRef}
              style={otpModalStyles.hiddenInput}
              value={otp}
              onChangeText={handleOTPChange}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus={true}
              caretHidden={true}
              editable={!isExpired && !loading}
            />
          </View>

          {/* Error Message */}
          {error && (
            <View style={otpModalStyles.errorContainer}>
              <Icon name="alert-circle" size={16} color="#EF4444" />
              <Text style={otpModalStyles.errorText}>{error}</Text>
            </View>
          )}

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              otpModalStyles.verifyButton,
              (otp.length !== 6 || isExpired || loading) &&
                otpModalStyles.verifyButtonDisabled,
            ]}
            onPress={handleVerify}
            disabled={otp.length !== 6 || isExpired || loading}
            activeOpacity={0.8}
          >
            <View style={otpModalStyles.verifyButtonContent}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="checkmark-circle" size={22} color="#FFFFFF" />
                  <Text style={otpModalStyles.verifyButtonText}>
                    {isExpired ? 'OTP Expired' : 'Verify OTP'}
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Resend OTP Option */}
          {!isExpired && timeLeft < 60 && onResendOTP && (
            <TouchableOpacity
              style={otpModalStyles.resendOption}
              onPress={handleResendOTP}
              disabled={loading}
            >
              <Text style={otpModalStyles.resendOptionText}>
                Didn't receive OTP? Resend
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ============================================
// GOOGLE MAPS NAVIGATION ENGINE
// ============================================

const NavigationEngine = {
  startTurnByTurnNavigation: async (
    latitude: number,
    longitude: number,
    title: string = 'Destination',
  ): Promise<boolean> => {
    console.log(
      `Starting Google Maps Navigation to: ${latitude}, ${longitude}`,
    );

    try {
      let url = '';

      if (Platform.OS === 'android') {
        url = `google.navigation:q=${latitude},${longitude}&mode=d`;
        const supported = await Linking.canOpenURL(url);

        if (supported) {
          await Linking.openURL(url);
          console.log('Google Maps App opened (Android Navigation Mode)');
          return true;
        } else {
          const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving&dir_action=navigate`;
          await Linking.openURL(fallbackUrl);
          return true;
        }
      } else if (Platform.OS === 'ios') {
        url = `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`;
        const supported = await Linking.canOpenURL(url);

        if (supported) {
          await Linking.openURL(url);
          console.log('Google Maps App opened (iOS)');
          return true;
        } else {
          const appleMapsUrl = `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`;
          await Linking.openURL(appleMapsUrl);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to open Google Maps:', error);

      try {
        const browserUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        await Linking.openURL(browserUrl);
        return true;
      } catch (fallbackError) {
        console.error('Failed to open browser maps:', fallbackError);
        Alert.alert(
          'Navigation Failed',
          'Please install Google Maps from Play Store/App Store',
          [{ text: 'OK', style: 'cancel' }],
        );
        return false;
      }
    }
  },
};

// ============================================
// API CLIENT
// ============================================

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(
  async config => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('[REQUEST INTERCEPTOR ERROR]', error);
    }
    return config;
  },
  error => Promise.reject(error),
);

apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      try {
        await AsyncStorage.removeItem('authToken');
      } catch (storageError) {
        console.error('[STORAGE ERROR]', storageError);
      }
    }
    return Promise.reject(error);
  },
);

// ============================================
// INTERFACES
// ============================================

interface Order {
  _id: string;
  orderId: string;
  sellerLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  buyerLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  riderLocation?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  deliveryStatus: string;
  note: string;
  createdAt: string;
  isCOD?: boolean;
  amount?: number;
  acceptedAt?: string;
  pickedUpAt?: string;
}

interface OrdersResponse {
  success: boolean;
  data: {
    count: number;
    orders: Order[];
  };
  message?: string;
}

interface RiderLocationData {
  success: boolean;
  orderId: string;
  deliveryStatus: string;
  rider: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  navigationTarget: {
    type: 'SELLER' | 'BUYER';
    lat: number;
    lng: number;
  } | null;
  distanceInMeters: number | null;
  signals: {
    enableActionButton: boolean;
    showContactNumber: boolean;
  };
  contactNumber: string | null;
  serverTime: string;
}

interface AcceptOrderResponse {
  success: boolean;
  message: string;
  data: {
    orderId: string;
    deliveryStatus: string;
    riderLocation: {
      latitude: number;
      longitude: number;
      address: string;
    };
  };
}

interface RiderIdResponse {
  success: boolean;
  riderId: string;
  message?: string;
}

interface PickupResponse {
  success: boolean;
  message: string;
  data: {
    orderId: string;
    deliveryStatus: string;
  };
}

interface DeliveryResponse {
  success: boolean;
  message: string;
  data?: {
    user?: {
      name: string;
      image: string;
    };
  };
  otpExpiry?: {
    expiresAt: string;
    expiresIn: number;
    expiresInMinutes: number;
  };
}

// ============================================
// COMPACT TRACKING CARD COMPONENT - WITH BUTTON
// ============================================

interface TrackingCardProps {
  tracking: RiderLocationData;
  order: Order;
  onNavigate: () => void;
  onButtonPickup: () => void;
  onButtonDelivery: () => void;
  pickupLoading: boolean;
  deliveryLoading: boolean;
}

const TrackingCard: React.FC<TrackingCardProps> = ({
  tracking,
  order,
  onNavigate,
  onButtonPickup,
  onButtonDelivery,
  pickupLoading,
  deliveryLoading,
}) => {
  const locationType =
    tracking.deliveryStatus === 'assigned' ? 'Pickup' : 'Delivery';
  const enableButton = tracking.signals?.enableActionButton;
  const showContact = tracking.signals?.showContactNumber;
  const distance = tracking.distanceInMeters;
  const contactNumber = tracking.contactNumber;
  const isAssigned = tracking.deliveryStatus === 'assigned';

  const formatDistance = (meters: number | null): string => {
    if (meters === null || meters === undefined) return 'Calculating...';

    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  };

  const handleButtonAction = () => {
    if (isAssigned) {
      onButtonPickup();
    } else {
      onButtonDelivery();
    }
  };

  return (
    <View style={styles.trackingCard}>
      {/* Header */}
      <View style={styles.trackingHeader}>
        <View style={styles.trackingTitleRow}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE TRACKING</Text>
          </View>
          <View style={styles.distanceBadge}>
            <FontAwesome5 name="route" size={10} color="#3B82F6" />
            <Text style={styles.distanceBadgeText}>
              {formatDistance(distance)}
            </Text>
          </View>
        </View>

        <Text style={styles.trackingSubtitle}>
          {enableButton ? '✅ Ready to proceed' : '📍 Go to location'}
        </Text>
      </View>

      {/* Contact Section - Compact Design */}
      {showContact && contactNumber && (
        <View style={styles.contactCard}>
          <View style={styles.contactHeader}>
            <View style={styles.contactIcon}>
              <Icon name="call-outline" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.contactTitle}>
              Contact {isAssigned ? 'Seller' : 'Buyer'}
            </Text>
          </View>

          <View style={styles.contactBody}>
            <Text style={styles.contactNumber}>{contactNumber}</Text>
            <TouchableOpacity
              style={styles.callButtonSmall}
              onPress={() => Linking.openURL(`tel:${contactNumber}`)}
            >
              <Icon name="call" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Action Section */}
      <View style={styles.actionSection}>
        {enableButton ? (
          <View style={styles.buttonContainer}>
            <View style={styles.buttonInstructions}>
              <MaterialIcon name="info-outline" size={16} color="#6B7280" />
              <Text style={styles.buttonInstructionsText}>
                Tap button to confirm {locationType.toLowerCase()}
              </Text>
            </View>

            <ActionButton
              onPress={handleButtonAction}
              title={`CONFIRM ${locationType.toUpperCase()}`}
              iconName="check"
              iconColor="#FFFFFF"
              backgroundColor={isAssigned ? '#10B981' : '#8B5CF6'}
              disabled={isAssigned ? pickupLoading : deliveryLoading}
              loading={isAssigned ? pickupLoading : deliveryLoading}
            />
          </View>
        ) : (
          <View style={styles.navigateContainer}>
            <Text style={styles.navigateHint}>
              Need to be within 100m to proceed
            </Text>
            <TouchableOpacity
              style={styles.navigateButtonCompact}
              onPress={onNavigate}
            >
              <MaterialIcon name="directions" size={18} color="#FFFFFF" />
              <Text style={styles.navigateButtonCompactText}>
                Navigate to {locationType}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const PendingOrdersScreen = () => {
  const navigation = useNavigation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string>('');
  const [otpLoading, setOtpLoading] = useState<boolean>(false);
  const [otpExpiryTime, setOtpExpiryTime] = useState<number>(300);
  const [showCODPopup, setShowCODPopup] = useState(false);
  const [pickupLoading, setPickupLoading] = useState<string | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState<string | null>(null);

  // Tracking State
  const [trackingData, setTrackingData] = useState<{
    [orderId: string]: RiderLocationData;
  }>({});
  const [trackingIntervals, setTrackingIntervals] = useState<{
    [orderId: string]: ReturnType<typeof setInterval>;
  }>({});
  const [globalTrackingInterval, setGlobalTrackingInterval] =
    useState<ReturnType<typeof setInterval> | null>(null);

  // ============================================
  // GLOBAL TRACKING FUNCTIONS - FOR ALL ORDERS
  // ============================================

  const fetchRiderLocationDataForAllOrders = async () => {
    if (!riderId || orders.length === 0) return;

    try {
      const response = await apiClient.get<RiderLocationData>(
        `/api/track/rider-location/${riderId}`,
      );

      if (response.data.success) {
        const orderId = response.data.orderId;

        setTrackingData(prev => ({
          ...prev,
          [orderId]: response.data,
        }));

        if (response.data.signals.enableActionButton) {
          if (Platform.OS === 'android') {
            Vibration.vibrate([0, 50]);
          }
        }
      }
    } catch (error: any) {
      console.error(
        'Error fetching rider location for all orders:',
        error.message,
      );
    }
  };

  const startGlobalTracking = () => {
    if (globalTrackingInterval) {
      clearInterval(globalTrackingInterval);
    }

    console.log('Starting GLOBAL tracking for all orders');

    fetchRiderLocationDataForAllOrders();

    const interval = setInterval(() => {
      fetchRiderLocationDataForAllOrders();
    }, GLOBAL_TRACKING_INTERVAL);

    setGlobalTrackingInterval(interval);
  };

  const stopGlobalTracking = () => {
    if (globalTrackingInterval) {
      clearInterval(globalTrackingInterval);
      setGlobalTrackingInterval(null);
      console.log('Stopped GLOBAL tracking');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }

      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'pending_rider_accept':
        return '#F59E0B';
      case 'assigned':
        return '#3B82F6';
      case 'picked_up':
        return '#8B5CF6';
      case 'delivered':
        return '#10B981';
      case 'waiting_for_rider':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  // ============================================
  // NAVIGATION FUNCTIONS
  // ============================================

  const handleStartNavigation = async (
    order: Order,
    isPickup: boolean = true,
  ) => {
    try {
      const targetLocation = isPickup
        ? order.sellerLocation
        : order.buyerLocation;
      const navigationType = isPickup ? 'Pickup' : 'Delivery';

      const success = await NavigationEngine.startTurnByTurnNavigation(
        targetLocation.latitude,
        targetLocation.longitude,
        `${navigationType} Location`,
      );

      if (success) {
        Alert.alert(
          'Navigation Started',
          `Google Maps has opened with turn-by-turn navigation to ${navigationType.toLowerCase()} location.`,
          [
            {
              text: 'OK',
              style: 'default',
            },
          ],
        );
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to start navigation. Please try again.', [
        { text: 'OK', style: 'cancel' },
      ]);
    }
  };

  const handleTrackOrder = (order: Order) => {
    const statusLower = order.deliveryStatus.toLowerCase();

    if (statusLower === 'assigned') {
      Alert.alert(
        'Start Navigation',
        'Open Google Maps for turn-by-turn navigation to pickup location?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Start Navigation',
            onPress: () => handleStartNavigation(order, true),
            style: 'default',
          },
        ],
      );
    } else if (statusLower === 'picked_up') {
      Alert.alert(
        'Start Navigation',
        'Open Google Maps for turn-by-turn navigation to delivery location?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Start Navigation',
            onPress: () => handleStartNavigation(order, false),
            style: 'default',
          },
        ],
      );
    } else {
      Alert.alert('Not Ready', 'This order is not ready for navigation yet.', [
        { text: 'OK', style: 'cancel' },
      ]);
    }
  };

  // ============================================
  // API FUNCTIONS
  // ============================================

  const fetchRiderId = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setAuthError(true);
        return null;
      }

      const response = await apiClient.get<RiderIdResponse>(
        '/api/rider/get-rider-id',
      );

      if (response.data.success) {
        setRiderId(response.data.riderId);
        setAuthError(false);
        return response.data.riderId;
      } else {
        Alert.alert(
          'Error',
          response.data.message || 'Failed to fetch rider ID',
        );
        return null;
      }
    } catch (error: any) {
      let errorMessage = 'Failed to fetch rider ID. Please try again.';

      if (error.response?.status === 401 || error.response?.status === 403) {
        errorMessage = 'Authentication failed. Please login again.';
        setAuthError(true);
        handleLogout();
      }

      if (!(error.response?.status === 401 || error.response?.status === 403)) {
        Alert.alert('Error', errorMessage);
      }

      return null;
    }
  };

  const fetchAllOrders = async (): Promise<OrdersResponse> => {
    try {
      const currentRiderId = await fetchRiderId();

      if (!currentRiderId) {
        if (authError) {
          throw new Error('AUTH_ERROR');
        }
        throw new Error('Rider ID not found. Please login again.');
      }

      const apiUrl = `/api/shipping/rider/${currentRiderId}/pending-orders`;
      const response = await apiClient.get(apiUrl);

      return response.data;
    } catch (error: any) {
      throw error;
    }
  };

  const acceptOrderApi = async (
    orderId: string,
  ): Promise<AcceptOrderResponse> => {
    const response = await apiClient.post('/api/shipping/rider/accept', {
      orderId,
    });
    return response.data;
  };

  const pickupOrderApi = async (orderId: string): Promise<PickupResponse> => {
    const response = await apiClient.post('/api/shipping/rider/pickup', {
      orderId,
    });
    return response.data;
  };

  const deliverOrderApi = async (
    orderId: string,
    otp?: string,
  ): Promise<DeliveryResponse> => {
    const payload = otp ? { orderId, otp } : { orderId };
    const response = await apiClient.post(
      '/api/shipping/rider/deliver',
      payload,
    );
    return response.data;
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please login again.',
        [
          {
            text: 'Login',
            onPress: () => {
              navigation.navigate('Login' as never);
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const getAllOrders = async () => {
    try {
      setLoading(true);
      setAuthError(false);

      const response = await fetchAllOrders();

      if (response.success) {
        const allOrders = response.data.orders || [];

        const filteredOrders = allOrders.filter(
          order => order.deliveryStatus.toLowerCase() !== 'waiting_for_seller',
        );

        const sortedOrders = filteredOrders.sort((a, b) => {
          const statusOrder: { [key: string]: number } = {
            pending_rider_accept: 1,
            assigned: 2,
            waiting_for_rider: 3,
            picked_up: 4,
            delivered: 5,
          };

          const aStatus = a.deliveryStatus.toLowerCase();
          const bStatus = b.deliveryStatus.toLowerCase();

          const aOrder = statusOrder[aStatus] || 99;
          const bOrder = statusOrder[bStatus] || 99;

          return aOrder - bOrder;
        });

        setOrders(sortedOrders);

        if (sortedOrders.length > 0) {
          startGlobalTracking();
        }
      } else {
        Alert.alert('Error', response.message || 'Failed to fetch orders');
        setOrders([]);
      }
    } catch (error: any) {
      if (error.message === 'AUTH_ERROR' || error.response?.status === 401) {
        setAuthError(true);
      } else {
        const errorMsg =
          error.message || 'Failed to fetch orders. Please try again.';
        Alert.alert('Error', errorMsg);
      }

      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    getAllOrders();
  };

  const handleAcceptOrder = async (order: Order) => {
    Alert.alert('Accept Order', 'Are you sure you want to accept this order?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Accept',
        onPress: () => acceptOrder(order),
        style: 'default',
      },
    ]);
  };

  const acceptOrder = async (order: Order) => {
    try {
      setAcceptingOrderId(order.orderId);
      const response = await acceptOrderApi(order.orderId);

      if (response.success) {
        Alert.alert('Success', 'Order accepted successfully!');

        setOrders(prev =>
          prev.map(o =>
            o.orderId === order.orderId
              ? { ...o, deliveryStatus: 'assigned' }
              : o,
          ),
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to accept order');
      }
    } catch (error: any) {
      let errorMessage =
        error.message || 'Failed to accept order. Please try again.';

      if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
        handleLogout();
      } else if (error.response?.status === 403) {
        errorMessage = 'This order is not assigned to you.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Order not found.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const handlePickupButtonComplete = async (orderId: string) => {
    try {
      setPickupLoading(orderId);

      const response = await pickupOrderApi(orderId);

      if (response.success) {
        Alert.alert('Success', 'Order picked up successfully!');

        setOrders(prev =>
          prev.map(o =>
            o.orderId === orderId ? { ...o, deliveryStatus: 'picked_up' } : o,
          ),
        );

        setTimeout(() => {
          setPickupLoading(null);
        }, 1500);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to confirm pickup');
      setPickupLoading(null);
    }
  };

  const handleDeliveryButtonComplete = async (orderId: string) => {
    try {
      setDeliveryLoading(orderId);
      setOtpError('');

      const response = await deliverOrderApi(orderId);

      if (response.success) {
        setSelectedOrder(orders.find(o => o.orderId === orderId) || null);

        if (response.otpExpiry?.expiresIn) {
          setOtpExpiryTime(response.otpExpiry.expiresIn);
        } else {
          setOtpExpiryTime(300);
        }

        setShowOTPModal(true);
      } else {
        Alert.alert('Error', response.message || 'Failed to initiate delivery');
      }
    } catch (error: any) {
      let errorMessage = 'Failed to initiate delivery';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setDeliveryLoading(null);
    }
  };

  const verifyOTP = async () => {
    try {
      if (!otp || otp.length !== 6) {
        setOtpError('Please enter a valid 6-digit OTP');
        Vibration.vibrate(100);
        return;
      }

      if (!selectedOrder) return;

      setOtpLoading(true);
      setOtpError('');

      const response = await deliverOrderApi(selectedOrder.orderId, otp);

      if (response.success) {
        setShowOTPModal(false);
        setOtp('');
        setOtpError('');
        setOtpLoading(false);

        const successMessage =
          response.message || 'Delivery completed successfully!';

        if (selectedOrder?.isCOD) {
          Alert.alert('Success', successMessage, [
            {
              text: 'OK',
              onPress: () => {
                setShowCODPopup(true);
              },
            },
          ]);
        } else {
          Alert.alert('Success', successMessage, [
            {
              text: 'OK',
              onPress: () => {
                setOrders(prev =>
                  prev.map(o =>
                    o.orderId === selectedOrder!.orderId
                      ? { ...o, deliveryStatus: 'delivered' }
                      : o,
                  ),
                );
                setSelectedOrder(null);
              },
            },
          ]);
        }
      } else {
        setOtpError(response.message || 'OTP verification failed');
        Vibration.vibrate(100);
      }
    } catch (error: any) {
      let errorMessage = 'OTP verification failed';

      if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Invalid or expired OTP';
      } else if (
        error.message?.includes('Invalid') ||
        error.message?.includes('expired')
      ) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      setOtpError(errorMessage);
      Vibration.vibrate(100);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (selectedOrder) {
      handleDeliveryButtonComplete(selectedOrder.orderId);
    }
  };

  const handleCODConfirm = () => {
    Alert.alert(
      'Cash Received',
      `₹${selectedOrder?.amount} received from customer. Don't forget to collect cash!`,
      [
        {
          text: 'OK',
          onPress: () => {
            if (selectedOrder) {
              setOrders(prev =>
                prev.map(o =>
                  o.orderId === selectedOrder.orderId
                    ? { ...o, deliveryStatus: 'delivered' }
                    : o,
                ),
              );
              setShowCODPopup(false);
              setSelectedOrder(null);
            }
          },
        },
      ],
    );
  };

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  const renderOrderItem = ({ item }: { item: Order }) => {
    const statusLower = item.deliveryStatus.toLowerCase();
    const isPending = statusLower === 'pending_rider_accept';
    const isAssigned = statusLower === 'assigned';
    const isPickedUp = statusLower === 'picked_up';
    const isDelivered = statusLower === 'delivered';

    const tracking = trackingData[item.orderId];

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderIdContainer}>
            <Icon name="receipt-outline" size={16} color="#6B7280" />
            <Text style={styles.orderId}>
              ORDER #{item.orderId.substring(0, 8)}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.deliveryStatus) },
            ]}
          >
            <Text style={styles.statusText}>
              {item.deliveryStatus.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        {(isAssigned || isPickedUp) && tracking && (
          <TrackingCard
            tracking={tracking}
            order={item}
            onNavigate={() => handleTrackOrder(item)}
            onButtonPickup={() => handlePickupButtonComplete(item.orderId)}
            onButtonDelivery={() => handleDeliveryButtonComplete(item.orderId)}
            pickupLoading={pickupLoading === item.orderId}
            deliveryLoading={deliveryLoading === item.orderId}
          />
        )}

        {/* Location Section */}
        <View style={styles.locationSection}>
          <View style={styles.locationRow}>
            <View style={styles.locationIconContainer}>
              <View
                style={[styles.locationIcon, { backgroundColor: '#10B981' }]}
              >
                <FontAwesome5 name="store" size={10} color="#FFFFFF" />
              </View>
              <View style={styles.verticalLine} />
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>PICKUP</Text>
              <Text style={styles.locationAddress} numberOfLines={50}>
                {item.sellerLocation?.address || 'Seller Address not available'}
              </Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <View style={styles.locationIconContainer}>
              <View
                style={[styles.locationIcon, { backgroundColor: '#3B82F6' }]}
              >
                <FontAwesome5 name="home" size={10} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>DELIVERY</Text>
              <Text style={styles.locationAddress} numberOfLines={50}>
                {item.buyerLocation?.address || 'Buyer Address not available'}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.orderFooter}>
          <View style={styles.footerLeft}>
            {item.isCOD && (
              <View style={styles.codBadge}>
                <FontAwesome5
                  name="money-bill-wave"
                  size={10}
                  color="#FFFFFF"
                />
                <Text style={styles.codText}>COD: ₹{item.amount}</Text>
              </View>
            )}

            <View style={styles.timeSection}>
              <Icon name="time-outline" size={12} color="#9CA3AF" />
              <Text style={styles.createdAtText}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
          </View>

          <View style={styles.footerRight}>
            {isPending && (
              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  acceptingOrderId === item.orderId &&
                    styles.acceptButtonDisabled,
                ]}
                onPress={() => handleAcceptOrder(item)}
                disabled={acceptingOrderId === item.orderId}
              >
                {acceptingOrderId === item.orderId ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <MaterialIcon
                      name="delivery-dining"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {(isAssigned || isPickedUp) &&
              !tracking?.signals?.enableActionButton && (
                <TouchableOpacity
                  style={styles.navigateButton}
                  onPress={() => handleTrackOrder(item)}
                >
                  <MaterialIcon name="directions" size={18} color="#FFFFFF" />
                  <Text style={styles.navigateButtonText}>Navigate</Text>
                </TouchableOpacity>
              )}

            {isDelivered && (
              <View style={styles.deliveredBadge}>
                <Icon name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.deliveredText}>Delivered</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyStateIcon}>
          <FontAwesome5 name="box-open" size={60} color="#D1D5DB" />
        </View>

        {authError ? (
          <>
            <Icon
              name="alert-circle-outline"
              size={50}
              color="#EF4444"
              style={styles.authErrorIcon}
            />
            <Text style={styles.authErrorTitle}>Session Expired</Text>
            <Text style={styles.authErrorText}>
              Your authentication token has expired or is invalid.
            </Text>
            <TouchableOpacity
              onPress={handleLogout}
              style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
            >
              <Icon name="log-in-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Go to Login</Text>
            </TouchableOpacity>
          </>
        ) : loading ? (
          <>
            <Text style={styles.emptyStateTitle}>Loading Orders...</Text>
            <ActivityIndicator
              size="large"
              color="#3B82F6"
              style={{ marginTop: 20 }}
            />
          </>
        ) : (
          <>
            <Text style={styles.emptyStateTitle}>No Orders Found</Text>
            <Text style={styles.emptyStateText}>
              You don't have any orders at the moment.
            </Text>
            <TouchableOpacity
              onPress={getAllOrders}
              style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
            >
              <Icon name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Refresh</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const renderCODPopup = () => (
    <Modal
      visible={showCODPopup}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowCODPopup(false)}
    >
      <View style={styles.codModalOverlay}>
        <View style={styles.codModalContent}>
          <View style={styles.codIconContainer}>
            <FontAwesome5 name="money-bill-wave" size={40} color="#F59E0B" />
          </View>

          <Text style={styles.codModalTitle}>Cash on Delivery</Text>
          <Text style={styles.codModalAmount}>₹{selectedOrder?.amount}</Text>
          <Text style={styles.codModalMessage}>
            Please collect cash from the customer
          </Text>

          <TouchableOpacity
            style={styles.codConfirmButton}
            onPress={handleCODConfirm}
          >
            <Text style={styles.codConfirmButtonText}>Cash Received</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ============================================
  // LIFECYCLE
  // ============================================

  useFocusEffect(
    React.useCallback(() => {
      const init = async () => {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          await getAllOrders();
        } else {
          Alert.alert(
            'Authentication Required',
            'Please login to view orders',
            [
              {
                text: 'Login',
                onPress: () => {
                  navigation.navigate('Login' as never);
                },
              },
            ],
          );
        }
      };
      init();

      return () => {
        stopGlobalTracking();

        Object.values(trackingIntervals).forEach(interval => {
          clearInterval(interval);
        });
      };
    }, []),
  );

  useEffect(() => {
    if (orders.length > 0 && !globalTrackingInterval) {
      startGlobalTracking();
    }
  }, [orders]);

  useEffect(() => {
    if (riderId) {
      fetchRiderLocationDataForAllOrders();
    }
  }, [riderId]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#3B82F6"
          style={styles.loadingSpinner}
        />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#F3F4F6" barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>All Deliveries</Text>
            <Text style={styles.headerSubtitle}>
              {orders.length} order{orders.length !== 1 ? 's' : ''} in total
            </Text>
          </View>
        </View>

        <View style={styles.headerBottomRow}>
          {riderId && (
            <View style={styles.riderIdBadge}>
              <Icon name="person-circle-outline" size={12} color="#3B82F6" />
              <Text style={styles.riderIdText}>
                Rider ID: {riderId.substring(0, 8)}...
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Icon
              name="refresh"
              size={18}
              color={refreshing ? '#9CA3AF' : '#3B82F6'}
            />
            <Text style={styles.refreshButtonText}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={item => item._id || item.orderId}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      <OTPModal
        visible={showOTPModal}
        onClose={() => {
          setShowOTPModal(false);
          setOtp('');
          setOtpError('');
        }}
        onVerify={verifyOTP}
        otp={otp}
        setOtp={setOtp}
        loading={otpLoading}
        error={otpError}
        expiryTime={otpExpiryTime}
        onResendOTP={handleResendOTP}
      />

      {renderCODPopup()}
    </SafeAreaView>
  );
};

// ============================================
// OTP MODAL STYLES
// ============================================

const otpModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  header: {
    marginBottom: 24,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  titleContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  timerBoxExpired: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  timerTextExpired: {
    color: '#EF4444',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  otpSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    width: '100%',
  },
  otpBox: {
    width: 50,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  otpBoxActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
  },
  otpBoxFilled: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  otpBoxDisabled: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEE2E2',
  },
  otpText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  otpTextFilled: {
    color: '#065F46',
  },
  otpTextDisabled: {
    color: '#DC2626',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
    flex: 1,
  },
  verifyButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  verifyButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  verifyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  resendOption: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendOptionText: {
    fontSize: 13,
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
});

// ============================================
// BUTTON STYLES
// ============================================

const buttonStyles = StyleSheet.create({
  buttonContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 400,
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

// ============================================
// MAIN STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingSpinner: {
    marginBottom: 15,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 25,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  headerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riderIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  riderIdText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  refreshButtonText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '500',
  },
  listContainer: {
    padding: 12,
    paddingBottom: 20,
  },

  // Order Card Styles
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderId: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },

  // Tracking Card Styles
  trackingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trackingHeader: {
    marginBottom: 10,
  },
  trackingTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
  },
  trackingSubtitle: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },

  // Contact Card Styles
  contactCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  contactIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0C4A6E',
  },
  contactBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0EA5E9',
    letterSpacing: 0.5,
  },
  callButtonSmall: {
    backgroundColor: '#0EA5E9',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Action Section Styles
  actionSection: {
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 6,
  },
  buttonInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  buttonInstructionsText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '500',
    textAlign: 'center',
  },
  navigateContainer: {
    alignItems: 'center',
  },
  navigateHint: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'center',
  },
  navigateButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    width: '100%',
  },
  navigateButtonCompactText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Location Section
  locationSection: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  locationIconContainer: {
    alignItems: 'center',
    width: 32,
  },
  locationIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalLine: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E7EB',
    marginTop: 2,
    marginBottom: 2,
  },
  locationDetails: {
    flex: 1,
    marginLeft: 10,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  locationAddress: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 18,
  },

  // Order Footer
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    marginLeft: 10,
  },
  codBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginBottom: 6,
  },
  codText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  createdAtText: {
    fontSize: 11,
    color: '#6B7280',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    minWidth: 90,
    justifyContent: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#A7F3D0',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    minWidth: 90,
    justifyContent: 'center',
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  deliveredText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  emptyStateIcon: {
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 18,
  },
  authErrorIcon: {
    marginBottom: 12,
  },
  authErrorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  authErrorText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // COD Modal Styles
  codModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  codModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  codIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  codModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  codModalAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 12,
  },
  codModalMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  codConfirmButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  codConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PendingOrdersScreen;
