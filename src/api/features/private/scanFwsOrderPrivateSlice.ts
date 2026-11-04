// src/api/v0/scan.api.ts

import {
  ScanResponse,
  OrderDetails,
  TrackingStatus,
} from '../../../core/types/orderTypes';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { apiRequest } from '../../../core/utils/handler/apiClient';

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

// ============================================================
// VERIFY QR + MARK READY FOR DISPATCH
// ============================================================

export const verifyQRAndMarkReadyForDispatch = async (
  qrData: any,
): Promise<ScanResponse> => {
  return apiRequest<ScanResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.VERIFY_QR_AND_MARK_READY_FOR_DISPATCH}`,
    {
      method: 'POST',
      body: JSON.stringify({ qrData }),
    },
  );
};

// ============================================================
// ✅ Get all orders for FWS
// ============================================================

export const getFWSOrders = async (): Promise<any> => {
  const response = await apiRequest<{ data: any }>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_FWS_ORDER}`,
    { method: 'GET' },
  );

  return response.data;
};

// ============================================================
// ✅ Get single order details
// ============================================================

export const getOrderDetails = async (
  orderId: string,
): Promise<OrderDetails> => {
  const response = await apiRequest<{ data: OrderDetails }>(
    `${TIZZYOS_API_BASE_URL}/orders/${orderId}`,
    { method: 'GET' },
  );

  return response.data;
};

// ============================================================
// Get tracking status
// ============================================================

export const getTrackingStatus = async (
  orderId: string,
): Promise<TrackingStatus> => {
  return apiRequest<TrackingStatus>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_TRACKING_HISTORY}?orderId=${encodeURIComponent(
      orderId,
    )}`,
    { method: 'GET' },
  );
};

// ============================================================
// ✅ Fetch order details by orderId
// ============================================================

export const getOrderById = async (
  orderId: string,
): Promise<OrderDetailsResponse> => {
  return apiRequest<OrderDetailsResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_ORDER_BY_ID}/${orderId}`,
    { method: 'GET' },
  );
};