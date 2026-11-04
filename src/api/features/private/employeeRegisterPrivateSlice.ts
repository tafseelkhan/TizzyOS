// api/features/private/employeeRegisterPrivateSlice.ts

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import {
  apiRequest,
  ApiError,
} from '../../../core/utils/handler/apiClient';
// ✅ base-64 for React Native
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
// PLATFORM HEADERS — ek jagah
// ================================

const platformHeaders: Record<string, string> =
  Platform.OS === 'android'
    ? { 'X-Platform': 'android' }
    : Platform.OS === 'ios'
    ? { 'X-Platform': 'ios' }
    : {};

// ================================
// ✅ Token se userId nikalne ka function
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
      return null;
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

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
  } catch {
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
    return apiRequest<EmployeeResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.CREATE_EMPLOYEE}`,
      {
        method: 'POST',
        headers: platformHeaders,
        body: JSON.stringify(formData),
      },
    );
  },

  // ================================
  // CHECK EMPLOYEE FORM STATUS
  // ================================
  checkEmployeeStatus: async (): Promise<CheckEmployeeStatusResponse> => {
    return apiRequest<CheckEmployeeStatusResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.CHECK_EMPLOYEE_STATUS}`,
      {
        method: 'GET',
        headers: platformHeaders,
      },
    );
  },

  // ================================
  // ✅ GET ALL EMPLOYEES
  // ================================
  getAllEmployees: async (): Promise<EmployeeResponse> => {
    return apiRequest<EmployeeResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_ALL_EMPLOYEES}`,
      {
        method: 'GET',
        headers: platformHeaders,
      },
    );
  },

  // ================================
  // ✅ GET EMPLOYEE BY NAME AND ROLE
  // ================================
  getEmployeeByNameAndRole: async (
    name: string,
    role: string,
  ): Promise<EmployeeResponse> => {
    return apiRequest<EmployeeResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_EMPLOYEE_BY_NAME_ROLE}`,
      {
        method: 'POST',
        headers: platformHeaders,
        body: JSON.stringify({ name, role }),
      },
    );
  },
};

export default employeeApi;