// EditProfileScreen.tsx
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FA5Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../../contexts/theme/ThemeContext';

// ✅ Inline image picker
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
} from 'react-native-image-picker';

// ✅ APIs — ALL 6
import { me } from '../../../api/features/public/authPublicSlice';
import {
  updateBasicProfile,
  updateAppRole,
  requestRecoveryConnectUpdate,
  verifyRecoveryConnectUpdate,
  requestPhoneChangeOTP,
  verifyPhoneChangeOTP,
} from '../../../api/features/private/ProfilePrivateSlice';
import { ApiError } from '../../../core/utils/handler/apiClient';

const { width: screenWidth } = Dimensions.get('window');

type AppName = 'TIZZYGO' | 'TIZZYOS' | 'LINKEDROP';

const APP_ROLES: Record<AppName, string[]> = {
  TIZZYGO: ['USER'],
  TIZZYOS: ['SELLER', 'FWS', 'SHIPPING', 'CAB', 'RENT'],
  LINKEDROP: ['USER'],
};

const ALLOWED_THEMES = ['light', 'dark', 'system'] as const;

interface FormData {
  name: string;
  email: string;
  phone: string;
  image?: string;
  theme?: string;
  color?: string;
  dateOfBirth?: string;
  displayName?: string;
  apps?: Array<{ app: string; roles: string[] }>;
  recoveryConnect?: string;
}

// ============================================================
// 🛠️ INLINE VALIDATION
// ============================================================

const validateProfileForm = (data: { name: string }): string[] => {
  const errors: string[] = [];
  if (!data.name || !data.name.trim()) {
    errors.push('Full name is required');
  } else if (data.name.trim().length < 2) {
    errors.push('Full name must be at least 2 characters');
  }
  return errors;
};

const validatePhone = (phone: string): string[] => {
  const errors: string[] = [];
  if (!phone || !phone.trim()) {
    errors.push('Phone number is required');
  } else {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      errors.push('Enter a valid phone number with country code');
    }
  }
  return errors;
};

// ============================================================
// 🛠️ INLINE IMAGE PICKER HELPERS
// ============================================================

interface PickedImageResult {
  uri: string;
  base64: string;
}

const processImagePickerResponse = (
  response: ImagePickerResponse,
): PickedImageResult | null => {
  if (response.didCancel) return null;
  if (response.errorCode) {
    throw new Error(response.errorMessage || 'Image picker error');
  }
  const asset = response.assets?.[0];
  if (!asset || !asset.uri) return null;
  return {
    uri: asset.uri,
    base64: asset.base64 || '',
  };
};

const pickFromCamera = async (): Promise<PickedImageResult | null> => {
  const response = await launchCamera({
    mediaType: 'photo',
    includeBase64: true,
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8,
    saveToPhotos: false,
  });
  return processImagePickerResponse(response);
};

const pickFromGallery = async (): Promise<PickedImageResult | null> => {
  const response = await launchImageLibrary({
    mediaType: 'photo',
    includeBase64: true,
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8,
  });
  return processImagePickerResponse(response);
};

const showImageSourceDialog = (onCamera: () => void, onGallery: () => void) => {
  Alert.alert('Profile Photo', 'Choose how to add a photo', [
    { text: 'Camera', onPress: onCamera },
    { text: 'Gallery', onPress: onGallery },
    { text: 'Cancel', style: 'cancel' },
  ]);
};

// ============================================================
// 🧩 COMPONENT
// ============================================================

