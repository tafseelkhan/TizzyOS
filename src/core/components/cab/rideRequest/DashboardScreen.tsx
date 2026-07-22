// src/core/screens/cab/driver/DashboardScreen.tsx

import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../../contexts/auth/UserContext';
import { useDriverSocket } from '../../../hooks/cab/useDriverSocket';
import { useRideRequest } from '../../../hooks/cab/useRideRequest';
import { useDriverStatus } from '../../../hooks/cab/useDriverStatus';
import RideRequestPopup from './RideRequestPopup';

interface DashboardScreenProps {
  navigation: any;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { isConnected } = useDriverSocket();
  const {
    isOnline,
    isLoading,
    activeTrip,
    earnings,
    toggleOnline,
    refreshStatus,
  } = useDriverStatus();
  const {
    currentRequest,
    isRequestActive,
    acceptRide,
    rejectRide,
    dismissRequest,
  } = useRideRequest();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshStatus}
            colors={['#10b981']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Hello,</Text>
            <Text style={styles.userName}>{user?.name || 'Driver'}</Text>
          </View>
          <View style={styles.headerRight}>
            <View
              style={[
                styles.statusDot,
                isConnected ? styles.connected : styles.disconnected,
              ]}
            />
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              style={styles.profileButton}
            >
              <Icon name="person" size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Online Toggle Card */}
        <View style={styles.toggleCard}>
          <View>
            <Text style={styles.toggleTitle}>
              {isOnline ? '🟢 Online' : '⚪ Offline'}
            </Text>
            <Text style={styles.toggleSubtext}>
              {isOnline
                ? 'You are available for ride requests'
                : 'You are offline. Go online to receive rides'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              isOnline ? styles.onlineButton : styles.offlineButton,
            ]}
            onPress={() => toggleOnline(!isOnline)}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleButtonText}>
              {isOnline ? 'Go Offline' : 'Go Online'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{earnings}</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>5.0</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('TripHistory')}
          >
            <Icon name="history" size={24} color="#10b981" />
            <Text style={styles.actionText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Earnings')}
          >
            <Icon name="money" size={24} color="#f59e0b" />
            <Text style={styles.actionText}>Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Support')}
          >
            <Icon name="help" size={24} color="#6366f1" />
            <Text style={styles.actionText}>Support</Text>
          </TouchableOpacity>
        </View>

        {/* Active Trip */}
        {activeTrip && (
          <TouchableOpacity
            style={styles.tripCard}
            onPress={() =>
              navigation.navigate('ActiveTrip', {
                bookingId: activeTrip.bookingId,
              })
            }
          >
            <View style={styles.tripHeader}>
              <Text style={styles.tripTitle}>🚗 Active Trip</Text>
              <View style={styles.tripStatusBadge}>
                <Text style={styles.tripStatusText}>
                  {activeTrip.rideStatus?.toUpperCase() || 'ACTIVE'}
                </Text>
              </View>
            </View>
            <View style={styles.tripDetails}>
              <Text style={styles.tripFare}>₹{earnings || 0}</Text>
              <Text style={styles.tripLocation} numberOfLines={1}>
                {activeTrip.location?.address || 'On the way'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Connection Status */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isConnected ? '✅ Connected' : '🔄 Connecting...'}
          </Text>
          <Text style={styles.versionText}>v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Ride Request Popup - Global Overlay */}
      {currentRequest && isRequestActive && (
        <RideRequestPopup
          visible={true}
          requestData={currentRequest}
          onAccept={acceptRide}
          onReject={rejectRide}
          onTimeout={dismissRequest}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  welcomeText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '400',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connected: {
    backgroundColor: '#10b981',
  },
  disconnected: {
    backgroundColor: '#ef4444',
  },
  profileButton: {
    padding: 4,
  },
  toggleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  toggleSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    maxWidth: 180,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
  },
  onlineButton: {
    backgroundColor: '#fee2e2',
  },
  offlineButton: {
    backgroundColor: '#10b981',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actionCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '30%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    fontWeight: '500',
  },
  tripCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  tripStatusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tripStatusText: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '500',
  },
  tripDetails: {
    marginTop: 8,
  },
  tripFare: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10b981',
  },
  tripLocation: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#6b7280',
  },
  versionText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});

export default DashboardScreen;
