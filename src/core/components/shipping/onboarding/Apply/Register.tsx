import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  FlatList,
  ScrollView,
  Modal,
  Alert,
  Switch,
  PermissionsAndroid,
  AppState,
  AppStateStatus,
  LogBox,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Fontisto from 'react-native-vector-icons/Fontisto';
import FWSOnboardingScreen from '../FWSOnboardingScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import DeviceInfo from 'react-native-device-info';
import { vehicleOptions } from './vehicleCategory';
import GetLocation from 'react-native-get-location';
import LocationService, {
  LocationWithMetadata,
} from '../../../../utils/shippings/LocationService';

const { width } = Dimensions.get('window');
LogBox.ignoreLogs(['new NativeEventEmitter']);

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export type RootStackParamList = {
  RiderRegistration: undefined;
  RegistrationSuccess: { shippingId: string };
  Login: undefined;
  Home: undefined;
};

type RiderRegistrationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RiderRegistration'
>;

type VehicleCategory = 'Car' | 'Bike' | 'Scooter' | 'Auto' | 'Tempo';
type IdentityType = 'Aadhaar' | 'VoterID' | 'Passport' | 'PAN';
type ShippingType = 'TRUCK' | 'RIDER';

const API_BASE_URL = 'http://10.207.117.121:5000';

const getLocationOnce = (): Promise<{ lat: number; lng: number }> =>
  new Promise((res, rej) => {
    console.log('📍📱 [GET_LOCATION_ONCE] Getting single location...');
    GetLocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 15000,
    })
      .then(loc => {
        console.log('📍✅ [GET_LOCATION_ONCE] Location obtained:', {
          lat: loc.latitude,
          lng: loc.longitude,
        });
        res({ lat: loc.latitude, lng: loc.longitude });
      })
      .catch(err => {
        console.log('📍❌ [GET_LOCATION_ONCE] Error:', err);
        rej(err);
      });
  });

function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): T {
  const timer = useRef<any>(null);
  return useCallback(
    (...args: any[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay],
  ) as T;
}

export async function requestLocationPermission(): Promise<boolean> {
  console.log('🔐📱 [REQUEST_LOCATION_PERMISSION] Called from export');
  return await LocationService.requestPermissions();
}

async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs storage to upload images',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }
  return true;
}

// ============================================================
// FULL SCREEN LOADER COMPONENT
// ============================================================
const FullScreenLoader: React.FC<{ visible: boolean; message?: string }> = ({
  visible,
  message = 'Submitting your application...',
}) => {
  if (!visible) return null;

  return (
    <View style={styles.fullScreenLoader}>
      <View style={styles.loaderCard}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loaderTitle}>Please Wait</Text>
        <Text style={styles.loaderMessage}>{message}</Text>
        <View style={styles.loaderDots}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
    </View>
  );
};

// ============================================================
// UI COMPONENTS - PURE BLUE THEME
// ============================================================

const FormCard: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <View style={styles.formCard}>
    <View style={styles.formCardHeader}>
      <Icon name={icon} size={22} color="#2563EB" />
      <Text style={styles.formCardTitle}>{title}</Text>
    </View>
    <View style={styles.formCardContent}>{children}</View>
  </View>
);

const InputField: React.FC<{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  icon: string;
  required?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
}> = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  required = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  maxLength,
}) => (
  <View style={styles.inputFieldContainer}>
    <View style={styles.inputLabelRow}>
      <Text style={styles.inputLabelText}>{label}</Text>
      {required && <Text style={styles.requiredStar}>*</Text>}
    </View>
    <View style={styles.inputFieldWrapper}>
      <Icon
        name={icon}
        size={20}
        color="#2563EB"
        style={styles.inputFieldIcon}
      />
      <TextInput
        style={styles.inputField}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
    </View>
  </View>
);

const SelectField: React.FC<{
  label: string;
  value: string | null;
  onPress: () => void;
  placeholder: string;
  icon: string;
  required?: boolean;
}> = ({ label, value, onPress, placeholder, icon, required = false }) => (
  <View style={styles.inputFieldContainer}>
    <View style={styles.inputLabelRow}>
      <Text style={styles.inputLabelText}>{label}</Text>
      {required && <Text style={styles.requiredStar}>*</Text>}
    </View>
    <TouchableOpacity style={styles.selectField} onPress={onPress}>
      <Icon
        name={value ? 'check-circle' : icon}
        size={20}
        color={value ? '#10B981' : '#2563EB'}
        style={styles.selectFieldIcon}
      />
      <Text
        style={[
          styles.selectFieldText,
          !value && styles.selectFieldPlaceholder,
        ]}
      >
        {value || placeholder}
      </Text>
      <Icon name="keyboard-arrow-down" size={22} color="#2563EB" />
    </TouchableOpacity>
  </View>
);

const UploadField: React.FC<{
  label: string;
  imageUri: string | null;
  onPress: () => void;
  uploading: boolean;
  required?: boolean;
}> = ({ label, imageUri, onPress, uploading, required = false }) => (
  <View style={styles.inputFieldContainer}>
    <View style={styles.inputLabelRow}>
      <Text style={styles.inputLabelText}>{label}</Text>
      {required && <Text style={styles.requiredStar}>*</Text>}
    </View>
    <TouchableOpacity
      style={[styles.uploadField, imageUri && styles.uploadFieldSuccess]}
      onPress={onPress}
      disabled={uploading}
    >
      {uploading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <>
          <Icon
            name={imageUri ? 'check-circle' : 'cloud-upload'}
            size={22}
            color="#FFFFFF"
          />
          <Text style={styles.uploadFieldText}>
            {imageUri ? 'Uploaded Successfully' : `Upload ${label}`}
          </Text>
        </>
      )}
    </TouchableOpacity>
  </View>
);

