// src/api/features/private/driverProfileSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface DriverStats {
  totalRides: number;
  completed: number;
  cancelled: number;
  earnings: number;
  rating: number;
}

export interface DriverProfile {
  id: string;
  name: string;
  image: string;
  isActive: boolean;
  stats: DriverStats;
  driverCode: string;
  vehicleNumber: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
}

/**
 * Raw backend response shape for GET_DRIVER_STATUS.
 * Backend may return partial data — we normalize in the mapper.
 */
interface DriverProfileRawResponse {
  success?: boolean;
  message?: string;
  data?: {
    _id?: string;
    id?: string;
    name?: string;
    image?: string;
    isActive?: boolean;
    driverCode?: string;
    vehicleNumber?: string;
    status?: DriverProfile['status'];
    stats?: Partial<DriverStats>;
  };
  _id?: string;
  id?: string;
  name?: string;
  image?: string;
  isActive?: boolean;
  driverCode?: string;
  vehicleNumber?: string;
  status?: DriverProfile['status'];
  stats?: Partial<DriverStats>;
}

// ============================================================
// HELPERS
// ============================================================

const normalizeImageUrl = (image?: string): string => {
  if (!image) return '';
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  // Relative path — TizzyOS base ke saath join
  return `${TIZZYOS_API_BASE_URL}${image}`;
};

const mapDriverProfile = (raw: DriverProfileRawResponse): DriverProfile => {
  // Backend may wrap in `data` or return flat — handle both
  const data = raw.data ?? raw;

  return {
    id: data._id ?? data.id ?? '',
    name: data.name ?? '',
    image: normalizeImageUrl(data.image),
    isActive: data.isActive ?? false,
    driverCode: data.driverCode ?? '',
    vehicleNumber: data.vehicleNumber ?? '',
    status: data.status ?? 'pending',
    stats: {
      totalRides: data.stats?.totalRides ?? 0,
      completed: data.stats?.completed ?? 0,
      cancelled: data.stats?.cancelled ?? 0,
      earnings: data.stats?.earnings ?? 0,
      rating: data.stats?.rating ?? 0,
    },
  };
};

// ============================================================
// DRIVER PROFILE API
//
// Same pattern as `me()`:
// - Auto refresh + retry handled by apiClient
// - 401 → apiClient clears tokens and throws
// - No fake fallback — throw on failure, caller handles
// ============================================================

export const getDriverProfile = async (): Promise<DriverProfile> => {
  const response = await apiRequest<DriverProfileRawResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_DRIVER_PROFILE}`,
    { method: 'GET' },
  );

  return mapDriverProfile(response);
};
