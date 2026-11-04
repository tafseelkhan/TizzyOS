// api/features/private/warehousePrivateSlice.ts

import { Platform } from 'react-native';
import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ================================
// INTERFACES / TYPES
// ================================

export interface WarehouseFormData {
  [key: string]: any;
}

export interface WarehouseResponse {
  success: boolean;
  message?: string;
  data?: any;
}

// ================================
// PLATFORM HEADERS — ek jagah
// ================================

const platformHeaders: Record<string, string> =
  Platform.OS === 'android'
    ? { 'X-Platform': 'android' }
    : Platform.OS === 'ios'
    ? { 'X-Platform': 'ios' }
    : {};

// ================================
// WAREHOUSE API
// ================================

export const warehouseApi = {
  /**
   * CREATE WAREHOUSE
   * POST /warehouse
   */
  createWarehouse: async (
    userId: string,
    formData: WarehouseFormData,
  ): Promise<WarehouseResponse> => {
    return apiRequest<WarehouseResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.CREATE_WAREHOUSE}`,
      {
        method: 'POST',
        headers: platformHeaders,
        body: JSON.stringify({
          userId,
          ...formData,
        }),
      },
    );
  },

  /**
   * CHECK WAREHOUSE STATUS
   * GET /warehouse/check/:userId
   */
  checkWarehouseStatus: async (
    userId: string,
  ): Promise<WarehouseResponse> => {
    return apiRequest<WarehouseResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_CHECK_WAREHOUSE}/${userId}`,
      {
        method: 'GET',
        headers: platformHeaders,
      },
    );
  },

  /**
   * GET WAREHOUSE BY USER ID
   * GET /warehouse/:userId
   */
  getWarehouseByUserId: async (
    userId: string,
  ): Promise<WarehouseResponse> => {
    return apiRequest<WarehouseResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_WAREHOUSE_BY_ID}/${userId}`,
      {
        method: 'GET',
        headers: platformHeaders,
      },
    );
  },
};

export default warehouseApi;