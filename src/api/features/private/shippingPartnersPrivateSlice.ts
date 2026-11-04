// src/api/features/private/shippingPartnersPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface ShippingPartner {
  id: string;
  userId: string;
  name: string;
  rating: number;
  vehicleType: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleNumber?: string;
  isAvailable: boolean;
  phoneNumber?: string;
  maxOrdersPerDay: number;
  currentOrders: number;
  shippingType?: string;
  city?: string;
  state?: string;
  distance?: number;
  alreadyHandled?: boolean;
}

interface ShippingPartnerRaw {
  _id?: string;
  id?: string;
  userId?: string;
  name?: string;
  rating?: number;
  vehicleCategory?: string;
  shippingType?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleNumber?: string;
  isOnline?: boolean;
  isAvailable?: boolean;
  phoneNumber?: string;
  maxOrdersPerDay?: number;
  orderStats?: { assigned?: number };
  city?: string;
  state?: string;
  distance?: number;
}

interface AvailableShippingResponse {
  success?: boolean;
  message?: string;
  shippingPartners?: ShippingPartnerRaw[];
  data?: ShippingPartnerRaw[];
}

// ============================================================
// MAPPER
// ============================================================

const mapPartner = (
  item: ShippingPartnerRaw,
  excludedIds: string[],
): ShippingPartner => ({
  id: item._id ?? item.id ?? '',
  userId: item.userId ?? '',
  name: item.name ?? 'Unknown',
  rating: item.rating ?? 4.0,
  vehicleType: item.vehicleCategory ?? item.shippingType ?? 'RIDER',
  vehicleBrand: item.vehicleBrand,
  vehicleModel: item.vehicleModel,
  vehicleNumber: item.vehicleNumber,
  isAvailable: !!(item.isOnline && item.isAvailable),
  phoneNumber: item.phoneNumber,
  maxOrdersPerDay: item.maxOrdersPerDay ?? 10,
  currentOrders: item.orderStats?.assigned ?? 0,
  shippingType: item.shippingType,
  city: item.city,
  state: item.state,
  distance: item.distance ?? 0,
  alreadyHandled: excludedIds.includes(item.userId ?? ''),
});

// ============================================================
// API — Get Available Shipping Partners
// ============================================================

export const getAvailableShippingPartners = async (
  shippingType?: 'RIDER' | 'TRUCK',
  excludedIds: string[] = [],
): Promise<ShippingPartner[]> => {
  const response = await apiRequest<AvailableShippingResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_AVAILABLE_SHIPPING}`,
    { method: 'GET' },
  );

  if (!response.success) {
    return [];
  }

  const raw =
    response.shippingPartners ?? response.data ?? [];

  return raw
    .filter(item => {
      if (!shippingType) return true;
      const type = item.shippingType ?? item.vehicleCategory;
      return type === shippingType;
    })
    .map(item => mapPartner(item, excludedIds));
};