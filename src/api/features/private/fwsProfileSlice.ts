// src/api/features/private/fwsProfileSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface FWSStats {
  totalOrders: number;
  completed: number;
  inProgress: number;
  pending: number;
}

export interface FWSProfile {
  id: string;
  name: string;
  image: string;
  isActive: boolean;
  stats: FWSStats;
}

interface FWSProfileRawResponse {
  success?: boolean;
  message?: string;
  data?: {
    _id?: string;
    id?: string;
    name?: string;
    image?: string;
    isActive?: boolean;
    stats?: Partial<FWSStats>;
  };
  _id?: string;
  id?: string;
  name?: string;
  image?: string;
  isActive?: boolean;
  stats?: Partial<FWSStats>;
}

// ============================================================
// HELPERS
// ============================================================

const normalizeImageUrl = (image?: string): string => {
  if (!image) return '';
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  return `${TIZZYOS_API_BASE_URL}/${image}`;
};

const mapFWSProfile = (raw: FWSProfileRawResponse): FWSProfile => {
  const data = raw.data ?? raw;

  return {
    id: data._id ?? data.id ?? '',
    name: data.name ?? '',
    image: normalizeImageUrl(data.image),
    isActive: data.isActive ?? false,
    stats: {
      totalOrders: data.stats?.totalOrders ?? 0,
      completed: data.stats?.completed ?? 0,
      inProgress: data.stats?.inProgress ?? 0,
      pending: data.stats?.pending ?? 0,
    },
  };
};

// ============================================================
// API
// ============================================================

export const getFWSProfile = async (): Promise<FWSProfile> => {
  const response = await apiRequest<FWSProfileRawResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_FWS_PROFILE}`,
    { method: 'GET' },
  );

  return mapFWSProfile(response);
};