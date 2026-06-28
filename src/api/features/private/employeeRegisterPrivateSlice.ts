// api/features/private/employeeRegisterPrivateSlice.ts
import axios, { AxiosError, AxiosResponse } from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { getToken } from '../../connections/token/tokenSlice';
// ✅ Import base-64 for React Native
import { decode as base64Decode } from 'base-64';

// ================================
// INTERFACES / TYPES
// ================================

export interface EmployeeFormData {
  name: string;
  email: string;
  phone: string;
  role: 'MANAGER' | 'SUPERVISOR' | 'SCANNER' | 'PACKER' | 'DISPATCHER';
  fwsCode: string;
  address?: string;
}

export interface EmployeeResponse {
  success: boolean;
  message?: string;
  data?: any;
  count?: number;
}

export interface CheckEmployeeStatusResponse {
  success: boolean;
  data: {
    isFormFilled: boolean;
    isFormComplete?: boolean;
    status:
      | 'NOT_FILLED'
      | 'ACTIVE'
      | 'INACTIVE'
      | 'PENDING'
      | 'APPROVED'
      | 'REJECTED'
      | 'SUSPENDED';
    approvalStatus?: string;
    message: string;
    employee?: any;
    warehouse?: any;
    user?: any;
  };
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
  console.log('📡 [fetchHandler] ====================');
  console.log('📡 [fetchHandler] URL:', url);
  console.log('📡 [fetchHandler] Method:', options.method);
  console.log(
    '📡 [fetchHandler] Headers:',
    JSON.stringify(options.headers, null, 2),
  );

  if (options.body) {
    console.log(
      '📡 [fetchHandler] Body:',
      JSON.stringify(options.body, null, 2),
    );
  }

  try {
    const config: any = {
      method: options.method,
      url: url,
      headers: options.headers || {},
    };

    if (options.body) {
      config.data = options.body;
    }

    console.log('📡 [fetchHandler] Sending request...');
    const response: AxiosResponse = await axios(config);

    console.log('✅ [fetchHandler] Response Status:', response.status);
    console.log(
      '✅ [fetchHandler] Response Data:',
      JSON.stringify(response.data, null, 2),
    );
    console.log('📡 [fetchHandler] ====================');

    return response.data;
  } catch (error: any) {
    console.error('❌ [fetchHandler] Error:', error);

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error(
          '❌ [fetchHandler] Response Error Status:',
          axiosError.response.status,
        );
        console.error(
          '❌ [fetchHandler] Response Error Data:',
          axiosError.response.data,
        );
        throw (
          axiosError.response.data || {
            success: false,
            message: 'Server error',
          }
        );
      } else if (axiosError.request) {
        console.error('❌ [fetchHandler] No response from server');
        throw {
          success: false,
          message: 'Network error - No response from server',
        };
      } else {
        console.error(
          '❌ [fetchHandler] Request setup error:',
          axiosError.message,
        );
        throw { success: false, message: axiosError.message };
      }
    }
    console.error('❌ [fetchHandler] Unknown error:', error);
    throw error;
  }
}

