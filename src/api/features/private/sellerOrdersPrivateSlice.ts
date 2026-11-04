// src/api/features/private/sellerOrdersPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest, ApiError } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface QRCodeData {
  showQR: boolean;
  completed?: boolean;
  message?: string;
  qrCodeUrl?: string;
  qrData?: string;
  holderType?: string;
  status?: string;
  [key: string]: unknown;
}

export interface SellerOrderRaw {
  _id?: string;
  orderId?: string;
  productId?: string;
  sellerId?: string;
  userId?: string;
  buyerId?: string;
  buyerName?: string;
  items?: Array<{
    quantity?: number;
    productData?: {
      title?: string;
      brand?: string;
      category?: string;
      [key: string]: unknown;
    };
    selectedVariant?: Record<string, string>;
    productId?: string;
  }>;
  productPrice?: number;
  productMrp?: number;
  productFinalPrice?: number;
  productGstRate?: number;
  deliveryCharge?: number;
  finalAmount?: number;
  status?: string;
  paymentIntentId?: string;
  paymentStatus?: string;
  buyerAddress?: {
    address?: string;
    googlePlaceId?: string;
    latitude?: number;
    longitude?: number;
  };
  sellerAddress?: {
    address?: string;
    googlePlaceId?: string;
    latitude?: number;
    longitude?: number;
  };
  createdAt?: string;
  updatedAt?: string;
  isConfirmed?: boolean;
  fulfillmentType?: 'SELLER' | 'FWS';
  shippingRider?: {
    id: string;
    name: string;
    phoneNumber?: string;
    vehicleType?: string;
  };
  rider?: {
    id: string;
    name: string;
    phoneNumber?: string;
    vehicleType?: string;
  };
  metadata?: {
    idempotencyKey?: string;
    cartId?: string;
    createdAt?: string;
  };
  deliveryTracking?: any | null;
  trackingHistory?: any[] | null;
  qrOwnershipHistory?: any[] | null;
  pendingAssignment?: any | null;
  route?: any[];
  routeHistory?: any[];
  currentStatus?: string | null;
  currentHolderType?: string | null;
  currentHolderId?: string | null;
  currentHolderName?: string | null;
  trackingId?: string | null;
  currentLocation?: any | null;
  currentFWS?: any | null;
  currentShipping?: any | null;
  trackingUpdatedAt?: string | null;
  hasTracking?: boolean;
  [key: string]: unknown;
}

export interface ShippingPartnerRaw {
  _id?: string;
  id?: string;
  userId: string;
  name?: string;
  rating?: number;
  vehicleCategory?: string;
  shippingType?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleNumber?: string;
  vehicleImage?: string;
  isOnline?: boolean;
  isAvailable?: boolean;
  phoneNumber?: string;
  maxOrdersPerDay?: number;
  orderStats?: {
    assigned?: number;
    delivered?: number;
    remaining?: number;
  };
  city?: string;
  state?: string;
  kyc?: any;
  [key: string]: unknown;
}

interface SellerOrdersApiResponse {
  success?: boolean;
  orders?: SellerOrderRaw[];
  data?: SellerOrderRaw[];
  [key: string]: unknown;
}

interface OrderQRApiResponse {
  success?: boolean;
  data?: QRCodeData;
  message?: string;
  [key: string]: unknown;
}

interface ActionApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

interface ShippingPartnersApiResponse {
  success?: boolean;
  shippingPartners?: ShippingPartnerRaw[];
  data?: ShippingPartnerRaw[];
  partners?: ShippingPartnerRaw[];
  [key: string]: unknown;
}

// ============================================================
// 1. GET SELLER ORDERS
// ============================================================

export const getSellerOrders = async (
  sellerId: string,
): Promise<SellerOrderRaw[]> => {
  const data = await apiRequest<SellerOrdersApiResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_SELLER_ORDERS}?sellerId=${encodeURIComponent(
      sellerId,
    )}`,
    { method: 'GET' },
  );

  if (data?.success && Array.isArray(data.orders)) return data.orders;
  if (Array.isArray(data)) return data as unknown as SellerOrderRaw[];
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

// ============================================================
// 2. GET ORDER QR CODE
// ============================================================

export const getOrderQRCode = async (
  orderId: string,
): Promise<QRCodeData | null> => {
  try {
    const data = await apiRequest<OrderQRApiResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_ORDER_QR}/${orderId}/qr`,
      { method: 'GET' },
    );

    if (data?.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    if (__DEV__) {
      console.error(`❌ getOrderQRCode error for ${orderId}:`, error);
    }
    return null;
  }
};

// ============================================================
// 3. SELLER ACCEPT ORDER
// ============================================================

export const sellerAcceptOrder = async (
  orderId: string,
): Promise<{ success: boolean; message?: string }> => {
  const data = await apiRequest<ActionApiResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.SELLER_ACCEPT_ORDER}`,
    {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    },
  );

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to accept order');
  }

  return { success: true, message: data?.message };
};

// ============================================================
// 4. SELLER ASSIGN SHIPPING (MANUAL + AUTO)
// ============================================================

export interface AssignShippingPayload {
  orderId: string;
  assignmentType: 'AUTO' | 'MANUAL';
  shippingType: 'RIDER' | 'TRUCK';
  shippingId?: string;
}

export const sellerAssignShipping = async (
  payload: AssignShippingPayload,
): Promise<{ success: boolean; message?: string }> => {
  const data = await apiRequest<ActionApiResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.SELLER_ASSIGN_SHIPPING}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to assign shipping partner');
  }

  return { success: true, message: data?.message };
};

// ============================================================
// 5. SELLER DELIVER TO FWS
// ============================================================

export const sellerDeliverToFWS = async (
  orderId: string,
): Promise<{ success: boolean; message?: string }> => {
  const data = await apiRequest<ActionApiResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.SELLER_DELIVER_TO_FWS}`,
    {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    },
  );

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to intransit to FWS');
  }

  return { success: true, message: data?.message };
};

// ============================================================
// 6. GET AVAILABLE SHIPPING PARTNERS
// ============================================================

export const getAvailableShippingPartners =
  async (): Promise<ShippingPartnerRaw[]> => {
    const data = await apiRequest<ShippingPartnersApiResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_AVAILABLE_SHIPPING}`,
      { method: 'GET' },
    );

    if (data?.success && Array.isArray(data.shippingPartners)) {
      return data.shippingPartners;
    }
    if (Array.isArray(data)) {
      return data as unknown as ShippingPartnerRaw[];
    }
    if (data?.partners && Array.isArray(data.partners)) {
      return data.partners;
    }

    return [];
  };