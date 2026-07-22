// src/core/components/cab/driver/RideRequestPopup.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Vibration,
  StatusBar,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RideRequest } from '../../../types/RideTypes';
import { CONFIG } from '../../../../api/constants/rideRequestConfig';

const { height, width } = Dimensions.get('window');

interface RideRequestPopupProps {
  visible: boolean;
  requestData: RideRequest | null;
  onAccept: () => void;
  onReject: () => void;
  onTimeout: () => void;
}

const RideRequestPopup: React.FC<RideRequestPopupProps> = ({
  visible,
  requestData,
  onAccept,
  onReject,
  onTimeout,
}) => {
  const [timeLeft, setTimeLeft] = useState(CONFIG.RIDE_REQUEST_TIMEOUT_SECONDS);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset timer when popup appears
  useEffect(() => {
    if (visible && requestData) {
      setTimeLeft(CONFIG.RIDE_REQUEST_TIMEOUT_SECONDS);

      // Slide up animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 5,
      }).start();

      // Pulse animation for urgency
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      // Progress bar animation
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: CONFIG.RIDE_REQUEST_TIMEOUT_SECONDS * 1000,
        useNativeDriver: false,
      }).start();

      // Start countdown timer
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            Vibration.cancel();
            onTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, CONFIG.RIDE_REQUEST_COUNTDOWN_INTERVAL);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        Vibration.cancel();
      };
    } else {
      // Dismiss animation
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      Vibration.cancel();
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      Vibration.cancel();
    };
  }, []);

  if (!visible || !requestData) return null;

  const { fare, pickup, destination, distance } = requestData;
  const progressWidth = (timeLeft / CONFIG.RIDE_REQUEST_TIMEOUT_SECONDS) * 100;
  const isUrgent = timeLeft <= 5;

  // Handle accept
  const handleAccept = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    Vibration.cancel();
    onAccept();
  };

  // Handle reject
  const handleReject = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    Vibration.cancel();
    onReject();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Header with timer */}
          <View style={styles.header}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Icon name="car" size={28} color="#10b981" />
            </Animated.View>
            <Text style={styles.headerTitle}>New Ride Request</Text>
            <Text style={[styles.timer, isUrgent && styles.timerUrgent]}>
              {timeLeft}s
            </Text>
          </View>

          {/* Fare & Distance */}
          <View style={styles.fareContainer}>
            <Text style={styles.fare}>₹{fare}</Text>
            <View style={styles.fareRight}>
              <Text style={styles.distance}>📏 {distance} km</Text>
              {requestData.isRetry && (
                <View style={styles.retryBadge}>
                  <Text style={styles.retryText}>Increased Fare</Text>
                </View>
              )}
            </View>
          </View>

          {/* Pickup & Drop */}
          <View style={styles.locationContainer}>
            <View style={styles.locationRow}>
              <View style={styles.pickupDot} />
              <View style={styles.locationContent}>
                <Text style={styles.locationLabel}>Pickup</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {pickup?.address || 'Loading...'}
                </Text>
              </View>
            </View>

            <View style={styles.locationDivider} />

            <View style={styles.locationRow}>
              <View style={styles.dropDot} />
              <View style={styles.locationContent}>
                <Text style={styles.locationLabel}>Drop</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {destination?.address || 'Loading...'}
                </Text>
              </View>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progressWidth}%`,
                  backgroundColor: isUrgent ? '#ef4444' : '#10b981',
                },
              ]}
            />
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.rejectButton]}
              onPress={handleReject}
              activeOpacity={0.7}
            >
              <Icon name="close" size={28} color="#ef4444" />
              <Text style={styles.rejectText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={handleAccept}
              activeOpacity={0.7}
            >
              <Icon name="check" size={28} color="#ffffff" />
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    maxHeight: height * 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
    color: '#1f2937',
  },
  timer: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6b7280',
  },
  timerUrgent: {
    color: '#ef4444',
  },
  fareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  fare: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10b981',
  },
  fareRight: {
    alignItems: 'flex-end',
  },
  distance: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  retryBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  retryText: {
    fontSize: 10,
    color: '#d97706',
    fontWeight: '600',
  },
  locationContainer: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pickupDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    marginRight: 12,
    marginTop: 2,
  },
  dropDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444',
    marginRight: 12,
    marginTop: 2,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 2,
  },
  locationDivider: {
    height: 20,
    width: 2,
    backgroundColor: '#d1d5db',
    marginLeft: 6,
    marginVertical: 4,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 10,
  },
  acceptButton: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  rejectButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  acceptText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  rejectText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RideRequestPopup;
