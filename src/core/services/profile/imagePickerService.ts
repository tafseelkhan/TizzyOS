// services/profile/imagePickerService.ts
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {
  checkAndRequestCameraPermissions,
  checkAndRequestGalleryPermissions,
} from '../../utils/profile/permissionUtils';

export const imagePickerService = {
  async pickFromCamera(): Promise<{
    uri: string;
    base64: string | null;
    type: string | null;
  } | null> {
    try {
      const hasPermission = await checkAndRequestCameraPermissions();

      if (!hasPermission) {
        return null;
      }

      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
        saveToPhotos: true,
        cameraType: 'back',
      });

      return this.processImageResult(result);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to open camera');
    }
  },

  async pickFromGallery(): Promise<{
    uri: string;
    base64: string | null;
    type: string | null;
  } | null> {
    try {
      const hasPermission = await checkAndRequestGalleryPermissions();

      if (!hasPermission) {
        return null;
      }

      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
        selectionLimit: 1,
      });

      // File size check (max 5MB)
      if (result.assets && result.assets[0] && result.assets[0].fileSize) {
        const fileSizeMB = result.assets[0].fileSize / (1024 * 1024);
        if (fileSizeMB > 5) {
          throw new Error(
            'Image Too Large - Please select an image smaller than 5MB',
          );
        }
      }

      return this.processImageResult(result);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to open gallery');
    }
  },

  processImageResult(result: ImagePickerResponse) {
    if (result.didCancel) {
      return null;
    }

    if (result.errorCode) {
      throw new Error(result.errorMessage || 'Failed to pick image');
    }

    if (result.assets && result.assets[0]) {
      const asset = result.assets[0];
      const imageUri = asset.uri || '';
      const base64Data = asset.base64 || '';

      if (base64Data) {
        const imageData = `data:${
          asset.type || 'image/jpeg'
        };base64,${base64Data}`;
        return {
          uri: imageUri,
          base64: imageData,
          type: asset.type || null,
        };
      } else if (imageUri) {
        return {
          uri: imageUri,
          base64: null,
          type: asset.type || null,
        };
      }
    }

    return null;
  },
};
