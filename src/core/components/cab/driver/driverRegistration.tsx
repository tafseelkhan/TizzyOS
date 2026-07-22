import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useCabDriver, useDriverForm } from '../../../hooks/cab/useCabDriver';
import { useVehicleCategories } from '../../../hooks/cab/useVehicleCategories';
import { useRideTypes } from '../../../hooks/cab/useRideTypes';
import { pickImage, ImageResult } from '../../../services/cab/cabService';
import DocumentUpload from './documentUpload';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const CabDriverRegistration = () => {
  const navigation =
    useNavigation<NavigationProp<Record<string, object | undefined>>>();

  // ✅ Hooks
  const { register, isLoading, isRegistered, checkStatus } = useCabDriver();
  const { formData, updateField, resetForm } = useDriverForm();
  const {
    isLoading: rideTypesLoading,
    rideTypes,
    getRideTypeLabel,
    selectRideType,
  } = useRideTypes();
  const {
    isLoading: categoriesLoading,
    isLoadingFiltered,
    filteredCategories,
    companies,
    models,
    selectedModel,
    rideTypeInfo,
    fetchFilteredCategories,
    selectCategory,
    selectCompany,
    selectModel,
    getCategoryLabel,
    getCompanyLabel,
    getModelLabel,
  } = useVehicleCategories();

  // ✅ Local states for image uploads
  const [licenceFront, setLicenceFront] = useState<ImageResult | null>(null);
  const [licenceBack, setLicenceBack] = useState<ImageResult | null>(null);
  const [rcFront, setRcFront] = useState<ImageResult | null>(null);
  const [rcBack, setRcBack] = useState<ImageResult | null>(null);
  const [insurance, setInsurance] = useState<ImageResult | null>(null);
  const [pollution, setPollution] = useState<ImageResult | null>(null);

  // ✅ Modal states
  const [showRideTypePicker, setShowRideTypePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // ✅ Check status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // ✅ Auto navigate if already registered
  useEffect(() => {
    if (
      isRegistered &&
      navigation &&
      typeof navigation.navigate === 'function'
    ) {
      navigation.navigate('DriverStatus');
    }
  }, [isRegistered, navigation]);

  // ✅ Handle image pick
  const handlePickImage = async (field: string) => {
    const image = await pickImage();
    if (image) {
      switch (field) {
        case 'licenceFront':
          setLicenceFront(image);
          updateField('licenceFront', image.base64);
          break;
        case 'licenceBack':
          setLicenceBack(image);
          updateField('licenceBack', image.base64);
          break;
        case 'rcFront':
          setRcFront(image);
          updateField('rcFront', image.base64);
          break;
        case 'rcBack':
          setRcBack(image);
          updateField('rcBack', image.base64);
          break;
        case 'insurance':
          setInsurance(image);
          updateField('insurance', image.base64);
          break;
        case 'pollution':
          setPollution(image);
          updateField('pollutionCertificate', image.base64);
          break;
      }
    }
  };

  // ✅ Handle ride type selection - SEND rideTypeCode to backend
  const handleRideTypeSelect = (code: string) => {
    selectRideType(code);
    updateField('rideTypeCode', code); // ✅ This will be sent to backend
    setShowRideTypePicker(false);
    // ✅ Fetch filtered categories when ride type is selected
    fetchFilteredCategories(code);
  };

  // ✅ Handle category selection
  const handleCategorySelect = (categoryCode: string) => {
    selectCategory(categoryCode);
    updateField('vehicleCategoryCode', categoryCode);
    updateField('vehicleCompanyCode', '');
    updateField('vehicleModelCode', '');
    setShowCategoryPicker(false);
  };

  // ✅ Handle company selection
  const handleCompanySelect = (companyCode: string) => {
    selectCompany(companyCode);
    updateField('vehicleCompanyCode', companyCode);
    updateField('vehicleModelCode', '');
    setShowCompanyPicker(false);
  };

  // ✅ Handle model selection
  const handleModelSelect = (modelCode: string) => {
    selectModel(modelCode);
    updateField('vehicleModelCode', modelCode);
    setShowModelPicker(false);
  };

  // ✅ Handle registration - backend ko rideTypeCode bhejega
  const handleRegister = async () => {
    try {
      // ✅ formData contains rideTypeCode, vehicleCategoryCode, vehicleCompanyCode, vehicleModelCode, etc.
      const success = await register(formData);
      if (success) {
        resetForm();
        setLicenceFront(null);
        setLicenceBack(null);
        setRcFront(null);
        setRcBack(null);
        setInsurance(null);
        setPollution(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to register driver');
    }
  };

  // ✅ Check if form is valid
  const isFormValid = () => {
    const requiredFields = [
      'rideTypeCode', // ✅ This must be selected
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
      field =>
        formData[field as keyof typeof formData] &&
        formData[field as keyof typeof formData] !== '',
    );
  };

  // ✅ If already registered, don't render
  if (isRegistered) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Section */}
          <View style={styles.headerContainer}>
            <View style={styles.headerIconContainer}>
              <Icon name="car-sport" size={34} color="#3B82F6" />
            </View>
            <Text style={styles.title}>Driver Registration</Text>
            <Text style={styles.subtitle}>
              Join our fleet and start earning today
            </Text>
          </View>

          {/* ✅ RIDE TYPE SELECTION - FIRST STEP (Required) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="layers" size={20} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Select Ride Type</Text>
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredBadgeText}>Required</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Ride Type <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setShowRideTypePicker(true)}
                disabled={rideTypesLoading}
              >
                <View style={styles.selectLeft}>
                  <Icon
                    name="car"
                    size={18}
                    color="#9CA3AF"
                    style={styles.selectIcon}
                  />
                  <Text
                    style={
                      formData.rideTypeCode
                        ? styles.selectText
                        : styles.selectPlaceholder
                    }
                  >
                    {rideTypesLoading
                      ? 'Loading...'
                      : getRideTypeLabel(formData.rideTypeCode)}
                  </Text>
                </View>
                <Icon name="chevron-down" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {formData.rideTypeCode && rideTypeInfo && (
              <View style={styles.infoBox}>
                <Icon name="information-circle" size={16} color="#3B82F6" />
                <Text style={styles.infoText}>{rideTypeInfo.description}</Text>
              </View>
            )}

            {!formData.rideTypeCode && (
              <Text style={styles.hintText}>
                ⚠️ Please select a ride type to continue
              </Text>
            )}
          </View>

          {/* ✅ Licence Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="document-text" size={20} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Licence Details</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Licence Number <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Icon
                  name="card"
                  size={18}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter licence number"
                  placeholderTextColor="#9CA3AF"
                  value={formData.licenceNumber}
                  onChangeText={text => updateField('licenceNumber', text)}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Expiry Date <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Icon
                  name="calendar"
                  size={18}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={formData.licenceExpiryDate}
                  onChangeText={text => updateField('licenceExpiryDate', text)}
                />
              </View>
            </View>

            <DocumentUpload
              label="Licence Front *"
              image={licenceFront}
              onPress={() => handlePickImage('licenceFront')}
            />

            <DocumentUpload
              label="Licence Back *"
              image={licenceBack}
              onPress={() => handlePickImage('licenceBack')}
            />
          </View>

          {/* ✅ Vehicle Section - Only after ride type selection */}
          {formData.rideTypeCode && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="car" size={20} color="#3B82F6" />
                <Text style={styles.sectionTitle}>Vehicle Details</Text>
              </View>

              {/* Category Picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Category <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setShowCategoryPicker(true)}
                  disabled={
                    isLoadingFiltered || filteredCategories.length === 0
                  }
                >
                  <View style={styles.selectLeft}>
                    <Icon
                      name="grid"
                      size={18}
                      color="#9CA3AF"
                      style={styles.selectIcon}
                    />
                    <Text
                      style={
                        formData.vehicleCategoryCode
                          ? styles.selectText
                          : styles.selectPlaceholder
                      }
                    >
                      {isLoadingFiltered
                        ? 'Loading...'
                        : getCategoryLabel(formData.vehicleCategoryCode)}
                    </Text>
                  </View>
                  <Icon name="chevron-down" size={18} color="#6B7280" />
                </TouchableOpacity>
                {filteredCategories.length === 0 && !isLoadingFiltered && (
                  <Text style={styles.hintText}>
                    No vehicles available for this ride type
                  </Text>
                )}
              </View>

              {/* Company Picker */}
              {formData.vehicleCategoryCode && companies.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Company <Text style={styles.required}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.selectInput}
                    onPress={() => setShowCompanyPicker(true)}
                  >
                    <View style={styles.selectLeft}>
                      <Icon
                        name="business"
                        size={18}
                        color="#9CA3AF"
                        style={styles.selectIcon}
                      />
                      <Text
                        style={
                          formData.vehicleCompanyCode
                            ? styles.selectText
                            : styles.selectPlaceholder
                        }
                      >
                        {getCompanyLabel(formData.vehicleCompanyCode)}
                      </Text>
                    </View>
                    <Icon name="chevron-down" size={18} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Model Picker */}
              {formData.vehicleCompanyCode && models.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Model <Text style={styles.required}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.selectInput}
                    onPress={() => setShowModelPicker(true)}
                  >
                    <View style={styles.selectLeft}>
                      <Icon
                        name="cube"
                        size={18}
                        color="#9CA3AF"
                        style={styles.selectIcon}
                      />
                      <Text
                        style={
                          formData.vehicleModelCode
                            ? styles.selectText
                            : styles.selectPlaceholder
                        }
                      >
                        {getModelLabel(formData.vehicleModelCode)}
                      </Text>
                    </View>
                    <Icon name="chevron-down" size={18} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Show selected model details */}
              {selectedModel && (
                <View style={styles.modelDetailsContainer}>
                  <Text style={styles.modelDetailsTitle}>
                    Vehicle Specifications
                  </Text>
                  <View style={styles.modelDetailsGrid}>
                    <View style={styles.modelDetailItem}>
                      <Text style={styles.modelDetailLabel}>Type</Text>
                      <Text style={styles.modelDetailValue}>
                        {selectedModel.vehicleType}
                      </Text>
                    </View>
                    <View style={styles.modelDetailItem}>
                      <Text style={styles.modelDetailLabel}>Class</Text>
                      <Text style={styles.modelDetailValue}>
                        {selectedModel.vehicleClass}
                      </Text>
                    </View>
                    <View style={styles.modelDetailItem}>
                      <Text style={styles.modelDetailLabel}>AC</Text>
                      <Text style={styles.modelDetailValue}>
                        {selectedModel.hasAC ? 'Yes ✅' : 'No ❌'}
                      </Text>
                    </View>
                    <View style={styles.modelDetailItem}>
                      <Text style={styles.modelDetailLabel}>Passengers</Text>
                      <Text style={styles.modelDetailValue}>
                        {selectedModel.passengerCapacity}
                      </Text>
                    </View>
                    <View style={styles.modelDetailItem}>
                      <Text style={styles.modelDetailLabel}>Luggage</Text>
                      <Text style={styles.modelDetailValue}>
                        {selectedModel.luggageCapacity} bags
                      </Text>
                    </View>
                    <View style={styles.modelDetailItem}>
                      <Text style={styles.modelDetailLabel}>Hand Bags</Text>
                      <Text style={styles.modelDetailValue}>
                        {selectedModel.handBagCapacity}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Vehicle Number <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <Icon
                    name="car-outline"
                    size={18}
                    color="#9CA3AF"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="KA01AB1234"
                    placeholderTextColor="#9CA3AF"
                    value={formData.vehicleNumber}
                    onChangeText={text => updateField('vehicleNumber', text)}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <View style={styles.rowContainer}>
                <View style={[styles.halfWidth, { marginRight: 8 }]}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Color <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <Icon
                        name="color-palette"
                        size={18}
                        color="#9CA3AF"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="White"
                        placeholderTextColor="#9CA3AF"
                        value={formData.vehicleColor}
                        onChangeText={text => updateField('vehicleColor', text)}
                      />
                    </View>
                  </View>
                </View>
                <View style={[styles.halfWidth, { marginLeft: 8 }]}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Year <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <Icon
                        name="calendar-outline"
                        size={18}
                        color="#9CA3AF"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="2022"
                        placeholderTextColor="#9CA3AF"
                        value={formData.manufacturingYear}
                        onChangeText={text =>
                          updateField('manufacturingYear', text)
                        }
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Documents Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="document-attach" size={20} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Vehicle Documents</Text>
            </View>

            <DocumentUpload
              label="RC Front *"
              image={rcFront}
              onPress={() => handlePickImage('rcFront')}
            />

            <DocumentUpload
              label="RC Back *"
              image={rcBack}
              onPress={() => handlePickImage('rcBack')}
            />

            <DocumentUpload
              label="Insurance"
              image={insurance}
              onPress={() => handlePickImage('insurance')}
              optional
            />

            <DocumentUpload
              label="Pollution Certificate"
              image={pollution}
              onPress={() => handlePickImage('pollution')}
              optional
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isFormValid() || isLoading) && styles.submitButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={!isFormValid() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Register Driver</Text>
                <Icon name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By registering, you agree to our{' '}
              <Text style={styles.footerLink}>Terms & Conditions</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ✅ RIDE TYPE PICKER MODAL */}
      <Modal
        visible={showRideTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRideTypePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Ride Type</Text>
              <TouchableOpacity onPress={() => setShowRideTypePicker(false)}>
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {rideTypes.map(rideType => (
                <TouchableOpacity
                  key={rideType.code}
                  style={styles.modalItem}
                  onPress={() => handleRideTypeSelect(rideType.code)}
                >
                  <View style={styles.modalItemLeft}>
                    <Text style={styles.modalItemText}>{rideType.name}</Text>
                    <Text style={styles.modalItemSubtext} numberOfLines={2}>
                      {rideType.description}
                    </Text>
                    <View style={styles.modalItemClasses}>
                      <Text style={styles.modalItemClassesText}>
                        Classes: {rideType.vehicleClasses.join(', ')}
                      </Text>
                    </View>
                  </View>
                  {formData.rideTypeCode === rideType.code && (
                    <Icon name="checkmark-circle" size={22} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ✅ Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredCategories.map(category => (
                <TouchableOpacity
                  key={category.code}
                  style={styles.modalItem}
                  onPress={() => handleCategorySelect(category.code)}
                >
                  <Text style={styles.modalItemText}>{category.category}</Text>
                  {formData.vehicleCategoryCode === category.code && (
                    <Icon name="checkmark-circle" size={22} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ✅ Company Picker Modal */}
      <Modal
        visible={showCompanyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCompanyPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Company</Text>
              <TouchableOpacity onPress={() => setShowCompanyPicker(false)}>
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {companies.map(company => (
                <TouchableOpacity
                  key={company.code}
                  style={styles.modalItem}
                  onPress={() => handleCompanySelect(company.code)}
                >
                  <Text style={styles.modalItemText}>{company.name}</Text>
                  {formData.vehicleCompanyCode === company.code && (
                    <Icon name="checkmark-circle" size={22} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ✅ Model Picker Modal */}
      <Modal
        visible={showModelPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModelPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Model</Text>
              <TouchableOpacity onPress={() => setShowModelPicker(false)}>
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {models.map(model => (
                <TouchableOpacity
                  key={model.code}
                  style={styles.modalItem}
                  onPress={() => handleModelSelect(model.code)}
                >
                  <View style={styles.modalItemLeft}>
                    <Text style={styles.modalItemText}>{model.name}</Text>
                    <Text style={styles.modalItemSubtext}>
                      {model.vehicleType} • {model.vehicleClass} •{' '}
                      {model.passengerCapacity} seats
                    </Text>
                  </View>
                  {formData.vehicleModelCode === model.code && (
                    <Icon name="checkmark-circle" size={22} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ============ STYLES ============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  headerIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 10,
    letterSpacing: 0.3,
    flex: 1,
  },
  requiredBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 5,
  },
  required: {
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputIcon: {
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 11,
    fontSize: 14,
    color: '#1A1A1A',
  },
  selectInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectIcon: {
    marginRight: 10,
  },
  selectText: {
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
  },
  selectPlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
    flex: 1,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#3B82F6',
    marginLeft: 8,
    lineHeight: 16,
  },
  hintText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
  },
  modelDetailsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modelDetailsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  modelDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  modelDetailItem: {
    width: '33.33%',
    marginBottom: 6,
  },
  modelDetailLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  modelDetailValue: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
  },
  footer: {
    marginTop: 18,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  footerLink: {
    color: '#3B82F6',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  modalItemText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  modalItemSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  modalItemClasses: {
    marginTop: 4,
  },
  modalItemClassesText: {
    fontSize: 10,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
});

export default CabDriverRegistration;
