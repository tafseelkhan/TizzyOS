// screens/QRScannerScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  Vibration,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import axios from 'axios';

// ✅ CORRECT: Import Camera and CameraType from react-native-camera-kit v18
import { Camera, CameraType } from 'react-native-camera-kit';
import type { CameraApi } from 'react-native-camera-kit';

// ✅ Types
type QRScannerNavigationProp = StackNavigationProp<any>;

// ✅ API Base URL
const API_BASE_URL = 'http://10.48.121.121:5000';

// ✅ Auth Helper
const getAuthToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('authToken');
};

const QRScannerScreen = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const navigation = useNavigation<QRScannerNavigationProp>();

  // ✅ Ref for camera kit - use CameraApi type
  const cameraRef = useRef<CameraApi>(null);

  // ✅ Safe navigation function
  const safeGoBack = () => {
    if (navigation?.goBack) {
      navigation.goBack();
    } else {
      console.warn('Navigation is not available');
    }
  };

  // ✅ Camera Permission Check
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
              onPress: () => safeGoBack(),
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

  // ✅ HANDOVER API (UNCHANGED)
  const handoverViaQrApi = async (qrData: string) => {
    setLoading(true);
    setError('');

    try {
      const authToken = await getAuthToken();
      if (!authToken) {
        throw new Error('Please login first to scan QR code');
      }

      let actualToken = qrData;
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.token) {
          actualToken = parsed.token;
          console.log('📝 Extracted token from JSON:', actualToken);
        }
      } catch (e) {
        console.log('📝 Using QR data as raw string');
      }

      console.log('🔄 Sending QR handover request...');

      const response = await axios.post(
        `${API_BASE_URL}/api/v0/delivery/tracking/shipping/handover/via/qr`,
        { token: actualToken },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      console.log('📦 API Response:', response.data);

      if (
        response.data.duplicate === true ||
        response.data.code === 'DUPLICATE_SCAN'
      ) {
        console.log('⚠️ Duplicate scan detected');
        Vibration.vibrate(100);
        Alert.alert(
          '⚠️ Duplicate Scan',
          response.data.details ||
            response.data.message ||
            'This QR has already been scanned.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsScanning(true);
                safeGoBack();
              },
            },
          ],
        );
        return;
      }

      if (response.data.alreadyScanned === true) {
        console.log('⚠️ Already scanned');
        Vibration.vibrate(100);
        Alert.alert(
          '⚠️ Already Scanned',
          response.data.message ||
            'This QR has already been scanned for this handover.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsScanning(true);
                safeGoBack();
              },
            },
          ],
        );
        return;
      }

      if (response.data.success) {
        Vibration.vibrate(200);
        Alert.alert(
          '✅ Handover Successful!',
          `Order ${response.data.data?.orderId || ''} handed over to ${
            response.data.data?.toHolder?.type || 'recipient'
          }`,
          [
            {
              text: 'OK',
              onPress: () => {
                setIsScanning(true);
                safeGoBack();
              },
            },
          ],
        );
      } else {
        throw new Error(response.data.message || 'Handover failed');
      }
    } catch (error: any) {
      console.error('❌ QR Processing Error:', error);

      const errorData = error.response?.data;
      const errorMessage =
        errorData?.message ||
        error.message ||
        'Something went wrong. Please try again.';

      if (
        errorData?.duplicate === true ||
        errorData?.code === 'DUPLICATE_SCAN' ||
        errorMessage.includes('duplicate') ||
        errorMessage.includes('already scanned') ||
        errorMessage.includes('already verified') ||
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
                safeGoBack();
              },
            },
          ],
        );
        return;
      }

      setError(errorMessage);

      Alert.alert('❌ Handover Failed', errorMessage, [
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
            safeGoBack();
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle QR code scan from CameraKit
  const onReadCode = (event: any) => {
    // Stop scanning immediately
    if (!isScanning || loading) return;

    // CameraKit v18 returns QR data in event.nativeEvent.codeStringValue
    const qrData = event?.nativeEvent?.codeStringValue || event?.data || event;

    if (!qrData || typeof qrData !== 'string') return;

    console.log('📸 QR Code Scanned:', qrData);

    setIsScanning(false);
    Vibration.vibrate(100);
    handoverViaQrApi(qrData);
  };

  // ✅ Loading/Error States
  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.cameraContainer}>
        {/* ✅ CameraKit v18 - ONLY QR CODES */}
        <Camera
          ref={cameraRef}
          style={styles.camera}
          cameraType={CameraType.Back}
          scanBarcode={isScanning && !loading}
          // surfaceColor REMOVED - doesn't exist in v18
          onReadCode={onReadCode}
        />

        {/* ✅ Overlay on top of camera */}
        <View style={styles.overlay} pointerEvents="none">
          <TouchableOpacity
            style={[styles.backButton, { pointerEvents: 'auto' }]}
            onPress={() => safeGoBack()}
          >
            <Icon name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.scanAreaContainer}>
            <View style={styles.scanArea} />
            <Text style={styles.scanText}>Align QR code within the frame</Text>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingOverlayText}>Verifying...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setError('');
                setIsScanning(true);
              }}
              style={[styles.tryAgainButton, { pointerEvents: 'auto' }]}
            >
              <Text style={styles.tryAgainText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isScanning && !loading && !error && (
          <TouchableOpacity
            style={[styles.rescanButton, { pointerEvents: 'auto' }]}
            onPress={() => setIsScanning(true)}
          >
            <Icon name="scan-outline" size={20} color="#FFFFFF" />
            <Text style={styles.rescanText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

// ✅ Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  scanAreaContainer: {
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
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
  loadingOverlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 4,
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
  tryAgainText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
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
  rescanText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default QRScannerScreen;
