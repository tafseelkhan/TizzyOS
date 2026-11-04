// src/api/features/private/productFormPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface Subcategory {
  name: string;
  specs: string[];
  variantOptions: string[];
}

export interface Category {
  _id: string;
  category: string;
  subcategories: Subcategory[];
}

export interface PriceCalculationResponse {
  success: boolean;
  message?: string;
  data: {
    savedAmount: number;
    discountPercentage: number;
    finalPrice: number;
    gstRate: number;
    gstAmount: number;
    checkoutTotal: number;
    basePrice: number;
    customerPays: number;
  };
}

export interface UploadUrlResponse {
  uploadUrl: string;
  filePath: string;
  [key: string]: unknown;
}

export interface CreateProductResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
}

// ============================================================
// 1. CALCULATE PRODUCT PRICING (public — no auth)
// ============================================================

export const calculateProductPricing = async (params: {
  mrp: number;
  price: number;
  category: string;
  subcategory: string;
  gstType: 'INCLUSIVE' | 'EXCLUSIVE';
}): Promise<PriceCalculationResponse> => {
  return apiRequest<PriceCalculationResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.CALCULATE_PRODUCT_PRICING}`,
    {
      method: 'POST',
      auth: false,
      body: JSON.stringify(params),
    },
  );
};

// ============================================================
// 2. GET PRODUCT CATEGORIES (public — no auth)
// ============================================================

export const getProductCategories = async (): Promise<Category[]> => {
  const data = await apiRequest<any>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_PRODUCT_CATEGORIES}`,
    {
      method: 'GET',
      auth: false,
    },
  );

  let categoriesData: Category[] = [];

  if (Array.isArray(data)) {
    categoriesData = data;
  } else if (data?.categories && Array.isArray(data.categories)) {
    categoriesData = data.categories;
  } else if (data?.data && Array.isArray(data.data)) {
    categoriesData = data.data;
  }

  return categoriesData;
};

// ============================================================
// 3. GET UPLOAD URL (auth required)
// ============================================================

export const getUploadUrl = async (
  fileName: string,
  fileType: string,
): Promise<UploadUrlResponse> => {
  return apiRequest<UploadUrlResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_UPLOAD_URL}`,
    {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType }),
    },
  );
};

// ============================================================
// 4. CREATE PRODUCT (auth required)
// ============================================================

export const createProduct = async (
  payload: any,
): Promise<CreateProductResponse> => {
  return apiRequest<CreateProductResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.CREATE_PRODUCT}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};