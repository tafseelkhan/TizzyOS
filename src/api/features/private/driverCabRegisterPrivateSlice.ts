import { Platform } from 'react-native';
import {
  RegisterDriverRequest,
  RegisterDriverResponse,
  RideDriver,
  GetDriverResponse,
  ApiError,
  VehicleCategoryResponse,
  VehicleCategory,
} from '../../../core/types/CabTypes';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { getToken } from '../../connections/token/tokenSlice';

// ============================================
// 🚗 VEHICLE CATEGORY API
// ============================================

/**
 * Fetch all ride vehicle categories
 */
export const getRideVehicleCategories =
  async (): Promise<VehicleCategoryResponse> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.GET_VEHICLE_CATEGORIES}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Failed to fetch vehicle categories',
        };
      }

      return {
        success: true,
        message: data.message || 'Categories fetched successfully',
        data: data.data,
      };
    } catch (error) {
      console.error('Get vehicle categories error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
      };
    }
  };

// ============================================
// 🚕 DRIVER API
// ============================================

export const registerRideDriver = async (
  data: RegisterDriverRequest,
): Promise<RegisterDriverResponse> => {
  try {
    const token = await getToken();
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.REGISTER_DRIVER}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.message || 'Registration failed',
        errors: result.errors,
      };
    }

    return {
      success: true,
      message: result.message || 'Driver registered successfully',
      data: result.data,
    };
  } catch (error) {
    console.error('Register driver error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Registration failed',
    };
  }
};

export const getRideDriver = async (): Promise<RideDriver | null> => {
  try {
    const token = await getToken();
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.GET_DRIVER_STATUS}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const result: GetDriverResponse = await response.json();
    return result.data || null;
  } catch (error) {
    console.error('Get driver error:', error);
    return null;
  }
};

export const checkDriverStatus = async (): Promise<{
  isRegistered: boolean;
  driver?: RideDriver;
}> => {
  try {
    const driver = await getRideDriver();
    if (driver) {
      return {
        isRegistered: true,
        driver,
      };
    }
    return { isRegistered: false };
  } catch (error) {
    console.error('Check driver status error:', error);
    return { isRegistered: false };
  }
};
