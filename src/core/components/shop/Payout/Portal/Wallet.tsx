// screens/Seller/CreateAirXPayAccountScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width } = Dimensions.get('window');

// Define navigation param types
type RootStackParamList = {
  CreateAirXPayAccountScreen: undefined;
  Login: undefined;
  SellerDashboard: undefined;
};

// Define props type
type CreateAirXPayAccountScreenProps = {
  navigation: NativeStackNavigationProp<
    RootStackParamList,
    'CreateAirXPayAccountScreen'
  >;
  route?: any;
};

// Define API response types
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

interface SellerAccount {
  _id: string;
  name: string;
  email: string;
  stripeAccountId: string;
  payoutMode: 'automatic' | 'manual';
  payoutVerified: boolean;
}

interface FormData {
  name: string;
  email: string;
  payoutMode: 'automatic' | 'manual';
}

const CreateAirXPayAccountScreen: React.FC<CreateAirXPayAccountScreenProps> = ({
  navigation,
  route,
}) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [sellerAccount, setSellerAccount] = useState<SellerAccount | null>(
    null,
  );
  const insets = useSafeAreaInsets();

  const BASE_URL = 'http://172.20.245.121:5000/api';
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    payoutMode: 'automatic',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedData = JSON.parse(userData);
        setFormData(prev => ({
          ...prev,
          name: parsedData.name || '',
          email: parsedData.email || '',
        }));
      }
    } catch (error) {
      console.log('Error loading user data:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const createSellerAccount = async (payload: FormData): Promise<any> => {
    const token = await getAuthToken();
    const response = await fetch(
      `${BASE_URL}/payout-portal/wallet/seller/create`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create account');
    }
    return data;
  };

  const getOnboardingLink = async (sellerId: string): Promise<any> => {
    const token = await getAuthToken();
    const response = await fetch(
      `${BASE_URL}/seller/${sellerId}/onboarding-link`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get onboarding link');
    }
    return data;
  };

  const checkAccountStatus = async (sellerId: string): Promise<any> => {
    const token = await getAuthToken();
    const response = await fetch(`${BASE_URL}/seller/${sellerId}/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to check status');
    }
    return data;
  };

  const handleCreateAccount = async () => {
    if (!validateForm()) {
      Alert.alert(
        'Validation Error',
        'Please fill all required fields correctly',
      );
      return;
    }

    setLoading(true);
    try {
      const response = await createSellerAccount(formData);

      if (response.success && response.seller && response.accountLink) {
        setSellerAccount(response.seller);
        setOnboardingUrl(response.accountLink);
        setStep(2);

        await AsyncStorage.setItem('sellerId', response.seller._id);
        await AsyncStorage.setItem(
          'stripeAccountId',
          response.seller.stripeAccountId,
        );

        Alert.alert(
          'Account Created!',
          'Your seller account has been created. Now complete Stripe onboarding to receive payments.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to create account');
      }
    } catch (error: any) {
      console.error('Create account error:', error);
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStripeOnboarding = async () => {
    if (!sellerAccount?._id) return;

    setLoading(true);
    try {
      const response = await getOnboardingLink(sellerAccount._id);

      if (response.success && response.onboardingUrl) {
        await Linking.openURL(response.onboardingUrl);

        setTimeout(() => {
          handleCheckStatus();
        }, 5000);
      } else {
        Alert.alert('Error', response.error || 'Failed to get onboarding link');
      }
    } catch (error: any) {
      console.error('Get onboarding link error:', error);
      Alert.alert('Error', 'Failed to open Stripe onboarding');

      if (onboardingUrl) {
        await Linking.openURL(onboardingUrl);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!sellerAccount?._id) return;

    setLoading(true);
    try {
      const response = await checkAccountStatus(sellerAccount._id);

      if (response.success) {
        if (response.payoutVerified) {
          Alert.alert(
            'Success!',
            'Your Stripe account is now verified. You can start receiving payments.',
            [
              {
                text: 'Go to Dashboard',
                onPress: () => navigation.replace('SellerDashboard'),
              },
            ],
          );
        } else {
          Alert.alert(
            'Still Pending',
            'Your account verification is still pending. Verification usually takes 1-2 business days.',
            [{ text: 'OK' }],
          );
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to check status');
      }
    } catch (error: any) {
      console.error('Status check error:', error);
      Alert.alert('Error', 'Failed to check account status');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const handlePayoutModeChange = (mode: 'automatic' | 'manual') => {
    setFormData({ ...formData, payoutMode: mode });
  };

  const renderForm = () => (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Seller Account</Text>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.activeStep]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>
        <Text style={styles.subtitle}>Step 1 of 2: Enter your details</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Enter your full name"
              value={formData.name}
              onChangeText={text => handleInputChange('name', text)}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={text => handleInputChange('email', text)}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout Settings</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Payout Mode *</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[
                  styles.radioOption,
                  formData.payoutMode === 'automatic' &&
                    styles.radioOptionSelected,
                ]}
                onPress={() => handlePayoutModeChange('automatic')}
              >
                <View style={styles.radioCircle}>
                  {formData.payoutMode === 'automatic' && (
                    <View style={styles.radioInnerCircle} />
                  )}
                </View>
                <View style={styles.radioTextContainer}>
                  <Text style={styles.radioLabel}>Automatic Payouts</Text>
                  <Text style={styles.radioDescription}>
                    Payments are sent to your bank account automatically
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.radioOption,
                  formData.payoutMode === 'manual' &&
                    styles.radioOptionSelected,
                ]}
                onPress={() => handlePayoutModeChange('manual')}
              >
                <View style={styles.radioCircle}>
                  {formData.payoutMode === 'manual' && (
                    <View style={styles.radioInnerCircle} />
                  )}
                </View>
                <View style={styles.radioTextContainer}>
                  <Text style={styles.radioLabel}>Manual Payouts</Text>
                  <Text style={styles.radioDescription}>
                    You initiate payouts manually from dashboard
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.helpContainer}>
              <Text style={styles.helpText}>
                ℹ️ You can change this setting later from your dashboard
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.termsContainer}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.termsText}>
              By creating a seller account, you agree to our Terms of Service
              and Privacy Policy. Stripe will verify your identity for payment
              processing.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.createButton, loading && styles.buttonDisabled]}
          onPress={handleCreateAccount}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.createButtonText}>Create Seller Account</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>
          After account creation, you'll be redirected to Stripe for
          verification
        </Text>
      </View>
    </ScrollView>
  );

  const renderSuccessScreen = () => (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.successContainer}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: insets.bottom + 20,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(1)}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.successTitle}>Account Created!</Text>
          <View style={styles.stepIndicator}>
            <View style={styles.stepDot} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, styles.activeStep]} />
          </View>
          <Text style={styles.subtitle}>
            Step 2 of 2: Complete Verification
          </Text>
        </View>

        <View style={styles.successIconContainer}>
          <View style={styles.successIconCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.successMainTitle}>
            Account Created Successfully!
          </Text>
          <Text style={styles.successSubtitle}>
            Your seller account has been created. Complete Stripe verification
            to start receiving payments.
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Account Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>👤</Text>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{sellerAccount?.name}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📧</Text>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{sellerAccount?.email}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🆔</Text>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Account ID</Text>
              <Text style={styles.detailValue}>
                {sellerAccount?.stripeAccountId?.substring(0, 12)}...
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>💰</Text>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Payout Mode</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      sellerAccount?.payoutMode === 'automatic'
                        ? '#E8F5E9'
                        : '#FFF3CD',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        sellerAccount?.payoutMode === 'automatic'
                          ? '#2E7D32'
                          : '#856404',
                    },
                  ]}
                >
                  {sellerAccount?.payoutMode === 'automatic'
                    ? 'Automatic'
                    : 'Manual'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>✅</Text>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Verification Status</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: sellerAccount?.payoutVerified
                      ? '#E8F5E9'
                      : '#FFF3CD',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: sellerAccount?.payoutVerified
                        ? '#2E7D32'
                        : '#856404',
                    },
                  ]}
                >
                  {sellerAccount?.payoutVerified ? 'Verified' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Next Steps</Text>

          <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Text style={styles.instructionIconText}>🔐</Text>
            </View>
            <View style={styles.instructionContent}>
              <Text style={styles.instructionTitleText}>
                Complete Stripe Verification
              </Text>
              <Text style={styles.instructionDesc}>
                Click the button below to open Stripe's secure verification page
                in your browser
              </Text>
            </View>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Text style={styles.instructionIconText}>🏦</Text>
            </View>
            <View style={styles.instructionContent}>
              <Text style={styles.instructionTitleText}>Add Bank Account</Text>
              <Text style={styles.instructionDesc}>
                Connect your bank account to receive payments
              </Text>
            </View>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Text style={styles.instructionIconText}>💵</Text>
            </View>
            <View style={styles.instructionContent}>
              <Text style={styles.instructionTitleText}>
                Start Receiving Payments
              </Text>
              <Text style={styles.instructionDesc}>
                Once verified, customers can pay you directly
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleOpenStripeOnboarding}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  Open Stripe Verification
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCheckStatus}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <>
                <Text style={styles.secondaryButtonText}>
                  Check Verification Status
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tertiaryButton}
            onPress={() => navigation.replace('SellerDashboard')}
          >
            <Text style={styles.tertiaryButtonText}>Skip for Now</Text>
          </TouchableOpacity>

          <Text style={styles.bottomNote}>
            You can complete verification later from your dashboard
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flexContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 10 : 0}
    >
      {step === 1 ? renderForm() : renderSuccessScreen()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
    paddingTop: 10,
  },
  successHeader: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 15,
    top: 15,
    zIndex: 1,
    padding: 5,
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    textAlign: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    textAlign: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ccc',
  },
  activeStep: {
    backgroundColor: '#007AFF',
  },
  stepLine: {
    width: 50,
    height: 2,
    backgroundColor: '#ccc',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    padding: 20,
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  successIconContainer: {
    alignItems: 'center',
    padding: 30,
    width: '100%',
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  checkIcon: {
    fontSize: 60,
    color: '#4CAF50',
  },
  successMainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    width: width - 40,
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    width: width - 40,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  detailIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#ff3b30',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  radioGroup: {
    flexDirection: 'column',
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  radioOptionSelected: {
    backgroundColor: '#E8F5FF',
    borderColor: '#007AFF',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioTextContainer: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  radioDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 10,
    marginVertical: 10,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 2,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#1976d2',
    lineHeight: 18,
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  note: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  instructionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instructionIconText: {
    fontSize: 18,
  },
  instructionContent: {
    flex: 1,
  },
  instructionTitleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  instructionDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  actionsContainer: {
    width: width - 40,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#635bff',
    borderRadius: 12,
    padding: 18,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#635bff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tertiaryButton: {
    padding: 18,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  bottomNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default CreateAirXPayAccountScreen;
