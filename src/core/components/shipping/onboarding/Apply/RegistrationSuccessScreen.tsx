// RegistrationSuccessScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  useNavigation,
  useRoute,
  NavigationProp,
  RouteProp,
} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ API slice
import {
  getShippingRegistrationById,
  ShippingData,
  ShippingStatusApiResponse,
} from '../../../../../api/features/private/riderRegistrationStatusPrivateSlice';
import { ApiError } from '../../../../../core/utils/handler/apiClient';

// ============================================================
// TYPES
// ============================================================

type RootStackParamList = {
  RiderRegistration: undefined;
  RegistrationSuccess: { shippingId: string };
  Home: undefined;
  Login: undefined;
};

type NavigationType = NavigationProp<RootStackParamList>;

type RegistrationSuccessRouteProp = RouteProp<
  RootStackParamList,
  'RegistrationSuccess'
>;

interface DetailRowProps {
  label: string;
  value: string;
}

interface StepItemProps {
  number: string;
  title: string;
  description: string;
}

// ============================================================
// COMPONENT
// ============================================================

const RegistrationSuccessScreen: React.FC = () => {
  const navigation = useNavigation<NavigationType>();
  const route = useRoute<RegistrationSuccessRouteProp>();

  const [shippingData, setShippingData] = useState<ShippingData | null>(null);
  const [apiResponse, setApiResponse] =
    useState<ShippingStatusApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);

  // ============================================================
  // ✅ FETCH SHIPPING DATA (via slice)
  // ============================================================

  const fetchShippingData = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = await getShippingRegistrationById(id);

      if (data.success && data.shipping) {
        setApiResponse(data);
        setShippingData(data.shipping);
      } else {
        throw new Error(data.message || 'Invalid response from server');
      }
    } catch (err: any) {
      if (__DEV__) {
        console.error('Error fetching shipping data:', err);
      }

      let errorMessage = 'Failed to load registration details';

      if (err instanceof ApiError) {
        if (err.status === 401) {
          errorMessage = 'Session expired. Please login again.';
          // apiClient ne already tokens clear kar diye
        } else if (err.status === 404) {
          errorMessage =
            'Registration data not found. It may have been deleted.';
        } else if (err.message) {
          errorMessage = err.message;
        }
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============================================================
  // REFRESH HANDLER
  // ============================================================

  const onRefresh = async () => {
    if (shippingId) {
      setRefreshing(true);
      await fetchShippingData(shippingId);
    }
  };

  // ============================================================
  // INITIALIZATION
  // ============================================================

  useEffect(() => {
    const initializeScreen = async () => {
      try {
        const id = route.params?.shippingId;

        if (!id) {
          // Try to get shippingId from AsyncStorage as fallback
          const storedId = await AsyncStorage.getItem('lastShippingId');
          if (storedId) {
            setShippingId(storedId);
            await fetchShippingData(storedId);
            return;
          }

          setError('Registration ID not received. Please try again.');
          setLoading(false);
          return;
        }

        setShippingId(id);

        // Store shippingId for future reference
        await AsyncStorage.setItem('lastShippingId', id);

        await fetchShippingData(id);
      } catch (err: any) {
        if (__DEV__) {
          console.error('Initialization error:', err);
        }
        setError(err?.message || 'Failed to initialize screen');
        setLoading(false);
      }
    };

    initializeScreen();
  }, [route.params]);

  // ============================================================
  // AUTO-REFRESH EVERY 30s
  // ============================================================

  useEffect(() => {
    if (!shippingId) return;

    const intervalId = setInterval(() => {
      fetchShippingData(shippingId);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [shippingId]);

  // ============================================================
  // NAVIGATION HANDLERS
  // ============================================================

  const handleBackToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const handleRegisterAnother = () => {
    navigation.navigate('RiderRegistration');
  };

  const handleCheckStatus = () => {
    if (shippingId) {
      fetchShippingData(shippingId);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('lastShippingId');
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  // ============================================================
  // STATUS HELPERS
  // ============================================================

  const formatStatus = (status: string | undefined) => {
    if (!status) return 'Unknown';

    const statusMap: Record<string, string> = {
      pending: 'Pending Review',
      in_review: 'Under Review',
      approved: 'Approved',
      decline: 'Rejected',
      rejected: 'Rejected',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return '#6b7280';

    const colorMap: Record<string, string> = {
      pending: '#f59e0b',
      in_review: '#3b82f6',
      approved: '#10b981',
      decline: '#ef4444',
      rejected: '#ef4444',
    };
    return colorMap[status] || '#6b7280';
  };

  const getStatusIcon = (status: string | undefined): string => {
    if (!status) return 'help';

    const iconMap: Record<string, string> = {
      pending: 'pending',
      in_review: 'history',
      approved: 'check-circle',
      decline: 'cancel',
      rejected: 'cancel',
    };
    return iconMap[status] || 'help';
  };

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>
          Fetching your registration details...
        </Text>
        {shippingId && (
          <Text style={styles.idText}>
            ID: {shippingId.substring(0, 12)}...
          </Text>
        )}
      </SafeAreaView>
    );
  }

  // ============================================================
  // ERROR STATE
  // ============================================================

  if (error && !shippingData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[styles.container, styles.centerContent]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Icon name="error-outline" size={80} color="#ef4444" />
          <Text style={styles.errorTitle}>Unable to Load Details</Text>
          <Text style={styles.errorText}>{error}</Text>

          {shippingId && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleCheckStatus}
            >
              <Icon name="refresh" size={20} color="white" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleBackToHome}
          >
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>

          {error && error.includes('Session expired') && (
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Icon name="logout" size={20} color="white" />
              <Text style={styles.logoutButtonText}>Login Again</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  const currentStatus = apiResponse?.status?.formStatus || shippingData?.status;
  const kycStatus = apiResponse?.status?.kycStatus || shippingData?.kyc?.status;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
      >
        {error && (
          <View style={styles.errorAlert}>
            <Icon name="error-outline" size={20} color="#ef4444" />
            <Text style={styles.errorAlertText}>{error}</Text>
            <TouchableOpacity onPress={handleCheckStatus}>
              <Icon name="refresh" size={20} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.iconContainer}>
          <Icon name="check-circle" size={100} color="#10b981" />
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleCheckStatus}
          >
            <Icon name="refresh" size={20} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Registration Successful! 🎉</Text>
        <Text style={styles.subtitle}>
          {apiResponse?.message ||
            'Thank you for registering. Your application ID is:'}
        </Text>
        <Text style={styles.applicationId}>
          {shippingData?._id
            ? shippingData._id.substring(0, 16).toUpperCase() + '...'
            : 'N/A'}
        </Text>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Icon name="timeline" size={24} color="#3b82f6" />
            <Text style={styles.statusTitle}>Application Status</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${getStatusColor(currentStatus)}20` },
              ]}
            >
              <Icon
                name={getStatusIcon(currentStatus)}
                size={16}
                color={getStatusColor(currentStatus)}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: getStatusColor(currentStatus) },
                ]}
              >
                {formatStatus(currentStatus)}
              </Text>
            </View>
          </View>

          {kycStatus && (
            <View style={styles.kycStatusContainer}>
              <Icon
                name="verified"
                size={16}
                color={
                  kycStatus === 'verified'
                    ? '#10b981'
                    : kycStatus === 'rejected'
                      ? '#ef4444'
                      : '#f59e0b'
                }
              />
              <Text
                style={[
                  styles.kycStatusText,
                  {
                    color:
                      kycStatus === 'verified'
                        ? '#10b981'
                        : kycStatus === 'rejected'
                          ? '#ef4444'
                          : '#f59e0b',
                  },
                ]}
              >
                KYC:{' '}
                {kycStatus === 'verified'
                  ? 'Verified'
                  : kycStatus === 'rejected'
                    ? 'Rejected'
                    : 'Pending'}
              </Text>
            </View>
          )}

          <Text style={styles.statusTime}>
            Last updated:{' '}
            {shippingData?.updatedAt
              ? new Date(shippingData.updatedAt).toLocaleString('en-IN')
              : 'Just now'}
          </Text>

          <TouchableOpacity
            style={styles.checkStatusButton}
            onPress={handleCheckStatus}
          >
            <Icon name="refresh" size={18} color="#3b82f6" />
            <Text style={styles.checkStatusText}>Check Latest Status</Text>
          </TouchableOpacity>
        </View>

        {shippingData && (
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Icon name="description" size={24} color="#3b82f6" />
              <Text style={styles.detailsTitle}>Registration Details</Text>
            </View>

            <DetailRow label="Application ID" value={shippingData._id} />
            <DetailRow label="Full Name" value={shippingData.name} />
            <DetailRow
              label="Vehicle"
              value={`${shippingData.vehicleBrand} ${shippingData.vehicleModel}`}
            />
            <DetailRow
              label="Vehicle Number"
              value={shippingData.vehicleNumber}
            />
            <DetailRow
              label="Vehicle Type"
              value={shippingData.vehicleCategory}
            />

            {shippingData.maxOrdersPerDay && (
              <DetailRow
                label="Daily Capacity"
                value={`${shippingData.maxOrdersPerDay} orders/day`}
              />
            )}

            {shippingData.drivingLicenseNumber && (
              <DetailRow
                label="License Number"
                value={shippingData.drivingLicenseNumber}
              />
            )}

            {shippingData.identityType && shippingData.identityNumber && (
              <DetailRow
                label={`${shippingData.identityType} Number`}
                value={shippingData.identityNumber}
              />
            )}

            <DetailRow
              label="Submitted On"
              value={new Date(shippingData.createdAt).toLocaleDateString(
                'en-IN',
                {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                },
              )}
            />

            <View style={styles.statusRow}>
              <Text style={styles.detailLabel}>Current Status:</Text>
              <View style={styles.statusDisplay}>
                <Icon
                  name={getStatusIcon(currentStatus)}
                  size={18}
                  color={getStatusColor(currentStatus)}
                />
                <Text
                  style={[
                    styles.statusValue,
                    { color: getStatusColor(currentStatus) },
                  ]}
                >
                  {formatStatus(currentStatus)}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.nextStepsCard}>
          <View style={styles.nextStepsHeader}>
            <Icon name="next-plan" size={24} color="#3b82f6" />
            <Text style={styles.nextStepsTitle}>What's Next?</Text>
          </View>

          {currentStatus === 'pending' && (
            <>
              <StepItem
                number="1"
                title="Document Verification"
                description="Our team will verify your documents within 24-48 hours."
              />
              <StepItem
                number="2"
                title="Background Check"
                description="We'll conduct a background verification for security purposes."
              />
            </>
          )}

          {currentStatus === 'in_review' && (
            <>
              <StepItem
                number="1"
                title="Under Review"
                description="Your application is currently being reviewed by our team."
              />
              <StepItem
                number="2"
                title="Additional Checks"
                description="We may contact you for additional information if needed."
              />
            </>
          )}

          {currentStatus === 'approved' && kycStatus === 'verified' && (
            <>
              <StepItem
                number="1"
                title="Congratulations! 🎉"
                description="Your application has been approved. You can now start accepting deliveries."
              />
              <StepItem
                number="2"
                title="Download Rider App"
                description="Download our rider app from the app store to get started."
              />
            </>
          )}

          {currentStatus === 'approved' && kycStatus === 'pending' && (
            <>
              <StepItem
                number="1"
                title="Application Approved"
                description="Your application has been approved by admin."
              />
              <StepItem
                number="2"
                title="KYC Verification Pending"
                description="Your KYC documents are under verification."
              />
            </>
          )}

          {(currentStatus === 'decline' || currentStatus === 'rejected') && (
            <>
              <StepItem
                number="1"
                title="Application Reviewed"
                description="Unfortunately, your application was not approved."
              />
              <StepItem
                number="2"
                title="Contact Support"
                description="Please contact support for more information and to reapply."
              />
            </>
          )}

          <StepItem
            number="3"
            title="Training Session"
            description="Attend a brief online training session to understand our platform."
          />

          <StepItem
            number="4"
            title="Start Earning"
            description="Complete your first delivery and start earning money!"
          />
        </View>

        <View style={styles.footerCard}>
          <Icon name="info" size={20} color="#3b82f6" />
          <View style={styles.footerContent}>
            <Text style={styles.footerTitle}>Important Information</Text>
            <Text style={styles.footerText}>
              • Status updates automatically every 30 seconds{'\n'}• You'll
              receive email/SMS notifications for status changes{'\n'}• Contact
              support for any questions: support@deliveryapp.com
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleBackToHome}
          >
            <Icon name="home" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Go to Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tertiaryButton}
            onPress={handleRegisterAnother}
          >
            <Icon name="add-circle" size={20} color="#3b82f6" />
            <Text style={styles.tertiaryButtonText}>
              Register Another Vehicle
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================================
// HELPER COMPONENTS
// ============================================================

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const StepItem: React.FC<StepItemProps> = ({ number, title, description }) => (
  <View style={styles.stepItem}>
    <View style={styles.stepNumber}>
      <Text style={styles.stepNumberText}>{number}</Text>
    </View>
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
    </View>
  </View>
);

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  idText: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 12,
  },
  errorAlertText: {
    flex: 1,
    color: '#991b1b',
    fontSize: 14,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 30,
    position: 'relative',
  },
  refreshButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: 'white',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e40af',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  applicationId: {
    fontSize: 14,
    color: '#3b82f6',
    textAlign: 'center',
    fontFamily: 'monospace',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 30,
    alignSelf: 'center',
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginRight: 'auto',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  kycStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  kycStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 16,
  },
  checkStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 8,
  },
  checkStatusText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  detailsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'right',
    flex: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  statusDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  nextStepsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  nextStepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  stepNumber: {
    backgroundColor: '#3b82f6',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#1e40af',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tertiaryButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  footerCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  footerContent: {
    flex: 1,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#0c4a6e',
    lineHeight: 18,
  },
});

export default RegistrationSuccessScreen;