// src/screens/cab/CabDriverStatus.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useCabDriver } from '../../../hooks/cab/useCabDriver';
import DriverStatusBadge from './driverStatusBadge';
import VehicleInfoCard from './vehicleInfoCard';
import { formatDisplayDate } from '../../../utils/cab/driverRegisterValidators';

const CabDriverStatus = ({ navigation }: any) => {
  const { isLoading, driver, status, statusColor, statusLabel, refreshDriver } =
    useCabDriver();

  useEffect(() => {
    refreshDriver();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!driver) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🚗</Text>
        <Text style={styles.emptyTitle}>No Driver Profile</Text>
        <Text style={styles.emptySubtitle}>
          You haven't registered as a driver yet
        </Text>
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => navigation.navigate('CabDriverRegistration')}
        >
          <Text style={styles.registerButtonText}>Register Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* ✅ Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Driver Profile</Text>
          <TouchableOpacity onPress={refreshDriver}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ Driver Code & Status */}
        <View style={styles.card}>
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Driver Code</Text>
            <Text style={styles.code}>{driver.driverCode}</Text>
          </View>
          <DriverStatusBadge status={status} />
        </View>

        {/* ✅ Licence Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Licence Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Number</Text>
            <Text style={styles.detailValue}>{driver.licenceNumber}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expiry</Text>
            <Text style={styles.detailValue}>
              {formatDisplayDate(driver.licenceExpiryDate)}
            </Text>
          </View>
        </View>

        {/* ✅ Vehicle Details */}
        <VehicleInfoCard vehicle={driver.vehicle} />

        {/* ✅ Status Message */}
        {status === 'pending' && (
          <View style={styles.statusMessage}>
            <Text style={styles.statusMessageText}>
              ⏳ Your application is under review. We'll notify you once
              approved.
            </Text>
          </View>
        )}

        {status === 'rejected' && (
          <View style={[styles.statusMessage, styles.statusMessageError]}>
            <Text style={styles.statusMessageText}>
              ❌ Your application was rejected. Please contact support.
            </Text>
          </View>
        )}

        {status === 'suspended' && (
          <View style={[styles.statusMessage, styles.statusMessageWarning]}>
            <Text style={styles.statusMessageText}>
              ⚠️ Your account has been suspended. Contact support for more info.
            </Text>
          </View>
        )}

        {status === 'approved' && (
          <View style={[styles.statusMessage, styles.statusMessageSuccess]}>
            <Text style={styles.statusMessageText}>
              ✅ Your account is approved! You can start accepting rides.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
    textAlign: 'center',
  },
  registerButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  refreshText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  code: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  statusMessage: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  statusMessageText: {
    fontSize: 14,
    color: '#1E293B',
    textAlign: 'center',
  },
  statusMessageSuccess: {
    backgroundColor: '#D1FAE5',
  },
  statusMessageError: {
    backgroundColor: '#FEE2E2',
  },
  statusMessageWarning: {
    backgroundColor: '#FEF3C7',
  },
});

export default CabDriverStatus;
