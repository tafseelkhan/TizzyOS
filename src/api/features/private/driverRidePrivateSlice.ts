// src/api/v0/features/private/driverRidePrivateSlice.ts

import { TIZZYOS_API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import {
  apiRequest,
  ApiError,
} from '../../../core/utils/handler/apiClient';
import {
  Booking,
  Tracking,
  LiveTrackingData,
} from '../../../core/types/RideTypes';

// ✅ ADD: Response type for acceptRideRequest
export interface AcceptRideResponse {
  trackingId: string;
  bookingId?: string;
  quoteId?: string;
}

// ============================================================
// 🔧 HELPER — extract error message consistently
// ============================================================

const getErrMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};

// ============================================================
// 🚗 DRIVER RIDE API
// ============================================================

export const driverRideApi = {
  /**
   * Get active trip for the driver
   * GET /api/v0/ride/tracking/active?type=driver
   */
  getActiveTrip: async (): Promise<Tracking | null> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        data?: Tracking;
      }>(
        `${TIZZYOS_API_BASE_URL}/api/v0/ride/tracking/active?type=driver`,
        { method: 'GET' },
      );

      return response.success ? response.data ?? null : null;
    } catch {
      return null;
    }
  },

  /**
   * Get full trip details by booking ID
   * GET /api/v0/ride/booking/:bookingId
   */
  getTripDetails: async (bookingId: string): Promise<Booking> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
        data: Booking;
      }>(
        `${TIZZYOS_API_BASE_URL}/api/v0/ride/booking/${bookingId}`,
        { method: 'GET' },
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch trip details');
      }

      return response.data;
    } catch (error) {
      throw new Error(getErrMessage(error, 'Failed to fetch trip details'));
    }
  },

  /**
   * ✅ Get live tracking data by trackingId
   * GET /cab/ride/tracking/:bookingId/:trackingId
   */
  getLiveTracking: async (
    bookingId: string,
    trackingId: string,
    quoteId: string,
  ): Promise<LiveTrackingData> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
        data: LiveTrackingData;
      }>(
        `${TIZZYOS_API_BASE_URL}/api/v0/ride/live/tracking/connect/${bookingId}/session/${trackingId}?quoteId=${encodeURIComponent(
          quoteId,
        )}`,
        { method: 'GET' },
      );

      if (!response.success) {
        throw new Error(
          response.message || 'Failed to fetch live tracking data',
        );
      }

      return response.data;
    } catch (error) {
      throw new Error(
        getErrMessage(error, 'Failed to fetch live tracking data'),
      );
    }
  },

  /**
   * Get tracking data by trackingId (OLD - kept for backward compatibility)
   * GET /api/v0/ride/tracking/:trackingId
   */
  getTrackingByBooking: async (trackingId: string): Promise<Tracking> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
        data: Tracking;
      }>(
        `${TIZZYOS_API_BASE_URL}/api/v0/ride/tracking/${trackingId}`,
        { method: 'GET' },
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch tracking');
      }

      return response.data;
    } catch (error) {
      throw new Error(getErrMessage(error, 'Failed to fetch tracking'));
    }
  },

  /**
   * Update ride status
   * PUT /api/v0/ride/tracking/:trackingId/status
   */
  updateRideStatus: async (
    trackingId: string,
    status: string,
  ): Promise<Tracking> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
        data: Tracking;
      }>(
        `${TIZZYOS_API_BASE_URL}/api/v0/ride/tracking/${trackingId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status }),
        },
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to update status');
      }

      return response.data;
    } catch (error) {
      throw new Error(getErrMessage(error, 'Failed to update status'));
    }
  },

  /**
   * Cancel booking
   * POST /api/v0/ride/cancel/:bookingId
   */
  cancelBooking: async (bookingId: string, reason: string): Promise<void> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
      }>(
        `${TIZZYOS_API_BASE_URL}/api/v0/ride/cancel/${bookingId}`,
        {
          method: 'POST',
          body: JSON.stringify({ cancelReason: reason }),
        },
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to cancel booking');
      }
    } catch (error) {
      throw new Error(getErrMessage(error, 'Failed to cancel booking'));
    }
  },

  /**
   * Get driver booking history
   * GET /api/v0/ride/bookings/driver
   */
  getDriverBookings: async (
    page: number = 1,
    limit: number = 20,
  ): Promise<{ bookings: Booking[]; total: number }> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
        data: { bookings: Booking[]; total: number };
      }>(
        `${TIZZYOS_API_BASE_URL}/api/v0/ride/bookings/driver?page=${page}&limit=${limit}`,
        { method: 'GET' },
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch bookings');
      }

      return response.data;
    } catch (error) {
      throw new Error(getErrMessage(error, 'Failed to fetch bookings'));
    }
  },

  /**
   * Verify pickup with QR token
   * POST /api/v0/ride/qr/verify-pickup
   */
  verifyPickup: async (qrToken: string): Promise<void> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
      }>(`${TIZZYOS_API_BASE_URL}/api/v0/ride/qr/verify-pickup`, {
        method: 'POST',
        body: JSON.stringify({ token: qrToken }),
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to verify pickup');
      }
    } catch (error) {
      throw new Error(getErrMessage(error, 'Failed to verify pickup'));
    }
  },

  /**
   * Verify drop with QR token
   * POST /api/v0/ride/qr/verify-drop
   */
  verifyDrop: async (qrToken: string): Promise<void> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
      }>(`${TIZZYOS_API_BASE_URL}/api/v0/ride/qr/verify-drop`, {
        method: 'POST',
        body: JSON.stringify({ token: qrToken }),
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to verify drop');
      }
    } catch (error) {
      throw new Error(getErrMessage(error, 'Failed to verify drop'));
    }
  },

  /**
   * ✅ Accept ride request (REST fallback)
   * POST /api/v0/ride/requests/:requestId/accept
   */
  acceptRideRequest: async (requestId: string): Promise<AcceptRideResponse> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
        data?: {
          trackingId?: string;
          tracking_id?: string;
          bookingId?: string;
          booking_id?: string;
          quoteId?: string;
          quote_id?: string;
        };
      }>(
        `${TIZZYOS_API_BASE_URL}/api/v0/ride/requests/${requestId}/accept`,
        { method: 'POST' },
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to accept ride');
      }

      return {
        trackingId:
          response.data?.trackingId || response.data?.tracking_id || '',
        bookingId:
          response.data?.bookingId || response.data?.booking_id || '',
        quoteId: response.data?.quoteId || response.data?.quote_id || '',
      };
    } catch (error) {
      throw new Error(getErrMessage(error, 'Failed to accept ride'));
    }
  },

  /**
   * Reject ride request (REST fallback)
   * POST /api/v0/ride/requests/:requestId/reject
   */
  rejectRideRequest: async (requestId: string): Promise<void> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
      }>(
        `${TIZZYOS_API_BASE_URL}/api/v0/ride/requests/${requestId}/reject`,
        { method: 'POST' },
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to reject ride');
      }
    } catch (error) {
      throw new Error(getErrMessage(error, 'Failed to reject ride'));
    }
  },

  /**
   * Collect cash after drop QR verification.
   * POST /api/v0/ride/payments/:bookingId/collect-cash
   */
  collectCashPayment: async (bookingId: string): Promise<any> => {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
        data?: any;
      }>(
        `${TIZZYOS_API_BASE_URL}/api/v0/ride/payments/${bookingId}/collect-cash`,
        { method: 'POST' },
      );

      if (!response.success) {
        throw new Error(
          response.message || 'Failed to confirm cash payment',
        );
      }

      return response.data;
    } catch (error) {
      throw new Error(
        getErrMessage(error, 'Failed to confirm cash payment'),
      );
    }
  },
};