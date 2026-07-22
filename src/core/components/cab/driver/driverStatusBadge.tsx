import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { DriverStatus, DRIVER_STATUS_LABELS } from '../../../types/CabTypes';

interface DriverStatusBadgeProps {
  status: DriverStatus | null;
  size?: 'small' | 'medium' | 'large';
}

const DriverStatusBadge: React.FC<DriverStatusBadgeProps> = ({
  status,
  size = 'medium',
}) => {
  if (!status) return null;

  const getStatusConfig = (status: DriverStatus) => {
    const configs = {
      pending: {
        bgColor: '#FEF3C7',
        textColor: '#92400E',
        borderColor: '#F59E0B',
        icon: 'time-outline',
        dotColor: '#F59E0B',
      },
      approved: {
        bgColor: '#D1FAE5',
        textColor: '#065F46',
        borderColor: '#10B981',
        icon: 'checkmark-circle-outline',
        dotColor: '#10B981',
      },
      rejected: {
        bgColor: '#FEE2E2',
        textColor: '#991B1B',
        borderColor: '#EF4444',
        icon: 'close-circle-outline',
        dotColor: '#EF4444',
      },
      suspended: {
        bgColor: '#F3F4F6',
        textColor: '#4B5563',
        borderColor: '#6B7280',
        icon: 'pause-circle-outline',
        dotColor: '#6B7280',
      },
    };
    return configs[status] || configs.suspended;
  };

  const config = getStatusConfig(status);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 12,
          dotSize: 6,
          iconSize: 14,
          fontSize: 10,
        };
      case 'large':
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 24,
          dotSize: 10,
          iconSize: 20,
          fontSize: 15,
        };
      default: // medium
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          dotSize: 8,
          iconSize: 16,
          fontSize: 13,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
          borderRadius: sizeStyles.borderRadius,
        },
      ]}
    >
      <View
        style={[
          styles.statusDot,
          {
            backgroundColor: config.dotColor,
            width: sizeStyles.dotSize,
            height: sizeStyles.dotSize,
            borderRadius: sizeStyles.dotSize / 2,
          },
        ]}
      />

      <Icon
        name={config.icon}
        size={sizeStyles.iconSize}
        color={config.textColor}
        style={styles.statusIcon}
      />

      <Text
        style={[
          styles.statusText,
          {
            color: config.textColor,
            fontSize: sizeStyles.fontSize,
          },
        ]}
      >
        {DRIVER_STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusDot: {
    marginRight: 6,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default DriverStatusBadge;
