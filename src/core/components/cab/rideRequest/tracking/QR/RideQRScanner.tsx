import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { StackScreenProps } from '@react-navigation/stack';
import { driverRideApi } from '../../../../../../api/features/private/driverRidePrivateSlice';
import { RootStackParamList } from '../../../../../../navigations/RootStackParamList';

type RideQRScannerProps = StackScreenProps<
  RootStackParamList,
  'RideQRScanner'
>;

const RideQRScanner: React.FC<RideQRScannerProps> = ({ route, navigation }) => {
  // ✅ SAFE: optional chaining — no crash
  const scanType = route?.params?.scanType;

  console.log('[RideQRScanner] 📥 route:', route);
  console.log('[RideQRScanner] 📥 scanType:', scanType);

  const [processing, setProcessing] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [message, setMessage] = useState(
    'Place the QR code inside the camera view.',
  );

  const scanLockedRef = useRef(false);

  const safeGoBack = useCallback(() => {
    navigation?.goBack?.();
  }, [navigation]);

  const handleReadCode = useCallback(
    async (event: { nativeEvent?: { codeStringValue?: string } }) => {
      if (scanLockedRef.current) return;
      if (!scanType) {
        setMessage('Invalid scan mode. Please reopen the scanner.');
        return;
      }

      const qrToken = event.nativeEvent?.codeStringValue?.trim();
      if (!qrToken) {
        setMessage('Could not read the QR code. Please scan again.');
        return;
      }

      scanLockedRef.current = true;
      setProcessing(true);
      setCameraEnabled(false);
      setMessage(
        scanType === 'pickup'
          ? 'Verifying pickup QR...'
          : 'Verifying drop QR...',
      );

      try {
        if (scanType === 'pickup') {
          await driverRideApi.verifyPickup(qrToken);
        } else {
          await driverRideApi.verifyDrop(qrToken);
        }

        setMessage(
          scanType === 'pickup'
            ? 'Pickup QR successfully verified!'
            : 'Drop QR successfully verified!',
        );

        setTimeout(() => {
          safeGoBack();
        }, 600);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'QR verification failed.';
        setMessage(errorMessage);
        setCameraEnabled(true);
        scanLockedRef.current = false;
      } finally {
        setProcessing(false);
      }
    },
    [scanType, safeGoBack],
  );

  const handleRetry = () => {
    scanLockedRef.current = false;
    setMessage('Place the QR code inside the camera view.');
    setCameraEnabled(true);
  };

  // ✅ EARLY RETURN — missing scanType ka friendly error UI
  if (!scanType) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Scanner unavailable</Text>
          <Text style={styles.errorMessage}>
            Missing scan mode. Please go back and try again.
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={safeGoBack}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ✅ FULL SCREEN CAMERA — no border, no background, no laser */}
      <View style={StyleSheet.absoluteFill}>
        {cameraEnabled && !processing ? (
          <Camera
            style={StyleSheet.absoluteFill}
            cameraType={CameraType.Back}
            scanBarcode={true}
            onReadCode={handleReadCode}
          />
        ) : (
          <View style={styles.processingOverlay}>
            {processing ? (
              <>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={styles.processingText}>Verifying...</Text>
              </>
            ) : (
              <Icon name="qr-code-2" size={72} color="#ffffff" />
            )}
          </View>
        )}
      </View>

      {/* ✅ TOP-LEFT CLOSE BUTTON — floating over camera */}
      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Close QR scanner"
          style={styles.closeButton}
          onPress={safeGoBack}
          disabled={processing}
        >
          <Icon name="close" size={26} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>
            {scanType === 'pickup' ? 'Verify Pickup' : 'Verify Drop'}
          </Text>
          <Text style={styles.subtitle}>
            {scanType === 'pickup'
              ? 'Scan customer pickup QR'
              : 'Scan customer drop QR'}
          </Text>
        </View>
      </SafeAreaView>

      {/* ✅ BOTTOM MESSAGE — floating over camera */}
      <SafeAreaView style={styles.bottomBar} pointerEvents="box-none">
        <View style={styles.messageContainer}>
          <Icon name="qr-code-scanner" size={22} color="#ffffff" />
          <Text style={styles.messageText}>{message}</Text>
        </View>

        {!processing && !cameraEnabled && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.85}
          >
            <Text style={styles.retryText}>Scan Again</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footerText}>
          The QR code will be verified on the server.
        </Text>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // black fallback if camera not ready
  },

  /* ✅ PROCESSING / PLACEHOLDER — full screen centered */
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  processingText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  /* ✅ TOP BAR — floating header over camera */
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 12,
    color: '#e5e7eb',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* ✅ BOTTOM BAR — floating message + retry over camera */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 12,
  },
  messageText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  footerText: {
    color: '#e5e7eb',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  retryButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#059669',
    marginBottom: 4,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  /* ✅ ERROR SCREEN — same as before, full dark */
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  errorButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default RideQRScanner;