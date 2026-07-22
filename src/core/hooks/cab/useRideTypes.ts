// hooks/cab/useRideTypes.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { fetchRideTypes } from '../../services/cab/cabService';
import { RideType } from '../../types/CabTypes';

interface UseRideTypesReturn {
  isLoading: boolean;
  rideTypes: RideType[];
  selectedRideType: RideType | null;
  fetchRideTypesData: () => Promise<void>;
  selectRideType: (code: string) => void;
  getRideTypeLabel: (code: string) => string;
}

export const useRideTypes = (): UseRideTypesReturn => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [rideTypes, setRideTypes] = useState<RideType[]>([]);
  const [selectedRideType, setSelectedRideType] = useState<RideType | null>(
    null,
  );

  const fetchRideTypesData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fetchRideTypes();
      if (result.success && result.rideTypes) {
        setRideTypes(result.rideTypes);
      } else {
        Alert.alert('Error', result.message || 'Failed to fetch ride types');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectRideType = useCallback(
    (code: string) => {
      if (!code) {
        setSelectedRideType(null);
        return;
      }
      const rideType = rideTypes.find(rt => rt.code === code);
      if (rideType) {
        setSelectedRideType(rideType);
      }
    },
    [rideTypes],
  );

  const getRideTypeLabel = useCallback(
    (code: string): string => {
      if (!code) return 'Select Ride Type';
      const rideType = rideTypes.find(rt => rt.code === code);
      return rideType ? rideType.name : 'Select Ride Type';
    },
    [rideTypes],
  );

  // ✅ Auto-fetch on mount
  useEffect(() => {
    fetchRideTypesData();
  }, []);

  return {
    isLoading,
    rideTypes,
    selectedRideType,
    fetchRideTypesData,
    selectRideType,
    getRideTypeLabel,
  };
};
