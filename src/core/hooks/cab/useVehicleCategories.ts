import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { fetchVehicleCategories } from '../../services/cab/cabService';
import {
  VehicleCategory,
  VehicleCompany,
  VehicleModel,
} from '../../types/CabTypes';

interface UseVehicleCategoriesReturn {
  isLoading: boolean;
  categories: VehicleCategory[];
  selectedCategory: VehicleCategory | null;
  selectedCompany: VehicleCompany | null;
  selectedModel: VehicleModel | null;
  companies: VehicleCompany[];
  models: VehicleModel[];
  fetchCategories: () => Promise<void>;
  selectCategory: (categoryCode: string) => void;
  selectCompany: (companyCode: string) => void;
  selectModel: (modelCode: string) => void;
  getCategoryCode: (category: string) => string;
  getCompanyCode: (companyName: string) => string;
  getModelCode: (modelName: string) => string;
  resetSelection: () => void;
}

export const useVehicleCategories = (): UseVehicleCategoriesReturn => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<VehicleCategory | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<VehicleCompany | null>(
    null,
  );
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [companies, setCompanies] = useState<VehicleCompany[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);

  // ✅ Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fetchVehicleCategories();

      if (result.success && result.categories) {
        setCategories(result.categories);
      } else {
        Alert.alert(
          'Error',
          result.message || 'Failed to fetch vehicle categories',
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ✅ Select category
  const selectCategory = useCallback(
    (categoryCode: string) => {
      const category = categories.find(c => c.code === categoryCode);
      if (category) {
        setSelectedCategory(category);
        setSelectedCompany(null);
        setSelectedModel(null);
        setCompanies(category.companies);
        setModels([]);
      }
    },
    [categories],
  );

  // ✅ Select company
  const selectCompany = useCallback(
    (companyCode: string) => {
      if (selectedCategory) {
        const company = selectedCategory.companies.find(
          c => c.code === companyCode,
        );
        if (company) {
          setSelectedCompany(company);
          setSelectedModel(null);
          setModels(company.models);
        }
      }
    },
    [selectedCategory],
  );

  // ✅ Select model
  const selectModel = useCallback(
    (modelCode: string) => {
      if (selectedCompany) {
        const model = selectedCompany.models.find(m => m.code === modelCode);
        if (model) {
          setSelectedModel(model);
        }
      }
    },
    [selectedCompany],
  );

  // ✅ Get category code by name
  const getCategoryCode = useCallback(
    (category: string): string => {
      const found = categories.find(
        c => c.category.toLowerCase() === category.toLowerCase(),
      );
      return found?.code || '';
    },
    [categories],
  );

  // ✅ Get company code by name
  const getCompanyCode = useCallback(
    (companyName: string): string => {
      if (selectedCategory) {
        const found = selectedCategory.companies.find(
          c => c.name.toLowerCase() === companyName.toLowerCase(),
        );
        return found?.code || '';
      }
      return '';
    },
    [selectedCategory],
  );

  // ✅ Get model code by name
  const getModelCode = useCallback(
    (modelName: string): string => {
      if (selectedCompany) {
        const found = selectedCompany.models.find(
          m => m.name.toLowerCase() === modelName.toLowerCase(),
        );
        return found?.code || '';
      }
      return '';
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
  }, []);

  // ✅ Initial fetch
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    isLoading,
    categories,
    selectedCategory,
    selectedCompany,
    selectedModel,
    companies,
    models,
    fetchCategories,
    selectCategory,
    selectCompany,
    selectModel,
    getCategoryCode,
    getCompanyCode,
    getModelCode,
    resetSelection,
  };
};
