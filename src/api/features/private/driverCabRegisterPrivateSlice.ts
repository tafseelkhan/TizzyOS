// api/features/private/driverCabRegisterPrivateSlice.ts
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
import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest, ApiError } from '../../../core/utils/handler/apiClient';

// ============================================
// 🚗 RIDE TYPES API
// ============================================

export const getRideTypes = async (): Promise<RideTypesResponse> => {
  try {
    const data = await apiRequest<{
      success?: boolean;
      message?: string;
      data?: RideType[];
    }>(`${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_RIDE_TYPES}`, {
      method: 'GET',
    });

    return {
      success: true,
      message: data.message || 'Ride types fetched successfully',
      data: data.data || [],
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Network error',
      data: [],
    };
  }
};

// ============================================
// 🚗 VEHICLE CATEGORY API (All + Filtered)
// ============================================

export const getRideVehicleCategories = async (
  rideTypeCode?: string,
): Promise<VehicleCategoryResponse> => {
  try {
    let url = `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_VEHICLE_CATEGORIES}`;
    if (rideTypeCode) {
      url += `?rideTypeCode=${encodeURIComponent(rideTypeCode)}`;
    }

    const data = await apiRequest<{
      success?: boolean;
      message?: string;
      data?: any;
    }>(url, {
      method: 'GET',
    });

    // Handle both formats: with rideType wrapper or plain array
    let categoriesData = data.data || [];
    if (data.data && data.data.categories) {
      categoriesData = data.data.categories;
    }

    return {
      success: true,
      message: data.message || 'Categories fetched successfully',
      data: categoriesData,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Network error',
      data: [],
    };
  }
};

// ============================================
// 🚗 FILTERED VEHICLE CATEGORIES API (DEPRECATED)
// ============================================

export const getFilteredVehicleCategories = async (
  rideTypeCode: string,
): Promise<FilteredVehicleCategoriesResponse> => {
  const result = await getRideVehicleCategories(rideTypeCode);

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
  try {
    const result = await apiRequest<{
      success?: boolean;
      message?: string;
      data?: unknown;
      errors?: unknown;
    }>(`${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.REGISTER_DRIVER}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return {
      success: true,
      message: result.message || 'Driver registered successfully',
      data: result.data,
    } as RegisterDriverResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      const errorData = error.data as
        { errors?: unknown; message?: string } | undefined;

      return {
        success: false,
        message: error.message || 'Registration failed',
        errors: errorData?.errors,
      } as RegisterDriverResponse;
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Registration failed',
    } as RegisterDriverResponse;
  }
};

export const getRideDriver = async (): Promise<RideDriver | null> => {
  try {
    const result = await apiRequest<GetDriverResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_DRIVER_STATUS}`,
      {
        method: 'GET',
      },
    );

    return result.data || null;
  } catch (error) {
    // 404 = driver not registered — expected
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    if (__DEV__) {
      console.warn('[getRideDriver]', error);
    }
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
      return { isRegistered: true, driver };
    }
    return { isRegistered: false };
  } catch {
    return { isRegistered: false };
  }
};
