// utils/api/v0/seller/status/seller.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://172.20.245.121:5000';

export interface SellerStatusResponse {
  success: boolean;
  data?: {
    status: 'pending' | 'approved' | 'rejected' | 'none';
    uniqOsId?: string | null;
    rejectionReason?: string | null;
    pendingDetails?: {
      reason: string | null;
      durationInDays: number | null;
    } | null;
    createdAt?: string;
  };
  message?: string;
}

// Custom fetch wrapper with timeout
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout = 30000,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export const getMySellerApplication =
  async (): Promise<SellerStatusResponse> => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        console.warn('⚠️ No token found in AsyncStorage');
        return {
          success: false,
          message: 'Unauthorized: Please login again',
        };
      }

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v0/seller/status`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();

      // NULL TO UNDEFINED CONVERSION
      if (data.success && data.data) {
        const responseData = data.data;
        const transformedData = {
          ...responseData,
          uniqOsId: responseData.uniqOsId || undefined,
          rejectionReason: responseData.rejectionReason || undefined,
          pendingDetails: responseData.pendingDetails
            ? {
                reason: responseData.pendingDetails.reason || undefined,
                durationInDays:
                  responseData.pendingDetails.durationInDays || undefined,
              }
            : undefined,
        };

        return {
          success: true,
          data: transformedData,
        };
      }

      return data as SellerStatusResponse;
    } catch (error: any) {
      console.error('❌ Error fetching seller status:', error.message);

      return {
        success: false,
        message:
          error.message ||
          'Failed to fetch seller status. Please try again later.',
      };
    }
  };

// ✅ Check Seller Form Status
export const checkSellerFormStatus = async () => {
  try {
    // 🔐 Get token from AsyncStorage
    const token = await AsyncStorage.getItem('authToken');

    if (!token) {
      throw new Error('No token found. Please login again.');
    }

    // 🌐 API call using native fetch
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/v0/seller/check-form-status`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`,
      );
    }

    const data = await response.json();
    console.log('✅ Seller Form Status Response:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Error checking form status:', error.message);
    throw new Error(error.message || 'Failed to check seller form status');
  }
};
