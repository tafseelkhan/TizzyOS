// services/profileService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileApi } from '../../../api/features/private/profilePrivateSlice';
import { processProfileImage } from '../../utils/profile/imageUtils';

export const profileService = {
  async fetchProfile() {
    try {
      const data = await profileApi.getProfile();

      const processedImage = processProfileImage(data.image);

      return {
        success: true,
        data: {
          _id: data?._id ?? '',
          name: data?.name ?? 'User',
          email: data?.email ?? 'Not provided',
          phone: data?.phone ?? 'Not provided',
          joinDate: data?.joinDate ?? new Date().toLocaleDateString(),
          verified: data?.verified ?? false,
          image: processedImage.url,
          hasImage: processedImage.hasValidImage,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Network error occurred',
        data: null,
      };
    }
  },

  async updateProfile(profileData: any) {
    try {
      const bodyToSend: any = {
        name: profileData.name.trim(),
        email: profileData.email.trim(),
        phone: profileData.phone.trim(),
      };

      // Only send image if it's new and not a URL
      if (profileData.image && !profileData.image.startsWith('http')) {
        if (profileData.image.startsWith('data:image')) {
          const base64Size = (profileData.image.length * 3) / (4 * 1024 * 1024);

          if (base64Size > 3) {
            throw new Error(
              'Image is too large. Please select a smaller image.',
            );
          }

          bodyToSend.image = profileData.image;
          bodyToSend.fileName = `profile_${Date.now()}.jpg`;
        }
      }

      const data = await profileApi.updateProfile(bodyToSend);

      // Update local storage
      if (data.user) {
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));
        if (data.user.image) {
          await AsyncStorage.setItem('profileImage', data.user.image);
        }
      }

      return {
        success: true,
        message: 'Profile updated successfully! 🎉',
        user: data.user,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.message || 'Network error - Please check your connection',
      };
    }
  },
};
