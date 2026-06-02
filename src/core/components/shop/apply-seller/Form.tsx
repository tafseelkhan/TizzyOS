import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  Easing,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  PermissionsAndroid,
} from 'react-native';
import { useTheme } from '../../../contexts/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from '@react-native-documents/picker';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker'; // Add this import
import {
  sellerApplicationAPI,
  SellerApplicationData,
} from '../../../services/SellerApplication';
import { checkSellerFormStatus } from '../../../services/SellerStatusService';

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;

// Types
interface FormData {
  fullName: string;
  email: string;
  phone: string;
  address: {
    full: string;
    pincode: string;
    city: string;
    state: string;
    country: string;
  };
  aadhaarFront: any;
  aadhaarBack: any;
  panFront: any;
  panBack: any;
  selfieWithDoc: any;
  shopName: string;
  gstNumber: string;
  category: {
    mainCategory: string;
    subcategories: string[];
  };
  gstCertificate: any;
}

interface Category {
  name: string;
  icon: string;
  subcategories: string[];
}

interface SellerApplicationScreenProps {
  onApplicationSubmitSuccess?: (applicationData: {
    applicationId?: string;
    uniqOsId?: string;
  }) => void;
}

const CATEGORIES: Category[] = [
  {
    name: 'Electronics',
    icon: 'cellphone',
    subcategories: [
      'Mobile Phones',
      'Laptops',
      'Cameras',
      'Audio Devices',
      'Smart Watches',
      'Tablets',
      'Gaming Consoles',
      'Accessories',
    ],
  },
  {
    name: 'Fashion',
    icon: 'tshirt-crew',
    subcategories: [
      'Men',
      'Women',
      'Kids',
      'Footwear',
      'Accessories',
      'Jewelry',
      'Watches',
      'Bags',
    ],
  },
  {
    name: 'Home & Kitchen',
    icon: 'home',
    subcategories: [
      'Furniture',
      'Appliances',
      'Cookware',
      'Home Decor',
      'Gardening',
      'Lighting',
      'Bedding',
      'Storage',
    ],
  },
  {
    name: 'Beauty',
    icon: 'lipstick',
    subcategories: [
      'Skincare',
      'Makeup',
      'Haircare',
      'Fragrances',
      'Personal Care',
      'Wellness',
      'Bath & Body',
      'Men Grooming',
    ],
  },
  {
    name: 'Sports',
    icon: 'basketball',
    subcategories: [
      'Fitness',
      'Outdoor',
      'Cycling',
      'Team Sports',
      'Yoga',
      'Water Sports',
      'Winter Sports',
      'Camping',
    ],
  },
  {
    name: 'Books',
    icon: 'book',
    subcategories: [
      'Fiction',
      'Non-Fiction',
      'Academic',
      'Children',
      'Self-Help',
      'Business',
      'Cookbooks',
      'Travel',
    ],
  },
  {
    name: 'Toys',
    icon: 'gamepad-variant',
    subcategories: [
      'Action Figures',
      'Dolls',
      'Educational',
      'Board Games',
      'Outdoor',
      'Puzzles',
      'Building Sets',
      'Arts & Crafts',
    ],
  },
  {
    name: 'Automotive',
    icon: 'car',
    subcategories: [
      'Car Care',
      'Accessories',
      'Tools',
      'Interior',
      'Exterior',
      'Electronics',
      'Oils & Fluids',
      'Motorcycle',
    ],
  },
  {
    name: 'Groceries',
    icon: 'food-apple',
    subcategories: [
      'Fresh Produce',
      'Dairy',
      'Beverages',
      'Snacks',
      'Frozen Foods',
      'Organic',
      'International',
      'Health Foods',
    ],
  },
  {
    name: 'Health',
    icon: 'medical-bag',
    subcategories: [
      'Supplements',
      'Medical Equipment',
      'Personal Care',
      'Fitness Trackers',
      'Elderly Care',
      'First Aid',
      'Wellness',
    ],
  },
  {
    name: 'Jewelry',
    icon: 'diamond-stone',
    subcategories: [
      'Rings',
      'Necklaces',
      'Earrings',
      'Bracelets',
      'Watches',
      'Fine Jewelry',
      'Fashion Jewelry',
      'Custom',
    ],
  },
  {
    name: 'Pets',
    icon: 'paw',
    subcategories: [
      'Food',
      'Toys',
      'Grooming',
      'Health Care',
      'Accessories',
      'Beds',
      'Aquarium',
      'Birds',
    ],
  },
];

const steps = [
  { title: 'Personal', icon: 'person' },
  { title: 'Address', icon: 'location-on' },
  { title: 'Documents', icon: 'folder' },
  { title: 'Selfie', icon: 'camera' },
  { title: 'Business', icon: 'business' },
  { title: 'Biz Docs', icon: 'description' },
  { title: 'Review', icon: 'visibility' },
  { title: 'Submit', icon: 'send' },
];

export const SellerApplicationScreen: React.FC<
  SellerApplicationScreenProps
