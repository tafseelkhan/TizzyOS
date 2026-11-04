// src/api/features/private/pendingOrdersPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest, ApiError } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface PendingAssignment {
  assignmentId: string;
  assigneeId: string;
  assigneeType: string;
  status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  assignedAt: string;
  expiresAt: string;
}

export interface QrOwnershipHistory {
  holderId: string;
  holderType: string;
  holderName: string;
  receivedAt: string;
  releasedAt: string | null;
}

export interface TrackingHistoryEntry {
  status: string;
  holderType?: string;
  holderId?: string;
  note?: string;
  createdAt: string;
  performedByType?: string;
  fwsProcessingStage?: string;
  scanInfo?: {
    status: string;
    holderType: string;
    holderId: string;
    holderName: string;
    note: string;
    fwsProcessingStage?: string;
    createdAt: string;
  };
}

export interface TrackingStatusResponse {
  success: boolean;
  orderId: string;
  fulfillmentType: 'SELLER' | 'FWS';
  pendingAssignment: PendingAssignment | null;
  trackingHistory: TrackingHistoryEntry[];
  qrOwnershipHistory: QrOwnershipHistory[];
  currentStatus: string;
  currentHolderType: string;
  currentHolderId: string;
  currentFWS?: {
    userId: string;
    fwsCode: string;
    fwsName: string;
    city: string;
    processingStage: string;
  };
  assignmentHistory?: Array<{
    assignmentId: string;
    assigneeId: string;
    assigneeType: string;
    assignedBy: string;
    assignedByType: string;
    assignedAt: string;
    acceptedAt?: string;
    rejectedAt?: string;
    cancelledAt?: string;
    assignmentType: string;
    distance: number;
    status: string;
  }>;
  currentShipping?: {
    shippingUserId: string;
    shippingName: string;
    latitude: number;
    longitude: number;
    shippingType: string;
    updatedAt: string;
  };
}

export interface OrderData {
  _id: string;
  orderId: string;
  sellerAddress: {
    address: string;
    latitude: number;
    longitude: number;
  };
  buyerAddress: {
    address: string;
    latitude: number;
    longitude: number;
  };
  finalAmount: number;
  paymentStatus: string;
  fulfillmentType: string;
  createdAt: string;
  status: string;
}

export interface OrderWithBasicInfo {
  order: OrderData;
}

export interface MyAssignedOrdersResponse {
  success: boolean;
  data: {
    orders: OrderWithBasicInfo[];
    stats: {
      current: number;
      delivered: number;
      total: number;
      remaining: number;
    };
  };
}

export interface AcceptOrderResponse {
  success: boolean;
  message: string;
  data: {
    orderId: string;
    deliveryStatus: string;
  };
}

export interface HandoverResponse {
  success: boolean;
  message: string;
  alreadyScanned?: boolean;
  duplicate?: boolean;
  code?: string;
  details?: string;
  data?: {
    orderId: string;
    fromHolder: string;
    toHolder: string;
  };
}

export interface DeliveryInitiateResponse {
  success: boolean;
  message: string;
  data: {
    orderId: string;
    trackingId: string;
    requiresOtp: boolean;
    expiresAt: string;
    expiresInMinutes: number;
    buyerEmail?: string;
    buyerName?: string;
    otp?: string;
    otpExpiry?: {
      expiresAt: string;
      expiresIn: number;
      expiresInMinutes: number;
    };
  };
}

export interface OTPVerifyResponse {
  success: boolean;
  message: string;
  data: {
    orderId: string;
    trackingId: string;
    deliveredAt: string;
    deliveredBy: {
      userId: string;
      userType: string;
      userName: string;
    };
    buyerName: string;
    buyerId: string;
    previousHolder: {
      userId: string;
      userType: string;
      userName: string;
    };
  };
}

