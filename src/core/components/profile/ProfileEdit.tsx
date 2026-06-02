// screens/EditProfileScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StatusBar,
  SafeAreaView,
  Dimensions,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FA5Icon from 'react-native-vector-icons/FontAwesome5';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/theme/ThemeContext';
import ImagePicker from 'react-native-image-crop-picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FormData {
  name: string;
  email: string;
  phone: string;
  image?: string;
}

const getImageUrl = (image?: string): string => {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  return '';
};

export default function EditProfileScreen() {
  const { isDark, resolvedTheme } = useTheme();
  const navigation = useNavigation();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    image: '',
  });
  const [previewImage, setPreviewImage] = useState('');
  const [hasImage, setHasImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Dynamic colors based on theme
  const backgroundColor = isDark ? '#1E293B' : '#f9fafb';
  const textColor = isDark ? '#F1F5F9' : '#1f2937';
  const subtitleColor = isDark ? '#94A3B8' : '#6b7280';
  const cardBackground = isDark ? '#1E293B' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const inputBackground = isDark ? '#374151' : '#f9fafb';
  const inputBorder = isDark ? '#475569' : '#d1d5db';

  // Fixed gradient colors
  const gradientColors: string[] = isDark
    ? ['#1E293B', '#1E293B', '#1E293B']
    : ['#f9fafb', '#f9fafb', '#f9fafb'];

  const buttonGradient: string[] = isDark
    ? ['#7C3AED', '#6D28D9']
    : ['#8b5cf6', '#3b82f6'];

  const infoCardBackground = isDark ? '#374151' : '#f3f4f6';
  const infoCardBorder = isDark ? '#475569' : '#e5e7eb';
  const errorBackground = isDark ? '#7f1d1d' : '#fef2f2';
  const errorBorder = isDark ? '#991b1b' : '#fecaca';
  const successBackground = isDark ? '#14532d' : '#f0fdf4';
  const successBorder = isDark ? '#166534' : '#bbf7d0';

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const phoneInputRef = useRef<TextInput>(null);

  // Permission checking for Android
  const checkAndroidPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const cameraPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        const storagePermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        );

        // Get Android version safely
        const androidVersion =
          typeof Platform.Version === 'string'
            ? parseInt(Platform.Version, 10)
            : Platform.Version;

        if (androidVersion >= 33) {
          // Android 13+ uses READ_MEDIA_IMAGES
          const mediaPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          );
          if (!cameraPermission || !mediaPermission) {
            return await requestAndroidPermissions();
          }
        } else {
          if (!cameraPermission || !storagePermission) {
            return await requestAndroidPermissions();
          }
        }
        return true;
      } catch (err) {
        console.warn('Permission check error:', err);
        return false;
      }
    }
    return true;
  };

  const requestAndroidPermissions = async (): Promise<boolean> => {
    try {
      const permissionsToRequest = [PermissionsAndroid.PERMISSIONS.CAMERA];

      // Get Android version safely
      const androidVersion =
        typeof Platform.Version === 'string'
          ? parseInt(Platform.Version, 10)
          : Platform.Version;

      if (androidVersion >= 33) {
        permissionsToRequest.push(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        );
      } else {
        permissionsToRequest.push(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        );
      }

      const granted = await PermissionsAndroid.requestMultiple(
        permissionsToRequest,
      );

      const allGranted = Object.values(granted).every(
        status => status === PermissionsAndroid.RESULTS.GRANTED,
      );

      if (!allGranted) {
        Alert.alert(
          'Permission Required',
          'Camera and storage permissions are needed to upload photos. Please grant them in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Permission request error:', err);
      return false;
    }
  };

  // Show image source selection dialog
  const showImageSourceDialog = () => {
    Alert.alert(
      'Select Image Source',
      'Choose where to get your profile photo from',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Camera',
          onPress: () => handleCameraClick(),
          style: 'default',
        },
        {
          text: 'Gallery',
          onPress: () => handleGalleryClick(),
          style: 'default',
        },
      ],
      { cancelable: true },
    );
  };

  // Handle camera click with permission check
  const handleCameraClick = async () => {
    try {
      // Check permissions
      const hasPermission = await checkAndroidPermissions();
      if (!hasPermission) return;

      // Launch camera
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
        saveToPhotos: true,
      });

      if (result.didCancel) {
        console.log('User cancelled camera');
        return;
      }

      if (result.errorCode) {
        console.error('Camera error:', result.errorMessage);
        Alert.alert('Error', 'Failed to open camera. Please try again.');
        return;
      }

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const imageUri = asset.uri || '';
        const base64Data = asset.base64 || '';

        if (base64Data) {
          const imageData = `data:${
            asset.type || 'image/jpeg'
          };base64,${base64Data}`;
          setFormData(prev => ({ ...prev, image: imageData }));
          setPreviewImage(imageUri);
          setHasImage(true);
        } else if (imageUri) {
          setFormData(prev => ({ ...prev, image: imageUri }));
          setPreviewImage(imageUri);
          setHasImage(true);
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  // Handle gallery click with permission check
  const handleGalleryClick = async () => {
    try {
      // Check permissions
      const hasPermission = await checkAndroidPermissions();
      if (!hasPermission) return;

      // Launch image library
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
        selectionLimit: 1,
      });

      if (result.didCancel) {
        console.log('User cancelled gallery');
        return;
      }

      if (result.errorCode) {
        console.error('Gallery error:', result.errorMessage);
        Alert.alert('Error', 'Failed to open gallery. Please try again.');
        return;
      }

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const imageUri = asset.uri || '';
        const base64Data = asset.base64 || '';

        // Check file size (max 5MB)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert(
            'Image Too Large',
            'Please select an image smaller than 5MB for faster upload.',
            [{ text: 'OK' }],
          );
          return;
        }

        if (base64Data) {
          const imageData = `data:${
            asset.type || 'image/jpeg'
          };base64,${base64Data}`;
          setFormData(prev => ({ ...prev, image: imageData }));
          setPreviewImage(imageUri);
          setHasImage(true);
        } else if (imageUri) {
          setFormData(prev => ({ ...prev, image: imageUri }));
          setPreviewImage(imageUri);
          setHasImage(true);
        }
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery. Please try again.');
    }
  };

  // Image picker function with permission handling
  const handleImageChange = async () => {
    showImageSourceDialog();
  };

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        setLoading(true);

        const token = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('userData');

        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user._id);
        }

        if (!token) {
          setError('Please login again');
          setLoading(false);
          return;
        }

        const res = await fetch('http://172.20.10.12:5000/api/profile/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        if (res.ok) {
          let hasValidImage = false;
          let imageUrl = '';

          if (
            data.image &&
            data.image !== '' &&
            data.image !== 'null' &&
            data.image !== 'undefined'
          ) {
            imageUrl = getImageUrl(data.image);
            hasValidImage = imageUrl.startsWith('http') && imageUrl.length > 10;
          }

          setFormData({
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            image: hasValidImage ? imageUrl : '',
          });

          setHasImage(hasValidImage);
          setPreviewImage(hasValidImage ? imageUrl : '');
        } else {
          setError(data.msg || 'Failed to load profile');
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndProfile();
  }, []);

  const handlePhoneFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  // Function to convert image path to base64 if needed
  const getImageBase64 = async (imagePath: string): Promise<string | null> => {
    try {
      if (imagePath.startsWith('data:image')) {
        return imagePath;
      }
      if (imagePath.startsWith('http')) {
        return null;
      }
      return imagePath;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return null;
    }
  };

  // Optimized submit function
  const handleSubmit = async () => {
    // Keyboard close
    Keyboard.dismiss();

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setError('Please login again');
        setIsSubmitting(false);
        return;
      }

      const startTime = Date.now();

      const bodyToSend: any = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
      };

      // Only send image if it's new and not a URL
      if (formData.image && !formData.image.startsWith('http')) {
        // Check if it's a base64 string or a file path
        if (formData.image.startsWith('data:image')) {
          const base64Size = (formData.image.length * 3) / (4 * 1024 * 1024); // Approx MB
          console.log(`📤 Image size: ${base64Size.toFixed(2)} MB`);

          if (base64Size > 3) {
            setError('Image is too large. Please select a smaller image.');
            setIsSubmitting(false);
            return;
          }

          bodyToSend.image = formData.image;
          bodyToSend.fileName = `profile_${Date.now()}.jpg`;
        } else {
          // If it's a file path, we need to convert to base64
          console.log('⚠️ Image path detected, skipping upload for now');
        }
      }

      console.log('🚀 Sending update request...');

      const res = await fetch('http://172.20.10.12:5000/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyToSend),
      });

      const data = await res.json();
      const endTime = Date.now();

      console.log(
        `⏱️ Request completed in: ${(endTime - startTime) / 1000} seconds`,
      );

      if (res.ok) {
        setSuccess('Profile updated successfully! 🎉');

        // Update local storage
        if (data.user) {
          await AsyncStorage.setItem('userData', JSON.stringify(data.user));
          if (data.user.image) {
            await AsyncStorage.setItem('profileImage', data.user.image);
          }
        }

        // Auto navigate back after success
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        setError(data.message || 'Update failed. Please try again.');
      }
    } catch (err) {
      console.error('🔥 Update error:', err);
      setError('Network error - Please check your connection');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading component
  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <LinearGradient
            colors={gradientColors}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.loadingCard,
              {
                backgroundColor: cardBackground,
                borderColor: cardBorder,
              },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={isDark ? '#A78BFA' : '#8b5cf6'}
            />
            <Text style={[styles.loadingText, { color: subtitleColor }]}>
              Loading your profile...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <StatusBar
        backgroundColor={isDark ? '#1E293B' : '#f9fafb'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <LinearGradient
          colors={gradientColors}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Space for Camera */}
          <View style={styles.cameraSpace} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Icon
                name="arrow-back"
                size={24}
                color={isDark ? '#94A3B8' : '#6b7280'}
              />
              <Text style={[styles.backText, { color: subtitleColor }]}></Text>
            </TouchableOpacity>

            <View style={styles.titleContainer}>
              <Text style={[styles.headerTitle, { color: textColor }]}>
                Edit Profile
              </Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          {/* Success/Error Messages */}
          {error ? (
            <View
              style={[
                styles.errorMessage,
                {
                  backgroundColor: errorBackground,
                  borderColor: errorBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.errorText,
                  { color: isDark ? '#FCA5A5' : '#dc2626' },
                ]}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {success ? (
            <View
              style={[
                styles.successMessage,
                {
                  backgroundColor: successBackground,
                  borderColor: successBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.successText,
                  { color: isDark ? '#86EFAC' : '#16a34a' },
                ]}
              >
                {success}
              </Text>
            </View>
          ) : null}

          {/* Main Form Card */}
          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: cardBackground,
                borderColor: cardBorder,
              },
            ]}
          >
            {/* Profile Image Upload */}
            <View style={styles.imageSection}>
              <TouchableOpacity
                style={styles.imageContainer}
                onPress={handleImageChange}
              >
                <View
                  style={[
                    styles.imageWrapper,
                    {
                      borderColor: isDark ? '#4b5563' : '#d1d5db',
                      backgroundColor: isDark ? '#374151' : '#e5e7eb',
                    },
                  ]}
                >
                  {/* Conditional rendering: Show user image if available, otherwise show Lottie animation */}
                  {hasImage && previewImage && previewImage !== '' ? (
                    <Image
                      source={{ uri: previewImage }}
                      style={styles.profileImage}
                      resizeMode="cover"
                      onError={() => {
                        console.log('Image load error, falling back to Lottie');
                        setHasImage(false);
                        setPreviewImage('');
                      }}
                    />
                  ) : (
                    <LottieView
                      source={require('../../../core/components/animations/lotties/Login icon (1).json')}
                      style={styles.profileImage}
                      autoPlay={true}
                      loop={true}
                      resizeMode="cover"
                    />
                  )}
                </View>

                {/* Camera Icon Overlay */}
                <View style={styles.cameraButton}>
                  <Icon name="camera-alt" size={20} color="white" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleImageChange}>
                <Text
                  style={[styles.changePhotoText, { color: subtitleColor }]}
                >
                  Tap to change profile photo
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Name Field */}
              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <View
                    style={[
                      styles.labelIcon,
                      {
                        backgroundColor: isDark ? '#7C3AED' : '#8b5cf6',
                      },
                    ]}
                  >
                    <FA5Icon name="user" size={14} color="white" />
                  </View>
                  <Text style={[styles.label, { color: textColor }]}>
                    Full Name
                  </Text>
                </View>
                <TextInput
                  value={formData.name}
                  onChangeText={text =>
                    setFormData({ ...formData, name: text })
                  }
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBackground,
                      borderColor: inputBorder,
                      color: textColor,
                    },
                  ]}
                  placeholder="Enter your full name"
                  placeholderTextColor={subtitleColor}
                  returnKeyType="next"
                />
              </View>

              {/* Email Field */}
              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <View
                    style={[
                      styles.labelIcon,
                      {
                        backgroundColor: isDark ? '#DC2626' : '#ef4444',
                      },
                    ]}
                  >
                    <Icon name="email" size={14} color="white" />
                  </View>
                  <Text style={[styles.label, { color: textColor }]}>
                    Email Address
                  </Text>
                </View>
                <TextInput
                  value={formData.email}
                  onChangeText={text =>
                    setFormData({ ...formData, email: text })
                  }
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBackground,
                      borderColor: inputBorder,
                      color: textColor,
                    },
                  ]}
                  placeholder="Enter your email address"
                  placeholderTextColor={subtitleColor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>

              {/* Phone Field */}
              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <View
                    style={[
                      styles.labelIcon,
                      {
                        backgroundColor: isDark ? '#059669' : '#10b981',
                      },
                    ]}
                  >
                    <FA5Icon name="phone" size={12} color="white" />
                  </View>
                  <Text style={[styles.label, { color: textColor }]}>
                    Phone Number
                  </Text>
                </View>
                <TextInput
                  ref={phoneInputRef}
                  value={formData.phone}
                  onChangeText={text =>
                    setFormData({ ...formData, phone: text })
                  }
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBackground,
                      borderColor: inputBorder,
                      color: textColor,
                    },
                  ]}
                  placeholder="Enter your phone number"
                  placeholderTextColor={subtitleColor}
                  keyboardType="phone-pad"
                  onFocus={handlePhoneFocus}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={[
                  styles.submitButton,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
              >
                <LinearGradient
                  colors={buttonGradient}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                {isSubmitting ? (
                  <View style={styles.submitContent}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.submitText}>Saving...</Text>
                  </View>
                ) : (
                  <View style={styles.submitContent}>
                    <Icon name="save" size={20} color="white" />
                    <Text style={styles.submitText}>Save Changes</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Additional Info */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: infoCardBackground,
                borderColor: infoCardBorder,
              },
            ]}
          >
            <Text style={[styles.infoText, { color: subtitleColor }]}>
              Your profile information helps us personalize your experience
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 10,
  },
  cameraSpace: {
    height: Platform.OS === 'ios' ? 20 : 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    marginLeft: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 30,
  },
  errorMessage: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  successMessage: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#8b5cf6',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  formContainer: {
    gap: 20,
    width: '100%',
  },
  inputGroup: {
    gap: 12,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
  },
  submitButton: {
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingCard: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
});
