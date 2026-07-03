import { Platform } from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import {
  registerRideDriver,
  getRideDriver,
  checkDriverStatus,
  getRideVehicleCategories,
} from '../../../api/features/private/driverCabRegisterPrivateSlice';
import {
  RegisterDriverRequest,
  RegisterDriverResponse,
  RideDriver,
  ApiError,
  VehicleCategory,
  VehicleCategoryResponse,
} from '../../types/CabTypes';
import {
  validateDriverForm,
  ValidationResult,
} from '../../utils/cab/driverRegisterValidators';

// ============================================
// 📸 IMAGE PICKER SERVICE
// ============================================

export interface ImageResult {
  uri: string;
  base64: string;
  fileName: string;
}

export const pickImage = (): Promise<ImageResult | null> => {
  return new Promise(resolve => {
    ImagePicker.launchImageLibrary(
      {
        mediaType: 'photo',
        includeBase64: true,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.7,
        selectionLimit: 1,
      },
      response => {
        if (response.didCancel) {
          resolve(null);
          return;
        }

        if (response.errorCode) {
          console.error('ImagePicker Error:', response.errorMessage);
          resolve(null);
          return;
        }

        const asset = response.assets?.[0];
        if (!asset?.uri || !asset.base64) {
          resolve(null);
          return;
        }

        resolve({
          uri: asset.uri,
          base64: `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`,
          fileName: asset.fileName || 'document.jpg',
        });
      },
    );
  });
};

export const pickMultipleImages = (
  maxCount: number = 5,
): Promise<ImageResult[]> => {
  return new Promise(resolve => {
    ImagePicker.launchImageLibrary(
      {
        mediaType: 'photo',
        includeBase64: true,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.7,
        selectionLimit: maxCount,
      },
      response => {
        if (response.didCancel) {
          resolve([]);
          return;
        }

        if (response.errorCode) {
          console.error('ImagePicker Error:', response.errorMessage);
          resolve([]);
          return;
        }

        const results: ImageResult[] = [];
        response.assets?.forEach(asset => {
          if (asset?.uri && asset?.base64) {
            results.push({
              uri: asset.uri,
              base64: `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`,
              fileName: asset.fileName || 'document.jpg',
            });
          }
        });

        resolve(results);
      },
    );
  });
};

// ============================================
// 🚗 VEHICLE CATEGORY SERVICE
// ============================================

export const fetchVehicleCategories = async (): Promise<{
  success: boolean;
  categories?: VehicleCategory[];
  message?: string;
}> => {
  try {
    const response = await getRideVehicleCategories();
    if (response.success && response.data) {
      return {
        success: true,
        categories: response.data,
        message: response.message,
      };
    }
    return {
      success: false,
      message: response.message || 'Failed to fetch categories',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error',
    };
  }
};

// ============================================
// 📋 DRIVER SERVICE
// ============================================

export interface DriverRegistrationResult {
  success: boolean;
  message: string;
  data?: {
    id: string;
    driverCode: string;
    status: string;
  };
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Register driver with validation
 */
export const registerDriver = async (
  formData: RegisterDriverRequest,
): Promise<DriverRegistrationResult> => {
  // ✅ Validate form data
  const validation = validateDriverForm(formData);
  if (!validation.isValid) {
    return {
      success: false,
      message: 'Validation failed',
      errors: validation.errors,
    };
  }

  try {
    const response = await registerRideDriver(formData);

    if (!response.success) {
      return {
        success: false,
        message: response.message || 'Registration failed',
        errors: response.errors,
      };
    }

    return {
      success: true,
      message: response.message || 'Driver registered successfully',
      data: response.data,
    };
  } catch (error) {
    console.error('Driver registration error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Registration failed',
    };
  }
};

/**
 * Get current driver profile
 */
export const getDriverProfile = async (): Promise<{
  success: boolean;
  data?: RideDriver;
  message?: string;
}> => {
  try {
    const driver = await getRideDriver();
    if (driver) {
      return {
        success: true,
        data: driver,
      };
    }
    return {
      success: false,
      message: 'Driver not found',
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Failed to fetch driver',
    };
  }
};

/**
 * Get driver status
 */
export const getDriverStatus = async (): Promise<{
  isRegistered: boolean;
  status?: string;
  driver?: RideDriver;
}> => {
  const result = await checkDriverStatus();
  return {
    isRegistered: result.isRegistered,
    status: result.driver?.status,
    driver: result.driver,
  };
};

/**
 * Check if driver is approved
 */
export const isDriverApproved = async (): Promise<boolean> => {
  const status = await getDriverStatus();
  return status.isRegistered && status.status === 'approved';
};

/**
 * Format driver code for display
 */
export const formatDriverCode = (code: string): string => {
  return code || 'N/A';
};

/**
 * Get status color
 */
export const getStatusColor = (status?: string): string => {
  const colors = {
    pending: '#F59E0B',
    approved: '#10B981',
    rejected: '#EF4444',
    suspended: '#6B7280',
  };
  return status
    ? colors[status as keyof typeof colors] || '#6B7280'
    : '#6B7280';
};

/**
 * Get status label
 */
export const getStatusLabel = (status?: string): string => {
  const labels = {
    pending: 'Pending Verification',
    approved: 'Approved',
    rejected: 'Rejected',
    suspended: 'Suspended',
  };
  return status
    ? labels[status as keyof typeof labels] || 'Unknown'
    : 'Unknown';
};
