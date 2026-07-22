// hooks/cab/useCabDriver.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import {
  registerDriver,
  getDriverProfile,
  getDriverStatus,
  isDriverApproved,
  getStatusColor,
  getStatusLabel,
} from '../../services/cab/cabService';
import {
  RegisterDriverRequest,
  RideDriver,
  DriverStatus,
} from '../../types/CabTypes';

interface UseCabDriverReturn {
  isLoading: boolean;
  isRegistered: boolean;
  driver: RideDriver | null;
  status: DriverStatus | null;
  statusColor: string;
  statusLabel: string;
  isApproved: boolean;
  register: (data: RegisterDriverRequest) => Promise<boolean>;
  refreshDriver: () => Promise<void>;
  checkStatus: () => Promise<void>;
  clearDriver: () => void;
  navigateToProfile: () => void;
}

export const useCabDriver = (): UseCabDriverReturn => {
  const navigation =
    useNavigation<NavigationProp<Record<string, object | undefined>>>();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [driver, setDriver] = useState<RideDriver | null>(null);
  const [status, setStatus] = useState<DriverStatus | null>(null);
  const [statusColor, setStatusColor] = useState<string>('#6B7280');
  const [statusLabel, setStatusLabel] = useState<string>('Unknown');
  const [isApproved, setIsApproved] = useState<boolean>(false);

  const navigateToProfile = useCallback(() => {
    try {
      if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate('DriverStatus');
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [navigation]);

  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getDriverStatus();

      setIsRegistered(result.isRegistered);
      setDriver(result.driver || null);

      if (result.driver) {
        const driverStatus = result.driver.status as DriverStatus;
        setStatus(driverStatus);
        setStatusColor(getStatusColor(driverStatus));
        setStatusLabel(getStatusLabel(driverStatus));
        setIsApproved(driverStatus === 'approved');

        if (result.isRegistered) {
          navigateToProfile();
        }
      } else {
        setStatus(null);
        setStatusColor('#6B7280');
        setStatusLabel('Unknown');
        setIsApproved(false);
      }
    } catch (error) {
      console.error('Error checking driver status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [navigateToProfile]);

  const register = useCallback(
    async (data: RegisterDriverRequest): Promise<boolean> => {
      try {
        setIsLoading(true);
        const result = await registerDriver(data);

        if (result.success) {
          Alert.alert(
            'Success 🎉',
            result.message || 'Driver registered successfully!',
          );
          await checkStatus();
          return true;
        } else {
          if (result.errors && result.errors.length > 0) {
            const errorMessages = result.errors
              .map(e => `• ${e.message}`)
              .join('\n');
            Alert.alert('Validation Error', errorMessages);
          } else {
            Alert.alert('Error', result.message || 'Registration failed');
          }
          return false;
        }
      } catch (error) {
        console.error('Registration error:', error);
        Alert.alert('Error', 'Something went wrong. Please try again.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [checkStatus],
  );

  const refreshDriver = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getDriverProfile();

      if (result.success && result.data) {
        setDriver(result.data);
        setIsRegistered(true);
        const driverStatus = result.data.status as DriverStatus;
        setStatus(driverStatus);
        setStatusColor(getStatusColor(driverStatus));
        setStatusLabel(getStatusLabel(driverStatus));
        setIsApproved(driverStatus === 'approved');
      } else {
        setIsRegistered(false);
        setDriver(null);
        setStatus(null);
        setStatusColor('#6B7280');
        setStatusLabel('Unknown');
        setIsApproved(false);
      }
    } catch (error) {
      console.error('Error refreshing driver:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearDriver = useCallback(() => {
    setDriver(null);
    setIsRegistered(false);
    setStatus(null);
    setStatusColor('#6B7280');
    setStatusLabel('Unknown');
    setIsApproved(false);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    isLoading,
    isRegistered,
    driver,
    status,
    statusColor,
    statusLabel,
    isApproved,
    register,
    refreshDriver,
    checkStatus,
    clearDriver,
    navigateToProfile,
  };
};

// ============================================
// 📝 FORM HOOK
// ============================================

interface UseDriverFormReturn {
  formData: RegisterDriverRequest;
  updateField: <K extends keyof RegisterDriverRequest>(
    field: K,
    value: RegisterDriverRequest[K],
  ) => void;
  resetForm: () => void;
  isFormValid: boolean;
}

export const useDriverForm = (): UseDriverFormReturn => {
  const [formData, setFormData] = useState<RegisterDriverRequest>({
    rideTypeCode: '',
    licenceNumber: '',
    licenceExpiryDate: '',
    licenceFront: '',
    licenceBack: '',
    vehicleCategoryCode: '',
    vehicleCompanyCode: '',
    vehicleModelCode: '',
    vehicleNumber: '',
    vehicleColor: '',
    manufacturingYear: '',
    rcFront: '',
    rcBack: '',
    insurance: '',
    pollutionCertificate: '',
  });

  const updateField = <K extends keyof RegisterDriverRequest>(
    field: K,
    value: RegisterDriverRequest[K],
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      rideTypeCode: '',
      licenceNumber: '',
      licenceExpiryDate: '',
      licenceFront: '',
      licenceBack: '',
      vehicleCategoryCode: '',
      vehicleCompanyCode: '',
      vehicleModelCode: '',
      vehicleNumber: '',
      vehicleColor: '',
      manufacturingYear: '',
      rcFront: '',
      rcBack: '',
      insurance: '',
      pollutionCertificate: '',
    });
  };

  const isFormValid = () => {
    const requiredFields: (keyof RegisterDriverRequest)[] = [
      'rideTypeCode',
      'licenceNumber',
      'licenceExpiryDate',
      'licenceFront',
      'licenceBack',
      'vehicleCategoryCode',
      'vehicleCompanyCode',
      'vehicleModelCode',
      'vehicleNumber',
      'vehicleColor',
      'manufacturingYear',
      'rcFront',
      'rcBack',
    ];

    return requiredFields.every(
      field => formData[field] && formData[field].trim() !== '',
    );
  };

  return {
    formData,
    updateField,
    resetForm,
    isFormValid: isFormValid(),
  };
};
