// src/core/screens/cab/driver/ActiveTripScreen.tsx

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { driverRideApi } from '../../../../api/features/private/driverRidePrivateSlice';
import { socketService } from '../../../utils/socket/rideRequestUtils';
import { SOCKET_EVENTS } from '../../../../api/constants/rideRequestConfig';
import { Booking, Tracking } from '../../../types/RideTypes';

interface ActiveTripScreenProps {
  route: {
    params: {
      bookingId: string;
    };
  };
  navigation: any;
}

const ActiveTripScreen: React.FC<ActiveTripScreenProps> = ({
  route,
  navigation,
}) => {
  const { bookingId } = route.params || {};
  const [booking, setBooking] = useState<Booking | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (bookingId) {
      loadTripDetails();
    }

    // Listen for status updates
    const handleStatusChange = (data: any) => {
      if (data.bookingId === bookingId) {
        loadTripDetails();
      }
    };

    socketService.on(SOCKET_EVENTS.RIDE_STATUS_CHANGE, handleStatusChange);

    return () => {
      socketService.off(SOCKET_EVENTS.RIDE_STATUS_CHANGE, handleStatusChange);
    };
  }, [bookingId]);

  const loadTripDetails = async () => {
    try {
      setLoading(true);
      const [bookingData, trackingData] = await Promise.all([
        driverRideApi.getTripDetails(bookingId),
        driverRideApi.getTrackingByBooking(bookingId),
      ]);
      setBooking(bookingData);
      setTracking(trackingData);
    } catch (error: any) {
      console.error('Failed to load trip:', error);
      Alert.alert('Error', error.message || 'Failed to load trip details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateRideStatus = async (status: string) => {
    if (!tracking) return;

    try {
      setUpdating(true);
      await driverRideApi.updateRideStatus(tracking.trackingId, status);

      // Emit socket event for real-time update
      socketService.emit(SOCKET_EVENTS.RIDE_STATUS_CHANGE, {
        bookingId: booking?.bookingId,
        status,
      });

      // Reload trip details
      await loadTripDetails();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      Alert.alert('Error', error.message || 'Failed to update ride status');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelTrip = () => {
    Alert.alert('Cancel Trip', 'Are you sure you want to cancel this trip?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setUpdating(true);
            await driverRideApi.cancelBooking(bookingId, 'Driver cancelled');
            socketService.emit('cancel-ride', { bookingId });
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
  };

  const renderStatusButtons = () => {
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
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </SafeAreaView>
    );
  }

  if (!booking || !tracking) {
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f2937" />

      {/* Header */}
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

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Trip Code */}
        <View style={styles.tripCodeCard}>
          <Text style={styles.tripCodeLabel}>Trip Code</Text>
          <Text style={styles.tripCode}>{booking.rideCode}</Text>
          <View style={styles.tripStatusBadgeLarge}>
            <Text style={styles.tripStatusTextLarge}>
              {booking.status?.toUpperCase() || 'ACTIVE'}
            </Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Customer</Text>
          <Text style={styles.cardValue}>{booking.customerId}</Text>
        </View>

        {/* Fare */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 Fare</Text>
          <Text style={styles.fareText}>₹{booking.fare?.totalFare || 0}</Text>
          <View style={styles.fareBreakdown}>
            <Text style={styles.fareBreakdownText}>
              Base: ₹{booking.fare?.baseFare || 0} · Distance: ₹
              {booking.fare?.distanceFare || 0}
            </Text>
          </View>
        </View>

        {/* Pickup & Drop */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Trip Details</Text>
          <View style={styles.locationRow}>
            <View style={styles.pickupDot} />
            <View style={styles.locationContent}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationAddress}>
                {booking.pickup?.address}
              </Text>
            </View>
          </View>
          <View style={styles.locationDivider} />
          <View style={styles.locationRow}>
            <View style={styles.dropDot} />
            <View style={styles.locationContent}>
              <Text style={styles.locationLabel}>Drop</Text>
              <Text style={styles.locationAddress}>
                {booking.destination?.address}
              </Text>
            </View>
          </View>
          <View style={styles.tripMeta}>
            <Text style={styles.tripMetaText}>📏 {booking.distance} km</Text>
            <Text style={styles.tripMetaText}>⏱️ {booking.duration} min</Text>
          </View>
        </View>

        {/* Tracking Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Tracking</Text>
          <View style={styles.trackingStatus}>
            <View
              style={[
                styles.trackingDot,
                tracking.pickupVerified ? styles.verified : styles.pending,
              ]}
            />
            <Text style={styles.trackingText}>
              Pickup: {tracking.pickupVerified ? '✅ Verified' : '⏳ Pending'}
            </Text>
          </View>
          <View style={styles.trackingStatus}>
            <View
              style={[
                styles.trackingDot,
                tracking.dropVerified ? styles.verified : styles.pending,
              ]}
            />
            <Text style={styles.trackingText}>
              Drop: {tracking.dropVerified ? '✅ Verified' : '⏳ Pending'}
            </Text>
          </View>
          {tracking.tripDistanceCovered > 0 && (
            <Text style={styles.tripProgress}>
              Distance Covered: {tracking.tripDistanceCovered.toFixed(1)} km
            </Text>
          )}
        </View>

        {/* Action Buttons */}
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
  tripCodeCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tripCodeLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  tripCode: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 4,
    letterSpacing: 2,
  },
  tripStatusBadgeLarge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  tripStatusTextLarge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d97706',
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  fareText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10b981',
  },
  fareBreakdown: {
    marginTop: 4,
  },
  fareBreakdownText: {
    fontSize: 12,
    color: '#6b7280',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    marginRight: 12,
    marginTop: 4,
  },
  dropDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginRight: 12,
    marginTop: 4,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  locationDivider: {
    height: 12,
    width: 2,
    backgroundColor: '#d1d5db',
    marginLeft: 4,
    marginVertical: 2,
  },
  tripMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  tripMetaText: {
    fontSize: 13,
    color: '#6b7280',
  },
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  verified: {
    backgroundColor: '#10b981',
  },
  pending: {
    backgroundColor: '#f59e0b',
  },
  trackingText: {
    fontSize: 14,
    color: '#1f2937',
  },
  tripProgress: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    gap: 8,
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
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
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

export default ActiveTripScreen;