// Simple Battery Info Card - Shows battery level only
const BatteryInfoCard: React.FC<{
  batteryLevel: number;
}> = ({ batteryLevel }) => {
  const getBatteryColor = (level: number) => {
    if (level > 50) return '#10B981';
    if (level > 20) return '#F59E0B';
    return '#EF4444';
  };

  const getBatteryIcon = (level: number) => {
    if (level > 90) return 'battery-full';
    if (level > 70) return 'battery-three-quarters';
    if (level > 50) return 'battery-half';
    if (level > 30) return 'battery-quarter';
    if (level > 15) return 'battery-empty';
    return 'battery-warning';
  };

  return (
    <View style={styles.batteryCard}>
      <View style={styles.batteryCardHeader}>
        <Icon name="battery-charging-full" size={22} color="#2563EB" />
        <Text style={styles.batteryCardTitle}>Battery Status</Text>
      </View>
      <View style={styles.batteryStatsRow}>
        <View style={styles.batteryStatItem}>
          <Fontisto
            name={getBatteryIcon(batteryLevel)}
            size={32}
            color={getBatteryColor(batteryLevel)}
          />
          <Text
            style={[
              styles.batteryStatValue,
              { color: getBatteryColor(batteryLevel) },
            ]}
          >
            {batteryLevel.toFixed(0)}%
          </Text>
          <Text style={styles.batteryStatLabel}>Battery</Text>
        </View>
        <View style={styles.batteryStatItem}>
          <Icon name="speed" size={32} color="#2563EB" />
          <Text style={[styles.batteryStatValue, { color: '#2563EB' }]}>
            5s
          </Text>
          <Text style={styles.batteryStatLabel}>Interval</Text>
        </View>
        <View style={styles.batteryStatItem}>
          <Icon name="gps-fixed" size={32} color="#10B981" />
          <Text style={[styles.batteryStatValue, { color: '#10B981' }]}>
            HIGH
          </Text>
          <Text style={styles.batteryStatLabel}>Accuracy</Text>
        </View>
      </View>
      <View style={styles.batteryProgressBar}>
        <View
          style={[
            styles.batteryProgressFill,
            {
              width: `${batteryLevel}%`,
              backgroundColor: getBatteryColor(batteryLevel),
            },
          ]}
        />
      </View>
    </View>
  );
};

// ============================================================
// MAIN SCREEN COMPONENT
// ============================================================

interface ModelItem {
  label: string;
  value: string;
  originalIndex?: number;
}
interface ShippingData {
  _id: string;
  status: string;
  name: string;
  vehicleBrand: string;
  vehicleModel: string;
  isOnline: boolean;
  lastOnlineAt?: string;
  lastOfflineAt?: string;
  shippingType?: string;
  city?: string;
  state?: string;
  vehicleCategory?: string;
  vehicleNumber?: string;
  maxOrdersPerDay?: number;
  kyc?: {
    drivingLicenseNumber: string;
    drivingLicenseImage: string;
    identityType: string;
    identityNumber: string;
    identityImage: string;
    status: string;
    verified?: boolean;
  };
  kycVerified?: boolean;
}
interface ItemType<T> {
  label: string;
  value: T;
}

