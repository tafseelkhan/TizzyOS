// utils/profile/permissionUtils.ts
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

// Android ke liye specific permission request
export const requestCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'App needs camera permission to take profile photos',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    return false;
  }
};

// Gallery permission request
export const requestGalleryPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const androidVersion = Platform.Version as number;

    if (androidVersion >= 33) {
      // Android 13+ ke liye READ_MEDIA_IMAGES
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        {
          title: 'Photos Permission',
          message: 'App needs permission to access your photos',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      // Android 12 and below ke liye READ_EXTERNAL_STORAGE
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs storage permission to access your photos',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (err) {
    return false;
  }
};

// Check aur request permissions for camera
export const checkAndRequestCameraPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const cameraPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );

    if (!cameraPermission) {
      return await requestCameraPermission();
    }
    return true;
  } catch (err) {
    return false;
  }
};

// Check aur request permissions for gallery
export const checkAndRequestGalleryPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const androidVersion = Platform.Version as number;

    if (androidVersion >= 33) {
      const mediaPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      );
      if (!mediaPermission) {
        return await requestGalleryPermission();
      }
    } else {
      const storagePermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
      if (!storagePermission) {
        return await requestGalleryPermission();
      }
    }
    return true;
  } catch (err) {
    return false;
  }
};

// Dialog show karne ka function
export const showImageSourceDialog = (
  onCamera: () => void,
  onGallery: () => void,
) => {
  Alert.alert(
    'Select Image Source',
    'Choose where to get your profile photo from',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Camera',
        onPress: onCamera,
        style: 'default',
      },
      {
        text: 'Gallery',
        onPress: onGallery,
        style: 'default',
      },
    ],
    { cancelable: true },
  );
};