import { getToken } from '../../../api/connections/token/tokenSlice';
import { warehouseApi } from '../../../api/features/private/fwsApplicationPrivateSlice';
import { jwtDecode } from 'jwt-decode';
import {
  WarehouseFormData,
  WarehouseStatus,
  WarehouseResponse,
} from '../../types/WarehouseTypes';

interface DecodedToken {
  userId: string;
  exp: number;
  iat: number;
}

interface WarehouseStatusResponse extends WarehouseResponse {
  hasSubmitted?: boolean;
}

export class WarehouseService {
  // ✅ API 1: Sirf status check - checkWarehouseStatus
  static async checkUserSubmission(userId: string): Promise<WarehouseStatus> {
    console.log('🔍 [Service] checkUserSubmission called for userId:', userId);

    try {
      const response = (await warehouseApi.checkWarehouseStatus(
        userId,
      )) as WarehouseStatusResponse;
      console.log(
        '📊 [Service] Full API Response:',
        JSON.stringify(response, null, 2),
      );

      if (response && response.success === true) {
        console.log('✅ [Service] API success:', response.success);
        console.log('✅ [Service] hasSubmitted:', response.hasSubmitted);

        if (response.hasSubmitted === true && response.data) {
          console.log('📦 [Service] Warehouse data found');

          return {
            hasSubmitted: true,
            approvalStatus: response.data.approvalStatus || 'PENDING',
            status: response.data.status || 'ACTIVE',
            warehouseData: response.data,
            rejectionReason: response.data.rejectionReason || null,
          };
        } else {
          console.log('📋 [Service] No form submitted yet');
          return {
            hasSubmitted: false,
          };
        }
      } else {
        console.log('⚠️ [Service] API response success is false');
        return {
          hasSubmitted: false,
        };
      }
    } catch (error: any) {
      console.error('❌ [Service] Check submission error:', error);
      return {
        hasSubmitted: false,
      };
    }
  }

  // ✅ FIX: Get complete warehouse details - AB getWarehouseByUserId USE KAREGA!
  static async getWarehouseDetails(userId: string): Promise<any> {
    console.log('📦 [Service] getWarehouseDetails called for userId:', userId);

    try {
      // ✅ CHANGE: checkWarehouseStatus ❌ → getWarehouseByUserId ✅
      const response = await warehouseApi.getWarehouseByUserId(userId);
      console.log(
        '📦 [Service] getWarehouseByUserId Response:',
        JSON.stringify(response, null, 2),
      );

      if (response && response.success === true && response.data) {
        console.log('✅ [Service] Full warehouse data received');
        console.log('📊 coverageKm:', response.data.coverageKm);
        console.log('📊 maxDailyOrders:', response.data.maxDailyOrders);
        return response.data;
      }

      console.log('⚠️ [Service] No warehouse details found');
      return null;
    } catch (error: any) {
      console.error('❌ [Service] Get warehouse error:', error);
      return null;
    }
  }

  // ✅ Submit warehouse form
  static async submitWarehouse(
    userId: string,
    formData: WarehouseFormData,
  ): Promise<any> {
    console.log('📝 [Service] submitWarehouse called for userId:', userId);
    console.log('📝 [Service] Form data:', JSON.stringify(formData, null, 2));

    try {
      const response = await warehouseApi.createWarehouse(userId, formData);
      console.log(
        '✅ [Service] Submit response:',
        JSON.stringify(response, null, 2),
      );

      if (response && response.success === true) {
        return response;
      }

      throw new Error(response?.message || 'Failed to submit warehouse');
    } catch (error: any) {
      console.error('❌ [Service] Submit warehouse error:', error);
      throw error;
    }
  }

  // ✅ Get current user ID from token
  static async getCurrentUserId(): Promise<string> {
    console.log('🔍 [Service] Getting current user ID...');

    try {
      const token = await getToken();
      console.log('🔑 [Service] Token found:', token ? 'Yes' : 'No');

      if (!token) {
        console.log('❌ [Service] No token found');
        throw new Error('No token found');
      }

      const decoded = jwtDecode<DecodedToken>(token);
      console.log('👤 [Service] Decoded user ID:', decoded.userId);

      return decoded.userId;
    } catch (error: any) {
      console.error('❌ [Service] Error getting user ID:', error);
      throw error;
    }
  }
}