function EditProfileScreen() {
  const { isDark } = useTheme();
  const navigation = useNavigation();

  // ===== Main form state =====
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    image: '',
    theme: 'system',
    color: '',
    dateOfBirth: '',
    displayName: '',
    apps: [],
    recoveryConnect: '',
  });
  const [previewImage, setPreviewImage] = useState('');
  const [hasImage, setHasImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ===== App role state =====
  const [selectedApp, setSelectedApp] = useState<AppName>('TIZZYGO');
  const [selectedRole, setSelectedRole] = useState('USER');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // ===== Phone change modal state =====
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1);
  const [newPhone, setNewPhone] = useState('');
  const [phoneVerificationId, setPhoneVerificationId] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isPhoneLoading, setIsPhoneLoading] = useState(false);

  // ===== Recovery connect modal state =====
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [newRecoveryConnect, setNewRecoveryConnect] = useState('');
  const [recoveryVerificationId, setRecoveryVerificationId] = useState('');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);

  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  // ===== Colors =====
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

  // ============================================================
  // ✅ FETCH PROFILE
  // ============================================================
  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await me();
      if (response?.success && response?.user) {
        const user = response.user as any;
        const displayName =
          user.displayName ||
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          user.username ||
          '';

        const imageUrl =
          user.profilePhoto &&
          (user.profilePhoto.startsWith('http://') ||
            user.profilePhoto.startsWith('https://'))
            ? user.profilePhoto
            : '';

        setFormData({
          name: displayName,
          email: user.email || '',
          phone: user.phone || '',
          image: imageUrl,
          theme: user.theme || 'system',
          color: user.color || '',
          dateOfBirth: user.dateOfBirth || '',
          displayName: user.displayName || '',
          apps: user.apps || [],
          recoveryConnect: user.recoveryConnect || '',
        });
        setHasImage(!!imageUrl);
        setPreviewImage(imageUrl);

        // Init role selection from existing apps
        if (user.apps && user.apps.length > 0) {
          const firstApp = user.apps[0];
          setSelectedApp(firstApp.app as AppName);
          setSelectedRole(firstApp.roles?.[0] || 'USER');
        }
      } else {
        setError(response?.message || 'Failed to load profile');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load profile');
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      return () => {};
    }, []),
  );

  // ============================================================
  // ✅ 1. UPDATE BASIC PROFILE
  // ============================================================
  const handleSubmit = async () => {
    Keyboard.dismiss();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const validationErrors = validateProfileForm({
      name: formData.name,
    });

    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      setIsSubmitting(false);
      return;
    }

    try {
      const nameParts = formData.name.trim().split(/\s+/);
      const payload: any = {
        firstName: nameParts[0],
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
        displayName: formData.displayName || formData.name.trim(),
        theme: formData.theme,
        color: formData.color,
      };

      if (formData.dateOfBirth) {
        payload.dateOfBirth = formData.dateOfBirth;
      }

      if (formData.image && !formData.image.startsWith('http')) {
        payload.profilePhoto = formData.image;
      }

      const result = await updateBasicProfile(payload);

      if (result.success) {
        setSuccess(result.message || 'Profile updated successfully!');
        setTimeout(() => navigation.goBack(), 1500);
      } else {
        setError(result.message || 'Failed to update profile');
      }
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // ✅ 2. UPDATE APP ROLE
  // ============================================================
  const handleUpdateAppRole = async () => {
    setIsUpdatingRole(true);
    setError('');
    setSuccess('');

    try {
      const result = await updateAppRole({
        app: selectedApp,
        role: selectedRole,
      });

      if (result.success) {
        setSuccess(
          result.message ||
            `Role updated to ${selectedRole} for ${selectedApp}`,
        );
        setFormData(prev => ({ ...prev, apps: result.apps }));
      } else {
        setError(result.message || 'Failed to update role');
      }
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Network error. Please try again.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // ============================================================
  // ✅ 3. PHONE CHANGE — STEP 1 (Request OTP)
  // ============================================================
  const handleRequestPhoneChange = async () => {
    setError('');
    const errs = validatePhone(newPhone);
    if (errs.length > 0) {
      Alert.alert('Validation Error', errs[0]);
      return;
    }

    setIsPhoneLoading(true);
    try {
      const result = await requestPhoneChangeOTP(newPhone);
      if (result.success) {
        setPhoneVerificationId(result.verificationId);
        setPhoneStep(2);
        Alert.alert(
          'OTP Sent',
          `Code sent to ${result.phone}. Expires in ${Math.floor(
            result.expiresInSeconds / 60,
          )} min.`,
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Network error';
      Alert.alert('Error', msg);
    } finally {
      setIsPhoneLoading(false);
    }
  };

  // ============================================================
  // ✅ 4. PHONE CHANGE — STEP 2 (Verify OTP)
  // ============================================================
  const handleVerifyPhoneChange = async () => {
    if (!phoneOtp || phoneOtp.length !== 6) {
      Alert.alert('Error', 'Enter the 6-digit OTP');
      return;
    }

    setIsPhoneLoading(true);
    try {
      const result = await verifyPhoneChangeOTP({
        phone: newPhone,
        verificationId: phoneVerificationId,
        code: phoneOtp,
      });

      if (result.success) {
        setFormData(prev => ({
          ...prev,
          phone: result.phone,
        }));
        Alert.alert('Success', 'Phone updated successfully!');
        setShowPhoneModal(false);
        // Reset
        setPhoneStep(1);
        setNewPhone('');
        setPhoneOtp('');
        setPhoneVerificationId('');
      } else {
        Alert.alert('Error', result.message || 'Failed to verify OTP');
      }
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Network error';
      Alert.alert('Error', msg);
    } finally {
      setIsPhoneLoading(false);
    }
  };

  // ============================================================
  // ✅ 5. RECOVERY CONNECT — STEP 1 (Request OTP)
  // ============================================================
  const handleRequestRecoveryConnect = async () => {
    const errs = validatePhone(newRecoveryConnect);
    if (errs.length > 0) {
      Alert.alert('Validation Error', errs[0]);
      return;
    }

    setIsRecoveryLoading(true);
    try {
      const result = await requestRecoveryConnectUpdate(newRecoveryConnect);
      if (result.success) {
        setRecoveryVerificationId(result.verificationId);
        setRecoveryStep(2);
        Alert.alert(
          'OTP Sent',
          `Code sent to ${result.recoveryConnect}. Expires in ${Math.floor(
            result.expiresInSeconds / 60,
          )} min.`,
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Network error';
      Alert.alert('Error', msg);
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  // ============================================================
  // ✅ 6. RECOVERY CONNECT — STEP 2 (Verify OTP)
  // ============================================================
  const handleVerifyRecoveryConnect = async () => {
    if (!recoveryOtp || recoveryOtp.length !== 6) {
      Alert.alert('Error', 'Enter the 6-digit OTP');
      return;
    }

    setIsRecoveryLoading(true);
    try {
      const result = await verifyRecoveryConnectUpdate({
        verificationId: recoveryVerificationId,
        code: recoveryOtp,
      });

      if (result.success) {
        setFormData(prev => ({
          ...prev,
          recoveryConnect: result.recoveryConnect,
        }));
        Alert.alert('Success', 'Recovery connect updated successfully!');
        setShowRecoveryModal(false);
        setRecoveryStep(1);
        setNewRecoveryConnect('');
        setRecoveryOtp('');
        setRecoveryVerificationId('');
      } else {
        Alert.alert('Error', result.message || 'Failed to verify OTP');
      }
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Network error';
      Alert.alert('Error', msg);
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  // ============================================================
  // IMAGE HANDLERS
  // ============================================================
  const handleCameraClick = async () => {
    setShowImageModal(false);
    try {
      const result = await pickFromCamera();
      if (result) {
        setFormData(prev => ({
          ...prev,
          image: result.base64 || result.uri,
        }));
        setPreviewImage(result.uri);
        setHasImage(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to open camera.');
    }
  };

  const handleGalleryClick = async () => {
    setShowImageModal(false);
    try {
      const result = await pickFromGallery();
      if (result) {
        setFormData(prev => ({
          ...prev,
          image: result.base64 || result.uri,
        }));
        setPreviewImage(result.uri);
        setHasImage(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to open gallery.');
    }
  };

  const handleDeleteImage = async () => {
    setIsDeleting(true);
    try {
      const result = await updateBasicProfile({ profilePhoto: '' });
      if (result.success) {
        setFormData(prev => ({ ...prev, image: '' }));
        setPreviewImage('');
        setHasImage(false);
        setShowImageModal(false);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to delete image');
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================
  // LOADING
  // ============================================================
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
              Loading profile...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <LinearGradient
          colors={gradientColors}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: textColor }]}>
              Edit Profile
            </Text>
            <View style={{ width: 40 }} />
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

          {/* ============ BASIC PROFILE CARD ============ */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBackground, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              📝 Basic Info
            </Text>

            {/* Image */}
            <View style={styles.imageSection}>
              <TouchableOpacity
                onPress={() => setShowImageModal(true)}
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
                  {hasImage && previewImage ? (
                    <Image
                      source={{ uri: previewImage }}
                      style={styles.profileImage}
                    />
                  ) : (
                    <LottieView
                      source={require('../../../core/components/animations/lotties/Login icon (1).json')}
                      style={styles.profileImage}
                      autoPlay
                      loop
                    />
                  )}
                </View>
                <View style={styles.cameraButton}>
                  <Icon name="camera-alt" size={20} color="white" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Name */}
            <InputField
              label="Full Name"
              icon="user"
              iconColor="#7C3AED"
              value={formData.name}
              onChangeText={t => setFormData({ ...formData, name: t })}
              placeholder="Enter your full name"
              textColor={textColor}
              subtitleColor={subtitleColor}
              inputBg={inputBackground}
              inputBorder={inputBorder}
            />

            {/* Display Name */}
            <InputField
              label="Display Name (optional)"
              icon="badge"
              iconColor="#3B82F6"
              value={formData.displayName || ''}
              onChangeText={t => setFormData({ ...formData, displayName: t })}
              placeholder="How others see you"
              textColor={textColor}
              subtitleColor={subtitleColor}
              inputBg={inputBackground}
              inputBorder={inputBorder}
            />

            {/* Date of Birth */}
            <InputField
              label="Date of Birth (YYYY-MM-DD)"
              icon="cake"
              iconColor="#EC4899"
              value={formData.dateOfBirth || ''}
              onChangeText={t => setFormData({ ...formData, dateOfBirth: t })}
              placeholder="1995-06-15"
              textColor={textColor}
              subtitleColor={subtitleColor}
              inputBg={inputBackground}
              inputBorder={inputBorder}
              keyboardType="numbers-and-punctuation"
            />

            {/* Theme */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: textColor }]}>Theme</Text>
              <View style={styles.chipRow}>
                {ALLOWED_THEMES.map(theme => (
                  <TouchableOpacity
                    key={theme}
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          formData.theme === theme
                            ? '#8b5cf6'
                            : inputBackground,
                        borderColor: inputBorder,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, theme })}
                  >
                    <Text
                      style={{
                        color: formData.theme === theme ? '#fff' : textColor,
                        fontWeight: '600',
                      }}
                    >
                      {theme}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Color */}
            <InputField
              label="Accent Color (hex)"
              icon="color-lens"
              iconColor="#F59E0B"
              value={formData.color || ''}
              onChangeText={t => setFormData({ ...formData, color: t })}
              placeholder="#3B82F6"
              textColor={textColor}
              subtitleColor={subtitleColor}
              inputBg={inputBackground}
              inputBorder={inputBorder}
            />

            {/* Save button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={styles.primaryButton}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={buttonGradient}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>💾 Save Basic Info</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ============ APP ROLE ============ */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBackground, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              🎭 App Role
            </Text>
            <Text style={[styles.sectionSubtitle, { color: subtitleColor }]}>
              Choose your active role per app
            </Text>

            {/* App selector */}
            <View style={styles.chipRow}>
              {(['TIZZYGO', 'TIZZYOS', 'LINKEDROP'] as AppName[]).map(app => (
                <TouchableOpacity
                  key={app}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        selectedApp === app ? '#8b5cf6' : inputBackground,
                      borderColor: inputBorder,
                    },
                  ]}
                  onPress={() => {
                    setSelectedApp(app);
                    setSelectedRole(APP_ROLES[app][0]);
                  }}
                >
                  <Text
                    style={{
                      color: selectedApp === app ? '#fff' : textColor,
                      fontWeight: '600',
                    }}
                  >
                    {app}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Role selector */}
            <View style={styles.chipRow}>
              {APP_ROLES[selectedApp].map(role => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        selectedRole === role ? '#10b981' : inputBackground,
                      borderColor: inputBorder,
                    },
                  ]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text
                    style={{
                      color: selectedRole === role ? '#fff' : textColor,
                      fontWeight: '600',
                    }}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleUpdateAppRole}
              disabled={isUpdatingRole}
              style={[styles.secondaryButton, { borderColor: '#8b5cf6' }]}
            >
              {isUpdatingRole ? (
                <ActivityIndicator color="#8b5cf6" />
              ) : (
                <Text style={{ color: '#8b5cf6', fontWeight: '700' }}>
                  🔄 Update {selectedApp} Role
                </Text>
              )}
            </TouchableOpacity>

            {/* Show current apps */}
            {formData.apps && formData.apps.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: subtitleColor,
                    marginBottom: 4,
                  }}
                >
                  Current:
                </Text>
                {formData.apps.map(a => (
                  <Text key={a.app} style={{ fontSize: 12, color: textColor }}>
                    • {a.app}: {a.roles.join(', ')}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* ============ PHONE CHANGE ============ */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBackground, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              📱 Phone Number
            </Text>
            <Text style={[styles.sectionSubtitle, { color: subtitleColor }]}>
              Current: {formData.phone || 'Not set'}
            </Text>

            <TouchableOpacity
              onPress={() => setShowPhoneModal(true)}
              style={[styles.secondaryButton, { borderColor: '#10b981' }]}
            >
              <Text style={{ color: '#10b981', fontWeight: '700' }}>
                📲 Change Phone Number
              </Text>
            </TouchableOpacity>
          </View>

          {/* ============ RECOVERY CONNECT ============ */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBackground, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              🛟 Recovery Connect
            </Text>
            <Text style={[styles.sectionSubtitle, { color: subtitleColor }]}>
              Current: {formData.recoveryConnect || 'Not set'}
            </Text>

            <TouchableOpacity
              onPress={() => setShowRecoveryModal(true)}
              style={[styles.secondaryButton, { borderColor: '#F59E0B' }]}
            >
              <Text style={{ color: '#F59E0B', fontWeight: '700' }}>
                🛟 Update Recovery Connect
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ============================================================ */}
      {/* IMAGE MODAL */}
      {/* ============================================================ */}
      <Modal
        visible={showImageModal}
        transparent
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

            <ModalOption
              icon="add-a-photo"
              color="#10b981"
              title="Add New Photo"
              subtitle="Take a photo or choose from gallery"
              onPress={() =>
                showImageSourceDialog(handleCameraClick, handleGalleryClick)
              }
              textColor={textColor}
              subtitleColor={subtitleColor}
            />

            {hasImage && (
              <ModalOption
                icon="delete"
                color="#ef4444"
                title="Delete Photo"
                subtitle="Remove your profile photo"
                loading={isDeleting}
                onPress={handleDeleteImage}
                textColor={textColor}
                subtitleColor={subtitleColor}
              />
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowImageModal(false)}
            >
              <Text style={{ color: '#ef4444', fontWeight: '700' }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ============================================================ */}
      {/* PHONE CHANGE MODAL */}
      {/* ============================================================ */}
      <Modal
        visible={showPhoneModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isPhoneLoading) {
            setShowPhoneModal(false);
            setPhoneStep(1);
            setNewPhone('');
            setPhoneOtp('');
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.formModal,
              { backgroundColor: modalBackground, borderColor: modalBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: textColor }]}>
              {phoneStep === 1 ? '📱 Change Phone' : '🔐 Verify OTP'}
            </Text>

            {phoneStep === 1 ? (
              <>
                <Text
                  style={[styles.sectionSubtitle, { color: subtitleColor }]}
                >
                  Enter your new phone number with country code (e.g.
                  +919876543210)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBackground,
                      borderColor: inputBorder,
                      color: textColor,
                    },
                  ]}
                  value={newPhone}
                  onChangeText={setNewPhone}
                  placeholder="+919876543210"
                  placeholderTextColor={subtitleColor}
                  keyboardType="phone-pad"
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleRequestPhoneChange}
                  disabled={isPhoneLoading}
                >
                  <LinearGradient
                    colors={buttonGradient}
                    style={StyleSheet.absoluteFill}
                  />
                  {isPhoneLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text
                  style={[styles.sectionSubtitle, { color: subtitleColor }]}
                >
                  Enter the 6-digit code sent to {newPhone}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBackground,
                      borderColor: inputBorder,
                      color: textColor,
                      textAlign: 'center',
                      fontSize: 24,
                      letterSpacing: 8,
                    },
                  ]}
                  value={phoneOtp}
                  onChangeText={t =>
                    setPhoneOtp(t.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  placeholderTextColor={subtitleColor}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleVerifyPhoneChange}
                  disabled={isPhoneLoading}
                >
                  <LinearGradient
                    colors={buttonGradient}
                    style={StyleSheet.absoluteFill}
                  />
                  {isPhoneLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify OTP</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPhoneStep(1)}
                  style={styles.linkButton}
                >
                  <Text style={{ color: subtitleColor, fontSize: 13 }}>
                    ← Change phone number
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowPhoneModal(false);
                setPhoneStep(1);
                setNewPhone('');
                setPhoneOtp('');
                setPhoneVerificationId('');
              }}
            >
              <Text style={{ color: '#ef4444', fontWeight: '700' }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============================================================ */}
      {/* RECOVERY MODAL */}
      {/* ============================================================ */}
      <Modal
        visible={showRecoveryModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isRecoveryLoading) {
            setShowRecoveryModal(false);
            setRecoveryStep(1);
            setNewRecoveryConnect('');
            setRecoveryOtp('');
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.formModal,
              { backgroundColor: modalBackground, borderColor: modalBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: textColor }]}>
              {recoveryStep === 1 ? '🛟 Recovery Connect' : '🔐 Verify OTP'}
            </Text>

            {recoveryStep === 1 ? (
              <>
                <Text
                  style={[styles.sectionSubtitle, { color: subtitleColor }]}
                >
                  Enter new recovery number with country code
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBackground,
                      borderColor: inputBorder,
                      color: textColor,
                    },
                  ]}
                  value={newRecoveryConnect}
                  onChangeText={setNewRecoveryConnect}
                  placeholder="+919876543210"
                  placeholderTextColor={subtitleColor}
                  keyboardType="phone-pad"
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleRequestRecoveryConnect}
                  disabled={isRecoveryLoading}
                >
                  <LinearGradient
                    colors={buttonGradient}
                    style={StyleSheet.absoluteFill}
                  />
                  {isRecoveryLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text
                  style={[styles.sectionSubtitle, { color: subtitleColor }]}
                >
                  Enter the 6-digit code sent to {newRecoveryConnect}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBackground,
                      borderColor: inputBorder,
                      color: textColor,
                      textAlign: 'center',
                      fontSize: 24,
                      letterSpacing: 8,
                    },
                  ]}
                  value={recoveryOtp}
                  onChangeText={t =>
                    setRecoveryOtp(t.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  placeholderTextColor={subtitleColor}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleVerifyRecoveryConnect}
                  disabled={isRecoveryLoading}
                >
                  <LinearGradient
                    colors={buttonGradient}
                    style={StyleSheet.absoluteFill}
                  />
                  {isRecoveryLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify OTP</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRecoveryStep(1)}
                  style={styles.linkButton}
                >
                  <Text style={{ color: subtitleColor, fontSize: 13 }}>
                    ← Change recovery number
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowRecoveryModal(false);
                setRecoveryStep(1);
                setNewRecoveryConnect('');
                setRecoveryOtp('');
                setRecoveryVerificationId('');
              }}
            >
              <Text style={{ color: '#ef4444', fontWeight: '700' }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// REUSABLE COMPONENTS
// ============================================================

const InputField: React.FC<{
  label: string;
  icon: string;
  iconColor: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  textColor: string;
  subtitleColor: string;
  inputBg: string;
  inputBorder: string;
  keyboardType?: any;
  editable?: boolean;
}> = ({
  label,
  icon,
  iconColor,
  value,
  onChangeText,
  placeholder,
  textColor,
  subtitleColor,
  inputBg,
  inputBorder,
  keyboardType,
  editable = true,
}) => (
  <View style={{ gap: 8, marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: iconColor,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}
      >
        <Icon name={icon as any} size={14} color="white" />
      </View>
      <Text style={{ fontSize: 14, fontWeight: '600', color: textColor }}>
        {label}
      </Text>
    </View>
    <TextInput
      style={{
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        backgroundColor: inputBg,
        borderColor: inputBorder,
        color: textColor,
      }}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={subtitleColor}
      keyboardType={keyboardType}
      editable={editable}
    />
  </View>
);

const ModalOption: React.FC<{
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  loading?: boolean;
  onPress: () => void;
  textColor: string;
  subtitleColor: string;
}> = ({
  icon,
  color,
  title,
  subtitle,
  loading,
  onPress,
  textColor,
  subtitleColor,
}) => (
  <TouchableOpacity style={styles.optionItem} onPress={onPress}>
    <View style={[styles.optionIcon, { backgroundColor: color }]}>
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <Icon name={icon as any} size={22} color="white" />
      )}
    </View>
    <View style={styles.optionTextContainer}>
      <Text style={[styles.optionTitle, { color: textColor }]}>{title}</Text>
      <Text style={[styles.optionSubtitle, { color: subtitleColor }]}>
        {subtitle}
      </Text>
    </View>
  </TouchableOpacity>
);

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  sectionCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  fieldGroup: { gap: 8, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600' },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  imageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    overflow: 'hidden',
  },
  profileImage: { width: '100%', height: '100%' },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#8b5cf6',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
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
  textInput: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  optionsModal: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  formModal: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionTextContainer: { flex: 1 },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: { fontSize: 13 },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: { height: 40 },
});

export default EditProfileScreen;