const RiderRegistrationScreen: React.FC = () => {
  const navigation = useNavigation<RiderRegistrationScreenNavigationProp>();
  const isMounted = useRef(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [batteryLevel, setBatteryLevel] = useState<number>(100);

  const [shippingType, setShippingType] = useState<ShippingType | null>(null);
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [vehicleCategory, setVehicleCategory] =
    useState<VehicleCategory | null>(null);
  const [vehicleBrand, setVehicleBrand] = useState<string | null>(null);
  const [vehicleModel, setVehicleModel] = useState<string | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [maxOrdersPerDay, setMaxOrdersPerDay] = useState<string>('25');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState<string>('');
  const [identityType, setIdentityType] = useState<IdentityType | null>(null);
  const [identityNumber, setIdentityNumber] = useState<string>('');
  const [vehicleImage, setVehicleImage] = useState<string | null>(null);
  const [drivingLicenseImage, setDrivingLicenseImage] = useState<string | null>(
    null,
  );
  const [identityImage, setIdentityImage] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isTrackingOn, setIsTrackingOn] = useState<boolean>(false);
  const [isUpdatingOnlineStatus, setIsUpdatingOnlineStatus] =
    useState<boolean>(false);
  const [isUpdatingTrackingStatus, setIsUpdatingTrackingStatus] =
    useState<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);
  const [lastOfflineAt, setLastOfflineAt] = useState<string | null>(null);
  const [hasLocationPermission, setHasLocationPermission] =
    useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showBrandModal, setShowBrandModal] = useState<boolean>(false);
  const [showModelModal, setShowModelModal] = useState<boolean>(false);
  const [showIdentityModal, setShowIdentityModal] = useState<boolean>(false);
  const [showShippingTypeModal, setShowShippingTypeModal] =
    useState<boolean>(false);
  const [allModels, setAllModels] = useState<ModelItem[]>([]);
  const [allBrands, setAllBrands] = useState<ItemType<string>[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>(
    'Submitting your application...',
  );
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState<boolean>(true);
  const [shippingData, setShippingData] = useState<ShippingData | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // ============================================================
  // 📍 LOCATION STATE (UI ONLY)
  // ============================================================
  const [lastLocation, setLastLocation] = useState<LocationWithMetadata | null>(
    null,
  );
  const [isLocationAvailable, setIsLocationAvailable] =
    useState<boolean>(false);
  const locationSubscriptionRef = useRef<(() => void) | null>(null);
  const locationUpdateCountRef = useRef<number>(0);

  const vehicleCategories: ItemType<VehicleCategory>[] = [
    { label: 'Car', value: 'Car' },
    { label: 'Bike', value: 'Bike' },
    { label: 'Scooter', value: 'Scooter' },
    { label: 'Auto', value: 'Auto' },
    { label: 'Tempo', value: 'Tempo' },
  ];
  const identityTypes: ItemType<IdentityType>[] = [
    { label: 'Aadhaar Card', value: 'Aadhaar' },
    { label: 'Voter ID', value: 'VoterID' },
    { label: 'Passport', value: 'Passport' },
    { label: 'PAN Card', value: 'PAN' },
  ];
  const shippingTypes: ItemType<ShippingType>[] = [
    { label: 'Truck / Heavy Vehicle', value: 'TRUCK' },
    { label: 'Rider / Bike / Scooter', value: 'RIDER' },
  ];

  const checkPermissionStatus = useCallback(async () => {
    console.log('🔐📱 [checkPermissionStatus] Checking permission status...');
    const hasPermission = await LocationService.requestPermissions();
    setHasLocationPermission(hasPermission);
    console.log(
      `🔐 [checkPermissionStatus] Permission status: ${hasPermission}`,
    );
  }, []);

  const loadVehicleBrands = useCallback((category: VehicleCategory) => {
    if (vehicleOptions[category])
      setAllBrands(
        Object.keys(vehicleOptions[category]).map(b => ({
          label: b,
          value: b,
        })),
      );
    else setAllBrands([]);
    setVehicleBrand(null);
    setVehicleModel(null);
    setAllModels([]);
  }, []);

  const loadVehicleModels = useCallback(
    (category: VehicleCategory, brand: string) => {
      if (vehicleOptions[category]?.[brand])
        setAllModels(
          vehicleOptions[category][brand].map((m: string, i: number) => ({
            label: m,
            value: m,
            originalIndex: i,
          })),
        );
      else setAllModels([]);
      setVehicleModel(null);
    },
    [],
  );

  useEffect(() => {
    if (vehicleCategory) loadVehicleBrands(vehicleCategory);
    else setAllBrands([]);
  }, [vehicleCategory, loadVehicleBrands]);

  useEffect(() => {
    if (vehicleCategory && vehicleBrand)
      loadVehicleModels(vehicleCategory, vehicleBrand);
    else setAllModels([]);
  }, [vehicleCategory, vehicleBrand, loadVehicleModels]);

  // Get battery level
  const updateBatteryLevel = async () => {
    try {
      const level = await DeviceInfo.getBatteryLevel();
      setBatteryLevel(level * 100);
    } catch {
      setBatteryLevel(75);
    }
  };

  // ============================================================
  // 📱 MAIN useEffect - MOUNT & UNMOUNT
  // ============================================================
  useEffect(() => {
    console.log('==================================================');
    console.log('📱 [SCREEN] ════════════════════════════════════');
    console.log('📱 [SCREEN] 🏗️ MOUNTING RiderRegistrationScreen');
    console.log('==================================================');

    isMounted.current = true;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    checkPermissionStatus();
    updateBatteryLevel();

    // ============================================================
    // 📍 SUBSCRIBE TO LOCATION UPDATES - UI ONLY
    // LocationService owns the API upload
    // ============================================================

    console.log('📱 [SCREEN] 📞 Subscribing to location updates (UI only)...');

    locationSubscriptionRef.current = LocationService.subscribeToLocation(
      (locationData: LocationWithMetadata) => {
        console.log('==================================================');
        console.log('📍 [SCREEN] ════════════════════════════════════');
        console.log(
          `📍 [SCREEN] 📍 LOCATION UPDATE #${++locationUpdateCountRef.current}`,
        );
        console.log(`📍 [SCREEN] 📅 Time: ${new Date().toISOString()}`);
        console.log('📍 [SCREEN] ════════════════════════════════════');
        console.log('📍 [SCREEN] 📊 Location Data:', {
          lat: locationData.latitude,
          lng: locationData.longitude,
          accuracy: locationData.accuracy,
          speed: locationData.speed,
          batteryLevel: locationData.batteryLevel,
          networkType: locationData.networkType,
          isFresh: locationData.isFresh,
          isCached: locationData.isCached,
        });
        console.log('==================================================');

        if (!isMounted.current) {
          console.log('📍 [SCREEN] ⏸️ Screen unmounted, ignoring location');
          return;
        }

        // ✅ ONLY UPDATE UI - NO API CALL HERE
        // LocationService handles the API upload
        setLastLocation(locationData);
        setIsLocationAvailable(true);
      },
    );

    return () => {
      console.log('📱 [SCREEN] 🧹 UNMOUNTING RiderRegistrationScreen');
      isMounted.current = false;

      // Unsubscribe from location updates
      if (locationSubscriptionRef.current) {
        console.log('📱 [SCREEN] 📞 Unsubscribing from location updates...');
        locationSubscriptionRef.current();
        locationSubscriptionRef.current = null;
      }
    };
  }, []);

  const handleRequestPermissions = async () => {
    console.log(
      '🔐📱 [handleRequestPermissions] Requesting location permissions...',
    );
    const granted = await requestLocationPermission();
    setHasLocationPermission(granted);
    console.log(`🔐 [handleRequestPermissions] Permission granted: ${granted}`);
    Toast.show({
      type: granted ? 'success' : 'error',
      text1: granted ? 'Permission Granted' : 'Permission Required',
      text2: granted ? 'Location access enabled' : 'Location access is needed',
    });
  };

  // ============================================================
  // 🟢 GO ONLINE WITH LOCATION
  // ============================================================
  const goOnlineWithLocation = async (
    shippingId: string,
    authToken: string,
  ): Promise<boolean> => {
    console.log('🟢🚀 [GO_ONLINE_WITH_LOCATION] ===== GOING ONLINE =====');
    console.log(`🟢🚀 [GO_ONLINE_WITH_LOCATION] Shipping ID: ${shippingId}`);

    try {
      console.log('📍 [GO_ONLINE_WITH_LOCATION] Getting initial location...');
      const location = await LocationService.getCurrentLocationOnce();

      if (location) {
        console.log(
          `📍 [GO_ONLINE_WITH_LOCATION] Initial location: ${location.latitude}, ${location.longitude}`,
        );

        console.log(
          '🌐 [GO_ONLINE_WITH_LOCATION] Sending start action to backend...',
        );
        await fetch(`${API_BASE_URL}/api/v0/track/rider/location`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            shippingId: shippingId,
            action: 'start',
            latitude: location.latitude,
            longitude: location.longitude,
          }),
        });
        console.log(
          '✅ [GO_ONLINE_WITH_LOCATION] Start action sent successfully',
        );
      } else {
        console.log(
          '⚠️ [GO_ONLINE_WITH_LOCATION] No initial location available',
        );
      }
    } catch (error) {
      console.log(
        '⚠️ [GO_ONLINE_WITH_LOCATION] Error sending start action:',
        error,
      );
    }

    console.log('🎯 [GO_ONLINE_WITH_LOCATION] Starting continuous tracking...');

    // ✅ PASS shippingId to startTracking
    const success = await LocationService.startTracking(shippingId);

    if (isMounted.current && success) {
      setIsTrackingOn(true);
      console.log('✅ [GO_ONLINE_WITH_LOCATION] Tracking started successfully');
    } else {
      console.log('❌ [GO_ONLINE_WITH_LOCATION] Failed to start tracking');
    }
    return success;
  };

  // ============================================================
  // 🛑 STOP LIVE TRACKING
  // ============================================================
  const stopLiveTracking = async (): Promise<boolean> => {
    console.log('📍🛑 [STOP_LIVE_TRACKING] ===== STOPPING LIVE TRACKING =====');
    const success = await LocationService.stopTracking();
    if (isMounted.current && success) {
      setIsTrackingOn(false);
      console.log('📍✅ [STOP_LIVE_TRACKING] Live tracking stopped');
    }
    return success;
  };

  useFocusEffect(
    useCallback(() => {
      console.log(
        '📱🔍 [USE_FOCUS_EFFECT] Screen focused - fetching shipping data',
      );
      fetchShippingData();
      checkPermissionStatus();
    }, []),
  );

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      console.log(`🔑 [GET_AUTH_TOKEN] Auth token present: ${!!token}`);
      return token;
    } catch (error) {
      console.log('🔑❌ [GET_AUTH_TOKEN] Error:', error);
      return null;
    }
  };

  const fetchShippingData = async () => {
    if (!isMounted.current) return;
    try {
      setCheckingExisting(true);
      const token = await getAuthToken();
      if (!token) {
        console.log('🔑 [FETCH_SHIPPING] No auth token found');
        setCheckingExisting(false);
        setShowOnboarding(true);
        return;
      }

      console.log('🌐 [FETCH_SHIPPING] Fetching shipping data from backend...');
      const res = await fetch(`${API_BASE_URL}/api/v0/shipping/form/check`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.shippingData) {
          const reg = data.shippingData;
          console.log(`✅ [FETCH_SHIPPING] Shipping data found: ${reg._id}`);
          setShippingId(reg._id);
          setShippingData(reg);
          setIsOnline(reg.isOnline || false);
          setLastOnlineAt(reg.lastOnlineAt || null);
          setLastOfflineAt(reg.lastOfflineAt || null);
          setShowOnboarding(false);

          if (reg.kyc && isMounted.current) {
            setDrivingLicenseNumber(reg.kyc.drivingLicenseNumber || '');
            setIdentityType((reg.kyc.identityType as IdentityType) || null);
            setIdentityNumber(reg.kyc.identityNumber || '');
            if (reg.kyc.drivingLicenseImage)
              setDrivingLicenseImage(reg.kyc.drivingLicenseImage);
            if (reg.kyc.identityImage) setIdentityImage(reg.kyc.identityImage);
          }

          const approved = reg.status === 'approved';
          const kycVerified =
            reg.kyc?.status === 'verified' ||
            reg.kyc?.verified === true ||
            reg.kycVerified === true;

          if (approved && kycVerified && reg.isOnline) {
            console.log(
              '🔄 [FETCH_SHIPPING] Restarting tracking for existing online session',
            );
            // ✅ PASS shippingId to startTracking
            await LocationService.startTracking(reg._id);
            if (isMounted.current) setIsTrackingOn(true);
          }
        } else {
          console.log('🔍 [FETCH_SHIPPING] No shipping data found');
          setShowOnboarding(true);
        }
      } else if (res.status === 404) {
        console.log('🔍 [FETCH_SHIPPING] No shipping registration found (404)');
        if (isMounted.current) {
          setShippingData(null);
          setShowOnboarding(true);
        }
      }
    } catch (error) {
      console.log('❌ [FETCH_SHIPPING] Error fetching shipping data:', error);
    } finally {
      if (isMounted.current) setCheckingExisting(false);
    }
  };

  const toggleOnlineStatusCore = async () => {
    console.log('🔄🟢 [TOGGLE_ONLINE_CORE] ===== TOGGLING ONLINE STATUS =====');

    if (!shippingData) {
      console.log('🔄❌ [TOGGLE_ONLINE_CORE] No shipping data');
      Toast.show({
        type: 'error',
        text1: 'No Registration',
        text2: 'Register first',
      });
      return;
    }

    const approved = shippingData.status === 'approved';
    const kycVerified =
      shippingData.kyc?.status === 'verified' ||
      shippingData.kyc?.verified === true ||
      shippingData.kycVerified === true;

    if (!approved || !kycVerified) {
      console.log('🔄❌ [TOGGLE_ONLINE_CORE] Not approved/verified');
      Toast.show({
        type: 'error',
        text1: 'Verification Pending',
        text2: 'Need approval & KYC verification',
      });
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      return;
    }

    if (isUpdatingOnlineStatus) {
      console.log('🔄⚠️ [TOGGLE_ONLINE_CORE] Already updating, returning');
      return;
    }
    setIsUpdatingOnlineStatus(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        console.log('🔄❌ [TOGGLE_ONLINE_CORE] No auth token');
        navigation.navigate('Login');
        return;
      }

      const newStatus = !isOnline;
      console.log(
        `🔄 [TOGGLE_ONLINE_CORE] Toggling online status to: ${newStatus}`,
      );
      setIsOnline(newStatus);

      console.log(
        '🌐 [TOGGLE_ONLINE_CORE] Sending online status to backend...',
      );
      const res = await fetch(`${API_BASE_URL}/api/v0/shipper/online-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isOnline: newStatus }),
      });

      const data = await res.json();
      console.log('🌐 [TOGGLE_ONLINE_CORE] Response:', data);

      if (res.ok && data.success) {
        const now = new Date().toISOString();
        if (data.data) {
          setLastOnlineAt(data.data.lastOnlineAt || now);
          setLastOfflineAt(data.data.lastOfflineAt || now);
        } else {
          if (newStatus) setLastOnlineAt(now);
          else setLastOfflineAt(now);
        }

        ReactNativeHapticFeedback.trigger(
          newStatus ? 'notificationSuccess' : 'notificationWarning',
          hapticOptions,
        );

        if (newStatus) {
          console.log(
            '🟢 [TOGGLE_ONLINE_CORE] Going online - starting location tracking',
          );
          await goOnlineWithLocation(shippingData._id, token);
          Toast.show({
            type: 'success',
            text1: 'You are now Online',
            text2: 'Location tracking enabled',
          });
        } else {
          console.log(
            '🔴 [TOGGLE_ONLINE_CORE] Going offline - stopping location tracking',
          );
          await stopLiveTracking();
          Toast.show({
            type: 'info',
            text1: 'You are now Offline',
            text2: 'Tracking stopped',
          });
        }
      } else {
        setIsOnline(!newStatus);
        throw new Error(data.message || 'Failed to update');
      }
    } catch (error: any) {
      console.log(
        '❌ [TOGGLE_ONLINE_CORE] Error toggling online status:',
        error,
      );
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.message,
      });
    } finally {
      if (isMounted.current) setIsUpdatingOnlineStatus(false);
    }
  };

  const toggleOnlineStatus = useDebounce(toggleOnlineStatusCore, 1500);

  // ============================================================
  // 📍 TOGGLE LOCATION TRACKING
  // ============================================================
  const toggleLocationTrackingCore = async () => {
    console.log(
      '📍🔄 [TOGGLE_TRACKING_CORE] ===== TOGGLING LOCATION TRACKING =====',
    );
    console.log(`📍🔄 [TOGGLE_TRACKING_CORE] isTrackingOn: ${isTrackingOn}`);

    if (!shippingData) {
      console.log('📍❌ [TOGGLE_TRACKING_CORE] No shipping data');
      Toast.show({
        type: 'error',
        text1: 'No Registration',
        text2: 'Register first',
      });
      return;
    }

    if (!isOnline) {
      console.log('📍❌ [TOGGLE_TRACKING_CORE] Not online');
      Toast.show({
        type: 'error',
        text1: 'Go Online First',
        text2: 'Need to be online',
      });
      return;
    }

    if (isUpdatingTrackingStatus) {
      console.log('📍⚠️ [TOGGLE_TRACKING_CORE] Already updating, returning');
      return;
    }

    setIsUpdatingTrackingStatus(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        console.log('📍❌ [TOGGLE_TRACKING_CORE] No auth token');
        navigation.navigate('Login');
        return;
      }

      if (!isTrackingOn) {
        console.log('📍🟢 [TOGGLE_TRACKING_CORE] Starting location tracking');
        // ✅ PASS shippingId to startTracking
        const success = await LocationService.startTracking(shippingData._id);
        if (success && isMounted.current) {
          setIsTrackingOn(true);
          ReactNativeHapticFeedback.trigger(
            'notificationSuccess',
            hapticOptions,
          );
          Toast.show({
            type: 'success',
            text1: 'Location Tracking ON',
            text2: 'Location being shared',
          });
        }
      } else {
        console.log('📍🔴 [TOGGLE_TRACKING_CORE] Stopping location tracking');
        const success = await LocationService.stopTracking();
        if (success && isMounted.current) {
          setIsTrackingOn(false);
          ReactNativeHapticFeedback.trigger(
            'notificationWarning',
            hapticOptions,
          );
          Toast.show({
            type: 'info',
            text1: 'Location Tracking OFF',
            text2: 'Sharing stopped',
          });
        }
      }
    } catch (error: any) {
      console.log(
        '📍❌ [TOGGLE_TRACKING_CORE] Error toggling tracking:',
        error,
      );
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.message,
      });
    } finally {
      if (isMounted.current) setIsUpdatingTrackingStatus(false);
    }
  };

  const toggleLocationTracking = useDebounce(toggleLocationTrackingCore, 2000);

  const formatDate = (d: string | null) => {
    if (!d) return 'Never';
    try {
      return new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const pickImage = async (type: 'vehicle' | 'license' | 'identity') => {
    try {
      ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
      setUploadingImage(type);
      await requestStoragePermission();
      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
      });
      if (result.didCancel) {
        setUploadingImage(null);
        return;
      }
      if (result.errorCode) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: result.errorMessage || 'Failed',
        });
        setUploadingImage(null);
        return;
      }
      if (result.assets?.[0]?.base64) {
        const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        if (type === 'vehicle') setVehicleImage(base64);
        else if (type === 'license') setDrivingLicenseImage(base64);
        else setIdentityImage(base64);
        Toast.show({
          type: 'success',
          text1: 'Image Selected',
          text2: 'Uploaded',
        });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed' });
    } finally {
      setUploadingImage(null);
    }
  };

  const validateForm = (): boolean => {
    const checks: [boolean, string][] = [
      [!name.trim(), 'Enter full name'],
      [!shippingType, 'Select shipping type'],
      [!city.trim(), 'Enter city'],
      [!state.trim(), 'Enter state'],
      [!vehicleCategory, 'Select vehicle category'],
      [!vehicleBrand, 'Select brand'],
      [!vehicleModel, 'Select model'],
      [!vehicleNumber.trim(), 'Enter vehicle number'],
      [!vehicleImage, 'Upload vehicle image'],
      [!drivingLicenseNumber.trim(), 'Enter license number'],
      [!drivingLicenseImage, 'Upload license image'],
      [!!identityType && !identityNumber.trim(), 'Enter identity number'],
      [!!identityNumber && !identityImage, 'Upload identity image'],
      [!agreedToTerms, 'Agree to terms'],
    ];
    for (const [invalid, msg] of checks)
      if (invalid) {
        Toast.show({ type: 'error', text1: 'Required', text2: msg });
        return false;
      }
    return true;
  };

  const submitRegistration = async (formData: any) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Auth token missing');
    const res = await fetch(`${API_BASE_URL}/api/v0/shipping/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 409) throw new Error('Already registered');
      if (res.status === 401) {
        await AsyncStorage.removeItem('authToken');
        throw new Error('Session expired');
      }
      throw new Error(err);
    }
    return await res.json();
  };

  const proceedWithRegistration = async () => {
    const formData = {
      name: name.trim(),
      shippingType: shippingType,
      city: city.trim(),
      state: state.trim(),
      vehicleCategory,
      vehicleBrand,
      vehicleModel,
      vehicleNumber: vehicleNumber.toUpperCase().replace(/\s/g, ''),
      vehicleImage: vehicleImage?.split(',')[1] || '',
      maxOrdersPerDay: parseInt(maxOrdersPerDay) || 25,
      kyc: {
        drivingLicenseNumber: drivingLicenseNumber.toUpperCase(),
        drivingLicenseImage: drivingLicenseImage?.split(',')[1] || '',
        identityType: identityType || null,
        identityNumber: identityNumber || null,
        identityImage: identityImage?.split(',')[1] || null,
      },
      agreedToTerms: true,
      agreedAt: new Date().toISOString(),
    };
    const res = await submitRegistration(formData);
    const newId = res.shipping?._id || res._id || res.id;
    if (!newId) throw new Error('No ID received');
    navigation.navigate('RegistrationSuccess', { shippingId: newId });
  };

  const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoadingMessage('Validating your information...');
    setLoading(true);

    try {
      setLoadingMessage('Uploading documents to secure server...');
      await delay(500);
      setLoadingMessage('Submitting registration to authorities...');
      await proceedWithRegistration();
      setLoadingMessage('Registration successful! Redirecting...');
    } catch (error: any) {
      if (error.message.includes('already'))
        Alert.alert('Duplicate', error.message);
      else if (error.message.includes('expired')) {
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: 'Login again',
        });
        setTimeout(() => navigation.navigate('Login'), 1500);
      } else
        Toast.show({ type: 'error', text1: 'Failed', text2: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleViewStatus = () => {
    if (shippingId) navigation.navigate('RegistrationSuccess', { shippingId });
  };

  const handleNewRegistration = () => {
    setShippingData(null);
    setShippingId(null);
    setName('');
    setShippingType(null);
    setCity('');
    setState('');
    setVehicleCategory(null);
    setVehicleBrand(null);
    setVehicleModel(null);
    setVehicleNumber('');
    setMaxOrdersPerDay('25');
    setVehicleImage(null);
    setDrivingLicenseNumber('');
    setDrivingLicenseImage(null);
    setIdentityType(null);
    setIdentityNumber('');
    setIdentityImage(null);
    setAgreedToTerms(false);
    setIsOnline(false);
    setIsTrackingOn(false);
    setLastOnlineAt(null);
    setLastOfflineAt(null);
  };

  if (checkingExisting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.checkingText}>
            Checking registration status...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showOnboarding)
    return <FWSOnboardingScreen onComplete={() => setShowOnboarding(false)} />;

  if (shippingData) {
    const isApproved = shippingData.status === 'approved';
    const isKycVerified =
      shippingData.kyc?.status === 'verified' ||
      shippingData.kyc?.verified === true ||
      shippingData.kycVerified === true;
    const showSwiper = isApproved && isKycVerified;

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.dashboardHeader}>
            <View style={styles.dashboardHeaderContent}>
              <View style={styles.dashboardHeaderIcon}>
                <Icon
                  name={showSwiper ? 'verified' : 'pending'}
                  size={32}
                  color="#FFFFFF"
                />
              </View>
              <View>
                <Text style={styles.dashboardHeaderTitle}>
                  Delivery Partner
                </Text>
                <Text style={styles.dashboardHeaderSub}>
                  {showSwiper ? '✓ Account Active' : '⏳ Awaiting Verification'}
                </Text>
              </View>
            </View>
          </View>

          <BatteryInfoCard batteryLevel={batteryLevel} />

          <View style={styles.dashboardCard}>
            <View style={styles.profileRow}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {shippingData.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{shippingData.name}</Text>
                <Text style={styles.profileVehicle}>
                  {shippingData.vehicleBrand} {shippingData.vehicleModel}
                </Text>
              </View>
              <View
                style={[
                  styles.statusChip,
                  shippingData.status === 'approved'
                    ? styles.statusChipApproved
                    : shippingData.status === 'pending'
                      ? styles.statusChipPending
                      : styles.statusChipDeclined,
                ]}
              >
                <Text style={styles.statusChipText}>
                  {shippingData.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {shippingData.kyc && (
              <View style={styles.kycSection}>
                <View style={styles.kycSectionHeader}>
                  <Icon
                    name="verified-user"
                    size={20}
                    color={isKycVerified ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={styles.kycSectionTitle}>KYC Verification</Text>
                  <View
                    style={[
                      styles.kycBadge,
                      isKycVerified
                        ? styles.kycBadgeVerified
                        : styles.kycBadgePending,
                    ]}
                  >
                    <Text style={styles.kycBadgeText}>
                      {isKycVerified ? 'VERIFIED' : 'PENDING'}
                    </Text>
                  </View>
                </View>
                <View style={styles.kycDetailBox}>
                  <View style={styles.kycDetailRow}>
                    <Text style={styles.kycDetailLabel}>DL Number</Text>
                    <Text style={styles.kycDetailValue}>
                      {shippingData.kyc.drivingLicenseNumber}
                    </Text>
                  </View>
                  {shippingData.kyc.identityType && (
                    <View style={styles.kycDetailRow}>
                      <Text style={styles.kycDetailLabel}>ID Type</Text>
                      <Text style={styles.kycDetailValue}>
                        {shippingData.kyc.identityType}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {!hasLocationPermission && (
              <View style={styles.permissionBox}>
                <Icon name="location-disabled" size={28} color="#EF4444" />
                <Text style={styles.permissionBoxTitle}>
                  Location Access Required
                </Text>
                <Text style={styles.permissionBoxText}>
                  To track deliveries, we need location permission
                </Text>
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={handleRequestPermissions}
                >
                  <Text style={styles.permissionButtonText}>Grant Access</Text>
                </TouchableOpacity>
              </View>
            )}

            {showSwiper ? (
              <>
                <View style={styles.switchCard}>
                  <View style={styles.switchCardHeader}>
                    <Icon
                      name="wifi"
                      size={22}
                      color={isOnline ? '#10B981' : '#94A3B8'}
                    />
                    <Text style={styles.switchCardTitle}>Online Status</Text>
                    <View
                      style={[
                        styles.switchStatusBadge,
                        isOnline
                          ? styles.switchStatusOnlineBadge
                          : styles.switchStatusOfflineBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.switchStatusText,
                          isOnline
                            ? styles.switchStatusOnline
                            : styles.switchStatusOffline,
                        ]}
                      >
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>
                      Go {isOnline ? 'Offline' : 'Online'}
                    </Text>
                    <Switch
                      value={isOnline}
                      onValueChange={toggleOnlineStatus}
                      disabled={isUpdatingOnlineStatus}
                      trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.switchDescription}>
                    {isOnline
                      ? 'Ready to accept orders'
                      : 'Will not receive orders'}
                  </Text>
                </View>

                {isOnline && hasLocationPermission && (
                  <View style={styles.switchCard}>
                    <View style={styles.switchCardHeader}>
                      <Icon
                        name="location-on"
                        size={22}
                        color={isTrackingOn ? '#2563EB' : '#94A3B8'}
                      />
                      <Text style={styles.switchCardTitle}>Live Tracking</Text>
                      <View
                        style={[
                          styles.switchStatusBadge,
                          isTrackingOn
                            ? styles.switchStatusTrackingBadge
                            : styles.switchStatusOfflineBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.switchStatusText,
                            isTrackingOn
                              ? styles.switchStatusTracking
                              : styles.switchStatusOffline,
                          ]}
                        >
                          {isTrackingOn ? 'ACTIVE' : 'OFF'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>
                        {isTrackingOn ? 'Stop Tracking' : 'Start Tracking'}
                      </Text>
                      <Switch
                        value={isTrackingOn}
                        onValueChange={toggleLocationTracking}
                        disabled={isUpdatingTrackingStatus || !isOnline}
                        trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    <Text style={styles.switchDescription}>
                      {isTrackingOn
                        ? 'Tracking in background & lock screen'
                        : 'Location sharing stopped'}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.pendingCard}>
                <View style={styles.pendingCardInner}>
                  <Icon
                    name={isApproved ? 'pending-actions' : 'hourglass-empty'}
                    size={40}
                    color="#D97706"
                  />
                  <Text style={styles.pendingCardTitle}>
                    {!isApproved
                      ? 'Registration Under Review'
                      : 'KYC Verification Pending'}
                  </Text>
                  <Text style={styles.pendingCardText}>
                    {!isApproved
                      ? 'We will notify you once approved'
                      : 'Complete KYC to go online'}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.viewStatusBtn}
              onPress={handleViewStatus}
            >
              <Text style={styles.viewStatusBtnText}>
                View Application Status
              </Text>
              <Icon name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.newRegBtn}
              onPress={handleNewRegistration}
            >
              <Icon name="add-circle-outline" size={20} color="#2563EB" />
              <Text style={styles.newRegBtnText}>Register Another Vehicle</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Registration Form
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.formScrollContainer}
        >
          <Animated.View
            style={[
              styles.formHeader,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.formHeaderGradient}>
              <View style={styles.formHeaderContent}>
                <View style={styles.formHeaderIcon}>
                  <Icon name="delivery-dining" size={32} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.formHeaderTitle}>Become a Partner</Text>
                  <Text style={styles.formHeaderSubtitle}>
                    Join India's fastest delivery network
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <View style={styles.progressSteps}>
            <View style={styles.progressStepActive}>
              <Text style={styles.progressStepText}>1</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={styles.progressStep}>
              <Text style={styles.progressStepText}>2</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={styles.progressStep}>
              <Text style={styles.progressStepText}>3</Text>
            </View>
          </View>
          <Text style={styles.progressLabel}>Step 1 of 3: Basic Details</Text>

          <FormCard title="Shipping Details" icon="local-shipping">
            <SelectField
              label="Shipping Type"
              value={shippingType}
              onPress={() => setShowShippingTypeModal(true)}
              placeholder="Select shipping type"
              icon="local-shipping"
              required
            />
            <InputField
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="Enter your city"
              icon="location-city"
              required
            />
            <InputField
              label="State"
              value={state}
              onChangeText={setState}
              placeholder="Enter your state"
              icon="map"
              required
            />
          </FormCard>

          <FormCard title="Personal Information" icon="person">
            <InputField
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              icon="person-outline"
              required
            />
          </FormCard>

          <FormCard title="KYC Documents" icon="verified-user">
            <InputField
              label="Driving License Number"
              value={drivingLicenseNumber}
              onChangeText={setDrivingLicenseNumber}
              placeholder="Enter license number"
              icon="credit-card"
              required
              autoCapitalize="characters"
            />
            <UploadField
              label="Driving License"
              imageUri={drivingLicenseImage}
              onPress={() => pickImage('license')}
              uploading={uploadingImage === 'license'}
              required
            />
            <SelectField
              label="Identity Document"
              value={identityType}
              onPress={() => setShowIdentityModal(true)}
              placeholder="Select identity type"
              icon="fingerprint"
            />
            {identityType && (
              <>
                <InputField
                  label={`${identityType} Number`}
                  value={identityNumber}
                  onChangeText={setIdentityNumber}
                  placeholder={`Enter ${identityType} number`}
                  icon="fingerprint"
                />
                <UploadField
                  label={`${identityType} Document`}
                  imageUri={identityImage}
                  onPress={() => pickImage('identity')}
                  uploading={uploadingImage === 'identity'}
                />
              </>
            )}
          </FormCard>

          <FormCard title="Vehicle Information" icon="directions-car">
            <InputField
              label="Vehicle Number"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              placeholder="e.g., MH12AB1234"
              icon="confirmation-number"
              required
              autoCapitalize="characters"
            />
            <SelectField
              label="Vehicle Category"
              value={vehicleCategory}
              onPress={() => setShowCategoryModal(true)}
              placeholder="Select category"
              icon="category"
              required
            />
            {vehicleCategory && (
              <SelectField
                label="Vehicle Brand"
                value={vehicleBrand}
                onPress={() => setShowBrandModal(true)}
                placeholder="Select brand"
                icon="directions-car"
                required
              />
            )}
            {vehicleBrand && (
              <SelectField
                label="Vehicle Model"
                value={vehicleModel}
                onPress={() => setShowModelModal(true)}
                placeholder="Select model"
                icon="directions-car"
                required
              />
            )}
            <UploadField
              label="Vehicle Image"
              imageUri={vehicleImage}
              onPress={() => pickImage('vehicle')}
              uploading={uploadingImage === 'vehicle'}
              required
            />
            <InputField
              label="Max Orders Per Day"
              value={maxOrdersPerDay}
              onChangeText={setMaxOrdersPerDay}
              placeholder="25"
              icon="local-offer"
              keyboardType="numeric"
              maxLength={3}
            />
          </FormCard>

          <View style={styles.termsContainer}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
                setAgreedToTerms(!agreedToTerms);
              }}
            >
              <View
                style={[
                  styles.checkboxBox,
                  agreedToTerms && styles.checkboxBoxChecked,
                ]}
              >
                {agreedToTerms && (
                  <Icon name="check" size={14} color="#FFFFFF" />
                )}
              </View>
              <View>
                <Text style={styles.checkboxText}>
                  I agree to the Terms & Conditions
                </Text>
                <Text style={styles.checkboxSubtext}>
                  Read our terms and privacy policy
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!agreedToTerms || loading) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!agreedToTerms || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.submitBtnContent}>
                <Text style={styles.submitBtnText}>Submit Registration</Text>
                <Icon name="arrow-forward" size={20} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.noteText}>
            Application reviewed within 24 hours
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Full Screen Loader */}
      <FullScreenLoader visible={loading} message={loadingMessage} />

      {/* Modals */}
      <Modal
        visible={showShippingTypeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShippingTypeModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowShippingTypeModal(false)}
              style={styles.modalClose}
            >
              <Icon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Shipping Type</Text>
          </View>
          <FlatList
            data={shippingTypes}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  shippingType === item.value && styles.modalItemSelected,
                ]}
                onPress={() => {
                  setShippingType(item.value);
                  setShowShippingTypeModal(false);
                  ReactNativeHapticFeedback.trigger(
                    'impactMedium',
                    hapticOptions,
                  );
                }}
              >
                <Icon
                  name={
                    item.value === 'TRUCK' ? 'local-shipping' : 'motorcycle'
                  }
                  size={24}
                  color={shippingType === item.value ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    shippingType === item.value && styles.modalItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {shippingType === item.value && (
                  <Icon name="check-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowCategoryModal(false)}
              style={styles.modalClose}
            >
              <Icon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Vehicle Category</Text>
          </View>
          <FlatList
            data={vehicleCategories}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  vehicleCategory === item.value && styles.modalItemSelected,
                ]}
                onPress={() => {
                  setVehicleCategory(item.value);
                  setShowCategoryModal(false);
                  ReactNativeHapticFeedback.trigger(
                    'impactMedium',
                    hapticOptions,
                  );
                }}
              >
                <Icon
                  name={
                    item.value === 'Car'
                      ? 'directions-car'
                      : item.value === 'Bike'
                        ? 'directions-bike'
                        : item.value === 'Scooter'
                          ? 'scooter'
                          : item.value === 'Auto'
                            ? 'local-taxi'
                            : 'local-shipping'
                  }
                  size={24}
                  color={vehicleCategory === item.value ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    vehicleCategory === item.value &&
                      styles.modalItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {vehicleCategory === item.value && (
                  <Icon name="check-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showBrandModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBrandModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowBrandModal(false)}
              style={styles.modalClose}
            >
              <Icon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Brand</Text>
            <Text style={styles.modalSubtitle}>{vehicleCategory}</Text>
          </View>
          <FlatList
            data={allBrands}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  vehicleBrand === item.value && styles.modalItemSelected,
                ]}
                onPress={() => {
                  setVehicleBrand(item.value);
                  setShowBrandModal(false);
                  ReactNativeHapticFeedback.trigger(
                    'impactMedium',
                    hapticOptions,
                  );
                }}
              >
                <Icon
                  name="directions-car"
                  size={24}
                  color={vehicleBrand === item.value ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    vehicleBrand === item.value && styles.modalItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {vehicleBrand === item.value && (
                  <Icon name="check-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showModelModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModelModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowModelModal(false)}
              style={styles.modalClose}
            >
              <Icon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Model</Text>
            <Text style={styles.modalSubtitle}>{vehicleBrand}</Text>
          </View>
          <FlatList
            data={allModels}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  vehicleModel === item.value && styles.modalItemSelected,
                ]}
                onPress={() => {
                  setVehicleModel(item.value);
                  setShowModelModal(false);
                  ReactNativeHapticFeedback.trigger(
                    'impactMedium',
                    hapticOptions,
                  );
                }}
              >
                <Icon
                  name="directions-car"
                  size={24}
                  color={vehicleModel === item.value ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    vehicleModel === item.value && styles.modalItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {vehicleModel === item.value && (
                  <Icon name="check-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showIdentityModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowIdentityModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowIdentityModal(false)}
              style={styles.modalClose}
            >
              <Icon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Identity Type</Text>
          </View>
          <FlatList
            data={identityTypes}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  identityType === item.value && styles.modalItemSelected,
                ]}
                onPress={() => {
                  setIdentityType(item.value);
                  setShowIdentityModal(false);
                  ReactNativeHapticFeedback.trigger(
                    'impactMedium',
                    hapticOptions,
                  );
                }}
              >
                <Icon
                  name={
                    item.value === 'Aadhaar'
                      ? 'badge'
                      : item.value === 'VoterID'
                        ? 'how-to-vote'
                        : item.value === 'Passport'
                          ? 'card-travel'
                          : 'credit-card'
                  }
                  size={24}
                  color={identityType === item.value ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    identityType === item.value && styles.modalItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {identityType === item.value && (
                  <Icon name="check-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  scrollContainer: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 },
  formScrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  checkingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },

  // Full Screen Loader Styles
  fullScreenLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: width - 80,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 20,
    marginBottom: 8,
  },
  loaderMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  loaderDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginHorizontal: 4,
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },

  // Form Header - Pure Blue
  formHeader: { marginBottom: 24, marginTop: 8 },
  formHeaderGradient: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    padding: 20,
  },
  formHeaderContent: { flexDirection: 'row', alignItems: 'center' },
  formHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  formHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  formHeaderSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },

  // Progress Steps
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  progressStepActive: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 8,
  },
  progressLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '500',
    marginBottom: 20,
  },

  // Form Card
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  formCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
    marginLeft: 10,
  },
  formCardContent: { padding: 20 },

  // Input Fields
  inputFieldContainer: { marginBottom: 18 },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabelText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  requiredStar: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    marginLeft: 4,
  },
  inputFieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 52,
  },
  inputFieldIcon: { marginLeft: 16 },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 52,
  },
  selectFieldIcon: { marginRight: 12 },
  selectFieldText: { flex: 1, fontSize: 15, color: '#1E293B' },
  selectFieldPlaceholder: { color: '#94A3B8' },
  uploadField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  uploadFieldSuccess: { backgroundColor: '#10B981' },
  uploadFieldText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },

  // Terms
  termsContainer: { marginVertical: 16 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxBoxChecked: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkboxText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  checkboxSubtext: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // Submit Button
  submitBtn: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    gap: 12,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  submitBtnDisabled: { opacity: 0.6 },
  noteText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
  },

  // Dashboard Styles
  dashboardHeader: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    marginBottom: 16,
    padding: 20,
  },
  dashboardHeaderContent: { flexDirection: 'row', alignItems: 'center' },
  dashboardHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dashboardHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  dashboardHeaderSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  dashboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  profileVehicle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusChipApproved: { backgroundColor: '#D1FAE5' },
  statusChipPending: { backgroundColor: '#FEF3C7' },
  statusChipDeclined: { backgroundColor: '#FEE2E2' },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  kycSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  kycSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  kycSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 10,
    flex: 1,
  },
  kycBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  kycBadgeVerified: { backgroundColor: '#D1FAE5' },
  kycBadgePending: { backgroundColor: '#FEF3C7' },
  kycBadgeText: { fontSize: 11, fontWeight: '700' },
  kycDetailBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14 },
  kycDetailRow: { flexDirection: 'row', marginBottom: 8 },
  kycDetailLabel: { fontSize: 12, color: '#64748B', width: 100 },
  kycDetailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
    flex: 1,
  },
  permissionBox: {
    margin: 20,
    padding: 20,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    alignItems: 'center',
  },
  permissionBoxTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginTop: 12,
    marginBottom: 6,
  },
  permissionBoxText: {
    fontSize: 13,
    color: '#7F1D1D',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  permissionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  switchCard: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  switchCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 10,
    flex: 1,
  },
  switchStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  switchStatusOnlineBadge: { backgroundColor: '#D1FAE5' },
  switchStatusOfflineBadge: { backgroundColor: '#F1F5F9' },
  switchStatusTrackingBadge: { backgroundColor: '#DBEAFE' },
  switchStatusText: { fontSize: 11, fontWeight: '700' },
  switchStatusOnline: { color: '#10B981' },
  switchStatusOffline: { color: '#64748B' },
  switchStatusTracking: { color: '#2563EB' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  switchLabel: { fontSize: 14, fontWeight: '500', color: '#334155' },
  switchDescription: { fontSize: 12, color: '#64748B' },
  pendingCard: { margin: 20 },
  pendingCardInner: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
  },
  pendingCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 14,
    marginBottom: 6,
  },
  pendingCardText: { fontSize: 13, color: '#92400E', textAlign: 'center' },
  viewStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    margin: 20,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  viewStatusBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  newRegBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  newRegBtnText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },

  // Battery Card
  batteryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
  },
  batteryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  batteryCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  batteryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  batteryStatItem: { alignItems: 'center' },
  batteryStatValue: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  batteryStatLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  batteryProgressBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  batteryProgressFill: { height: '100%', borderRadius: 3 },

  // Modals
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalClose: { marginRight: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', flex: 1 },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginLeft: 8 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalItemSelected: { backgroundColor: '#EFF6FF' },
  modalItemText: { flex: 1, fontSize: 15, color: '#1E293B', marginLeft: 14 },
  modalItemTextSelected: { color: '#2563EB', fontWeight: '600' },
});

export default RiderRegistrationScreen;
