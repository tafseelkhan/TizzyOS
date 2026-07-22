// ============================================================
// FILE: src/api/v0/scan.api.ts
// ============================================================

import axios from 'axios';
import {
  ScanResponse,
  OrderDetails,
  TrackingStatus,
} from '../../../core/types/orderTypes';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { getToken } from '../../connections/token/tokenSlice';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';

export interface OrderDetailsData {
  _id: string;
  orderId: string;
  productId?: string;
  sellerId: string;
  sellerName?: string;
  buyerId: string;
  buyerName: string;
  trackingId: string;
  items: any[];
  productPrice: number;
  productMrp: number;
  productSavedAmount: number;
  productDiscount: number;
  productOfferText: string;
  productFinalPrice: number;
  productGst: number;
  productGstRate: number;
  deliveryCharge: number;
  distanceKm: number;
  totalBeforeCoupon: number;
  discountApplied: number;
  platformFee: number;
  packagingFee: number;
  finalAmount: number;
  status: string;
  fulfillmentType: string;
  metadata: any;
  shippingLabel: {
    qrCodeUrl: string;
    qrData: {
      token: string;
    };
  };
  paymentIntentId: string;
  token: string;
  buyerAddress: {
    address: string;
    googlePlaceId: string;
    latitude: number;
    longitude: number;
  };
  sellerAddress: {
    address: string;
    googlePlaceId: string;
    latitude: number;
    longitude: number;
  };
  couponUsed: any;
  couponData: any;
  coFundApplied: boolean;
  fundSplit: {
    bank: number;
    merchant: number;
  };
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface OrderDetailsResponse {
  success: boolean;
  message: string;
  data: OrderDetailsData;
}

export const verifyQRAndMarkReadyForDispatch = async (
  qrData: any,
): Promise<ScanResponse> => {
  try {
    const token = await getToken();

    const response = await axios.post(
      `${API_BASE_URL}${API_ENDPOINTS.VERIFY_QR_AND_MARK_READY_FOR_DISPATCH}`,
      { qrData },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  } catch (error: any) {
    console.error('❌ QR Scan API Error:', error);
    throw new Error(error.response?.data?.error || 'Failed to scan QR code');
  }
};

// ✅ NEW: Get all orders for FWS
export const getFWSOrders = async (): Promise<any> => {
  try {
    const token = await getToken();

    const response = await axios.get(
      `${API_BASE_URL}${API_ENDPOINTS.GET_FWS_ORDER}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return response.data.data;
  } catch (error: any) {
    console.error('❌ Get FWS Orders API Error:', error);
    throw new Error(
      error.response?.data?.error || 'Failed to fetch FWS orders',
    );
  }
};

// ✅ Get single order details (existing)
export const getOrderDetails = async (
  orderId: string,
): Promise<OrderDetails> => {
  try {
    const token = await getToken();

    const response = await axios.get(`${API_BASE_URL}/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data.data;
  } catch (error: any) {
    console.error('❌ Get Order API Error:', error);
    throw new Error(
      error.response?.data?.error || 'Failed to fetch order details',
    );
  }
};

export const getTrackingStatus = async (
  orderId: string,
): Promise<TrackingStatus> => {
  try {
    const token = await getToken();

    const response = await axios.get(
      `${API_BASE_URL}${API_ENDPOINTS.GET_TRACKING_HISTORY}?orderId=${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return response.data;
  } catch (error: any) {
    console.error('❌ Get Tracking API Error:', error);
    throw new Error(
      error.response?.data?.error || 'Failed to fetch tracking status',
    );
  }
};

/**
 * ✅ Fetch order details by orderId
 * @param orderId - The order ID to fetch
 * @returns Promise<OrderDetailsResponse>
 */
export const getOrderById = async (
  orderId: string,
): Promise<OrderDetailsResponse> => {
  try {
    console.log(`🔄 Fetching order details for: ${orderId}`);
    const token = await getToken();
    console.log(
      'API URL:',
      `${API_BASE_URL}${API_ENDPOINTS.GET_ORDER_BY_ID}/${orderId}`,
    );
    const response = await axios.get<OrderDetailsResponse>(
      `${API_BASE_URL}${API_ENDPOINTS.GET_ORDER_BY_ID}/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log('✅ Order details fetched successfully');
    return response.data;
  } catch (error: any) {
    console.error('❌ getOrderById Error:', error);
    throw new Error(
      error.response?.data?.message || 'Failed to fetch order details',
    );
  }
};
