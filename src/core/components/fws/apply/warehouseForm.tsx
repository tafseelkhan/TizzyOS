import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  SafeAreaView,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Geolocation from 'react-native-get-location';
import { WarehouseFormData } from '../../../types/WarehouseTypes';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

interface Props {
  onSubmit: (data: WarehouseFormData) => Promise<void>;
}

interface PickerOption {
  label: string;
  value: string;
  icon: string;
  description?: string;
}

const WarehouseForm: React.FC<Props> = ({ onSubmit }) => {
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);

  const inputRefs = useRef<{ [key: string]: TextInput | null }>({});
  const scrollViewRef = useRef<ScrollView>(null);

  const [formData, setFormData] = useState<WarehouseFormData>({
    name: '',
    city: '',
    state: '',
    pincode: '',
    address: '',
    latitude: 0,
    longitude: 0,
    phone: '',
    email: '',
    managerName: '',
    managerPhone: '',
    fwsType: 'LOCAL',
    coverageKm: 50,
    maxDailyOrders: 0,
  });

  const [formProgress, setFormProgress] = useState(0);

  const fwsOptions: PickerOption[] = [
    {
      label: 'Local',
      value: 'LOCAL',
      icon: 'store',
      description: 'Serves within city limits',
    },
    {
      label: 'Regional',
      value: 'REGIONAL',
      icon: 'business',
      description: 'Serves multiple cities',
    },
    {
      label: 'National',
      value: 'NATIONAL',
      icon: 'public',
      description: 'Serves across the country',
    },
  ];

  useEffect(() => {
    const filledFields = Object.values(formData).filter(
      val => val !== '' && val !== 0 && val !== 'LOCAL',
    ).length;
    const totalFields = 12;
    const progress = Math.round((filledFields / totalFields) * 100);
    setFormProgress(Math.min(progress, 100));
  }, [formData]);

  const handleInputChange = (field: keyof WarehouseFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleFocus = (field: string) => {
    setFocusedField(field);
  };

  const handleBlur = () => {
    setFocusedField(null);
  };

  const getCurrentLocation = async () => {
    try {
      setGettingLocation(true);
      const location = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });

      setFormData({
        ...formData,
        latitude: location.latitude,
        longitude: location.longitude,
      });
    } catch (error) {
      Alert.alert(
        'Location Error',
        'Unable to get location. Please check GPS and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: getCurrentLocation },
        ],
      );
    } finally {
      setGettingLocation(false);
    }
  };

  const validateForm = (): boolean => {
    const validations = [
      { field: formData.name.trim(), message: 'Please enter warehouse name' },
      { field: formData.city.trim(), message: 'Please enter city' },
      { field: formData.state.trim(), message: 'Please enter state' },
      {
        field: formData.pincode.trim() && formData.pincode.length >= 5,
        message: 'Please enter valid pincode',
      },
      { field: formData.address.trim(), message: 'Please enter address' },
      {
        field: formData.latitude !== 0 && formData.longitude !== 0,
        message: 'Please get current location',
      },
      {
        field: formData.phone.trim() && formData.phone.length >= 10,
        message: 'Please enter valid phone number',
      },
      {
        field: formData.email.trim() && formData.email.includes('@'),
        message: 'Please enter valid email',
      },
      {
        field: formData.managerName.trim(),
        message: 'Please enter manager name',
      },
      {
        field:
          formData.managerPhone.trim() && formData.managerPhone.length >= 10,
        message: 'Please enter valid manager phone',
      },
    ];

    for (const validation of validations) {
      if (!validation.field) {
        Alert.alert('Validation Error', validation.message);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validateForm()) return;

    try {
      setLoading(true);
      await onSubmit(formData);

      setShowSuccessModal(true);

      setTimeout(() => {
        setShowSuccessModal(false);
        setFormData({
          name: '',
          city: '',
          state: '',
          pincode: '',
          address: '',
          latitude: 0,
          longitude: 0,
          phone: '',
          email: '',
          managerName: '',
          managerPhone: '',
          fwsType: 'LOCAL',
          coverageKm: 50,
          maxDailyOrders: 0,
        });
      }, 3000);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const openPickerModal = () => {
    Keyboard.dismiss();
    setShowPickerModal(true);
  };

  const closePickerModal = () => {
    setShowPickerModal(false);
  };

  const selectPickerOption = (value: string) => {
    handleInputChange('fwsType', value);
    closePickerModal();
  };

  const getSelectedOption = () => {
    return (
      fwsOptions.find(opt => opt.value === formData.fwsType) || fwsOptions[0]
    );
  };

  const renderInput = (
    field: keyof WarehouseFormData,
    label: string,
    placeholder: string,
    icon: string,
    options?: {
      keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
      maxLength?: number;
      multiline?: boolean;
      numberOfLines?: number;
      secureTextEntry?: boolean;
      returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
      onSubmitEditing?: () => void;
    },
  ) => {
    const isFocused = focusedField === field;
    const value = formData[field]?.toString() || '';
    const hasValue = value.length > 0;

    return (
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{label}</Text>
        <View
          style={[
            styles.inputContainer,
            isFocused && styles.inputContainerFocused,
            hasValue && styles.inputContainerValid,
          ]}
        >
          <Icon
            name={icon}
            size={20}
            color={isFocused ? '#2563EB' : hasValue ? '#10B981' : '#94A3B8'}
            style={styles.inputIcon}
          />
          <TextInput
            ref={ref => { inputRefs.current[field] = ref; }}
            style={[styles.input, options?.multiline && styles.textArea]}
            placeholder={placeholder}
            placeholderTextColor="#94A3B8"
            value={value}
            onChangeText={text => handleInputChange(field, text)}
            keyboardType={options?.keyboardType || 'default'}
            maxLength={options?.maxLength}
            multiline={options?.multiline}
            numberOfLines={options?.numberOfLines}
            secureTextEntry={options?.secureTextEntry}
            returnKeyType={options?.returnKeyType || 'next'}
            blurOnSubmit={false}
            onFocus={() => handleFocus(field)}
            onBlur={handleBlur}
            onSubmitEditing={() => {
              if (options?.onSubmitEditing) {
                options.onSubmitEditing();
              }
            }}
          />
          {hasValue && (
            <Icon
              name="check-circle"
              size={18}
              color="#10B981"
              style={styles.inputRightIcon}
            />
          )}
        </View>
      </View>
    );
  };

  const renderSection = (
    title: string,
    icon: string,
    children: React.ReactNode,
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Icon name={icon} size={20} color="#2563EB" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const renderCustomPicker = () => {
    const selected = getSelectedOption();

    return (
      <>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>FWS Type</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openPickerModal}
            disabled={loading}
          >
            <View style={styles.pickerButton}>
              <View style={styles.pickerButtonContent}>
                <View style={styles.pickerIconContainer}>
                  <Icon name={selected.icon} size={22} color="#2563EB" />
                </View>
                <View style={styles.pickerTextContainer}>
                  <Text style={styles.pickerSelectedLabel}>
                    {selected.label}
                  </Text>
                  {selected.description && (
                    <Text style={styles.pickerSelectedDescription}>
                      {selected.description}
                    </Text>
                  )}
                </View>
                <Icon name="expand-more" size={26} color="#64748B" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {showPickerModal && (
          <Modal
            transparent
            visible={showPickerModal}
            animationType="slide"
            onRequestClose={closePickerModal}
          >
            <TouchableWithoutFeedback onPress={closePickerModal}>
              <View style={styles.pickerModalOverlay}>
                <TouchableWithoutFeedback>
                  <View style={styles.pickerModalContent}>
                    <View style={styles.pickerModalHeader}>
                      <Text style={styles.pickerModalTitle}>
                        Select FWS Type
                      </Text>
                      <TouchableOpacity
                        onPress={closePickerModal}
                        style={styles.pickerModalClose}
                      >
                        <Icon name="close" size={24} color="#64748B" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.pickerModalDivider} />

                    {fwsOptions.map((option, index) => {
                      const isSelected = formData.fwsType === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.pickerOption,
                            isSelected && styles.pickerOptionSelected,
                            index === fwsOptions.length - 1 &&
                              styles.pickerOptionLast,
                          ]}
                          onPress={() => selectPickerOption(option.value)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.pickerOptionIcon}>
                            <View
                              style={[
                                styles.pickerOptionIconCircle,
                                isSelected &&
                                  styles.pickerOptionIconCircleSelected,
                              ]}
                            >
                              <Icon
                                name={option.icon}
                                size={22}
                                color={isSelected ? '#2563EB' : '#94A3B8'}
                              />
                            </View>
                          </View>
                          <View style={styles.pickerOptionContent}>
                            <Text
                              style={[
                                styles.pickerOptionLabel,
                                isSelected && styles.pickerOptionLabelSelected,
                              ]}
                            >
                              {option.label}
                            </Text>
                            {option.description && (
                              <Text
                                style={[
                                  styles.pickerOptionDescription,
                                  isSelected &&
                                    styles.pickerOptionDescriptionSelected,
                                ]}
                              >
                                {option.description}
                              </Text>
                            )}
                          </View>
                          {isSelected && (
                            <View style={styles.pickerOptionCheck}>
                              <Icon
                                name="check-circle"
                                size={22}
                                color="#2563EB"
                              />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={styles.pickerCancelButton}
                      onPress={closePickerModal}
                    >
                      <Text style={styles.pickerCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => {}}>
            <Icon name="arrow-back-ios" size={22} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Warehouse Registration</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.content}>
            {/* Progress Card */}
            <View style={styles.progressCard}>
              <LinearGradient
                colors={['#2563EB', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.progressGradient}
              >
                <View style={styles.progressHeader}>
                  <View>
                    <Text style={styles.progressTitle}>
                      Application Progress
                    </Text>
                    <Text style={styles.progressSubtitle}>
                      {formProgress}% Complete
                    </Text>
                  </View>
                  <View style={styles.progressIconContainer}>
                    <Icon name="assignment" size={22} color="#FFF" />
                  </View>
                </View>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${formProgress}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.progressSteps}>
                  {['Info', 'Location', 'Contact', 'Manager', 'Settings'].map(
                    (step, index) => (
                      <View key={index} style={styles.stepContainer}>
                        <View
                          style={[
                            styles.stepDot,
                            index * 20 <= formProgress && styles.stepDotActive,
                          ]}
                        >
                          {index * 20 <= formProgress && (
                            <Icon name="check" size={10} color="#FFF" />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.stepLabel,
                            index * 20 <= formProgress &&
                              styles.stepLabelActive,
                          ]}
                        >
                          {step}
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              </LinearGradient>
            </View>

            {/* Basic Information */}
            {renderSection(
              'Basic Information',
              'info',
              renderInput(
                'name',
                'Warehouse Name',
                'Enter warehouse name',
                'store',
                {
                  returnKeyType: 'next',
                  onSubmitEditing: () => inputRefs.current['city']?.focus(),
                },
              ),
            )}

            {/* Location Details */}
            {renderSection(
              'Location Details',
              'location-on',
              <>
                {renderInput(
                  'city',
                  'City',
                  'Enter city name',
                  'location-city',
                  {
                    returnKeyType: 'next',
                    onSubmitEditing: () => inputRefs.current['state']?.focus(),
                  },
                )}
                {renderInput('state', 'State', 'Enter state name', 'map', {
                  returnKeyType: 'next',
                  onSubmitEditing: () => inputRefs.current['pincode']?.focus(),
                })}
                {renderInput(
                  'pincode',
                  'Pincode',
                  'Enter pincode',
                  'pin-drop',
                  {
                    keyboardType: 'numeric',
                    maxLength: 6,
                    returnKeyType: 'next',
                    onSubmitEditing: () =>
                      inputRefs.current['address']?.focus(),
                  },
                )}
                {renderInput(
                  'address',
                  'Address',
                  'Enter complete address',
                  'home',
                  {
                    multiline: true,
                    numberOfLines: 3,
                    returnKeyType: 'next',
                  },
                )}

                {renderCustomPicker()}

                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={getCurrentLocation}
                  disabled={gettingLocation}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#2563EB', '#1D4ED8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.locationGradient}
                  >
                    {gettingLocation ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Icon name="my-location" size={20} color="#FFF" />
                        <Text style={styles.locationButtonText}>
                          Get Current Location
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {formData.latitude !== 0 && (
                  <View style={styles.locationInfo}>
                    <Icon name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.locationInfoText}>
                      {formData.latitude.toFixed(6)},{' '}
                      {formData.longitude.toFixed(6)}
                    </Text>
                  </View>
                )}
              </>,
            )}

            {/* Contact Information */}
            {renderSection(
              'Contact Information',
              'contact-phone',
              <>
                {renderInput(
                  'phone',
                  'Phone Number',
                  'Enter phone number',
                  'phone',
                  {
                    keyboardType: 'phone-pad',
                    maxLength: 10,
                    returnKeyType: 'next',
                    onSubmitEditing: () => inputRefs.current['email']?.focus(),
                  },
                )}
                {renderInput(
                  'email',
                  'Email Address',
                  'Enter email address',
                  'email',
                  {
                    keyboardType: 'email-address',
                    returnKeyType: 'next',
                    onSubmitEditing: () =>
                      inputRefs.current['managerName']?.focus(),
                  },
                )}
              </>,
            )}

            {/* Manager Information */}
            {renderSection(
              'Manager Information',
              'badge',
              <>
                {renderInput(
                  'managerName',
                  'Manager Name',
                  'Enter full name',
                  'person',
                  {
                    returnKeyType: 'next',
                    onSubmitEditing: () =>
                      inputRefs.current['managerPhone']?.focus(),
                  },
                )}
                {renderInput(
                  'managerPhone',
                  'Manager Phone',
                  'Enter phone number',
                  'phone-android',
                  {
                    keyboardType: 'phone-pad',
                    maxLength: 10,
                    returnKeyType: 'next',
                    onSubmitEditing: () =>
                      inputRefs.current['coverageKm']?.focus(),
                  },
                )}
              </>,
            )}

            {/* Additional Settings */}
            {renderSection(
              'Additional Settings',
              'settings',
              <>
                {renderInput(
                  'coverageKm',
                  'Coverage (Km)',
                  'Enter coverage range',
                  'near-me',
                  {
                    keyboardType: 'numeric',
                    returnKeyType: 'next',
                    onSubmitEditing: () =>
                      inputRefs.current['maxDailyOrders']?.focus(),
                  },
                )}
                {renderInput(
                  'maxDailyOrders',
                  'Max Daily Orders',
                  '0 for unlimited',
                  'receipt',
                  {
                    keyboardType: 'numeric',
                    returnKeyType: 'done',
                  },
                )}
              </>,
            )}

            {/* Submit Button */}
            <View style={styles.submitContainer}>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#2563EB', '#1D4ED8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitGradient}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Icon name="send" size={22} color="#FFF" />
                      <Text style={styles.submitButtonText}>
                        Submit Application
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={styles.footerText}>
              All fields marked with <Text style={styles.requiredStar}>*</Text>{' '}
              are required
            </Text>
          </View>
        </ScrollView>

        {/* Success Modal */}
        <Modal visible={showSuccessModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.modalGradient}
              >
                <View style={styles.modalIconContainer}>
                  <Icon name="check-circle" size={56} color="#FFF" />
                </View>
                <Text style={styles.modalTitle}>Success!</Text>
                <Text style={styles.modalMessage}>
                  Your warehouse has been successfully registered.
                </Text>
                <View style={styles.modalFooter}>
                  <Icon name="verified" size={18} color="#FFF" />
                  <Text style={styles.modalFooterText}>
                    Application Submitted
                  </Text>
                </View>
              </LinearGradient>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
  },
  headerRight: {
    width: 40,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  content: {
    padding: 16,
  },
  progressCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  progressGradient: {
    padding: 18,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  progressSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  progressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 3,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  stepDotActive: {
    backgroundColor: '#FFF',
  },
  stepLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.5)',
  },
  stepLabelActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  sectionContent: {
    padding: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
  },
  inputContainerFocused: {
    borderColor: '#2563EB',
  },
  inputContainerValid: {
    borderColor: '#10B981',
  },
  inputIcon: {
    paddingLeft: 12,
    paddingRight: 4,
  },
  inputRightIcon: {
    paddingRight: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  textArea: {
    minHeight: 76,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  locationButton: {
    marginTop: 4,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
  },
  locationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  locationButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  locationInfoText: {
    marginLeft: 8,
    fontSize: 11,
    color: '#065F46',
    fontWeight: '500',
  },
  submitContainer: {
    marginTop: 6,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  requiredStar: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '85%',
    maxWidth: 360,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 8,
  },
  modalGradient: {
    padding: 28,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 6,
  },
  modalMessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
  },
  modalFooterText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '500',
    marginLeft: 6,
  },
  pickerButton: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  pickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pickerTextContainer: {
    flex: 1,
  },
  pickerSelectedLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  pickerSelectedDescription: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    maxHeight: height * 0.65,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  pickerModalClose: {
    padding: 4,
  },
  pickerModalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerOptionLast: {
    borderBottomWidth: 0,
  },
  pickerOptionSelected: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginVertical: 1,
  },
  pickerOptionIcon: {
    marginRight: 10,
  },
  pickerOptionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerOptionIconCircleSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionContent: {
    flex: 1,
  },
  pickerOptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  pickerOptionLabelSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  pickerOptionDescription: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  pickerOptionDescriptionSelected: {
    color: '#2563EB',
  },
  pickerOptionCheck: {
    marginLeft: 6,
  },
  pickerCancelButton: {
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
});

export default WarehouseForm;
