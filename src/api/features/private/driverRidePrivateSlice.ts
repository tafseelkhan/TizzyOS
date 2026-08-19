// src/api/v0/features/private/driverRidePrivateSlice.ts

import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';
import { getToken } from '../../connections/token/tokenSlice';
import { fetchHandler } from '../../../core/utils/handler/fetchHandler';
import { Booking, Tracking } from '../../../core/types/RideTypes';

export const driverRideApi = {
  /**
   * Get active trip for the driver
   * GET /api/v0/ride/tracking/active?type=driver
   */
  getActiveTrip: async (): Promise<Tracking | null> => {
    try {
      const token = await getToken();
      const response = await fetchHandler(
        `${API_BASE_URL}/api/v0/ride/tracking/active?type=driver`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response.success ? response.data : null;
    } catch {
      return null;
    }
  },

  /**
   * Get full trip details by booking ID
   * GET /api/v0/ride/booking/:bookingId
   */
  getTripDetails: async (bookingId: string): Promise<Booking> => {
    const token = await getToken();
    const response = await fetchHandler(
      `${API_BASE_URL}/api/v0/ride/booking/${bookingId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch trip details');
    }
    return response.data;
  },

  /**
   * ✅ FIX: Get tracking data by trackingId
   * GET /api/v0/ride/tracking/:trackingId
   */
  getTrackingByBooking: async (trackingId: string): Promise<Tracking> => {
    const token = await getToken();
    console.log(
      '[driverRideApi] 📡 getTrackingByBooking called with trackingId:',
      trackingId,
    );
    console.log(
      '[driverRideApi] 🔗 URL:',
      `${API_BASE_URL}/api/v0/ride/tracking/${trackingId}`,
    );

    try {
      const response = await fetchHandler(
        `${API_BASE_URL}/api/v0/ride/tracking/${trackingId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log(
        '[driverRideApi] 📦 getTrackingByBooking response:',
        JSON.stringify(response, null, 2),
      );

      if (!response.success) {
        console.error(
          '[driverRideApi] ❌ getTrackingByBooking failed:',
          response.message,
        );
        throw new Error(response.message || 'Failed to fetch tracking');
      }

      console.log('[driverRideApi] ✅ getTrackingByBooking success');
      return response.data;
    } catch (error: any) {
      console.error(
        '[driverRideApi] ❌ getTrackingByBooking error:',
        error.message,
      );
      throw error;
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
    const token = await getToken();
    const response = await fetchHandler(
      `${API_BASE_URL}/api/v0/ride/tracking/${trackingId}/status`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      },
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to update status');
    }
    return response.data;
  },

  /**
   * Cancel booking
   * POST /api/v0/ride/cancel/:bookingId
   */
  cancelBooking: async (bookingId: string, reason: string): Promise<void> => {
    const token = await getToken();
    const response = await fetchHandler(
      `${API_BASE_URL}/api/v0/ride/cancel/${bookingId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cancelReason: reason }),
      },
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to cancel booking');
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
    const token = await getToken();
    const response = await fetchHandler(
      `${API_BASE_URL}/api/v0/ride/bookings/driver?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch bookings');
    }
    return response.data;
  },

  /**
   * Verify pickup with QR token
   * POST /api/v0/ride/qr/verify-pickup
   */
  verifyPickup: async (qrToken: string): Promise<void> => {
    const token = await getToken();
    const response = await fetchHandler(
      `${API_BASE_URL}/api/v0/ride/qr/verify-pickup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: qrToken }),
      },
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to verify pickup');
    }
  },

  /**
   * Verify drop with QR token
   * POST /api/v0/ride/qr/verify-drop
   */
  verifyDrop: async (qrToken: string): Promise<void> => {
    const token = await getToken();
    const response = await fetchHandler(
      `${API_BASE_URL}/api/v0/ride/qr/verify-drop`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: qrToken }),
      },
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to verify drop');
    }
  },

  /**
   * Accept ride request (REST fallback)
   * POST /api/v0/ride/requests/:requestId/accept
   * ✅ Returns trackingId from backend
   */
  acceptRideRequest: async (
    requestId: string,
  ): Promise<{ trackingId: string }> => {
    const token = await getToken();
    const response = await fetchHandler(
      `${API_BASE_URL}/api/v0/ride/requests/${requestId}/accept`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to accept ride');
    }
    // ✅ Return trackingId from response
    return {
      trackingId: response.data?.trackingId || '',
    };
  },

  /**
   * Reject ride request (REST fallback)
   * POST /api/v0/ride/requests/:requestId/reject
   */
  rejectRideRequest: async (requestId: string): Promise<void> => {
    const token = await getToken();
    const response = await fetchHandler(
      `${API_BASE_URL}/api/v0/ride/requests/${requestId}/reject`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to reject ride');
    }
  },
};
