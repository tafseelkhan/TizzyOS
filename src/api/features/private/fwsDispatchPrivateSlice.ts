// ============================================================
// FILE: src/api/dispatch.api.ts
// ============================================================

import {
  ScanResponse,
  OrderDetails,
  TrackingStatus,
  DispatchAssignmentResponse,
} from '../../../core/types/orderTypes';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { getToken } from '../../connections/token/tokenSlice';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';

interface AssignDispatchParams {
  orderId: string;
  shippingType: 'RIDER' | 'TRUCK';
  assignmentType: 'AUTO' | 'MANUAL';
  shippingId?: string;
}

export const fwsAssignShipping = async (
  params: AssignDispatchParams,
): Promise<DispatchAssignmentResponse> => {
  try {
    const token = await getToken();

    // ✅ Fix: fetch() takes exactly 2 arguments (url, options)
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.FWS_ASSIGN_ORDER}`, // ✅ Complete URL
      {
        method: 'POST', // ✅ Method specify karo
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: params.orderId,
          shippingType: params.shippingType,
          assignmentType: params.assignmentType,
          shippingId: params.shippingId,
        }), // ✅ Body mein data bhejo
      },
    );

    // ✅ Check if response is ok
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData?.error || 'Failed to assign dispatch');
    }

    // ✅ Parse response
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('❌ Assign Dispatch API Error:', error);
    throw new Error(error.message || 'Failed to assign dispatch');
  }
};
