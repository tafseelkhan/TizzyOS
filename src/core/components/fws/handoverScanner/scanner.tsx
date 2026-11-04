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
import Icon from 'react-native-vector-icons/Ionicons';
import {
  PERMISSIONS,
  request,
  check,
  RESULTS,
} from 'react-native-permissions';

// ✅ CORRECT: Import Camera and CameraType from react-native-camera-kit v18
import { Camera, CameraType } from 'react-native-camera-kit';
import type { CameraApi } from 'react-native-camera-kit';

// ✅ NEW: API slice (auto refresh + retry)
import {
  handoverViaQr,
  HandoverViaQrResponse,
} from '../../../../api/features/private/qrHandoverPrivateSlice';
import { ApiError } from '../../../../core/utils/handler/apiClient';

// ✅ Types
type QRScannerNavigationProp = StackNavigationProp<any>;

// ============================================================
// 🧩 COMPONENT
// ============================================================

const QRScannerScreen = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const navigation = useNavigation<QRScannerNavigationProp>();

  // ✅ Ref for camera kit
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

  // ============================================================
  // ✅ HANDOVER API — new slice use
  // ============================================================
  const handoverViaQrApi = async (qrData: string) => {
    setLoading(true);
    setError('');

    try {
      const response: HandoverViaQrResponse = await handoverViaQr(qrData);

      // Duplicate scan (success response mein)
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
                setIsScanning(true);
                safeGoBack();
              },
            },
          ],
        );
        return;
      }

      // Already scanned
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
                setIsScanning(true);
                safeGoBack();
              },
            },
          ],
        );
        return;
      }

      // Success
      if (response.success) {
        Vibration.vibrate(200);
        Alert.alert(
          '✅ Handover Successful!',
          `Order ${response.data?.orderId || ''} handed over to ${
            response.data?.toHolder?.type || 'recipient'
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
        throw new Error(response.message || 'Handover failed');
      }
    } catch (error: any) {
      const errorData =
        error instanceof ApiError
          ? (error.data as
              | {
                  duplicate?: boolean;
                  code?: string;
                  message?: string;
                  details?: string;
                }
              | undefined)
          : undefined;

      const errorMessage =
        errorData?.message ||
        (error instanceof Error ? error.message : null) ||
        'Something went wrong. Please try again.';

      // Duplicate scan detection in error
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

  // ✅ Handle QR code scan
  const onReadCode = (event: any) => {
    if (!isScanning || loading) return;

    const qrData = event?.nativeEvent?.codeStringValue || event?.data || event;

    if (!qrData || typeof qrData !== 'string') return;

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
        <Camera
          ref={cameraRef}
          style={styles.camera}
          cameraType={CameraType.Back}
          scanBarcode={isScanning && !loading}
          onReadCode={onReadCode}
        />

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