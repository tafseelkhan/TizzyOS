// EditProfileScreen.tsx (Final Working Version with Refresh)
import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native'; // ✅ useFocusEffect import karo
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FA5Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../../contexts/theme/ThemeContext';
import { profileService } from '../../services/profile/profileService';
import { imagePickerService } from '../../services/profile/imagePickerService';
import { profileApi } from '../../../api/features/private/profilePrivateSlice';
import { validateProfileForm } from '../../utils/profile/profileUtils';
import { showImageSourceDialog } from '../../utils/profile/permissionUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FormData {
  name: string;
  email: string;
  phone: string;
  image?: string;
}

export default function EditProfileScreen() {
  const { isDark } = useTheme();
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
  const [showImageModal, setShowImageModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const phoneInputRef = useRef<TextInput>(null);

  // Dynamic colors
  const backgroundColor = isDark ? '#1E293B' : '#f9fafb';
  const textColor = isDark ? '#F1F5F9' : '#1f2937';
  const subtitleColor = isDark ? '#94A3B8' : '#6b7280';
  const cardBackground = isDark ? '#1E293B' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const inputBackground = isDark ? '#374151' : '#f9fafb';
  const inputBorder = isDark ? '#475569' : '#d1d5db';
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
  const modalBackground = isDark ? '#1E293B' : '#ffffff';
  const modalBorder = isDark ? '#374151' : '#e5e7eb';

  // ✅ Fetch profile function - reusable
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const result = await profileService.fetchProfile();

      if (result.success && result.data) {
        setFormData({
          name: result.data.name || '',
          email: result.data.email || '',
          phone: result.data.phone || '',
          image: result.data.image || '',
        });
        setHasImage(result.data.hasImage || false);
        setPreviewImage(result.data.image || '');
      } else {
        setError(result.message || 'Failed to load profile');
      }
    } catch (error: any) {
      setError('Network error. Please try again.');
      console.error('Fetch profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Initial load
  useEffect(() => {
    fetchProfile();
  }, []);

  // ✅ Refresh when screen comes into focus (after returning from ProfileScreen)
  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      return () => {};
    }, []),
  );

  // Image picker handlers
  const handleCameraClick = async () => {
    setShowImageModal(false);
    try {
      const result = await imagePickerService.pickFromCamera();

      if (result) {
        setFormData(prev => ({ ...prev, image: result.base64 || result.uri }));
        setPreviewImage(result.uri);
        setHasImage(true);
        Alert.alert('Success', 'Photo captured successfully!');
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message ||
          'Failed to open camera. Please check camera permissions in settings.',
      );
    }
  };

  const handleGalleryClick = async () => {
    setShowImageModal(false);
    try {
      const result = await imagePickerService.pickFromGallery();

      if (result) {
        setFormData(prev => ({ ...prev, image: result.base64 || result.uri }));
        setPreviewImage(result.uri);
        setHasImage(true);
        Alert.alert('Success', 'Photo selected successfully!');
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message ||
          'Failed to open gallery. Please check storage permissions in settings.',
      );
    }
  };

  // Delete image handler
  const handleDeleteImage = async () => {
    setIsDeleting(true);
    try {
      const result = await profileApi.deleteProfileImage();

      if (result.success) {
        setFormData(prev => ({ ...prev, image: '' }));
        setPreviewImage('');
        setHasImage(false);
        setShowImageModal(false);
        Alert.alert('Success', 'Profile image deleted successfully!');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete profile image');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open image options modal
  const handleImagePress = () => {
    setShowImageModal(true);
  };

  // New image change handler (camera/gallery options)
  const handleAddNewPhoto = () => {
    showImageSourceDialog(handleCameraClick, handleGalleryClick);
  };

  const handlePhoneFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const validationErrors = validateProfileForm(formData);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await profileService.updateProfile(formData);

      if (result.success) {
        setSuccess(result.message || 'Profile updated successfully!');
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        setError(result.message || 'Failed to update profile');
      }
    } catch (error: any) {
      setError('Network error. Please try again.');
      console.error('Update profile error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
              { backgroundColor: cardBackground, borderColor: cardBorder },
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
          <View style={styles.cameraSpace} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name="arrow-back"
                size={24}
                color={isDark ? '#94A3B8' : '#6b7280'}
              />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={[styles.headerTitle, { color: textColor }]}>
                Edit Profile
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {/* Messages */}
          {error ? (
            <View
              style={[
                styles.errorMessage,
                { backgroundColor: errorBackground, borderColor: errorBorder },
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
              { backgroundColor: cardBackground, borderColor: cardBorder },
            ]}
          >
            {/* Profile Image Upload */}
            <View style={styles.imageSection}>
              <TouchableOpacity
                style={styles.imageContainer}
                onPress={handleImagePress}
                activeOpacity={0.8}
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
                  {hasImage && previewImage && previewImage !== '' ? (
                    <Image
                      source={{ uri: previewImage }}
                      style={styles.profileImage}
                      resizeMode="cover"
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
                <View style={styles.cameraButton}>
                  <Icon name="camera-alt" size={20} color="white" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleImagePress}>
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
                      { backgroundColor: isDark ? '#7C3AED' : '#8b5cf6' },
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
                      { backgroundColor: isDark ? '#DC2626' : '#ef4444' },
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
                      { backgroundColor: isDark ? '#059669' : '#10b981' },
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
                activeOpacity={0.8}
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

      {/* Image Options Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowImageModal(false)}
        >
          <View
            style={[
              styles.optionsModal,
              { backgroundColor: modalBackground, borderColor: modalBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: textColor }]}>
              Profile Photo
            </Text>

            {/* Add New Photo Option */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleAddNewPhoto}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#10b981' }]}>
                <Icon name="add-a-photo" size={22} color="white" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: textColor }]}>
                  Add New Photo
                </Text>
                <Text style={[styles.optionSubtitle, { color: subtitleColor }]}>
                  Take a photo or choose from gallery
                </Text>
              </View>
            </TouchableOpacity>

            {/* Delete Photo Option - Only show if image exists */}
            {hasImage && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={handleDeleteImage}
                disabled={isDeleting}
              >
                <View
                  style={[styles.optionIcon, { backgroundColor: '#ef4444' }]}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Icon name="delete" size={22} color="white" />
                  )}
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, { color: textColor }]}>
                    Delete Photo
                  </Text>
                  <Text
                    style={[styles.optionSubtitle, { color: subtitleColor }]}
                  >
                    Remove your profile photo
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Cancel Button */}
            <TouchableOpacity
              style={[styles.cancelButton]}
              onPress={() => setShowImageModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: '#ef4444' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    padding: 8,
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
    width: 40,
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
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsModal: {
    width: screenWidth - 48,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
