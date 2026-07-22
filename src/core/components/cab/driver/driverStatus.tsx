import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useCabDriver } from '../../../hooks/cab/useCabDriver';
import DriverStatusBadge from './driverStatusBadge';
import VehicleInfoCard from './vehicleInfoCard';
import { formatDisplayDate } from '../../../utils/cab/driverRegisterValidators';

const { width, height } = Dimensions.get('window');

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
        <View style={styles.emptyIconContainer}>
          <Icon name="car-outline" size={60} color="#3B82F6" />
        </View>
        <Text style={styles.emptyTitle}>No Driver Profile</Text>
        <Text style={styles.emptySubtitle}>
          You haven't registered as a driver yet
        </Text>
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => navigation.navigate('CabDriverRegistration')}
        >
          <Icon name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.registerButtonText}>Register Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ✅ Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconContainer}>
              <Icon name="person-circle-outline" size={28} color="#3B82F6" />
            </View>
            <Text style={styles.title}>Driver Profile</Text>
          </View>
          <TouchableOpacity
            onPress={refreshDriver}
            style={styles.refreshButton}
          >
            <Icon name="refresh-outline" size={18} color="#3B82F6" />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ Driver Code Card - Separate Row */}
        <View style={styles.card}>
          <View style={styles.codeWrapper}>
            <View style={styles.codeIconContainer}>
              <Icon name="finger-print-outline" size={24} color="#3B82F6" />
            </View>
            <View style={styles.codeTextContainer}>
              <Text style={styles.codeLabel}>Driver Code</Text>
              <Text style={styles.code}>{driver.driverCode}</Text>
            </View>
          </View>
        </View>

        {/* ✅ Status Badge Card - Separate Row */}
        <View style={[styles.card, styles.statusCard]}>
          <View style={styles.statusWrapper}>
            <Text style={styles.statusLabel}>Current Status</Text>
            <DriverStatusBadge status={status} />
          </View>
        </View>

        {/* ✅ Licence Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderIcon}>
              <Icon name="document-text-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.cardTitle}>Licence Details</Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <View style={styles.detailIconBg}>
                <Icon name="card-outline" size={16} color="#64748B" />
              </View>
              <Text style={styles.detailLabel}>Number</Text>
            </View>
            <Text style={styles.detailValue}>{driver.licenceNumber}</Text>
          </View>

          <View style={[styles.detailRow, styles.lastDetailRow]}>
            <View style={styles.detailLeft}>
              <View style={styles.detailIconBg}>
                <Icon name="calendar-outline" size={16} color="#64748B" />
              </View>
              <Text style={styles.detailLabel}>Expiry</Text>
            </View>
            <Text style={styles.detailValue}>
              {formatDisplayDate(driver.licenceExpiryDate)}
            </Text>
          </View>
        </View>

        {/* ✅ Vehicle Details */}
        <VehicleInfoCard vehicle={driver.vehicle} />

        {/* ✅ Status Message */}
        {status === 'pending' && (
          <View style={[styles.statusMessage, styles.statusMessagePending]}>
            <View style={styles.statusIconContainer}>
              <Icon name="time-outline" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.statusMessageText}>
              Your application is under review. We'll notify you once approved.
            </Text>
          </View>
        )}

        {status === 'rejected' && (
          <View style={[styles.statusMessage, styles.statusMessageError]}>
            <View style={styles.statusIconContainer}>
              <Icon name="close-circle-outline" size={22} color="#EF4444" />
            </View>
            <Text style={styles.statusMessageText}>
              Your application was rejected. Please contact support.
            </Text>
          </View>
        )}

        {status === 'suspended' && (
          <View style={[styles.statusMessage, styles.statusMessageWarning]}>
            <View style={styles.statusIconContainer}>
              <Icon name="warning-outline" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.statusMessageText}>
              Your account has been suspended. Contact support for more info.
            </Text>
          </View>
        )}

        {status === 'approved' && (
          <View style={[styles.statusMessage, styles.statusMessageSuccess]}>
            <View style={styles.statusIconContainer}>
              <Icon name="checkmark-circle-outline" size={22} color="#10B981" />
            </View>
            <Text style={styles.statusMessageText}>
              Your account is approved! You can start accepting rides.
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
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
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
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F8FAFC',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 20,
  },
  registerButton: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginLeft: 10,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  refreshText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // ✅ Driver Code Card - Full Width
  codeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  codeTextContainer: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  code: {
    fontSize: 14,
    fontFamily: 'Poppins-LightItalic',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  // ✅ Status Card - Separate Row
  statusCard: {
    marginBottom: 14,
  },
  statusWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  lastDetailRow: {
    borderBottomWidth: 0,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 8,
  },
  detailValue: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statusMessageText: {
    fontSize: 13,
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 18,
  },
  statusMessageSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusMessageError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  statusMessageWarning: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  statusMessagePending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
});

export default CabDriverStatus;
