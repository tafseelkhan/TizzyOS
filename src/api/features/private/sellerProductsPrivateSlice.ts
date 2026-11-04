// src/api/features/private/sellerProductsPrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';
import { apiRequest, ApiError } from '../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

export interface ProductVariant {
  images: string[];
  video?: string;
  fields?: {
    images?: string[];
    video?: string;
    [key: string]: any;
  };
}

export interface Product {
  id?: string;
  _id?: string;
  title: string;
  price: number;
  category?: string;
  variants: ProductVariant[];
  [key: string]: any;
}

interface ProductsApiResponse {
  products?: Product[];
  data?: Product[];
  [key: string]: any;
}

export interface DeleteProductResponse {
  success?: boolean;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

// ============================================================
// 1. GET SELLER PRODUCTS
// ============================================================

export const getSellerProducts = async (): Promise<Product[]> => {
  const data = await apiRequest<ProductsApiResponse>(
    `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.GET_SELLER_PRODUCTS}`,
    { method: 'GET' },
  );

  let productsData: Product[] = [];

  if (data?.products && Array.isArray(data.products)) {
    productsData = data.products;
  } else if (data?.data && Array.isArray(data.data)) {
    productsData = data.data;
  } else if (Array.isArray(data)) {
    productsData = data as unknown as Product[];
  }

  return productsData;
};

// ============================================================
// 2. DELETE SELLER PRODUCT
// ============================================================

export const deleteSellerProduct = async (
  productId: string,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const data = await apiRequest<DeleteProductResponse>(
      `${TIZZYOS_API_BASE_URL}${API_ENDPOINTS.DELETE_SELLER_PRODUCT}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ id: productId }),
      },
    );

    return {
      success: data?.success !== false,
      message: data?.message,
    };
  } catch (error) {
    if (__DEV__) {
      console.error('❌ deleteSellerProduct error:', error);
    }

    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to delete product';

    throw new Error(message);
  }
};