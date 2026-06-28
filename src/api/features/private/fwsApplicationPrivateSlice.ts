import axios, { AxiosError, AxiosResponse } from 'axios';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { getToken } from '../../connections/token/tokenSlice';

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
// FETCH HANDLER WITH AXIOS
// ================================

interface FetchHandlerOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
}

async function fetchHandler(
  url: string,
  options: FetchHandlerOptions,
): Promise<any> {
  try {
    const config: any = {
      method: options.method,
      url: url,
      headers: options.headers || {},
    };

    // Agar body hai toh data me daalo
    if (options.body) {
      config.data = options.body;
    }

    const response: AxiosResponse = await axios(config);
    return response.data;
  } catch (error: any) {
    // Axios error handling
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        // Server ne error response bheja
        console.error(
          'API Error Response:',
          axiosError.response.status,
          axiosError.response.data,
        );
        throw (
          axiosError.response.data || {
            success: false,
            message: 'Server error',
          }
        );
      } else if (axiosError.request) {
        // Request gayi lekin response nahi aaya
        console.error('No response from server:', axiosError.request);
        throw {
          success: false,
          message: 'Network error - No response from server',
        };
      } else {
        // Request setup me error
        console.error('Request setup error:', axiosError.message);
        throw { success: false, message: axiosError.message };
      }
    }
    // Unknown error
    console.error('Unknown error:', error);
    throw error;
  }
}

// ================================
// WAREHOUSE API
// ================================

export const warehouseApi = {
  // ================================
  // CREATE WAREHOUSE
  // ================================
  /**
   * @param {string} userId - User ID
   * @param {Object} formData - Warehouse form data
   * @returns {Promise} - A promise that resolves to the response
   */
  createWarehouse: async (
    userId: string,
    formData: WarehouseFormData,
  ): Promise<WarehouseResponse> => {
    const token: string | null = await getToken();

    if (!token) {
      throw { success: false, message: 'No authentication token found' };
    }

    return await fetchHandler(
      `${API_BASE_URL}${API_ENDPOINTS.CREATE_WAREHOUSE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
        body: {
          userId,
          ...formData,
        },
      },
    );
  },

  // ================================
  // CHECK WAREHOUSE STATUS
  // ================================
  /**
   * @param {string} userId - User ID
   * @returns {Promise} - A promise that resolves to the response
   */
  checkWarehouseStatus: async (userId: string): Promise<WarehouseResponse> => {
    const token: string | null = await getToken();

    if (!token) {
      throw { success: false, message: 'No authentication token found' };
    }

    return await fetchHandler(
      `${API_BASE_URL}${API_ENDPOINTS.GET_CHECK_WAREHOUSE}/${userId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
      },
    );
  },

  // ================================
  // GET WAREHOUSE BY USER ID
  // ================================
  /**
   * @param {string} userId - User ID
   * @returns {Promise} - A promise that resolves to the response
   */
  getWarehouseByUserId: async (userId: string): Promise<WarehouseResponse> => {
    const token: string | null = await getToken();

    if (!token) {
      throw { success: false, message: 'No authentication token found' };
    }

    return await fetchHandler(
      `${API_BASE_URL}${API_ENDPOINTS.GET_WAREHOUSE_BY_ID}/${userId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
      },
    );
  },
};

export default warehouseApi;