export interface RequestOTPResponse {
  success: boolean;
  message: string;
  data: {
    orderId: string;
    expiresAt: string;
    expiresInMinutes: number;
    buyerEmail?: string;
    buyerName?: string;
    otp?: string;
  };
}

export interface QRCodeData {
  showQR: boolean;
  completed?: boolean;
  message?: string;
  qrCodeUrl?: string;
  qrData?: string;
  holderType?: string;
  status?: string;
}

interface QRCodeApiResponse {
  success?: boolean;
  data?: QRCodeData;
  message?: string;
  [key: string]: unknown;
}

// ============================================================
// 1. GET MY ASSIGNED ORDERS
// ============================================================

export const getMyAssignedOrders =
  async (): Promise<MyAssignedOrdersResponse> => {
    return apiRequest<MyAssignedOrdersResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_MY_ASSIGNED_ORDERS}`,
      { method: 'GET' },
    );
  };

// ============================================================
// 2. ACCEPT ASSIGNMENT
// ============================================================

export const acceptAssignment = async (
  orderId: string,
  assignmentId: string,
): Promise<AcceptOrderResponse> => {
  return apiRequest<AcceptOrderResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.ACCEPT_ASSIGNMENT}`,
    {
      method: 'POST',
      body: JSON.stringify({ orderId, assignmentId }),
    },
  );
};

// ============================================================
// 3. HANDOVER VIA QR
// ============================================================

export const handoverViaQrDelivery = async (
  qrData: string,
): Promise<HandoverResponse> => {
  // Extract token from JSON if applicable
  let actualToken = qrData;
  try {
    const parsed = JSON.parse(qrData);
    if (parsed.token) {
      actualToken = parsed.token;
    }
  } catch {
    // Not JSON — use raw
  }

  return apiRequest<HandoverResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.HANDOVER_VIA_QR_DELIVERY}`,
    {
      method: 'POST',
      body: JSON.stringify({ token: actualToken }),
    },
  );
};

// ============================================================
// 4. INITIATE DELIVERY (SEND OTP)
// ============================================================

export const initiateDelivery = async (
  orderId: string,
): Promise<DeliveryInitiateResponse> => {
  return apiRequest<DeliveryInitiateResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.INITIATE_DELIVERY}`,
    {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    },
  );
};

// ============================================================
// 5. VERIFY DELIVERY OTP
// ============================================================

export const verifyDeliveryOTP = async (
  orderId: string,
  otp: string,
): Promise<OTPVerifyResponse> => {
  return apiRequest<OTPVerifyResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.VERIFY_DELIVERY_OTP}`,
    {
      method: 'POST',
      body: JSON.stringify({ orderId, otp }),
    },
  );
};

// ============================================================
// 6. REQUEST NEW DELIVERY OTP
// ============================================================

export const requestNewDeliveryOTP = async (
  orderId: string,
): Promise<RequestOTPResponse> => {
  return apiRequest<RequestOTPResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.REQUEST_DELIVERY_OTP}`,
    {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    },
  );
};

// ============================================================
// 7. GET TRACKING STATUS
// ============================================================

export const getTrackingStatus = async (
  orderId: string,
): Promise<TrackingStatusResponse | null> => {
  try {
    const data = await apiRequest<TrackingStatusResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_TRACKING_STATUS}?orderId=${encodeURIComponent(
        orderId,
      )}`,
      { method: 'GET' },
    );

    if (data?.success) return data;
    return null;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[getTrackingStatus] ${orderId} failed:`, error);
    }
    return null;
  }
};

// ============================================================
// 8. GET QR CODE FOR ORDER
// ============================================================

export const getOrderQRCode = async (
  orderId: string,
): Promise<QRCodeData | null> => {
  try {
    const data = await apiRequest<QRCodeApiResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_ORDER_QR}/${orderId}/qr`,
      { method: 'GET' },
    );

    if (data?.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[getOrderQRCode] ${orderId} failed:`, error);
    }
    return null;
  }
};