// ================================
// ✅ FIX: Token se userId nikalne ka function - atob ki jagah base-64
// ================================
const getUserIdFromToken = async (token: string): Promise<string | null> => {
  try {
    // Method 1: AsyncStorage se userId
    const storedUserId = await AsyncStorage.getItem('userId');
    if (storedUserId) {
      return storedUserId;
    }

    // Method 2: Token decode karke (React Native compatible)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid token format');
      return null;
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

    // ✅ FIX: base64Decode use karo (atob ki jagah)
    const jsonPayload = decodeURIComponent(
      base64Decode(base64)
        .split('')
        .map(
          (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
        )
        .join(''),
    );

    const decoded = JSON.parse(jsonPayload);
    return decoded.userId || decoded.id || null;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

// ================================
// EMPLOYEE API
// ================================

export const employeeApi = {
  // ================================
  // CREATE EMPLOYEE
  // ================================
  createEmployee: async (
    formData: EmployeeFormData,
  ): Promise<EmployeeResponse> => {
    console.log('📝 [API] createEmployee ====================');
    console.log('📝 [API] createEmployee called');
    console.log('📝 [API] FormData:', JSON.stringify(formData, null, 2));

    const token: string | null = await getToken();
    console.log('🔑 [API] Token found:', token ? 'Yes' : 'No');

    if (!token) {
      console.log('❌ [API] No token found');
      throw { success: false, message: 'No authentication token found' };
    }

    const url = `${API_BASE_URL}${API_ENDPOINTS.CREATE_EMPLOYEE}`;
    console.log('🌐 [API] URL:', url);
    console.log('🌐 [API] Platform:', Platform.OS);

    try {
      const response = await fetchHandler(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
        body: formData,
      });

      console.log(
        '✅ [API] createEmployee Response:',
        JSON.stringify(response, null, 2),
      );
      console.log('📝 [API] createEmployee ====================');

      return response;
    } catch (error: any) {
      console.error('❌ [API] createEmployee Error:', error);
      console.log('📝 [API] createEmployee ====================');
      throw error;
    }
  },

  // ================================
  // CHECK EMPLOYEE FORM STATUS
  // ================================
  checkEmployeeStatus: async (): Promise<CheckEmployeeStatusResponse> => {
    console.log('🌐 [API] checkEmployeeStatus ====================');
    console.log('🌐 [API] checkEmployeeStatus called');

    const token: string | null = await getToken();
    console.log('🔑 [API] Token found:', token ? 'Yes' : 'No');

    if (!token) {
      console.log('❌ [API] No token found');
      throw { success: false, message: 'No authentication token found' };
    }

    const url = `${API_BASE_URL}${API_ENDPOINTS.CHECK_EMPLOYEE_STATUS}`;
    console.log('🌐 [API] URL:', url);
    console.log('🌐 [API] Platform:', Platform.OS);

    try {
      const response = await fetchHandler(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
      });

      console.log(
        '✅ [API] checkEmployeeStatus Response:',
        JSON.stringify(response, null, 2),
      );
      console.log('🌐 [API] checkEmployeeStatus ====================');

      return response;
    } catch (error: any) {
      console.error('❌ [API] checkEmployeeStatus Error:', error);
      console.log('🌐 [API] checkEmployeeStatus ====================');
      throw error;
    }
  },

  // ================================
  // ✅ GET ALL EMPLOYEES - Token se userId lega
  // ================================
  getAllEmployees: async (): Promise<EmployeeResponse> => {
    console.log('📦 [API] getAllEmployees ====================');
    console.log('📦 [API] getAllEmployees called');

    const token: string | null = await getToken();
    console.log('🔑 [API] Token found:', token ? 'Yes' : 'No');

    if (!token) {
      console.log('❌ [API] No token found');
      throw { success: false, message: 'No authentication token found' };
    }

    const url = `${API_BASE_URL}${API_ENDPOINTS.GET_ALL_EMPLOYEES}`;
    console.log('🌐 [API] URL:', url);
    console.log('🌐 [API] Platform:', Platform.OS);

    try {
      const response = await fetchHandler(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
      });

      console.log(
        '✅ [API] getAllEmployees Response:',
        JSON.stringify(response, null, 2),
      );
      console.log('📦 [API] getAllEmployees ====================');

      return response;
    } catch (error: any) {
      console.error('❌ [API] getAllEmployees Error:', error);
      console.log('📦 [API] getAllEmployees ====================');
      throw error;
    }
  },

  // ================================
  // ✅ GET EMPLOYEE BY NAME AND ROLE - POST with name & role
  // ================================
  getEmployeeByNameAndRole: async (
    name: string,
    role: string,
  ): Promise<EmployeeResponse> => {
    console.log('🔍 [API] getEmployeeByNameAndRole ====================');
    console.log('🔍 [API] getEmployeeByNameAndRole called');
    console.log('🔍 [API] Name:', name);
    console.log('🔍 [API] Role:', role);

    const token: string | null = await getToken();
    console.log('🔑 [API] Token found:', token ? 'Yes' : 'No');

    if (!token) {
      console.log('❌ [API] No token found');
      throw { success: false, message: 'No authentication token found' };
    }

    const url = `${API_BASE_URL}${API_ENDPOINTS.GET_EMPLOYEE_BY_NAME_ROLE}`;
    console.log('🌐 [API] URL:', url);
    console.log('🌐 [API] Platform:', Platform.OS);

    try {
      const response = await fetchHandler(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === 'android' && { 'X-Platform': 'android' }),
          ...(Platform.OS === 'ios' && { 'X-Platform': 'ios' }),
        },
        body: { name, role },
      });

      console.log(
        '✅ [API] getEmployeeByNameAndRole Response:',
        JSON.stringify(response, null, 2),
      );
      console.log('🔍 [API] getEmployeeByNameAndRole ====================');

      return response;
    } catch (error: any) {
      console.error('❌ [API] getEmployeeByNameAndRole Error:', error);
      console.log('🔍 [API] getEmployeeByNameAndRole ====================');
      throw error;
    }
  },
};

export default employeeApi;