> = ({ onApplicationSubmitSuccess }) => {
  const navigation = useNavigation();
  const { isDark, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    address: {
      full: '',
      pincode: '',
      city: '',
      state: '',
      country: '',
    },
    aadhaarFront: null,
    aadhaarBack: null,
    panFront: null,
    panBack: null,
    selfieWithDoc: null,
    shopName: '',
    gstNumber: '',
    category: {
      mainCategory: '',
      subcategories: [],
    },
    gstCertificate: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(
    [],
  );
  const [customSubcategory, setCustomSubcategory] = useState('');

  // Camera states
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<Camera>(null);
  const devices = useCameraDevices();
  const device =
    cameraType === 'front'
      ? devices?.find(d => d.position === 'front')
      : devices?.find(d => d.position === 'back');

  const [checkingExistingApplication, setCheckingExistingApplication] =
    useState(true);
  const [hasExistingApplication, setHasExistingApplication] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({});

  const shakeAnimations = useRef({
    fullName: new Animated.Value(0),
    email: new Animated.Value(0),
    phone: new Animated.Value(0),
    addressFull: new Animated.Value(0),
    pincode: new Animated.Value(0),
    city: new Animated.Value(0),
    state: new Animated.Value(0),
    country: new Animated.Value(0),
    shopName: new Animated.Value(0),
    aadhaarFront: new Animated.Value(0),
    aadhaarBack: new Animated.Value(0),
    panFront: new Animated.Value(0),
    panBack: new Animated.Value(0),
    selfieWithDoc: new Animated.Value(0),
    businessDocument: new Animated.Value(0),
    gstCertificate: new Animated.Value(0),
  }).current;

  useFocusEffect(
    React.useCallback(() => {
      const checkExistingApplication = async () => {
        try {
          setCheckingExistingApplication(true);
          const result = await checkSellerFormStatus();

          if (result.success && result.canSubmit === false) {
            setHasExistingApplication(true);

            setTimeout(() => {
              navigation.navigate('SellerStatus' as never);
            }, 100);
          } else {
            setHasExistingApplication(false);
          }
        } catch (error: any) {
          setHasExistingApplication(false);
        } finally {
          setCheckingExistingApplication(false);
        }
      };

      checkExistingApplication();
    }, [navigation]),
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
      paddingTop: insets.top,
    },
    contentContainer: {
      flex: 1,
      padding: isMobile ? 16 : 32,
    },
    stepContainer: {
      marginBottom: 20,
    },
    stepText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#E2E8F0' : '#1E293B',
      marginBottom: 20,
    },
    input: {
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#CBD5E1',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      color: isDark ? '#FFFFFF' : '#000000',
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      fontSize: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    inputError: {
      borderColor: '#EF4444',
      backgroundColor: isDark ? '#2A1A1A' : '#FEF2F2',
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    button: {
      backgroundColor: '#3B82F6',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginVertical: 8,
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: '#3B82F6',
    },
    secondaryButtonText: {
      color: '#3B82F6',
    },
    disabledButton: {
      backgroundColor: '#9CA3AF',
      shadowOpacity: 0,
    },
    card: {
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E2E8F0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    categoryCard: {
      alignItems: 'center',
      padding: 20,
      margin: 8,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: isDark ? '#334155' : '#F1F5F9',
      minWidth: 100,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    selectedCategory: {
      borderColor: '#3B82F6',
      backgroundColor: isDark
        ? 'rgba(59, 130, 246, 0.2)'
        : 'rgba(59, 130, 246, 0.1)',
      transform: [{ scale: 1.05 }],
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#374151' : '#E2E8F0',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      margin: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    selectedChip: {
      backgroundColor: '#3B82F6',
    },
    chipText: {
      color: isDark ? '#E2E8F0' : '#374151',
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 4,
    },
    selectedChipText: {
      color: '#FFFFFF',
    },
    uploadCard: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: isDark ? '#4B5563' : '#CBD5E1',
      borderRadius: 16,
      padding: 30,
      alignItems: 'center',
      marginVertical: 8,
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
    },
    activeUploadCard: {
      borderColor: '#10B981',
      backgroundColor: isDark
        ? 'rgba(16, 185, 129, 0.1)'
        : 'rgba(16, 185, 129, 0.05)',
    },
    errorText: {
      color: '#EF4444',
      fontSize: 14,
      marginBottom: 16,
      fontWeight: '500',
    },
    successText: {
      color: '#10B981',
      fontSize: 14,
      marginBottom: 16,
      fontWeight: '500',
    },
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: isMobile ? 16 : 32,
      paddingVertical: 20,
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#E2E8F0',
    },
    step: {
      alignItems: 'center',
      flex: 1,
    },
    stepIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? '#374151' : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    activeStepIconContainer: {
      backgroundColor: '#3B82F6',
      transform: [{ scale: 1.1 }],
    },
    completedStepIconContainer: {
      backgroundColor: '#10B981',
    },
    stepLabel: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#64748B',
      textAlign: 'center',
      fontWeight: '500',
    },
    activeStepLabel: {
      color: '#3B82F6',
      fontWeight: '700',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? '#E2E8F0' : '#1E293B',
      marginBottom: 16,
      marginTop: 8,
    },
    uploadText: {
      color: isDark ? '#E2E8F0' : '#374151',
      marginTop: 12,
      fontSize: 16,
      fontWeight: '500',
      textAlign: 'center',
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      paddingHorizontal: isMobile ? 16 : 32,
    },
    progressBar: {
      flex: 1,
      height: 6,
      backgroundColor: isDark ? '#374151' : '#E2E8F0',
      borderRadius: 3,
      marginHorizontal: 8,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#3B82F6',
      borderRadius: 3,
    },
    subcategoryContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginVertical: 8,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
    },
    loadingText: {
      color: '#FFFFFF',
      marginTop: 16,
      fontSize: 16,
      fontWeight: '600',
    },
    cameraModal: {
      flex: 1,
      backgroundColor: 'black',
    },
    cameraContainer: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingBottom: 40,
    },
    camera: {
      flex: 1,
    },
    cameraControls: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    cameraButton: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cameraActionButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#3B82F6',
      justifyContent: 'center',
      alignItems: 'center',
    },
    flipButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    cameraPreview: {
      width: 100,
      height: 150,
      borderRadius: 10,
      position: 'absolute',
      top: 100,
      right: 20,
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
  });

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'This app needs access to your camera to take selfie',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const status = await request(PERMISSIONS.IOS.CAMERA);
      return status === RESULTS.GRANTED;
    }
  };

  const requestGalleryPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        // ✅ Android version check (VERY IMPORTANT)
        const permission =
          Platform.Version >= 33
            ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES // Android 13+
            : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE; // Android <=12

        const granted = await PermissionsAndroid.request(permission, {
          title: 'Gallery Permission',
          message: 'This app needs access to your gallery to select images',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        });

        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        // ✅ iOS permission
        const status = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);

        return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
      }
    } catch (error) {
      console.error('Gallery permission error:', error);
      return false;
    }
  };

  const pickImage = async (field: keyof FormData) => {
    try {
      const hasPermission = await requestGalleryPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission required',
          'Sorry, we need gallery permissions to make this work!',
        );
        return;
      }

      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });

      if (!result.didCancel && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setFormData(prev => ({
          ...prev,
          [field]: {
            uri: asset.uri,
            name: `image_${Date.now()}.jpg`,
            type: asset.type || 'image/jpeg',
            size: asset.fileSize || 0,
          },
        }));
      }
    } catch (error) {
      console.error('Image Picker Error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Camera Functions
  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission required',
        'Camera permission is required to take selfie',
      );
      return;
    }
    setCameraModalVisible(true);
  };

  const closeCamera = () => {
    setCameraModalVisible(false);
  };

  const flipCamera = () => {
    setCameraType(current => (current === 'back' ? 'front' : 'back'));
  };

  const takeSelfie = async () => {
    if (cameraRef.current && device) {
      try {
        // ✅ Simply call takePhoto without any options
        const photo = await cameraRef.current.takePhoto();

        if (photo && photo.path) {
          const selfieFile = {
            uri: `file://${photo.path}`,
            name: `selfie_${Date.now()}.jpg`,
            type: 'image/jpeg',
            size: photo.width ? photo.width * photo.height * 4 : 0,
          };

          setFormData(prev => ({
            ...prev,
            selfieWithDoc: selfieFile,
          }));

          closeCamera();
          Alert.alert('Success', 'Selfie captured successfully!');
        } else {
          Alert.alert('Error', 'Failed to capture selfie. Photo is empty.');
        }
      } catch (error) {
        console.error('Camera error:', error);
        Alert.alert('Error', 'Failed to capture selfie. Please try again.');
      }
    } else {
      Alert.alert('Error', 'Camera not ready. Please try again.');
    }
  };

  const handleSelfieUpload = () => {
    Alert.alert('Upload Selfie', 'Choose how you want to upload your selfie', [
      {
        text: 'Take Photo',
        onPress: openCamera,
      },
      {
        text: 'Choose from Gallery',
        onPress: () => pickImage('selfieWithDoc'),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handleInputFocus = (inputName: string) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  const shakeField = (fieldName: keyof typeof shakeAnimations) => {
    const shakeAnimation = shakeAnimations[fieldName];

    shakeAnimation.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const validateStep = (step: number): boolean => {
    let isValid = true;
    setError('');

    switch (step) {
      case 0:
        if (!formData.fullName.trim()) {
          setError('Please enter your full name');
          shakeField('fullName');
          isValid = false;
        } else if (!formData.email.trim()) {
          setError('Please enter your email address');
          shakeField('email');
          isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          setError('Please enter a valid email address');
          shakeField('email');
          isValid = false;
        } else if (!formData.phone.trim()) {
          setError('Please enter your phone number');
          shakeField('phone');
          isValid = false;
        } else if (!/^\d{10}$/.test(formData.phone)) {
          setError('Please enter a valid 10-digit phone number');
          shakeField('phone');
          isValid = false;
        }
        break;

      case 1:
        if (!formData.address.full.trim()) {
          setError('Please enter your full address');
          shakeField('addressFull');
          isValid = false;
        } else if (!formData.address.pincode.trim()) {
          setError('Please enter pincode');
          shakeField('pincode');
          isValid = false;
        } else if (!/^\d{6}$/.test(formData.address.pincode)) {
          setError('Please enter a valid 6-digit pincode');
          shakeField('pincode');
          isValid = false;
        } else if (!formData.address.city.trim()) {
          setError('Please enter your city');
          shakeField('city');
          isValid = false;
        } else if (!formData.address.state.trim()) {
          setError('Please enter your state');
          shakeField('state');
          isValid = false;
        } else if (!formData.address.country.trim()) {
          setError('Please enter your country');
          shakeField('country');
          isValid = false;
        }
        break;

      case 2:
        if (!formData.aadhaarFront && !formData.panFront) {
          setError('Please upload at least one document (Aadhaar or PAN)');
          shakeField('aadhaarFront');
          shakeField('panFront');
          isValid = false;
        } else if (formData.aadhaarFront && !formData.aadhaarBack) {
          setError('Please upload both front and back of Aadhaar card');
          shakeField('aadhaarBack');
          isValid = false;
        } else if (formData.panFront && !formData.panBack) {
          setError('Please upload both front and back of PAN card');
          shakeField('panBack');
          isValid = false;
        }
        break;

      case 3:
        if (!formData.selfieWithDoc) {
          setError('Please upload a selfie with your document');
          shakeField('selfieWithDoc');
          isValid = false;
        }
        break;

      case 4:
        if (!formData.shopName.trim()) {
          setError('Please enter your shop name');
          shakeField('shopName');
          isValid = false;
        }
        break;

      default:
        break;
    }

    return isValid;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
      setError('');
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError('');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddressChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value,
      },
    }));
  };

  const pickDocument = async (field: keyof FormData) => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.images, DocumentPicker.types.pdf],
      });

      if (result && result.length > 0) {
        setFormData(prev => ({
          ...prev,
          [field]: result[0],
        }));
      }
    } catch (error) {
      // ✅ FIXED: Check if error is a cancellation
      // The new version doesn't have isCancel method, we need to check error code or message
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as { code?: string; message?: string };
        if (
          err.code === 'DOCUMENT_PICKER_CANCELED' ||
          err.message?.includes('cancel')
        ) {
          // User cancelled - do nothing
          console.log('User cancelled document picker');
          return;
        }
      }
      // For other errors, show alert
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
  };

  const handleSubcategoryToggle = (subcategory: string) => {
    setSelectedSubcategories(prev =>
      prev.includes(subcategory)
        ? prev.filter(item => item !== subcategory)
        : [...prev, subcategory],
    );
  };

  const handleAddCustomSubcategory = () => {
    if (
      customSubcategory.trim() &&
      !selectedSubcategories.includes(customSubcategory)
    ) {
      setSelectedSubcategories(prev => [...prev, customSubcategory]);
      setCustomSubcategory('');
    }
  };

  const handleCategorySubmit = () => {
    if (selectedCategory && selectedSubcategories.length > 0) {
      setFormData(prev => ({
        ...prev,
        category: {
          mainCategory: selectedCategory.name,
          subcategories: selectedSubcategories,
        },
      }));
      handleNext();
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      address: {
        full: '',
        pincode: '',
        city: '',
        state: '',
        country: '',
      },
      aadhaarFront: null,
      aadhaarBack: null,
      panFront: null,
      panBack: null,
      selfieWithDoc: null,
      shopName: '',
      gstNumber: '',
      category: {
        mainCategory: '',
        subcategories: [],
      },
      gstCertificate: null,
    });
    setActiveStep(0);
    setSelectedCategory(null);
    setSelectedSubcategories([]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const applicationData: SellerApplicationData = {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        fullAddress: formData.address.full,
        city: formData.address.city,
        state: formData.address.state,
        country: formData.address.country,
        pincode: formData.address.pincode,
        shopName: formData.shopName,
        gstNumber: formData.gstNumber,
        category: formData.category.mainCategory,
        subcategories: formData.category.subcategories,
        aadhaarFront: formData.aadhaarFront,
        aadhaarBack: formData.aadhaarBack,
        panFront: formData.panFront,
        panBack: formData.panBack,
        selfieWithDoc: formData.selfieWithDoc,
        gstCertificate: formData.gstCertificate,
      };

      const result = await sellerApplicationAPI.submitApplication(
        applicationData,
      );

      if (result.success) {
        setSuccess(true);

        Alert.alert(
          'Application Submitted! 🎉',
          'Your seller application has been submitted successfully! We will review it and get back to you within 2-3 business days.',
          [
            {
              text: 'View Status',
              onPress: () => {
                navigation.navigate('SellerStatus' as never);
              },
            },
          ],
        );

        if (
          onApplicationSubmitSuccess &&
          typeof onApplicationSubmitSuccess === 'function'
        ) {
          onApplicationSubmitSuccess({
            applicationId: result.applicationId || `APP-${Date.now()}`,
          });
        }
      } else {
        setError(
          result.message || 'Failed to submit application. Please try again.',
        );
      }
    } catch (err: any) {
      setError(
        'Failed to submit application. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const renderLoadingOverlay = () => {
    if (!checkingExistingApplication) return null;

    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>
          Checking existing applications...
        </Text>
      </View>
    );
  };

  const renderCameraModal = () => (
    <Modal
      visible={cameraModalVisible}
      animationType="slide"
      statusBarTranslucent
    >
      <View style={styles.cameraModal}>
        <TouchableOpacity style={styles.closeButton} onPress={closeCamera}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {device ? (
          <View style={styles.cameraContainer}>
            <Camera
              style={styles.camera}
              device={device}
              isActive={cameraModalVisible}
              ref={cameraRef}
              photo={true}
            />

            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.flipButton} onPress={flipCamera}>
                <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraActionButton}
                onPress={takeSelfie}
              >
                <Ionicons name="camera" size={30} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.flipButton} />
            </View>
          </View>
        ) : (
          <View
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, marginBottom: 20 }}>
              Camera not available
            </Text>
            <TouchableOpacity style={styles.button} onPress={closeCamera}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );

  const renderStepContent = () => {
    if (checkingExistingApplication) {
      return (
        <View style={[styles.card, { alignItems: 'center', padding: 40 }]}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text
            style={[styles.stepText, { textAlign: 'center', marginTop: 20 }]}
          >
            Checking for existing applications...
          </Text>
        </View>
      );
    }

    switch (activeStep) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepText}>Personal Information</Text>

            <Animated.View
              style={{ transform: [{ translateX: shakeAnimations.fullName }] }}
            >
              <TextInput
                style={[
                  styles.input,
                  !formData.fullName.trim() &&
                    error.includes('name') &&
                    styles.inputError,
                ]}
                placeholder="Full Name"
                placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                value={formData.fullName}
                onChangeText={text => handleInputChange('fullName', text)}
                onFocus={() => handleInputFocus('fullName')}
                ref={ref => {
                  if (ref) inputRefs.current.fullName = ref;
                }}
              />
            </Animated.View>

            <Animated.View
              style={{ transform: [{ translateX: shakeAnimations.email }] }}
            >
              <TextInput
                style={[
                  styles.input,
                  (!formData.email.trim() ||
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) &&
                    error.includes('email') &&
                    styles.inputError,
                ]}
                placeholder="Email Address"
                placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                value={formData.email}
                onChangeText={text => handleInputChange('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => handleInputFocus('email')}
                ref={ref => {
                  if (ref) inputRefs.current.email = ref;
                }}
              />
            </Animated.View>

            <Animated.View
              style={{ transform: [{ translateX: shakeAnimations.phone }] }}
            >
              <TextInput
                style={[
                  styles.input,
                  (!formData.phone.trim() ||
                    !/^\d{10}$/.test(formData.phone)) &&
                    error.includes('phone') &&
                    styles.inputError,
                ]}
                placeholder="Phone Number"
                placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                value={formData.phone}
                onChangeText={text => handleInputChange('phone', text)}
                keyboardType="phone-pad"
                maxLength={10}
                onFocus={() => handleInputFocus('phone')}
                ref={ref => {
                  if (ref) inputRefs.current.phone = ref;
                }}
              />
            </Animated.View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepText}>Address Information</Text>

            <Animated.View
              style={{
                transform: [{ translateX: shakeAnimations.addressFull }],
              }}
            >
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  !formData.address.full.trim() &&
                    error.includes('address') &&
                    styles.inputError,
                ]}
                placeholder="Full Address"
                placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                value={formData.address.full}
                onChangeText={text => handleAddressChange('full', text)}
                multiline
                onFocus={() => handleInputFocus('addressFull')}
                ref={ref => {
                  if (ref) inputRefs.current.addressFull = ref;
                }}
              />
            </Animated.View>

            <Animated.View
              style={{ transform: [{ translateX: shakeAnimations.pincode }] }}
            >
              <TextInput
                style={[
                  styles.input,
                  (!formData.address.pincode.trim() ||
                    !/^\d{6}$/.test(formData.address.pincode)) &&
                    error.includes('pincode') &&
                    styles.inputError,
                ]}
                placeholder="Pincode"
                placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                value={formData.address.pincode}
                onChangeText={text => handleAddressChange('pincode', text)}
                keyboardType="number-pad"
                maxLength={6}
                onFocus={() => handleInputFocus('pincode')}
                ref={ref => {
                  if (ref) inputRefs.current.pincode = ref;
                }}
              />
            </Animated.View>

            <View style={{ flexDirection: isMobile ? 'column' : 'row' }}>
              <View
                style={{
                  flex: 1,
                  marginRight: isMobile ? 0 : 8,
                  marginBottom: isMobile ? 16 : 0,
                }}
              >
                <Animated.View
                  style={{ transform: [{ translateX: shakeAnimations.city }] }}
                >
                  <TextInput
                    style={[
                      styles.input,
                      !formData.address.city.trim() &&
                        error.includes('city') &&
                        styles.inputError,
                    ]}
                    placeholder="City"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    value={formData.address.city}
                    onChangeText={text => handleAddressChange('city', text)}
                    onFocus={() => handleInputFocus('city')}
                    ref={ref => {
                      if (ref) inputRefs.current.city = ref;
                    }}
                  />
                </Animated.View>
              </View>
              <View style={{ flex: 1, marginLeft: isMobile ? 0 : 8 }}>
                <Animated.View
                  style={{ transform: [{ translateX: shakeAnimations.state }] }}
                >
                  <TextInput
                    style={[
                      styles.input,
                      !formData.address.state.trim() &&
                        error.includes('state') &&
                        styles.inputError,
                    ]}
                    placeholder="State"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    value={formData.address.state}
                    onChangeText={text => handleAddressChange('state', text)}
                    onFocus={() => handleInputFocus('state')}
                    ref={ref => {
                      if (ref) inputRefs.current.state = ref;
                    }}
                  />
                </Animated.View>
              </View>
            </View>

            <Animated.View
              style={{ transform: [{ translateX: shakeAnimations.country }] }}
            >
              <TextInput
                style={[
                  styles.input,
                  !formData.address.country.trim() &&
                    error.includes('country') &&
                    styles.inputError,
                ]}
                placeholder="Country"
                placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                value={formData.address.country}
                onChangeText={text => handleAddressChange('country', text)}
                onFocus={() => handleInputFocus('country')}
                ref={ref => {
                  if (ref) inputRefs.current.country = ref;
                }}
              />
            </Animated.View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepText}>Document Upload</Text>

            <Text style={styles.sectionTitle}>Aadhaar Card</Text>

            <Animated.View
              style={{
                transform: [{ translateX: shakeAnimations.aadhaarFront }],
              }}
            >
              <TouchableOpacity
                style={[
                  styles.uploadCard,
                  formData.aadhaarFront && styles.activeUploadCard,
                ]}
                onPress={() => pickImage('aadhaarFront')}
              >
                <MaterialIcons
                  name="cloud-upload"
                  size={40}
                  color={
                    formData.aadhaarFront
                      ? '#10B981'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B'
                  }
                />
                <Text style={styles.uploadText}>
                  {formData.aadhaarFront
                    ? 'Front Uploaded ✓'
                    : 'Upload Aadhaar Front'}
                </Text>
                {formData.aadhaarFront && (
                  <Text
                    style={{ color: '#10B981', marginTop: 4, fontSize: 12 }}
                  >
                    {formData.aadhaarFront.name || 'Image selected'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={{
                transform: [{ translateX: shakeAnimations.aadhaarBack }],
              }}
            >
              <TouchableOpacity
                style={[
                  styles.uploadCard,
                  formData.aadhaarBack && styles.activeUploadCard,
                  !formData.aadhaarFront && { opacity: 0.5 },
                ]}
                onPress={() =>
                  formData.aadhaarFront && pickImage('aadhaarBack')
                }
                disabled={!formData.aadhaarFront}
              >
                <MaterialIcons
                  name="cloud-upload"
                  size={40}
                  color={
                    formData.aadhaarBack
                      ? '#10B981'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B'
                  }
                />
                <Text style={styles.uploadText}>
                  {formData.aadhaarBack
                    ? 'Back Uploaded ✓'
                    : 'Upload Aadhaar Back'}
                </Text>
                {formData.aadhaarBack && (
                  <Text
                    style={{ color: '#10B981', marginTop: 4, fontSize: 12 }}
                  >
                    {formData.aadhaarBack.name || 'Image selected'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              PAN Card
            </Text>

            <Animated.View
              style={{ transform: [{ translateX: shakeAnimations.panFront }] }}
            >
              <TouchableOpacity
                style={[
                  styles.uploadCard,
                  formData.panFront && styles.activeUploadCard,
                ]}
                onPress={() => pickImage('panFront')}
              >
                <MaterialIcons
                  name="cloud-upload"
                  size={40}
                  color={
                    formData.panFront
                      ? '#10B981'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B'
                  }
                />
                <Text style={styles.uploadText}>
                  {formData.panFront ? 'Front Uploaded ✓' : 'Upload PAN Front'}
                </Text>
                {formData.panFront && (
                  <Text
                    style={{ color: '#10B981', marginTop: 4, fontSize: 12 }}
                  >
                    {formData.panFront.name || 'Image selected'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={{ transform: [{ translateX: shakeAnimations.panBack }] }}
            >
              <TouchableOpacity
                style={[
                  styles.uploadCard,
                  formData.panBack && styles.activeUploadCard,
                  !formData.panFront && { opacity: 0.5 },
                ]}
                onPress={() => formData.panFront && pickImage('panBack')}
                disabled={!formData.panFront}
              >
                <MaterialIcons
                  name="cloud-upload"
                  size={40}
                  color={
                    formData.panBack
                      ? '#10B981'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B'
                  }
                />
                <Text style={styles.uploadText}>
                  {formData.panBack ? 'Back Uploaded ✓' : 'Upload PAN Back'}
                </Text>
                {formData.panBack && (
                  <Text
                    style={{ color: '#10B981', marginTop: 4, fontSize: 12 }}
                  >
                    {formData.panBack.name || 'Image selected'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepText}>Selfie Verification</Text>
            <Animated.View
              style={{
                transform: [{ translateX: shakeAnimations.selfieWithDoc }],
              }}
            >
              <TouchableOpacity
                style={[
                  styles.uploadCard,
                  formData.selfieWithDoc && styles.activeUploadCard,
                ]}
                onPress={handleSelfieUpload}
              >
                <MaterialIcons
                  name="camera-alt"
                  size={40}
                  color={
                    formData.selfieWithDoc
                      ? '#10B981'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B'
                  }
                />
                <Text style={styles.uploadText}>
                  {formData.selfieWithDoc
                    ? 'Selfie Uploaded ✓'
                    : 'Upload Selfie'}
                </Text>
                <Text
                  style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  Take a selfie with your document using camera or choose from
                  gallery
                </Text>
                {formData.selfieWithDoc && (
                  <Text
                    style={{ color: '#10B981', marginTop: 4, fontSize: 12 }}
                  >
                    {formData.selfieWithDoc.name || 'Selfie selected'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepText}>Business Information</Text>

            <Animated.View
              style={{ transform: [{ translateX: shakeAnimations.shopName }] }}
            >
              <TextInput
                style={[
                  styles.input,
                  !formData.shopName.trim() &&
                    error.includes('shop') &&
                    styles.inputError,
                ]}
                placeholder="Shop/Business Name"
                placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                value={formData.shopName}
                onChangeText={text => handleInputChange('shopName', text)}
                onFocus={() => handleInputFocus('shopName')}
                ref={ref => {
                  if (ref) inputRefs.current.shopName = ref;
                }}
              />
            </Animated.View>

            <TextInput
              style={styles.input}
              placeholder="GST Number (Optional)"
              placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
              value={formData.gstNumber}
              onChangeText={text => handleInputChange('gstNumber', text)}
              onFocus={() => handleInputFocus('gstNumber')}
              ref={ref => {
                if (ref) inputRefs.current.gstNumber = ref;
              }}
            />

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              Select Category
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: 8 }}
            >
              <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
                {CATEGORIES.map(category => (
                  <TouchableOpacity
                    key={category.name}
                    style={[
                      styles.categoryCard,
                      selectedCategory?.name === category.name &&
                        styles.selectedCategory,
                    ]}
                    onPress={() => handleCategorySelect(category)}
                  >
                    <MaterialCommunityIcons
                      name={category.icon as any}
                      size={32}
                      color={
                        selectedCategory?.name === category.name
                          ? '#3B82F6'
                          : isDark
                          ? '#94A3B8'
                          : '#64748B'
                      }
                    />
                    <Text
                      style={{
                        color:
                          selectedCategory?.name === category.name
                            ? '#3B82F6'
                            : isDark
                            ? '#E2E8F0'
                            : '#374151',
                        marginTop: 8,
                        textAlign: 'center',
                        fontWeight: '600',
                        fontSize: 12,
                      }}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {selectedCategory && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                  Select Subcategories for {selectedCategory.name}
                </Text>
                <Text
                  style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    marginBottom: 12,
                    fontSize: 14,
                  }}
                >
                  ✅ You can select multiple subcategories - Tap to
                  select/deselect
                </Text>

                <View style={styles.subcategoryContainer}>
                  {selectedCategory.subcategories.map(subcategory => (
                    <TouchableOpacity
                      key={subcategory}
                      style={[
                        styles.chip,
                        selectedSubcategories.includes(subcategory) &&
                          styles.selectedChip,
                      ]}
                      onPress={() => handleSubcategoryToggle(subcategory)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedSubcategories.includes(subcategory) &&
                            styles.selectedChipText,
                        ]}
                      >
                        {subcategory}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    marginTop: 16,
                    alignItems: 'center',
                  }}
                >
                  <TextInput
                    style={[
                      styles.input,
                      { flex: 1, marginRight: 12, marginBottom: 0 },
                    ]}
                    placeholder="Add Custom Subcategory"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    value={customSubcategory}
                    onChangeText={setCustomSubcategory}
                    onFocus={() => handleInputFocus('customSubcategory')}
                    ref={ref => {
                      if (ref) inputRefs.current.customSubcategory = ref;
                    }}
                  />
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { paddingHorizontal: 20, minWidth: 80 },
                    ]}
                    onPress={handleAddCustomSubcategory}
                    disabled={!customSubcategory.trim()}
                  >
                    <Text style={styles.buttonText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {selectedSubcategories.length > 0 && (
                  <View style={styles.card}>
                    <Text
                      style={{
                        color: isDark ? '#E2E8F0' : '#374151',
                        marginBottom: 12,
                        fontWeight: '600',
                        fontSize: 16,
                      }}
                    >
                      ✅ Selected Subcategories ({selectedSubcategories.length}
                      ):
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {selectedSubcategories.map(subcat => (
                        <View key={subcat} style={[styles.chip, { margin: 4 }]}>
                          <Text
                            style={[styles.chipText, { fontWeight: '500' }]}
                          >
                            {subcat}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleSubcategoryToggle(subcat)}
                            style={{ marginLeft: 4 }}
                          >
                            <Ionicons
                              name="close"
                              size={16}
                              color={isDark ? '#E2E8F0' : '#374151'}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepText}>Business Documents</Text>

            <Animated.View
              style={{
                transform: [{ translateX: shakeAnimations.gstCertificate }],
              }}
            >
              <TouchableOpacity
                style={[
                  styles.uploadCard,
                  formData.gstCertificate && styles.activeUploadCard,
                ]}
                onPress={() => pickDocument('gstCertificate')}
              >
                <MaterialIcons
                  name="receipt-long"
                  size={40}
                  color={
                    formData.gstCertificate
                      ? '#10B981'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B'
                  }
                />
                <Text style={styles.uploadText}>
                  {formData.gstCertificate
                    ? 'GST Certificate Uploaded ✓'
                    : 'Upload GST Certificate'}
                </Text>
                <Text
                  style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  Upload GST certificate (optional)
                </Text>
                {formData.gstCertificate && (
                  <Text
                    style={{ color: '#10B981', marginTop: 4, fontSize: 12 }}
                  >
                    {formData.gstCertificate.name || 'GST Certificate selected'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepText}>Review Information</Text>

            <View style={styles.card}>
              <Text
                style={{
                  color: isDark ? '#E2E8F0' : '#374151',
                  fontWeight: 'bold',
                  fontSize: 18,
                  marginBottom: 16,
                }}
              >
                Personal Information
              </Text>
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    fontSize: 14,
                  }}
                >
                  Name
                </Text>
                <Text
                  style={{
                    color: isDark ? '#E2E8F0' : '#374151',
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                >
                  {formData.fullName || 'Not provided'}
                </Text>
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    fontSize: 14,
                  }}
                >
                  Email
                </Text>
                <Text
                  style={{
                    color: isDark ? '#E2E8F0' : '#374151',
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                >
                  {formData.email || 'Not provided'}
                </Text>
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    fontSize: 14,
                  }}
                >
                  Phone
                </Text>
                <Text
                  style={{
                    color: isDark ? '#E2E8F0' : '#374151',
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                >
                  {formData.phone || 'Not provided'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text
                style={{
                  color: isDark ? '#E2E8F0' : '#374151',
                  fontWeight: 'bold',
                  fontSize: 18,
                  marginBottom: 16,
                }}
              >
                Business Information
              </Text>
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    fontSize: 14,
                  }}
                >
                  Shop Name
                </Text>
                <Text
                  style={{
                    color: isDark ? '#E2E8F0' : '#374151',
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                >
                  {formData.shopName || 'Not provided'}
                </Text>
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    fontSize: 14,
                  }}
                >
                  GST Number
                </Text>
                <Text
                  style={{
                    color: isDark ? '#E2E8F0' : '#374151',
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                >
                  {formData.gstNumber || 'Not provided'}
                </Text>
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    fontSize: 14,
                  }}
                >
                  Category
                </Text>
                <Text
                  style={{
                    color: isDark ? '#E2E8F0' : '#374151',
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                >
                  {formData.category.mainCategory || 'Not selected'}
                </Text>
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    fontSize: 14,
                  }}
                >
                  Subcategories
                </Text>
                <Text
                  style={{
                    color: isDark ? '#E2E8F0' : '#374151',
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                >
                  {formData.category.subcategories.length > 0
                    ? formData.category.subcategories.join(', ')
                    : 'Not selected'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text
                style={{
                  color: isDark ? '#E2E8F0' : '#374151',
                  fontWeight: 'bold',
                  fontSize: 18,
                  marginBottom: 16,
                }}
              >
                Document Status
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                }}
              >
                <Text
                  style={{
                    color: isDark ? '#E2E8F0' : '#374151',
                    marginBottom: 8,
                  }}
                >
                  Aadhaar:{' '}
                  {formData.aadhaarFront && formData.aadhaarBack
                    ? '✓ Complete'
                    : '✗ Incomplete'}
                </Text>
                <Text
                  style={{
                    color: isDark ? '#E2E8F0' : '#374151',
                    marginBottom: 8,
                  }}
                >
                  PAN:{' '}
                  {formData.panFront && formData.panBack
                    ? '✓ Complete'
                    : '✗ Incomplete'}
                </Text>
                <Text
                  style={{
                    color: isDark ? '#E2E8F0' : '#374151',
                    marginBottom: 8,
                  }}
                >
                  Selfie: {formData.selfieWithDoc ? '✓ Uploaded' : '✗ Missing'}
                </Text>
                <Text style={{ color: isDark ? '#E2E8F0' : '#374151' }}>
                  GST Certificate:{' '}
                  {formData.gstCertificate ? '✓ Uploaded' : '✗ Not Provided'}
                </Text>
              </View>
            </View>
          </View>
        );

      case 7:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepText}>Submit Application</Text>
            <View style={styles.card}>
              <MaterialIcons
                name="check-circle"
                size={60}
                color="#10B981"
                style={{ alignSelf: 'center', marginBottom: 20 }}
              />
              <Text
                style={{
                  color: isDark ? '#E2E8F0' : '#374151',
                  fontSize: 18,
                  textAlign: 'center',
                  marginBottom: 16,
                  fontWeight: '600',
                }}
              >
                Ready to Submit!
              </Text>
              <Text
                style={{
                  color: isDark ? '#94A3B8' : '#64748B',
                  textAlign: 'center',
                  marginBottom: 24,
                  lineHeight: 20,
                }}
              >
                Please review all your information before submitting. Once
                submitted, your application will be processed within 2-3
                business days.
              </Text>

              <TouchableOpacity
                style={[styles.button, loading && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <Text style={styles.buttonText}>Submitting...</Text>
                ) : (
                  <Text style={styles.buttonText}>Submit Application</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return <Text>Unknown step</Text>;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Camera Modal */}
      {renderCameraModal()}

      {/* Loading Overlay */}
      {renderLoadingOverlay()}

      {/* Horizontal Stepper */}
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <TouchableOpacity
              style={[
                styles.stepIconContainer,
                index < activeStep && styles.completedStepIconContainer,
                index === activeStep && styles.activeStepIconContainer,
              ]}
              onPress={() => index <= activeStep && setActiveStep(index)}
            >
              {index < activeStep ? (
                <MaterialIcons name="check" size={20} color="#FFFFFF" />
              ) : (
                <MaterialIcons
                  name={step.icon as any}
                  size={20}
                  color={
                    index === activeStep
                      ? '#FFFFFF'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B'
                  }
                />
              )}
            </TouchableOpacity>
            <Text
              style={[
                styles.stepLabel,
                index === activeStep && styles.activeStepLabel,
              ]}
            >
              {step.title}
            </Text>
          </View>
        ))}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text
          style={{
            color: isDark ? '#E2E8F0' : '#374151',
            fontSize: 14,
            fontWeight: '500',
            minWidth: 40,
          }}
        >
          {activeStep + 1}/{steps.length}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((activeStep + 1) / steps.length) * 100}%` },
            ]}
          />
        </View>
        <Text
          style={{
            color: isDark ? '#94A3B8' : '#64748B',
            fontSize: 14,
            minWidth: 60,
          }}
        >
          {Math.round(((activeStep + 1) / steps.length) * 100)}%
        </Text>
      </View>

      <ScrollView
        style={styles.contentContainer}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View
            style={[
              styles.card,
              {
                borderColor: '#EF4444',
                backgroundColor: isDark ? '#2A1A1A' : '#FEF2F2',
              },
            ]}
          >
            <Text style={styles.errorText}>
              <MaterialIcons name="error-outline" size={16} color="#EF4444" />{' '}
              {error}
            </Text>
          </View>
        ) : null}

        {success ? (
          <View
            style={[
              styles.card,
              {
                borderColor: '#10B981',
                backgroundColor: isDark ? '#1A2A1A' : '#F0FDF4',
              },
            ]}
          >
            <Text style={styles.successText}>
              <MaterialIcons name="check-circle" size={16} color="#10B981" />{' '}
              Application submitted successfully!
            </Text>
          </View>
        ) : null}

        {renderStepContent()}

        {/* Navigation Buttons */}
        {!hasExistingApplication && !checkingExistingApplication && (
          <View
            style={{
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              marginTop: 32,
              marginBottom: 20,
            }}
          >
            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                {
                  flex: isMobile ? 1 : 0.48,
                  opacity: activeStep === 0 ? 0.5 : 1,
                },
              ]}
              onPress={handleBack}
              disabled={activeStep === 0}
            >
              <Text style={styles.secondaryButtonText}>
                <MaterialIcons name="arrow-back" size={16} color="#3B82F6" />{' '}
                Back
              </Text>
            </TouchableOpacity>

            {activeStep < steps.length - 1 ? (
              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    flex: isMobile ? 1 : 0.48,
                    opacity:
                      activeStep === 4 &&
                      (!selectedCategory || selectedSubcategories.length === 0)
                        ? 0.5
                        : 1,
                  },
                ]}
                onPress={activeStep === 4 ? handleCategorySubmit : handleNext}
                disabled={
                  activeStep === 4 &&
                  (!selectedCategory || selectedSubcategories.length === 0)
                }
              >
                <Text style={styles.buttonText}>
                  Next{' '}
                  <MaterialIcons
                    name="arrow-forward"
                    size={16}
                    color="#FFFFFF"
                  />
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SellerApplicationScreen;
