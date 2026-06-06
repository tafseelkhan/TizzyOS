import Config from 'react-native-config';

import { API_ENDPOINTS } from '../../connections/snippet/apiEndpoints';

import { getToken } from '../../connections/token/tokenSlice';

import { fetchHandler } from '../../../core/utils/handler/fetchHandler';
import { API_BASE_URL } from '../../connections/snippet/apiBaseUrl';

export const profileApi = {
  /**
    @param {Object} formData - The data to update the profile with.
    @returns {Promise} - A promise that resolves to the response of the update profile request.
   */
  // ================================
  // GET PROFILE
  // ================================

  async getProfile() {
    const token = await getToken();

    return await fetchHandler(`${API_BASE_URL}${API_ENDPOINTS.GET_PROFILE}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  /**
    @param {Object} formData - The data to update the profile with.
    @returns {Promise} - A promise that resolves to the response of the update profile request.
   */
  // ================================
  // UPDATE PROFILE
  // ================================

  async updateProfile(formData: any) {
    const token = await getToken();

    return await fetchHandler(
      `${API_BASE_URL}${API_ENDPOINTS.UPDATE_PROFILE}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json', // ✅ YEH BOHT IMPORTANT HAI!
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      },
    );
  },

  // ================================
  // PROFILE IMAGE DELETE API
  // ================================

  async deleteProfileImage() {
    const token = await getToken();

    if (!token) {
      return { success: false, message: 'No authentication token found' };
    }

    return await fetchHandler(
      `${API_BASE_URL}${API_ENDPOINTS.DELETE_PROFILE_IMAGE}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
  },
};
