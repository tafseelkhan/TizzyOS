// PendingOrdersScreen.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Modal,
  Dimensions,
  Vibration,
  Platform,
  Linking,
  Animated,
  Image,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Camera, CameraType } from 'react-native-camera-kit';
import type { CameraApi } from 'react-native-camera-kit';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

// ✅ API slice
import {
  getMyAssignedOrders,
  acceptAssignment,
  handoverViaQrDelivery,
  initiateDelivery,
  verifyDeliveryOTP,
  requestNewDeliveryOTP,
  getTrackingStatus,
  getOrderQRCode,
  OrderData,
  OrderWithBasicInfo,
  TrackingStatusResponse,
  TrackingHistoryEntry,
  QRCodeData,
} from '../../../../api/features/private/pendingOrdersPrivateSlice';
import { ApiError } from '../../../../core/utils/handler/apiClient';

const { width, height } = Dimensions.get('window');

// ============================================
// AUTH HELPERS
// ============================================

const getAuthToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('authToken');
};

const getUserIdFromToken = async (): Promise<string | null> => {
  try {
    const token = await getAuthToken();
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    const userId =
      payload.userId || payload.sub || payload.id || payload._id || null;

    if (!userId) return null;

    // Remove stale cached userId
    try {
      const cachedUserId = await AsyncStorage.getItem('userId');
      if (cachedUserId && cachedUserId !== userId) {
        await AsyncStorage.removeItem('userId');
      }
    } catch {
      // ignore
    }

    return userId;
  } catch {
    return null;
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getLastTrackingStatus = (
  trackingHistory: TrackingHistoryEntry[],
): string | null => {
  if (!trackingHistory || trackingHistory.length === 0) return null;
  const lastEntry = trackingHistory[trackingHistory.length - 1];
  return lastEntry.status || lastEntry.scanInfo?.status || null;
};

const getCurrentQROwner = (
  qrOwnershipHistory: any[] | undefined,
): any | null => {
  if (!qrOwnershipHistory || qrOwnershipHistory.length === 0) return null;
  const activeEntry = qrOwnershipHistory.find(
    entry => entry.releasedAt === null,
  );
  return activeEntry || null;
};

// ============================================
// QR CODE MODAL
// ============================================

interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  qrCodeUrl: string;
  orderId: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({
  visible,
  onClose,
  qrCodeUrl,
  orderId,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={qrCodeModalStyles.overlay}>
        <View style={qrCodeModalStyles.container}>
          <View style={qrCodeModalStyles.header}>
            <Text style={qrCodeModalStyles.title}>Handover QR Code</Text>
            <TouchableOpacity
              onPress={onClose}
              style={qrCodeModalStyles.closeButton}
            >
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={qrCodeModalStyles.qrCodeWrapper}>
            {qrCodeUrl ? (
              <Image
                source={{ uri: qrCodeUrl }}
                style={qrCodeModalStyles.qrCodeImage}
                resizeMode="contain"
              />
            ) : (
              <ActivityIndicator size="large" color="#3B82F6" />
            )}
          </View>
          <Text style={qrCodeModalStyles.qrOrderId}>Order ID: {orderId}</Text>
          <Text style={qrCodeModalStyles.qrInstruction}>
            Show this QR code to the next person for handover verification
          </Text>
          <TouchableOpacity
            style={qrCodeModalStyles.doneButton}
            onPress={onClose}
          >
            <Text style={qrCodeModalStyles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ============================================
// QR INFO MODAL
// ============================================

const QRInfoModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onShowQR: () => void;
  orderId: string;
  loading?: boolean;
}> = ({ visible, onClose, onShowQR, orderId, loading = false }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={qrInfoStyles.overlay} onPress={onClose}>
        <View style={qrInfoStyles.container}>
          <View style={qrInfoStyles.iconContainer}>
            <MaterialCommunityIcon
              name="information-variant-circle"
              size={60}
              color="#3B82F6"
            />
          </View>
          <Text style={qrInfoStyles.title}>QR Code Information</Text>
          <Text style={qrInfoStyles.orderId}>Order: {orderId}</Text>
          <Text style={qrInfoStyles.message}>
            Show this QR code to the next person for handover verification.
          </Text>
          <TouchableOpacity
            style={qrInfoStyles.showQRButton}
            onPress={onShowQR}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcon name="qr-code" size={20} color="#FFFFFF" />
                <Text style={qrInfoStyles.showQRButtonText}>Show QR Code</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={qrInfoStyles.cancelButton} onPress={onClose}>
            <Text style={qrInfoStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

// ============================================
// MANUAL QR INPUT MODAL
// ============================================

const ManualQRInputModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (qrCode: string) => void;
  loading?: boolean;
  error?: string;
}> = ({ visible, onClose, onSubmit, loading = false, error }) => {
  const [qrInput, setQrInput] = useState('');

  const handleSubmit = () => {
    if (qrInput.trim()) {
      onSubmit(qrInput.trim());
    } else {
      Alert.alert('Error', 'Please enter QR code');
    }
  };

  const handleClose = () => {
    setQrInput('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={manualQRStyles.overlay}>
        <View style={manualQRStyles.container}>
          <View style={manualQRStyles.header}>
            <TouchableOpacity
              onPress={handleClose}
              style={manualQRStyles.closeButton}
            >
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={manualQRStyles.title}>Enter QR Code</Text>
          </View>
          <View style={manualQRStyles.inputSection}>
            <TextInput
              style={manualQRStyles.input}
              placeholder="Enter QR code manually"
              placeholderTextColor="#9CA3AF"
              value={qrInput}
              onChangeText={setQrInput}
              editable={!loading}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {error && (
            <View style={manualQRStyles.errorContainer}>
              <Icon name="alert-circle" size={16} color="#EF4444" />
              <Text style={manualQRStyles.errorText}>{error}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              manualQRStyles.submitButton,
              (!qrInput.trim() || loading) && manualQRStyles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!qrInput.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={manualQRStyles.submitButtonText}>
                Verify QR Code
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ============================================
// QR SCAN SELECTION MODAL
// ============================================

const QRScanSelectionModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCameraScan: () => void;
  onManualEntry: () => void;
}> = ({ visible, onClose, onCameraScan, onManualEntry }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={selectionStyles.overlay} onPress={onClose}>
        <View style={selectionStyles.container}>
          <Text style={selectionStyles.title}>Scan QR Code</Text>
          <TouchableOpacity
            style={selectionStyles.option}
            onPress={onCameraScan}
          >
            <View style={selectionStyles.optionIcon}>
              <Icon name="camera" size={24} color="#3B82F6" />
            </View>
            <View style={selectionStyles.optionTextContainer}>
              <Text style={selectionStyles.optionTitle}>Use Camera</Text>
              <Text style={selectionStyles.optionSubtitle}>
                Scan QR code using device camera
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={selectionStyles.option}
            onPress={onManualEntry}
          >
            <View style={selectionStyles.optionIcon}>
              <Icon name="create-outline" size={24} color="#8B5CF6" />
            </View>
            <View style={selectionStyles.optionTextContainer}>
              <Text style={selectionStyles.optionTitle}>Enter Manually</Text>
              <Text style={selectionStyles.optionSubtitle}>
                Type QR code manually
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={selectionStyles.cancelButton}
            onPress={onClose}
          >
            <Text style={selectionStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

// ============================================
// CAMERA QR SCANNER
// ============================================

const CameraQRScanner: React.FC<{
  visible: boolean;
  onClose: () => void;
  onScan: (qrData: string) => void;
  loading?: boolean;
  error?: string;
}> = ({ visible, onClose, onScan, loading = false, error }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const cameraRef = useRef<CameraApi>(null);

  useEffect(() => {
    if (visible) {
      checkCameraPermission();
      setScanned(false);
    }
  }, [visible]);

  const checkCameraPermission = async () => {
    try {
      const permission =
        Platform.OS === 'android'
          ? PERMISSIONS.ANDROID.CAMERA
          : PERMISSIONS.IOS.CAMERA;
      const result = await check(permission);
      if (result === RESULTS.GRANTED) {
        setHasPermission(true);
      } else {
        requestCameraPermission();
      }
    } catch {
      setHasPermission(false);
    }
  };

  const requestCameraPermission = async () => {
    try {
      const permission =
        Platform.OS === 'android'
          ? PERMISSIONS.ANDROID.CAMERA
          : PERMISSIONS.IOS.CAMERA;
      const result = await request(permission);
      if (result === RESULTS.GRANTED) {
        setHasPermission(true);
      } else {
        setHasPermission(false);
        Alert.alert(
          'Permission Required',
          'Camera permission is needed to scan QR codes.',
          [
            { text: 'Cancel', style: 'cancel', onPress: onClose },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      }
    } catch {
      setHasPermission(false);
    }
  };

  const onReadCode = (event: any) => {
    if (scanned || loading) return;

    const qrData = event?.nativeEvent?.codeStringValue || event?.data || event;

    if (!qrData || typeof qrData !== 'string') return;

    setScanned(true);
    Vibration.vibrate(100);
    onScan(qrData);
  };

  const handleClose = () => {
    setScanned(false);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={cameraStyles.container}>
        <View style={cameraStyles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={cameraStyles.closeButton}
          >
            <Icon name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={cameraStyles.headerTitle}>Scan QR Code</Text>
          <View style={{ width: 40 }} />
        </View>

        {hasPermission === true ? (
          <View style={{ flex: 1 }}>
            <Camera
              ref={cameraRef}
              style={cameraStyles.camera}
              cameraType={CameraType.Back}
              scanBarcode={!scanned && !loading}
              onReadCode={onReadCode}
            />

            <View
              style={cameraStyles.overlayTextContainer}
              pointerEvents="none"
            >
              <Text style={cameraStyles.scanText}>
                Align QR code within the frame
              </Text>
            </View>
          </View>
        ) : hasPermission === false ? (
          <View style={cameraStyles.noPermissionContainer}>
            <Icon name="camera-outline" size={60} color="#9CA3AF" />
            <Text style={cameraStyles.noPermissionText}>
              Camera permission required
            </Text>
            <TouchableOpacity
              style={cameraStyles.permissionButton}
              onPress={requestCameraPermission}
            >
              <Text style={cameraStyles.permissionButtonText}>
                Grant Permission
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={cameraStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={cameraStyles.loadingText}>Initializing camera...</Text>
          </View>
        )}

        {loading && (
          <View style={cameraStyles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={cameraStyles.loadingOverlayText}>Verifying...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={cameraStyles.errorContainer}>
            <Icon name="alert-circle" size={20} color="#EF4444" />
            <Text style={cameraStyles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => setScanned(false)}
              style={cameraStyles.tryAgainButton}
            >
              <Text style={cameraStyles.tryAgainText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {scanned && !loading && !error && (
          <TouchableOpacity
            style={cameraStyles.rescanButton}
            onPress={() => setScanned(false)}
          >
            <Icon name="scan-outline" size={20} color="#FFFFFF" />
            <Text style={cameraStyles.rescanText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
};

// ============================================
// NAVIGATION ENGINE
// ============================================

const NavigationEngine = {
  startTurnByTurnNavigation: async (
    latitude: number,
    longitude: number,
    title: string = 'Destination',
  ): Promise<boolean> => {
    try {
      let url = '';
      if (Platform.OS === 'android') {
        url = `google.navigation:q=${latitude},${longitude}&mode=d`;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
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
          return true;
        } else {
          const appleMapsUrl = `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`;
          await Linking.openURL(appleMapsUrl);
          return true;
        }
      }
      return false;
    } catch {
      try {
        const browserUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        await Linking.openURL(browserUrl);
        return true;
      } catch {
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
// ACTION BUTTON
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
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!disabled && !loading) {
      Vibration.vibrate(10);
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }
  };

  const handlePressOut = () => {
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
// OTP MODAL
// ============================================

interface OTPModalProps {
  visible: boolean;
  onClose: () => void;
  onVerify: (otp: string) => void;
  onResendOTP: () => void;
  otp: string;
  setOtp: (otp: string) => void;
  loading?: boolean;
  error?: string;
  expiryTime?: number;
  resendLoading?: boolean;
}

const OTPModal: React.FC<OTPModalProps> = ({
  visible,
  onClose,
  onVerify,
  onResendOTP,
  otp,
  setOtp,
  loading = false,
  error,
  expiryTime = 300,
  resendLoading = false,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [timeLeft, setTimeLeft] = useState<number>(expiryTime);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTimeLeft(expiryTime);
    setIsExpired(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsExpired(true);
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, expiryTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 500);
    } else {
      setActiveIndex(-1);
    }
  }, [visible]);

  const handleOTPChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= 6) {
      setOtp(numericText);
      setActiveIndex(numericText.length > 0 ? numericText.length - 1 : -1);
    }
  };

  const handleBoxPress = (index: number) => {
    if (isExpired || loading) return;
    inputRef.current?.focus();
    setActiveIndex(Math.min(index, otp.length));
  };

  const handleVerify = () => {
    if (!isExpired && otp.length === 6) {
      onVerify(otp);
    }
  };

  const handleResend = () => {
    if (!resendLoading) {
      onResendOTP();
      setTimeLeft(expiryTime);
      setIsExpired(false);
      setOtp('');
      setTimeout(() => inputRef.current?.focus(), 300);
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
        <Pressable
          style={otpModalStyles.overlay}
          onPress={() => inputRef.current?.focus()}
        >
          <View style={otpModalStyles.container}>
            <View style={otpModalStyles.header}>
              <TouchableOpacity
                style={otpModalStyles.closeButton}
                onPress={onClose}
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
              {isExpired && (
                <TouchableOpacity
                  style={otpModalStyles.resendButton}
                  onPress={handleResend}
                  disabled={resendLoading}
                >
                  {resendLoading ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <>
                      <Icon name="refresh" size={14} color="#3B82F6" />
                      <Text style={otpModalStyles.resendText}>Resend OTP</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

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
                      ]}
                    >
                      {otp[index] || ''}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                ref={inputRef}
                style={otpModalStyles.visibleInput}
                value={otp}
                onChangeText={handleOTPChange}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus={true}
                caretHidden={false}
                editable={!isExpired && !loading}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
                onSubmitEditing={handleVerify}
              />
            </View>

            {error && (
              <View style={otpModalStyles.errorContainer}>
                <Icon name="alert-circle" size={16} color="#EF4444" />
                <Text style={otpModalStyles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                otpModalStyles.verifyButton,
                (otp.length !== 6 || isExpired || loading) &&
                  otpModalStyles.verifyButtonDisabled,
              ]}
              onPress={handleVerify}
              disabled={otp.length !== 6 || isExpired || loading}
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

            {!isExpired && timeLeft < 60 && (
              <TouchableOpacity
                style={otpModalStyles.resendOption}
                onPress={handleResend}
                disabled={resendLoading}
              >
                <Text style={otpModalStyles.resendOptionText}>
                  Didn't receive OTP? Resend
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ============================================
// TRACKING TIMELINE
// ============================================

const TrackingTimeline: React.FC<{
  trackingHistory: TrackingHistoryEntry[];
}> = ({ trackingHistory }) => {
  if (!trackingHistory || trackingHistory.length === 0) return null;

  const getStatusIcon = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('delivered'))
      return <MaterialIcon name="check-circle" size={14} color="#10B981" />;
    if (s.includes('assignment_accepted'))
      return <MaterialIcon name="check-circle" size={14} color="#10B981" />;
    if (s.includes('assignment_sent'))
      return <MaterialIcon name="assignment" size={14} color="#3B82F6" />;
    if (s.includes('picked_up'))
      return <MaterialIcon name="inventory" size={14} color="#10B981" />;
    if (s.includes('waiting_for_assignment'))
      return <MaterialIcon name="hourglass-empty" size={14} color="#F59E0B" />;
    if (s.includes('ready_for_dispatch'))
      return <MaterialIcon name="local-shipping" size={14} color="#8B5CF6" />;
    return <MaterialIcon name="info" size={14} color="#6B7280" />;
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <View style={timelineStyles.container}>
      <View style={timelineStyles.header}>
        <MaterialIcon name="history" size={14} color="#6B7280" />
        <Text style={timelineStyles.title}>Tracking Timeline</Text>
      </View>
      {trackingHistory.map((item, index) => {
        const status = item.status || item.scanInfo?.status || '';
        const holderType = item.holderType || item.scanInfo?.holderType || '';
        const note = item.note || item.scanInfo?.note || '';
        const createdAt = item.createdAt || item.scanInfo?.createdAt || '';

        return (
          <View key={index} style={timelineStyles.timelineItem}>
            <View style={timelineStyles.timelineIcon}>
              {getStatusIcon(status)}
              {index < trackingHistory.length - 1 && (
                <View style={timelineStyles.timelineLine} />
              )}
            </View>
            <View style={timelineStyles.timelineContent}>
              <Text style={timelineStyles.timelineStatus}>
                {formatStatus(status)}
              </Text>
              {note ? (
                <Text style={timelineStyles.timelineNotes}>{note}</Text>
              ) : null}
              <Text style={timelineStyles.timelineTime}>
                {formatDateTime(createdAt)}
                {holderType ? ` • ${holderType}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ============================================
// ORDER CARD
// ============================================

interface OrderCardProps {
  order: OrderData;
  trackingStatus: TrackingStatusResponse | null;
  loggedInUserId: string;
  onAccept: () => void;
  onShowQR: () => void;
  onScan: () => void;
  onNavigate: () => void;
  onDeliveryComplete: () => void;
  acceptLoading: boolean;
  showQRLoading: boolean;
  scanLoading: boolean;
  deliveryLoading: boolean;
  isCompleted?: boolean;
}

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  trackingStatus,
  loggedInUserId,
  onAccept,
  onShowQR,
  onScan,
  onNavigate,
  onDeliveryComplete,
  acceptLoading,
  showQRLoading,
  scanLoading,
  deliveryLoading,
  isCompleted = false,
}) => {
  const showAcceptButton = trackingStatus?.pendingAssignment
    ? trackingStatus.pendingAssignment.assigneeId === loggedInUserId &&
      trackingStatus.pendingAssignment.status === 'PENDING_ACCEPTANCE'
    : false;

  const activeOwner = trackingStatus?.qrOwnershipHistory?.find(
    (q: any) => q.releasedAt === null,
  );

  const activeOwnerId = activeOwner?.holderId?.toString();
  const currentUserId = loggedInUserId?.toString();

  const showScanButton =
    !!activeOwner && activeOwnerId !== currentUserId && !isCompleted;

  const showShowQRButton =
    !!activeOwner && activeOwnerId === currentUserId && !isCompleted;

  const hasQR = showShowQRButton;

  const [showQRInfoModal, setShowQRInfoModal] = useState(false);

  const handleInfoPress = () => {
    setShowQRInfoModal(true);
  };

  const handleShowQRFromInfo = () => {
    setShowQRInfoModal(false);
    onShowQR();
  };

  const lastStatus = trackingStatus?.trackingHistory
    ? getLastTrackingStatus(trackingStatus.trackingHistory)
    : trackingStatus?.currentStatus;

  const isDelivered =
    lastStatus === 'delivered' || trackingStatus?.currentStatus === 'delivered';

  const currentQROwner = getCurrentQROwner(trackingStatus?.qrOwnershipHistory);

  return (
    <View style={[styles.orderCard, isDelivered && styles.deliveredCard]}>
      <View style={styles.orderHeader}>
        <View style={styles.orderIdContainer}>
          <Icon name="receipt-outline" size={16} color="#6B7280" />
          <Text style={styles.orderId}>
            ORDER #{order.orderId.substring(0, 8)}
          </Text>
        </View>
        <TouchableOpacity onPress={handleInfoPress} style={styles.infoIcon}>
          <MaterialCommunityIcon
            name="information-variant-circle"
            size={22}
            color="#3B82F6"
          />
        </TouchableOpacity>
        <View
          style={[
            styles.typeBadge,
            {
              backgroundColor:
                order.fulfillmentType === 'FWS' ? '#8B5CF6' : '#10B981',
            },
          ]}
        >
          <Text style={styles.typeText}>{order.fulfillmentType}</Text>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={styles.statusIconContainer}>
            {isDelivered ? (
              <MaterialIcon name="check-circle" size={20} color="#10B981" />
            ) : showAcceptButton ? (
              <MaterialIcon name="assignment" size={20} color="#F59E0B" />
            ) : hasQR ? (
              <MaterialIcon name="inventory" size={20} color="#10B981" />
            ) : (
              <MaterialIcon name="hourglass-empty" size={20} color="#6B7280" />
            )}
          </View>
          <Text style={styles.statusMessage}>
            {isDelivered
              ? '✅ Delivered'
              : showAcceptButton
              ? 'Assignment Received'
              : hasQR
              ? 'Parcel In Your Possession'
              : 'Waiting for Assignment'}
          </Text>
        </View>
        <View style={styles.actionContainer}>
          {!isDelivered && showAcceptButton && (
            <ActionButton
              onPress={onAccept}
              title="ACCEPT ASSIGNMENT"
              iconName="check"
              iconColor="#FFFFFF"
              backgroundColor="#10B981"
              disabled={acceptLoading}
              loading={acceptLoading}
            />
          )}
          {!isDelivered && showScanButton && (
            <ActionButton
              onPress={onScan}
              title="SCAN QR FOR HANDOVER"
              iconName="qr-code-scanner"
              iconColor="#FFFFFF"
              backgroundColor="#8B5CF6"
              disabled={scanLoading}
              loading={scanLoading}
            />
          )}
          {!isDelivered && !showAcceptButton && !hasQR && !showScanButton && (
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={onNavigate}
            >
              <MaterialIcon name="directions" size={18} color="#FFFFFF" />
              <Text style={styles.navigateButtonText}>
                Navigate to Location
              </Text>
            </TouchableOpacity>
          )}
          {isDelivered && (
            <View style={styles.deliveredBadge}>
              <MaterialIcon name="check-circle" size={18} color="#10B981" />
              <Text style={styles.deliveredText}>Order Completed</Text>
            </View>
          )}
        </View>
      </View>

      {!isDelivered && hasQR && (
        <TouchableOpacity
          style={styles.deliveryButton}
          onPress={onDeliveryComplete}
          disabled={deliveryLoading}
        >
          {deliveryLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcon name="delivery-dining" size={18} color="#FFFFFF" />
              <Text style={styles.deliveryButtonText}>Complete Delivery</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {currentQROwner && (
        <View style={styles.qrOwnerContainer}>
          <MaterialIcon name="qr-code" size={16} color="#3B82F6" />
          <Text style={styles.qrOwnerText}>
            QR Owner: {currentQROwner.holderName} ({currentQROwner.holderType})
          </Text>
        </View>
      )}

      <View style={styles.locationSection}>
        <View style={styles.locationRow}>
          <View style={styles.locationIconContainer}>
            <View style={[styles.locationIcon, { backgroundColor: '#10B981' }]}>
              <FontAwesome5 name="store" size={10} color="#FFFFFF" />
            </View>
            <View style={styles.verticalLine} />
          </View>
          <View style={styles.locationDetails}>
            <Text style={styles.locationLabel}>PICKUP</Text>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {order.sellerAddress?.address || 'Seller Address not available'}
            </Text>
          </View>
        </View>
        <View style={styles.locationRow}>
          <View style={styles.locationIconContainer}>
            <View style={[styles.locationIcon, { backgroundColor: '#3B82F6' }]}>
              <FontAwesome5 name="home" size={10} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.locationDetails}>
            <Text style={styles.locationLabel}>DELIVERY</Text>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {order.buyerAddress?.address || 'Buyer Address not available'}
            </Text>
          </View>
        </View>
      </View>

      {trackingStatus?.trackingHistory &&
        trackingStatus.trackingHistory.length > 0 && (
          <TrackingTimeline trackingHistory={trackingStatus.trackingHistory} />
        )}

      <View style={styles.orderFooter}>
        <View style={styles.footerLeft}>
          {order.paymentStatus === 'COD' && (
            <View style={styles.codBadge}>
              <FontAwesome5 name="money-bill-wave" size={10} color="#FFFFFF" />
              <Text style={styles.codText}>COD: ₹{order.finalAmount}</Text>
            </View>
          )}
          <View style={styles.timeSection}>
            <Icon name="time-outline" size={12} color="#9CA3AF" />
            <Text style={styles.createdAtText}>
              {new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </View>

      <QRInfoModal
        visible={showQRInfoModal}
        onClose={() => setShowQRInfoModal(false)}
        onShowQR={handleShowQRFromInfo}
        orderId={order.orderId}
        loading={showQRLoading}
      />
    </View>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const PendingOrdersScreen = () => {
  const navigation = useNavigation();
  const [loggedInUserId, setLoggedInUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<
    'current' | 'available' | 'completed'
  >('current');

  const [currentOrders, setCurrentOrders] = useState<OrderWithBasicInfo[]>([]);
  const [availableOrders, setAvailableOrders] = useState<OrderWithBasicInfo[]>(
    [],
  );
  const [completedOrders, setCompletedOrders] = useState<OrderWithBasicInfo[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [selectedOrderForOTP, setSelectedOrderForOTP] =
    useState<OrderWithBasicInfo | null>(null);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string>('');
  const [otpLoading, setOtpLoading] = useState<boolean>(false);
  const [otpExpiryTime, setOtpExpiryTime] = useState<number>(300);
  const [otpResendLoading, setOtpResendLoading] = useState<boolean>(false);
  const [showCODPopup, setShowCODPopup] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState<string | null>(null);

  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [selectedQRData, setSelectedQRData] = useState<{
    url: string;
    orderId: string;
  } | null>(null);

  const [showScanSelection, setShowScanSelection] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showManualQRInput, setShowManualQRInput] = useState(false);
  const [qrScanLoading, setQrScanLoading] = useState(false);
  const [qrScanError, setQrScanError] = useState<string>('');

  const [showQRLoading, setShowQRLoading] = useState<string | null>(null);
  const [trackingStatusMap, setTrackingStatusMap] = useState<{
    [orderId: string]: TrackingStatusResponse;
  }>({});

  // ============================================
  // FETCH ALL ORDERS
  // ============================================

  const getAllOrders = async () => {
    try {
      setLoading(true);

      const response = await getMyAssignedOrders();

      if (response.success) {
        const allOrders = response.data.orders || [];

        const current: OrderWithBasicInfo[] = [];
        const available: OrderWithBasicInfo[] = [];
        const completed: OrderWithBasicInfo[] = [];

        for (const orderItem of allOrders) {
          const tracking = await getTrackingStatus(orderItem.order.orderId);

          if (tracking) {
            setTrackingStatusMap(prev => ({
              ...prev,
              [orderItem.order.orderId]: tracking,
            }));

            const lastStatus = getLastTrackingStatus(tracking.trackingHistory);

            const isDelivered =
              lastStatus === 'delivered' ||
              tracking.currentStatus === 'delivered';

            const hasPendingAssignment =
              tracking.pendingAssignment &&
              tracking.pendingAssignment.status === 'PENDING_ACCEPTANCE' &&
              tracking.pendingAssignment.assigneeId === loggedInUserId;

            const isCurrentlyAssigned =
              tracking.currentShipping?.shippingUserId?.toString() ===
              loggedInUserId;

            const hasActiveQR = tracking.qrOwnershipHistory?.some(
              (q: any) =>
                q.releasedAt === null && q.holderId === loggedInUserId,
            );

            if (isDelivered) {
              completed.push(orderItem);
            } else if (hasPendingAssignment) {
              available.push(orderItem);
            } else if (isCurrentlyAssigned || hasActiveQR) {
              current.push(orderItem);
            } else {
              const hasAssignmentHistory = tracking.assignmentHistory?.some(
                (a: any) => a.assigneeId === loggedInUserId,
              );
              if (hasAssignmentHistory) {
                current.push(orderItem);
              } else {
                current.push(orderItem);
              }
            }
          } else {
            current.push(orderItem);
          }
        }

        setCurrentOrders(current);
        setAvailableOrders(available);
        setCompletedOrders(completed);
      } else {
        Alert.alert('Error', 'Failed to fetch orders');
        setCurrentOrders([]);
        setAvailableOrders([]);
        setCompletedOrders([]);
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('❌ Error in getAllOrders:', error);
      }
      if (error instanceof ApiError && error.status === 401) {
        Alert.alert('Session Expired', 'Please login again', [
          { text: 'Login', onPress: () => navigation.navigate('Login' as never) },
        ]);
      } else {
        Alert.alert('Error', error?.message || 'Failed to fetch orders');
      }
      setCurrentOrders([]);
      setAvailableOrders([]);
      setCompletedOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await getAllOrders();
  };

  // ============================================
  // ACCEPT ORDER
  // ============================================

  const acceptOrder = async (orderItem: OrderWithBasicInfo) => {
    try {
      setAcceptingOrderId(orderItem.order.orderId);
      const trackingStatus = trackingStatusMap[orderItem.order.orderId];
      const assignmentId = trackingStatus?.pendingAssignment?.assignmentId;
      if (!assignmentId) {
        Alert.alert('Error', 'No assignment found for this order');
        return;
      }
      const response = await acceptAssignment(
        orderItem.order.orderId,
        assignmentId,
      );
      if (response.success) {
        Alert.alert('Success', 'Order accepted successfully!');
        await getAllOrders();
      } else {
        Alert.alert('Error', response.message || 'Failed to accept order');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to accept order');
    } finally {
      setAcceptingOrderId(null);
    }
  };

  // ============================================
  // SHOW QR
  // ============================================

  const handleShowQRPress = async (orderId: string) => {
    try {
      setShowQRLoading(orderId);
      const qrData = await getOrderQRCode(orderId);
      if (!qrData) {
        Alert.alert('Error', 'Unable to fetch QR code. Please try again.');
        return;
      }
      if (!qrData.showQR) {
        Alert.alert(
          'Not Available',
          qrData.message || 'QR code is not available for this order.',
        );
        return;
      }
      if (qrData.qrCodeUrl) {
        setSelectedQRData({ url: qrData.qrCodeUrl, orderId });
        setShowQRCodeModal(true);
      } else {
        Alert.alert('Error', 'QR code URL not found.');
      }
    } catch {
      Alert.alert('Error', 'Failed to load QR code');
    } finally {
      setShowQRLoading(null);
    }
  };

  // ============================================
  // SCAN
  // ============================================

  const handleScanPress = () => {
    setQrScanError('');
    setShowScanSelection(true);
  };

  const handleCameraScan = () => {
    setShowScanSelection(false);
    setShowCameraScanner(true);
  };

  const handleManualEntry = () => {
    setShowScanSelection(false);
    setShowManualQRInput(true);
  };

  const handleQRScanResult = async (qrCode: string) => {
    try {
      setQrScanLoading(true);
      setQrScanError('');

      const response = await handoverViaQrDelivery(qrCode);

      if (response.duplicate === true || response.code === 'DUPLICATE_SCAN') {
        Vibration.vibrate(100);
        Alert.alert(
          '⚠️ Duplicate Scan',
          response.details ||
            response.message ||
            'This QR has already been scanned.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowCameraScanner(false);
                setShowManualQRInput(false);
                getAllOrders();
              },
            },
          ],
        );
        return;
      }

      if (response.alreadyScanned === true) {
        Vibration.vibrate(100);
        Alert.alert(
          '⚠️ Already Scanned',
          response.message ||
            'This QR has already been scanned for this handover.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowCameraScanner(false);
                setShowManualQRInput(false);
                getAllOrders();
              },
            },
          ],
        );
        return;
      }

      if (response.success) {
        Vibration.vibrate(200);
        Alert.alert('✅ Success', 'Handover completed successfully!', [
          {
            text: 'OK',
            onPress: () => {
              setShowCameraScanner(false);
              setShowManualQRInput(false);
              getAllOrders();
            },
          },
        ]);
      } else {
        setQrScanError(response.message || 'Failed to complete handover');
        Vibration.vibrate(100);
      }
    } catch (error: any) {
      const errorData =
        error instanceof ApiError ? (error.data as any) : undefined;
      const errorMessage =
        errorData?.message || error?.message || 'Failed to complete handover';

      if (
        errorData?.duplicate === true ||
        errorData?.code === 'DUPLICATE_SCAN' ||
        errorMessage.includes('duplicate') ||
        errorMessage.includes('already scanned') ||
        errorMessage.includes('already verified') ||
        errorMessage.includes('Duplicate Scan Not Allowed')
      ) {
        Vibration.vibrate(100);
        Alert.alert(
          '⚠️ Duplicate Scan',
          errorData?.details || errorData?.message || errorMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowCameraScanner(false);
                setShowManualQRInput(false);
                getAllOrders();
              },
            },
          ],
        );
        return;
      }

      setQrScanError(errorMessage);
      Vibration.vibrate(100);
    } finally {
      setQrScanLoading(false);
    }
  };

  // ============================================
  // DELIVERY COMPLETE (OTP FLOW)
  // ============================================

  const handleDeliveryButtonComplete = async (orderId: string) => {
    try {
      setDeliveryLoading(orderId);
      setOtpError('');

      const response = await initiateDelivery(orderId);

      if (response.success) {
        const expiresInMinutes = response.data.expiresInMinutes || 5;

        const allOrders = [
          ...currentOrders,
          ...availableOrders,
          ...completedOrders,
        ];
        const selected = allOrders.find(o => o.order.orderId === orderId);
        setSelectedOrderForOTP(selected || null);
        setOtpExpiryTime(expiresInMinutes * 60);
        setShowOTPModal(true);
        setOtp('');

        Alert.alert(
          '✅ OTP Sent',
          `An OTP has been sent to the buyer's email. It will expire in ${expiresInMinutes} minutes.`,
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to initiate delivery');
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Failed to initiate delivery',
      );
    } finally {
      setDeliveryLoading(null);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      Vibration.vibrate(100);
      return;
    }

    if (!selectedOrderForOTP) {
      setOtpError('Order not found');
      return;
    }

    try {
      setOtpLoading(true);
      setOtpError('');

      const response = await verifyDeliveryOTP(
        selectedOrderForOTP.order.orderId,
        otp,
      );

      if (response.success) {
        setShowOTPModal(false);
        setOtp('');
        setOtpError('');
        setSelectedOrderForOTP(null);

        Alert.alert(
          '✅ Delivery Complete',
          `Order ${selectedOrderForOTP.order.orderId} has been delivered successfully to ${response.data.buyerName}.`,
          [
            {
              text: 'OK',
              onPress: () => {
                getAllOrders();
              },
            },
          ],
        );
      } else {
        setOtpError(response.message || 'OTP verification failed');
        Vibration.vibrate(100);
      }
    } catch (error: any) {
      setOtpError(error?.message || 'OTP verification failed');
      Vibration.vibrate(100);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!selectedOrderForOTP) {
      Alert.alert('Error', 'No order selected');
      return;
    }

    try {
      setOtpResendLoading(true);
      setOtpError('');

      const response = await requestNewDeliveryOTP(
        selectedOrderForOTP.order.orderId,
      );

      if (response.success) {
        setOtpExpiryTime(response.data.expiresInMinutes * 60);
        setOtp('');
        Alert.alert(
          '✅ OTP Sent',
          `A new OTP has been sent. It will expire in ${response.data.expiresInMinutes} minutes.`,
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to request new OTP');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to request new OTP');
    } finally {
      setOtpResendLoading(false);
    }
  };

  const handleCODConfirm = () => {
    Alert.alert(
      'Cash Received',
      `₹${selectedOrderForOTP?.order.finalAmount} received from customer.`,
      [
        {
          text: 'OK',
          onPress: () => {
            getAllOrders();
            setShowCODPopup(false);
            setSelectedOrderForOTP(null);
          },
        },
      ],
    );
  };

  const handleNavigate = (order: OrderData, isPickup: boolean) => {
    const targetLocation = isPickup ? order.sellerAddress : order.buyerAddress;
    NavigationEngine.startTurnByTurnNavigation(
      targetLocation.latitude,
      targetLocation.longitude,
      `${isPickup ? 'Pickup' : 'Delivery'} Location`,
    );
  };

  // ============================================
  // RENDER
  // ============================================

  const renderOrderItem = ({ item }: { item: OrderWithBasicInfo }) => {
    const order = item.order;
    const trackingStatus = trackingStatusMap[order.orderId];
    const isCompleted = activeTab === 'completed';

    return (
      <OrderCard
        order={order}
        trackingStatus={trackingStatus || null}
        loggedInUserId={loggedInUserId}
        onAccept={() => acceptOrder(item)}
        onShowQR={() => handleShowQRPress(order.orderId)}
        onScan={handleScanPress}
        onNavigate={() => handleNavigate(order, false)}
        onDeliveryComplete={() => handleDeliveryButtonComplete(order.orderId)}
        acceptLoading={acceptingOrderId === order.orderId}
        showQRLoading={showQRLoading === order.orderId}
        scanLoading={qrScanLoading}
        deliveryLoading={deliveryLoading === order.orderId}
        isCompleted={isCompleted}
      />
    );
  };

  const renderEmptyState = (tab: 'current' | 'available' | 'completed') => {
    const titles = {
      current: 'No Current Orders',
      available: 'No Available Orders',
      completed: 'No Completed Orders',
    };
    const subtitles = {
      current: "You don't have any active orders at the moment.",
      available: 'No pending assignments available.',
      completed: "You haven't completed any deliveries yet.",
    };

    return (
      <View style={styles.emptyState}>
        <FontAwesome5 name="box-open" size={60} color="#D1D5DB" />
        <Text style={styles.emptyStateTitle}>{titles[tab]}</Text>
        <Text style={styles.emptyStateText}>{subtitles[tab]}</Text>
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
          <Text style={styles.codModalAmount}>
            ₹{selectedOrderForOTP?.order.finalAmount}
          </Text>
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
    useCallback(() => {
      const init = async () => {
        const userId = await getUserIdFromToken();

        if (userId) {
          setLoggedInUserId(userId);
        }

        const token = await getAuthToken();
        if (token) {
          await getAllOrders();
        } else {
          Alert.alert(
            'Authentication Required',
            'Please login to view orders',
            [
              {
                text: 'Login',
                onPress: () => navigation.navigate('Login' as never),
              },
            ],
          );
        }
      };
      init();
    }, []),
  );

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

  const getOrdersForTab = () => {
    switch (activeTab) {
      case 'current':
        return currentOrders;
      case 'available':
        return availableOrders;
      case 'completed':
        return completedOrders;
      default:
        return currentOrders;
    }
  };

  const getTabCount = (tab: 'current' | 'available' | 'completed') => {
    switch (tab) {
      case 'current':
        return currentOrders.length;
      case 'available':
        return availableOrders.length;
      case 'completed':
        return completedOrders.length;
      default:
        return 0;
    }
  };

  const displayOrders = getOrdersForTab();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>My Deliveries</Text>
            <Text style={styles.headerSubtitle}>
              {displayOrders.length} order
              {displayOrders.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'current' && styles.activeTab]}
            onPress={() => setActiveTab('current')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'current' && styles.activeTabText,
              ]}
            >
              Current ({getTabCount('current')})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'available' && styles.activeTab]}
            onPress={() => setActiveTab('available')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'available' && styles.activeTabText,
              ]}
            >
              Available ({getTabCount('available')})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
            onPress={() => setActiveTab('completed')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'completed' && styles.activeTabText,
              ]}
            >
              Completed ({getTabCount('completed')})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerBottomRow}>
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
        data={displayOrders}
        renderItem={renderOrderItem}
        keyExtractor={item => item.order._id || item.order.orderId}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => renderEmptyState(activeTab)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <OTPModal
        visible={showOTPModal}
        onClose={() => {
          setShowOTPModal(false);
          setOtp('');
          setOtpError('');
        }}
        onVerify={verifyOTP}
        onResendOTP={handleResendOTP}
        otp={otp}
        setOtp={setOtp}
        loading={otpLoading}
        error={otpError}
        expiryTime={otpExpiryTime}
        resendLoading={otpResendLoading}
      />

      <QRScanSelectionModal
        visible={showScanSelection}
        onClose={() => setShowScanSelection(false)}
        onCameraScan={handleCameraScan}
        onManualEntry={handleManualEntry}
      />

      <CameraQRScanner
        visible={showCameraScanner}
        onClose={() => {
          setShowCameraScanner(false);
          setQrScanError('');
        }}
        onScan={handleQRScanResult}
        loading={qrScanLoading}
        error={qrScanError}
      />

      <ManualQRInputModal
        visible={showManualQRInput}
        onClose={() => {
          setShowManualQRInput(false);
          setQrScanError('');
        }}
        onSubmit={handleQRScanResult}
        loading={qrScanLoading}
        error={qrScanError}
      />

      <QRCodeModal
        visible={showQRCodeModal}
        onClose={() => {
          setShowQRCodeModal(false);
          setSelectedQRData(null);
        }}
        qrCodeUrl={selectedQRData?.url || ''}
        orderId={selectedQRData?.orderId || ''}
      />

      {renderCODPopup()}
    </SafeAreaView>
  );
};

// ============================================
// STYLES
// ============================================

const qrInfoStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: width * 0.85,
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  showQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  showQRButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
  },
});

const manualQRStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  title: { fontSize: 20, fontWeight: '600', color: '#1F2937' },
  inputSection: { marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
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
  errorText: { fontSize: 13, color: '#DC2626', fontWeight: '500', flex: 1 },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: { backgroundColor: '#A7F3D0' },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

const selectionStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: width * 0.85,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  optionSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cancelButton: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
});

const cameraStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  camera: { flex: 1 },
  overlayTextContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  noPermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  noPermissionText: { color: '#FFFFFF', fontSize: 16, marginTop: 16 },
  permissionButton: {
    marginTop: 20,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: { color: '#FFFFFF', fontSize: 14, marginTop: 12 },
  loadingOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 12,
    marginHorizontal: 40,
    borderRadius: 30,
  },
  loadingOverlayText: { color: '#FFFFFF', fontSize: 14, marginTop: 4 },
  errorContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  tryAgainButton: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  tryAgainText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  rescanButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rescanText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});

const qrCodeModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: width * 0.85,
    padding: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCodeWrapper: { width: 200, height: 200, marginVertical: 20 },
  qrCodeImage: { width: '100%', height: '100%' },
  qrOrderId: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 10,
    textAlign: 'center',
  },
  qrInstruction: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  doneButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

const timelineStyles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: { fontSize: 12, fontWeight: '600', color: '#475569' },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  timelineIcon: { width: 28, alignItems: 'center', position: 'relative' },
  timelineLine: {
    position: 'absolute',
    top: 20,
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  timelineContent: { flex: 1 },
  timelineStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  timelineNotes: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  timelineTime: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
});

const otpModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  visibleInput: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    marginTop: 10,
    marginBottom: 5,
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
  header: { marginBottom: 24 },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  titleContainer: { alignItems: 'center' },
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
  timerBoxExpired: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  timerText: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },
  timerTextExpired: { color: '#EF4444' },
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
  resendText: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },
  otpSection: { marginBottom: 24, alignItems: 'center' },
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
  otpBoxActive: { borderColor: '#3B82F6', backgroundColor: '#FFFFFF' },
  otpBoxFilled: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  otpBoxDisabled: { borderColor: '#FCA5A5', backgroundColor: '#FEE2E2' },
  otpText: { fontSize: 26, fontWeight: '700', color: '#9CA3AF' },
  otpTextFilled: { color: '#065F46' },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
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
  errorText: { fontSize: 13, color: '#DC2626', fontWeight: '500', flex: 1 },
  verifyButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  verifyButtonDisabled: { backgroundColor: '#93C5FD' },
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
  resendOption: { marginTop: 16, alignItems: 'center' },
  resendOptionText: {
    fontSize: 13,
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
});

const buttonStyles = StyleSheet.create({
  buttonContainer: { alignItems: 'center', marginVertical: 4 },
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
  iconContainer: { marginRight: 10 },
  buttonText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingSpinner: { marginBottom: 15 },
  loadingText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
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
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  headerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
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
  refreshButtonText: { fontSize: 11, color: '#3B82F6', fontWeight: '500' },
  tabBar: { flexDirection: 'row', marginTop: 16, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  activeTab: { borderBottomColor: '#3B82F6' },
  tabText: { fontSize: 13, color: '#6B7280' },
  activeTabText: { color: '#3B82F6', fontWeight: '600' },
  listContainer: { padding: 12, paddingBottom: 20 },
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
  deliveredCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
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
    flex: 1,
  },
  orderId: { fontSize: 11, fontWeight: '500', color: '#374151' },
  infoIcon: { padding: 4, marginRight: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  statusCard: {
    borderRadius: 10,
    padding: 12,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusMessage: { fontSize: 14, fontWeight: '600', flex: 1, color: '#1F2937' },
  actionContainer: { marginTop: 4 },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  navigateButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  deliveryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  deliveryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  deliveredText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
  },
  qrOwnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  qrOwnerText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '500',
  },
  locationSection: { marginBottom: 12 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  locationIconContainer: { alignItems: 'center', width: 32 },
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
  locationDetails: { flex: 1, marginLeft: 10 },
  locationLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  locationAddress: { fontSize: 13, color: '#1F2937', lineHeight: 18 },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: { flex: 1 },
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
  codText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  timeSection: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  createdAtText: { fontSize: 11, color: '#6B7280' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
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
  codModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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

function atob(base64String: string): string {
  const base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const paddedBase64 =
    padding === 2
      ? `${base64}==`
      : padding === 3
      ? `${base64}=`
      : padding === 1
      ? `${base64}===`
      : base64;
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < paddedBase64.length; i += 1) {
    const value = chars.indexOf(paddedBase64.charAt(i));
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return decodeUtf8(output);
}

function decodeUtf8(str: string): string {
  let utf8 = '';
  let i = 0;
  while (i < str.length) {
    const charCode = str.charCodeAt(i++);
    if (charCode < 0x80) {
      utf8 += String.fromCharCode(charCode);
    } else if (charCode < 0xe0) {
      const charCode2 = str.charCodeAt(i++);
      utf8 += String.fromCharCode(
        ((charCode & 0x1f) << 6) | (charCode2 & 0x3f),
      );
    } else if (charCode < 0xf0) {
      const charCode2 = str.charCodeAt(i++);
      const charCode3 = str.charCodeAt(i++);
      utf8 += String.fromCharCode(
        ((charCode & 0x0f) << 12) |
          ((charCode2 & 0x3f) << 6) |
          (charCode3 & 0x3f),
      );
    } else {
      const charCode2 = str.charCodeAt(i++);
      const charCode3 = str.charCodeAt(i++);
      const charCode4 = str.charCodeAt(i++);
      let codePoint =
        ((charCode & 0x07) << 18) |
        ((charCode2 & 0x3f) << 12) |
        ((charCode3 & 0x3f) << 6) |
        (charCode4 & 0x3f);
      codePoint -= 0x10000;
      utf8 += String.fromCharCode(
        0xd800 + ((codePoint >> 10) & 0x3ff),
        0xdc00 + (codePoint & 0x3ff),
      );
    }
  }
  return utf8;
}

export default PendingOrdersScreen;