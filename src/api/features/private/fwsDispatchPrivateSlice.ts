// src/api/v0/dispatch.api.ts

import {
  DispatchAssignmentResponse,
} from '../../../core/types/orderTypes';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { apiRequest } from '../../../core/utils/handler/apiClient';

interface AssignDispatchParams {
  orderId: string;
  shippingType: 'RIDER' | 'TRUCK';
  assignmentType: 'AUTO' | 'MANUAL';
  shippingId?: string;
}

export const fwsAssignShipping = async (
  params: AssignDispatchParams,
): Promise<DispatchAssignmentResponse> => {
  return apiRequest<DispatchAssignmentResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.FWS_ASSIGN_ORDER}`,
    {
      method: 'POST',
      body: JSON.stringify({
        orderId: params.orderId,
        shippingType: params.shippingType,
        assignmentType: params.assignmentType,
        shippingId: params.shippingId,
      }),
    },
  );
};