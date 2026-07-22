// api/features/private/driverCabRegisterPrivateSlice.ts
import { Platform } from 'react-native';
import {
  RegisterDriverRequest,
  RegisterDriverResponse,
  RideDriver,
  GetDriverResponse,
  VehicleCategoryResponse,
  RideType,
  RideTypesResponse,
  FilteredVehicleCategoriesResponse,
} from '../../../core/types/CabTypes';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { getToken } from '../../connections/token/tokenSlice';

// ============================================
// 🚗 RIDE TYPES API
// ============================================

export const getRideTypes = async (): Promise<RideTypesResponse> => {
  console.log('🔄 getRideTypes: Making API call...');
  try {
    const token = await getToken();
    console.log(`🔑 Token: ${token ? '✅ Present' : '❌ Missing'}`);

    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.GET_RIDE_TYPES}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();
    console.log(`📊 getRideTypes Response Status: ${response.status}`);
    console.log(`📊 getRideTypes Data:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to fetch ride types',
        data: [],
      };
    }

    return {
      success: true,
      message: data.message || 'Ride types fetched successfully',
      data: data.data || [],
    };
  } catch (error) {
    console.error('Get ride types error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error',
      data: [],
    };
  }
};

// ============================================
// 🚗 VEHICLE CATEGORY API (All + Filtered)
// ============================================

// ✅ Updated: Accept optional rideTypeCode parameter
export const getRideVehicleCategories = async (
  rideTypeCode?: string, // ✅ Optional parameter
): Promise<VehicleCategoryResponse> => {
  try {
    const token = await getToken();

    // ✅ Build URL with query param if rideTypeCode provided
    let url = `${API_BASE_URL}${API_ENDPOINTS.GET_VEHICLE_CATEGORIES}`;
    if (rideTypeCode) {
      url += `?rideTypeCode=${rideTypeCode}`;
    }

    console.log(`🔄 getRideVehicleCategories: Fetching categories`);
    console.log(`📋 URL: ${url}`);
    console.log(`📋 rideTypeCode: ${rideTypeCode || 'ALL'}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    console.log(
      `📊 getRideVehicleCategories Response Status: ${response.status}`,
    );
    console.log(
      `📊 getRideVehicleCategories Data:`,
      JSON.stringify(data, null, 2),
    );

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to fetch vehicle categories',
        data: [],
      };
    }

    // ✅ Handle both formats: with rideType or without
    let categoriesData = data.data || [];

    // If response has rideType wrapper, extract categories
    if (data.data && data.data.categories) {
      categoriesData = data.data.categories;
    }

    return {
      success: true,
      message: data.message || 'Categories fetched successfully',
      data: categoriesData,
    };
  } catch (error) {
    console.error('Get vehicle categories error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error',
      data: [],
    };
  }
};

// ============================================
// 🚗 FILTERED VEHICLE CATEGORIES API (DEPRECATED - Use above)
// ============================================

// This is now merged with getRideVehicleCategories
export const getFilteredVehicleCategories = async (
  rideTypeCode: string,
): Promise<FilteredVehicleCategoriesResponse> => {
  console.log(
    `🔄 getFilteredVehicleCategories: ${rideTypeCode} (DEPRECATED - use getRideVehicleCategories)`,
  );

  // Use the same function with rideTypeCode
  const result = await getRideVehicleCategories(rideTypeCode);

  // Convert to FilteredVehicleCategoriesResponse format
  return {
    success: result.success,
    message: result.message,
    data: {
      rideType: null as any,
      categories: result.data || [],
    },
  };
};

// ============================================
// 🚕 DRIVER API
// ============================================

export const registerRideDriver = async (
  data: RegisterDriverRequest,
): Promise<RegisterDriverResponse> => {
  console.log('🔄 registerRideDriver: Registering driver...');
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
    console.log(`📊 registerRideDriver Response Status: ${response.status}`);
    console.log(`📊 registerRideDriver Data:`, JSON.stringify(result, null, 2));

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
  console.log('🔄 getRideDriver: Fetching driver...');
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

    console.log(`📊 getRideDriver Response Status: ${response.status}`);

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
  console.log('🔄 checkDriverStatus: Checking driver status...');
  try {
    const driver = await getRideDriver();
    if (driver) {
      console.log(`✅ Driver found: ${driver.driverCode}`);
      return {
        isRegistered: true,
        driver,
      };
    }
    console.log('ℹ️ No driver found');
    return { isRegistered: false };
  } catch (error) {
    console.error('Check driver status error:', error);
    return { isRegistered: false };
  }
};
