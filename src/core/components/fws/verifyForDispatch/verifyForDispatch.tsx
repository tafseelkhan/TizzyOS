// screens/VerifyForDispatch.tsx
// ============================================================
// FILE: src/screens/VerifyForDispatch.tsx
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Vibration,
  Dimensions,
  Linking,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import { verifyQRAndMarkReadyForDispatch } from '../../../../api/features/private/scanFwsOrderPrivateSlice';
import { ScanResponse } from '../../../types/orderTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// ✅ Extend ScanResponse to include duplicate detection fields
interface ExtendedScanResponse extends ScanResponse {
  message?: string;
  alreadyScanned?: boolean;
  duplicate?: boolean;
  code?: string;
  details?: string;
}

const VerifyForDispatch: React.FC = () => {
  const navigation = useNavigation();

  // ============================================================
  // States
  // ============================================================
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ExtendedScanResponse | null>(
    null,
  );
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const device = useCameraDevice('back');

  // ============================================================
  // Camera Permission Check
  // ============================================================
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
    } catch (error) {
      console.error('Check permission error:', error);
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
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      }
    } catch (error) {
      console.error('Request permission error:', error);
      setHasPermission(false);
    }
  };

  useEffect(() => {
    checkCameraPermission();
  }, []);

  // ============================================================
  // Get Auth Token from Storage
  // ============================================================
  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      return null;
    }
  };

  // ============================================================
  // QR Code Scanner using useCodeScanner hook
  // ============================================================
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'code-128'],
    onCodeScanned: codes => {
      if (isScanning && !isProcessing && codes.length > 0) {
        const qrData = codes[0]?.value;
        if (!qrData) return;

        setIsScanning(false);
        Vibration.vibrate(200);

        console.log('📸 QR Code Scanned:', qrData);
        handleQRScan(qrData);
      }
    },
  });

  // ============================================================
  // Handle QR Scan - COMPLETE FIXED WITH DUPLICATE DETECTION
  // ============================================================
  const handleQRScan = async (qrData: string) => {
    setIsProcessing(true);
    setError('');

    try {
      console.log('════════════════════════════════════════════');
      console.log('📸 QR SCAN DEBUG');
      console.log('════════════════════════════════════════════');
      console.log('Raw QR Data:', qrData);

      // Parse QR data
      let qrPayload: any = {};

      try {
        const parsed = JSON.parse(qrData);
        console.log('✅ Parsed as JSON:', parsed);
        qrPayload = parsed;
      } catch (e) {
        console.log('📝 Not JSON, using as plain text');
        qrPayload = { token: qrData };
      }

      // Extract required fields
      let requestData: any = {};

      if (qrPayload.orderId && qrPayload.sellerId && qrPayload.buyerId) {
        requestData = {
          orderId: qrPayload.orderId,
          sellerId: qrPayload.sellerId,
          buyerId: qrPayload.buyerId,
          dispatchId: qrPayload.dispatchId,
        };
        console.log('✅ All required fields found:', requestData);
      } else if (qrPayload.token || qrPayload.fwsCode) {
        const code = qrPayload.token || qrPayload.fwsCode;
        console.log('🔑 Found token/fwsCode:', code);
        requestData = { token: code };
      } else if (qrPayload.orderId) {
        console.log('📝 Found only orderId:', qrPayload.orderId);
        requestData = { orderId: qrPayload.orderId };
      } else {
        console.log('⚠️ No recognizable fields, sending raw data');
        requestData = { qrData: qrData };
      }

      console.log('📦 Final request data:', requestData);
      console.log('════════════════════════════════════════════');

      // Get auth token
      const authToken = await getAuthToken();
      if (!authToken) {
        throw new Error('Please login first to scan QR code');
      }

      console.log('🔄 Sending QR verification request...');

      const response = (await verifyQRAndMarkReadyForDispatch(
        requestData,
      )) as ExtendedScanResponse;

      console.log('✅ Scan Response:', JSON.stringify(response, null, 2));

      // ============================================================
      // ✅ STEP 1: Check for Duplicate Scan (NEW)
      // ============================================================
      if (response.duplicate === true || response.code === 'DUPLICATE_SCAN') {
        console.log('⚠️ DUPLICATE SCAN DETECTED!');
        Vibration.vibrate(100);
        Alert.alert(
          '⚠️ Duplicate Scan',
          response.details ||
            response.message ||
            'This QR has already been verified.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsScanning(true);
                navigation.goBack();
              },
            },
          ],
        );
        return;
      }

      // ============================================================
      // ✅ STEP 2: Check for alreadyScanned (Backward Compatibility)
      // ============================================================
      if (response.alreadyScanned === true) {
        console.log('⚠️ Already scanned (backward compatibility)');
        Vibration.vibrate(100);
        Alert.alert(
          '⚠️ Already Verified',
          response.message || 'This order has already been verified.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsScanning(true);
                navigation.goBack();
              },
            },
          ],
        );
        return;
      }

      // ============================================================
      // ✅ STEP 3: Check for Success
      // ============================================================
      if (response.success) {
        console.log('✅ Scan successful!');
        Vibration.vibrate(200);
        setScanResult(response);
        setShowSuccessModal(true);

        setTimeout(() => {
          setShowSuccessModal(false);
          setIsScanning(true);
          navigation.navigate('FWSScannedOrders' as never);
        }, 2000);
      } else {
        throw new Error(response.message || 'Verification failed');
      }
    } catch (error: any) {
      console.error('❌ Scan Error:', error);

      // ✅ Check if error response contains duplicate data
      const errorData = error.response?.data;
      const errorMessage =
        errorData?.message ||
        error.message ||
        'Unable to verify QR code. Please try again.';

      // ✅ Check for duplicate scan in error response
      if (
        errorData?.duplicate === true ||
        errorData?.code === 'DUPLICATE_SCAN' ||
        errorMessage.includes('duplicate') ||
        errorMessage.includes('already verified') ||
        errorMessage.includes('already scanned') ||
        errorMessage.includes('Duplicate Scan Not Allowed')
      ) {
        console.log('⚠️ Duplicate scan detected in error response');
        Vibration.vibrate(100);
        Alert.alert(
          '⚠️ Duplicate Scan',
          errorData?.details || errorData?.message || errorMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                setIsScanning(true);
                navigation.goBack();
              },
            },
          ],
        );
        return;
      }

      // User-friendly error messages
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('Invalid QR code')) {
        userFriendlyMessage =
          'Invalid QR code format. Please scan a valid FWS QR code.';
      } else if (errorMessage.includes('not found')) {
        userFriendlyMessage =
          'Order not found for this QR code. Please check and try again.';
      } else if (errorMessage.includes('not authorized')) {
        userFriendlyMessage = 'You are not authorized to verify this order.';
      } else if (errorMessage.includes('Network Error')) {
        userFriendlyMessage =
          'Network error. Please check your internet connection.';
      }

      setError(userFriendlyMessage);

      Alert.alert('❌ Scan Failed', userFriendlyMessage, [
        {
          text: 'Retry',
          onPress: () => {
            setIsScanning(true);
            setError('');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setIsScanning(true);
            navigation.goBack();
          },
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================
  // Success Modal
  // ============================================================
  const SuccessModal = () => {
    if (!scanResult || !showSuccessModal) return null;

    return (
      <View style={styles.successOverlay}>
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Scan Successful!</Text>
          <Text style={styles.successMessage}>
            Order {scanResult.data?.order?.orderId || 'verified'} ready for
            dispatch
          </Text>
          <Text style={styles.successSubMessage}>
            Stage: {scanResult.data?.fwsDetails?.processingStage || 'READY'}
          </Text>
          <Text style={styles.successSubMessage}>
            FWS: {scanResult.data?.fwsDetails?.name || 'N/A'}
          </Text>
          <ActivityIndicator
            style={styles.successLoader}
            size="small"
            color="#4CAF50"
          />
          <Text style={styles.successRedirectText}>
            Redirecting to orders list...
          </Text>
        </View>
      </View>
    );
  };

  // ============================================================
  // Loading Overlay
  // ============================================================
  const LoadingOverlay = () => {
    if (!isProcessing) return null;

    return (
      <View style={styles.loadingOverlay}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Verifying QR Code...</Text>
          <Text style={styles.loadingSubtext}>Please wait</Text>
        </View>
      </View>
    );
  };

  // ============================================================
  // Render
  // ============================================================
  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Checking permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="camera-outline" size={60} color="#9CA3AF" />
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestCameraPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.cameraContainer}>
        <Camera
          style={styles.camera}
          device={device}
          isActive={true}
          codeScanner={isScanning && !isProcessing ? codeScanner : undefined}
          torch="off"
          enableZoomGesture={true}
        >
          {/* Scanner Overlay */}
          <View style={styles.overlay}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Scan Frame */}
            <View style={styles.frameContainer}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>

            <Text style={styles.scanText}>Place QR Code inside the frame</Text>
          </View>
        </Camera>

        <LoadingOverlay />
        <SuccessModal />

        {/* Error Container */}
        {error && !isProcessing && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  frameContainer: {
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 10,
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#4CAF50',
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#4CAF50',
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#4CAF50',
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#4CAF50',
  },
  scanText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 30,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 12,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 16,
    borderRadius: 30,
  },
  loadingCard: {
    alignItems: 'center',
  },
  loadingSubtext: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 4,
  },
  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCard: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '85%',
  },
  successIcon: {
    fontSize: 60,
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  successSubMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  successLoader: {
    marginTop: 8,
  },
  successRedirectText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  errorContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
});

export default VerifyForDispatch;
