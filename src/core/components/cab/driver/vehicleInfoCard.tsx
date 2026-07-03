// src/components/cab/VehicleInfoCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Vehicle } from '../../../types/CabTypes';
import { capitalizeFirstLetter } from '../../../utils/cab/driverRegisterHelpers';

interface VehicleInfoCardProps {
  vehicle: Vehicle;
}

const VehicleInfoCard: React.FC<VehicleInfoCardProps> = ({ vehicle }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Vehicle Details</Text>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Category</Text>
        <Text style={styles.detailValue}>
          {capitalizeFirstLetter(vehicle.categoryCode)}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Company</Text>
        <Text style={styles.detailValue}>{vehicle.companyCode}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Model</Text>
        <Text style={styles.detailValue}>{vehicle.modelCode}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Number</Text>
        <Text style={styles.detailValue}>{vehicle.vehicleNumber}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Color</Text>
        <Text style={styles.detailValue}>
          {capitalizeFirstLetter(vehicle.vehicleColor)}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Year</Text>
        <Text style={styles.detailValue}>{vehicle.manufacturingYear}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default VehicleInfoCard;
