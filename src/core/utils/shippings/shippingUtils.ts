// src/modules/shipping/utils/shippingUtils.ts
import { Platform, UIManager } from 'react-native';

// Enable LayoutAnimation for Android
export const enableLayoutAnimation = () => {
  if (
    Platform.OS === 'android' &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
};

// Get image URL helper
export const getImageUrl = (image?: string): string => {
  if (!image) return 'https://via.placeholder.com/150';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads')) return `http://172.20.245.121:5000${image}`;
  return 'https://via.placeholder.com/150';
};

// Format shipping stats
export const formatShippingStats = (stats: any) => {
  return {
    shipments: stats?.shipments || 0,
    delivered: stats?.delivered || 0,
    inTransit: stats?.inTransit || 0,
    pending: stats?.pending || 0,
  };
};

// Calculate delivery rate percentage
export const getDeliveryRate = (stats: {
  delivered: number;
  shipments: number;
}): number => {
  if (stats.shipments === 0) return 0;
  return (stats.delivered / stats.shipments) * 100;
};

// Get status color
export const getStatusColor = (status: string, isDark: boolean) => {
  const colors = {
    delivered: '#4CAF50',
    'in-transit': '#2196F3',
    pending: '#FF9800',
    cancelled: '#F44336',
  };
  return colors[status as keyof typeof colors] || '#94A3B8';
};

// Validate shipping form data
export const validateShippingForm = (data: any) => {
  const errors: Record<string, string> = {};

  if (!data.name || data.name.trim().length < 3) {
    errors.name = 'Name must be at least 3 characters';
  }

  if (data.email && !/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = 'Invalid email format';
  }

  if (data.phone && !/^[0-9]{10,12}$/.test(data.phone)) {
    errors.phone = 'Invalid phone number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
