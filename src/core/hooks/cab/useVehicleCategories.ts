// hooks/cab/useVehicleCategories.ts
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  fetchAllVehicleCategories,
  fetchFilteredCategories as fetchFilteredCategoriesService,
} from '../../services/cab/cabService';
import {
  VehicleCategory,
  Company,
  Model,
  RideType,
} from '../../types/CabTypes';

interface UseVehicleCategoriesReturn {
  isLoading: boolean;
  isLoadingFiltered: boolean;
  categories: VehicleCategory[];
  filteredCategories: VehicleCategory[];
  companies: Company[];
  models: Model[];
  selectedCategory: VehicleCategory | null;
  selectedCompany: Company | null;
  selectedModel: Model | null;
  rideTypeInfo: RideType | null;

  fetchCategories: () => Promise<void>;
  fetchFilteredCategories: (rideTypeCode: string) => Promise<void>;
  selectCategory: (categoryCode: string) => void;
  selectCompany: (companyCode: string) => void;
  selectModel: (modelCode: string) => void;
  resetSelection: () => void;
  getCategoryLabel: (code: string) => string;
  getCompanyLabel: (code: string) => string;
  getModelLabel: (code: string) => string;
}

export const useVehicleCategories = (): UseVehicleCategoriesReturn => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingFiltered, setIsLoadingFiltered] = useState<boolean>(false);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<
    VehicleCategory[]
  >([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<VehicleCategory | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [rideTypeInfo, setRideTypeInfo] = useState<RideType | null>(null);

  // ✅ Fetch all categories
  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fetchAllVehicleCategories();
      if (result.success && result.categories) {
        setCategories(result.categories);
      } else {
        Alert.alert('Error', result.message || 'Failed to fetch categories');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ✅ Fetch filtered categories by ride type
  const fetchFilteredCategories = useCallback(async (rideTypeCode: string) => {
    if (!rideTypeCode) {
      console.warn('fetchFilteredCategories: No rideTypeCode provided');
      setFilteredCategories([]);
      setRideTypeInfo(null);
      return;
    }

    try {
      setIsLoadingFiltered(true);
      const result = await fetchFilteredCategoriesService(rideTypeCode);
      if (result.success && result.categories) {
        setFilteredCategories(result.categories);
        setRideTypeInfo(result.rideType || null);
        // Reset selections
        setCompanies([]);
        setModels([]);
        setSelectedCategory(null);
        setSelectedCompany(null);
        setSelectedModel(null);
      } else {
        Alert.alert(
          'Error',
          result.message || 'Failed to fetch filtered categories',
        );
        setFilteredCategories([]);
        setRideTypeInfo(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setFilteredCategories([]);
      setRideTypeInfo(null);
    } finally {
      setIsLoadingFiltered(false);
    }
  }, []);

  // ✅ Select category
  const selectCategory = useCallback(
    (categoryCode: string) => {
      if (!categoryCode) {
        setSelectedCategory(null);
        setCompanies([]);
        setModels([]);
        return;
      }
      const category = filteredCategories.find(c => c.code === categoryCode);
      if (category) {
        setSelectedCategory(category);
        setSelectedCompany(null);
        setSelectedModel(null);
        setCompanies(category.companies || []);
        setModels([]);
      }
    },
    [filteredCategories],
  );

  // ✅ Select company
  const selectCompany = useCallback(
    (companyCode: string) => {
      if (!companyCode || !selectedCategory) {
        setSelectedCompany(null);
        setModels([]);
        return;
      }
      const company = selectedCategory.companies?.find(
        c => c.code === companyCode,
      );
      if (company) {
        setSelectedCompany(company);
        setSelectedModel(null);
        setModels(company.models || []);
      }
    },
    [selectedCategory],
  );

  // ✅ Select model
  const selectModel = useCallback(
    (modelCode: string) => {
      if (!modelCode || !selectedCompany) {
        setSelectedModel(null);
        return;
      }
      const model = selectedCompany.models?.find(m => m.code === modelCode);
      if (model) {
        setSelectedModel(model);
      }
    },
    [selectedCompany],
  );

  // ✅ Reset selection
  const resetSelection = useCallback(() => {
    setSelectedCategory(null);
    setSelectedCompany(null);
    setSelectedModel(null);
    setCompanies([]);
    setModels([]);
    setFilteredCategories([]);
    setRideTypeInfo(null);
  }, []);

  // ✅ Get labels - with null checks
  const getCategoryLabel = useCallback(
    (code: string): string => {
      if (!code) return 'Select Category';
      const category = filteredCategories.find(c => c.code === code);
      return category ? category.category : 'Select Category';
    },
    [filteredCategories],
  );

  const getCompanyLabel = useCallback(
    (code: string): string => {
      if (!code) return 'Select Company';
      const company = companies.find(c => c.code === code);
      return company ? company.name : 'Select Company';
    },
    [companies],
  );

  const getModelLabel = useCallback(
    (code: string): string => {
      if (!code) return 'Select Model';
      const model = models.find(m => m.code === code);
      return model ? model.name : 'Select Model';
    },
    [models],
  );

  return {
    isLoading,
    isLoadingFiltered,
    categories,
    filteredCategories,
    companies,
    models,
    selectedCategory,
    selectedCompany,
    selectedModel,
    rideTypeInfo,
    fetchCategories,
    fetchFilteredCategories,
    selectCategory,
    selectCompany,
    selectModel,
    resetSelection,
    getCategoryLabel,
    getCompanyLabel,
    getModelLabel,
  };
};
