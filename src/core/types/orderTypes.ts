// ============================================================
// FILE: src/types/orderTypes.ts
// ============================================================

export interface FWSOrder {
  order: {
    _id: string;
    orderId: string;
    trackingId: string;
    fulfillmentType: string;
    status: string;
    buyerName: string;
    buyerId: string;
    sellerId: string;
    items: any[];
    finalAmount: number;
    createdAt: string;
    updatedAt: string;
  };
  tracking: {
    _id: string;
    orderId: string;
    trackingId: string;
    currentHolderType: string;
    currentHolderId: string;
    currentHolderName: string;
    currentFWS: {
      userId: string;
      fwsCode: string;
      fwsName: string;
      city: string;
      address: string;
      processingStage:
        | 'RECEIVED'
        | 'SCANNED'
        | 'READY_FOR_DISPATCH'
        | 'PICKED'
        | 'DISPATCHED';
      updatedAt: string;
    };
    pendingAssignment: {
      assignmentId: string;
      assigneeId: string;
      assigneeType: 'RIDER' | 'TRUCK';
      assignedBy: string;
      assignedAt: string;
      assignmentType: 'AUTO' | 'MANUAL';
      status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
      distance: number;
    } | null;
    currentStatus: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ScanResponse {
  success: boolean;
  data: {
    order: {
      orderId: string;
      sellerId: string;
      buyerId: string;
    };
    fwsDetails: {
      fwsCode: string;
      name: string;
      city: string;
      address: string;
      processingStage: string;
    };
    scanDetails: {
      scannedBy: {
        userId: string;
        name: string;
        isOwner: boolean;
        isEmployee: boolean;
        role: string;
      };
      scannedAt: string;
      processingStage: string;
      activityId: string;
    };
    currentHolder: {
      type: string;
      id: string;
      name: string;
    };
    message: string;
    readyForDispatch: boolean;
  };
}

export interface TrackingStatus {
  orderId: string;
  fulfillmentType: string;
  pendingAssignment: {
    assignmentId: string;
    assigneeId: string;
    assigneeType: 'RIDER' | 'TRUCK';
    assignedBy: string;
    assignedAt: string;
    assignmentType: 'AUTO' | 'MANUAL';
    status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
    distance: number;
  } | null;
  trackingHistory: any[];
  qrOwnershipHistory: any[];
  route: any[];
  routeHistory: any[];
  updatedAt: string;
}

export interface OrderDetails {
  _id: string;
  orderId: string;
  trackingId: string;
  fulfillmentType: string;
  status: string;
  seller: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  buyer: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  items: any[];
  pricing: {
    itemsTotal: number;
    deliveryCharge: number;
    finalAmount: number;
  };
  buyerAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  sellerAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  shippingLabel?: {
    paymentIntentId: string;
    token: string;
  };
  payment: {
    paymentIntentId: string | null;
    token: string | null;
    status: string;
    captured: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DispatchAssignmentResponse {
  success: boolean;
  message?: string;
  data: {
    assignmentId: string;
    shippingId: string;
    shippingName: string;
    shippingType: 'RIDER' | 'TRUCK';
    distance: number;
    status: 'PENDING_ACCEPTANCE';
    processingStage: 'READY_FOR_DISPATCH';
    readyActivityId: string;
    assignActivityId: string;
    message: string;
  };
}

export interface FWSOrderWithTracking {
  order: {
    _id: string;
    orderId: string;
    trackingId: string;
    sellerId: string;
    buyerId: string;
    buyerName: string;
    finalAmount: number;
    status: string;
    fulfillmentType: string;
    createdAt: string;
  } | null;
  tracking: {
    _id: string;
    orderId: string;
    trackingId: string;
    currentHolderType: string;
    currentHolderId: string;
    currentHolderName: string;
    currentFWS: {
      userId: string;
      fwsCode: string;
      fwsName: string;
      processingStage: string;
    };
    pendingAssignment: any;
    trackingHistory: any[];
  };
  isCurrentOrder: boolean;
}

export interface FWSOrdersResponse {
  success: boolean;
  data: {
    currentOrders: FWSOrderWithTracking[];
    previousOrders: FWSOrderWithTracking[];
    total: number;
    currentCount: number;
    previousCount: number;
  };
  message?: string;
}

export interface FWSOrderWithTracking {
  order: {
    _id: string;
    orderId: string;
    trackingId: string;
    sellerId: string;
    buyerId: string;
    buyerName: string;
    finalAmount: number;
    status: string;
    fulfillmentType: string;
    createdAt: string;
  } | null;
  tracking: {
    _id: string;
    orderId: string;
    trackingId: string;
    currentHolderType: string;
    currentHolderId: string;
    currentHolderName: string;
    currentFWS: {
      userId: string;
      fwsCode: string;
      fwsName: string;
      processingStage: string;
    };
    pendingAssignment: any;
    trackingHistory: any[];
  };
  isCurrentOrder: boolean;
}

// ✅ Extended order details from API
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
  finalAmount: number;
  status: string;
  fulfillmentType: string;
  shippingLabel?: any;
  buyerAddress?: {
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  sellerAddress?: {
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetailsResponse {
  success: boolean;
  message: string;
  data: OrderDetailsData;
}