import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Vehicle } from '../../../types/CabTypes';
import { capitalizeFirstLetter } from '../../../utils/cab/driverRegisterHelpers';

interface VehicleInfoCardProps {
  vehicle: Vehicle;
}

const VehicleInfoCard: React.FC<VehicleInfoCardProps> = ({ vehicle }) => {
  const vehicleDetails = [
    {
      icon: 'grid-outline',
      label: 'Category',
      value: capitalizeFirstLetter(vehicle.categoryCode),
    },
    {
      icon: 'business-outline',
      label: 'Company',
      value: vehicle.companyCode,
    },
    {
      icon: 'cube-outline',
      label: 'Model',
      value: vehicle.modelCode,
    },
    {
      icon: 'car-outline',
      label: 'Number',
      value: vehicle.vehicleNumber,
    },
    {
      icon: 'color-palette-outline',
      label: 'Color',
      value: capitalizeFirstLetter(vehicle.vehicleColor),
    },
    {
      icon: 'calendar-outline',
      label: 'Year',
      value: vehicle.manufacturingYear.toString(),
    },
  ];

  return (
    <View style={styles.card}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerIconContainer}>
          <Icon name="car-sport-outline" size={20} color="#3B82F6" />
        </View>
        <Text style={styles.cardTitle}>Vehicle Details</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>Verified</Text>
        </View>
      </View>

      {/* Vehicle Details */}
      {vehicleDetails.map((item, index) => (
        <View
          key={index}
          style={[
            styles.detailRow,
            index === vehicleDetails.length - 1 && styles.lastDetailRow,
          ]}
        >
          <View style={styles.detailLeft}>
            <View style={styles.detailIconContainer}>
              <Icon name={item.icon} size={16} color="#64748B" />
            </View>
            <Text style={styles.detailLabel}>{item.label}</Text>
          </View>
          <Text style={styles.detailValue}>{item.value}</Text>
        </View>
      ))}

      {/* Vehicle Status Indicator */}
      <View style={styles.vehicleStatus}>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Vehicle Active</Text>
        </View>
        <Text style={styles.verifiedText}>✓ Verified</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerIconContainer: {
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
    flex: 1,
  },
  headerBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  headerBadgeText: {
    fontSize: 9,
    color: '#10B981',
    fontWeight: '600',
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
  detailIconContainer: {
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
  vehicleStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },
  verifiedText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },
});

export default VehicleInfoCard;
