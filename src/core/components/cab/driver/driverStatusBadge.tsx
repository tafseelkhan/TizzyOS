// src/components/cab/DriverStatusBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DriverStatus, DRIVER_STATUS_LABELS } from '../../../types/CabTypes';

interface DriverStatusBadgeProps {
  status: DriverStatus | null;
}

const DriverStatusBadge: React.FC<DriverStatusBadgeProps> = ({ status }) => {
  if (!status) return null;

  const getStatusColor = (status: DriverStatus): string => {
    const colors = {
      pending: '#F59E0B',
      approved: '#10B981',
      rejected: '#EF4444',
      suspended: '#6B7280',
    };
    return colors[status] || '#6B7280';
  };

  const getBackgroundColor = (status: DriverStatus): string => {
    const colors = {
      pending: '#FEF3C7',
      approved: '#D1FAE5',
      rejected: '#FEE2E2',
      suspended: '#F3F4F6',
    };
    return colors[status] || '#F3F4F6';
  };

  return (
    <View
      style={[styles.badge, { backgroundColor: getBackgroundColor(status) }]}
    >
      <View
        style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]}
      />
      <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
        {DRIVER_STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default DriverStatusBadge;
