import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../../../../contexts/theme/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { getMySellerApplication } from '../../../../services/SellerStatusService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import vector icons from react-native-vector-icons
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;

interface SellerApplication {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  uniqOsId?: string;
  rejectionReason?: string;
  pendingDetails?: {
    reason: string;
    durationInDays: number;
  };
  submittedAt?: Date;
}

interface SellerStatusScreenProps {
  onApplicationSubmit?: () => void;
  onGoToDashboard?: () => void;
  onStartApplication?: () => void;
}

export const SellerStatusScreen: React.FC<SellerStatusScreenProps> = ({
  onApplicationSubmit,
  onGoToDashboard,
  onStartApplication,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [application, setApplication] = useState<SellerApplication>({
    status: 'none',
  });
  const [loading, setLoading] = useState(true);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    const fetchApplicationStatus = async () => {
      try {
        setLoading(true);

        const result = await getMySellerApplication();

        if (result.success && result.data) {
          const transformedData: SellerApplication = {
            status: result.data.status,
            uniqOsId: result.data.uniqOsId || undefined,
            rejectionReason: result.data.rejectionReason || undefined,
            pendingDetails: result.data.pendingDetails
              ? {
                  reason: result.data.pendingDetails.reason || '',
                  durationInDays:
                    result.data.pendingDetails.durationInDays || 0,
                }
              : undefined,
            submittedAt: result.data.createdAt
              ? new Date(result.data.createdAt)
              : undefined,
          };

          console.log('🔄 Transformed application data:', transformedData);
          setApplication(transformedData);
        } else {
          setApplication({ status: 'none' });
        }

        setLoading(false);

        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]).start();
      } catch (error) {
        console.error('Error fetching application:', error);
        setApplication({ status: 'none' });
        setLoading(false);
      }
    };

    fetchApplicationStatus();
  }, []);

  const handleGoToDashboard = () => {
    if (onGoToDashboard) {
      onGoToDashboard();
    } else {
      (navigation as any).navigate('Home');
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Please email us at support@tizzypanelx.com',
      [{ text: 'OK' }],
    );
  };

  const handleStartApplication = () => {
    if (onStartApplication) {
      onStartApplication();
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0A1A' : '#F0F4FF',
    },
    safeAreaContent: {
      flex: 1,
      paddingTop: insets.top,
    },
    content: {
      flex: 1,
      padding: 16,
      maxWidth: 500,
      alignSelf: 'center',
      width: '100%',
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#1A1A2E',
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? '#94A3B8' : '#64748B',
      lineHeight: 20,
      textAlign: 'center',
      maxWidth: 300,
    },
    mainCard: {
      backgroundColor: isDark ? '#15152B' : '#FFFFFF',
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: isDark ? '#000' : '#6366F1',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 16,
      elevation: 8,
      borderWidth: 1,
      borderColor: isDark ? '#25254A' : '#E2E8F0',
    },
    statusHeader: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    statusInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      width: '100%',
    },
    statusIconContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    statusTextContainer: {
      flex: 1,
    },
    statusTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1A1A2E',
      marginBottom: 4,
    },
    statusSubtitle: {
      fontSize: 14,
      color: isDark ? '#94A3B8' : '#64748B',
      lineHeight: 18,
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      alignSelf: 'flex-start',
    },
    pendingChip: {
      backgroundColor: '#FFFBEB',
      borderWidth: 2,
      borderColor: '#F59E0B',
    },
    approvedChip: {
      backgroundColor: '#ECFDF5',
      borderWidth: 2,
      borderColor: '#10B981',
    },
    rejectedChip: {
      backgroundColor: '#FEF2F2',
      borderWidth: 2,
      borderColor: '#EF4444',
    },
    noneChip: {
      backgroundColor: '#EFF6FF',
      borderWidth: 2,
      borderColor: '#3B82F6',
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    pendingText: {
      color: '#D97706',
    },
    approvedText: {
      color: '#047857',
    },
    rejectedText: {
      color: '#DC2626',
    },
    noneText: {
      color: '#1D4ED8',
    },
    text: {
      fontSize: 14,
      lineHeight: 20,
      color: isDark ? '#E2E8F0' : '#475569',
      marginBottom: 12,
    },
    highlightText: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1A1A2E',
      marginBottom: 8,
    },
    uniqOsId: {
      fontSize: 18,
      fontWeight: '800',
      color: isDark ? '#4F46E5' : '#4F46E5',
      textAlign: 'center',
      marginVertical: 12,
      letterSpacing: 1,
    },
    button: {
      backgroundColor: '#4F46E5',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 20,
      flexDirection: 'row',
      justifyContent: 'center',
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      padding: 14,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 12,
      borderWidth: 2,
      borderColor: isDark ? '#4F46E5' : '#4F46E5',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    secondaryButtonText: {
      color: isDark ? '#4F46E5' : '#4F46E5',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 6,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#0A0A1A' : '#F0F4FF',
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    alertCard: {
      backgroundColor: isDark ? '#25254A' : '#FFFBEB',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: '#F59E0B',
    },
    successAlert: {
      backgroundColor: isDark ? '#1E3A2E' : '#ECFDF5',
      borderColor: '#10B981',
    },
    infoAlert: {
      backgroundColor: isDark ? '#1E2A3A' : '#EFF6FF',
      borderColor: '#3B82F6',
    },
    errorAlert: {
      backgroundColor: isDark ? '#3A1E1E' : '#FEF2F2',
      borderColor: '#EF4444',
    },
    alertHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    alertContent: {
      flex: 1,
    },
    adminMessageCard: {
      backgroundColor: isDark ? '#2D2D5A' : '#F8FAFC',
      borderRadius: 12,
      padding: 16,
      marginTop: 12,
      borderLeftWidth: 4,
      borderLeftColor: '#F59E0B',
    },
    adminMessageTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#F59E0B' : '#D97706',
      marginBottom: 8,
    },
    adminMessageText: {
      fontSize: 13,
      lineHeight: 18,
      color: isDark ? '#E2E8F0' : '#475569',
      fontStyle: 'italic',
    },
    progressContainer: {
      backgroundColor: isDark ? '#1E1E3A' : '#F1F5F9',
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    },
    progressBar: {
      height: 8,
      backgroundColor: isDark ? '#2D2D5A' : '#E2E8F0',
      borderRadius: 4,
      marginTop: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#4F46E5',
      borderRadius: 4,
      width: '65%',
    },
    idBadge: {
      backgroundColor: isDark ? '#2D2D5A' : '#EEF2FF',
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: isDark ? '#4F46E5' : '#4F46E5',
      marginVertical: 12,
      alignItems: 'center',
    },
    statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 24,
      backgroundColor: isDark ? '#1E1E3A' : '#F1F5F9',
      borderRadius: 16,
      padding: 12,
    },
    statusStep: {
      alignItems: 'center',
      flex: 1,
    },
    stepCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    stepText: {
      fontSize: 10,
      textAlign: 'center',
      color: isDark ? '#94A3B8' : '#64748B',
      fontWeight: '600',
    },
    activeStep: {
      backgroundColor: '#4F46E5',
    },
    completedStep: {
      backgroundColor: '#10B981',
    },
    pendingStep: {
      backgroundColor: isDark ? '#2D2D5A' : '#E2E8F0',
    },
    stepLine: {
      flex: 1,
      height: 2,
      backgroundColor: isDark ? '#2D2D5A' : '#E2E8F0',
      marginTop: -20,
    },
    completedLine: {
      backgroundColor: '#10B981',
    },
    reasonText: {
      fontSize: 14,
      lineHeight: 20,
      color: isDark ? '#E2E8F0' : '#475569',
      marginTop: 8,
      fontStyle: 'normal',
    },
    noReasonText: {
      fontSize: 13,
      color: isDark ? '#94A3B8' : '#64748B',
      fontStyle: 'italic',
      marginTop: 8,
    },
  });

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <View
            style={[
              styles.statusIconContainer,
              { backgroundColor: isDark ? '#1E1E3A' : '#F1F5F9' },
            ]}
          >
            <Ionicons
              name="storefront-outline"
              size={28}
              color={isDark ? '#4F46E5' : '#4F46E5'}
            />
          </View>
          <Text
            style={[
              styles.highlightText,
              { marginTop: 16, textAlign: 'center' },
            ]}
          >
            Loading Your Status
          </Text>
          <Text style={[styles.text, { textAlign: 'center' }]}>
            Preparing your seller dashboard...
          </Text>
        </View>
      </Animated.View>
    </View>
  );

  const renderStatusSteps = (currentStatus: string) => {
    const steps = [
      { key: 'none', label: 'Application', icon: 'document-text' },
      { key: 'pending', label: 'Under Review', icon: 'search' },
      { key: 'approved', label: 'Approved', icon: 'checkmark' },
    ];

    const getStepStatus = (stepKey: string) => {
      const statusOrder = ['none', 'pending', 'approved'];
      const currentIndex = statusOrder.indexOf(currentStatus);
      const stepIndex = statusOrder.indexOf(stepKey);

      if (stepIndex < currentIndex) return 'completed';
      if (stepIndex === currentIndex) return 'active';
      return 'pending';
    };

    return (
      <View style={styles.statusIndicator}>
        {steps.map((step, index) => {
          const stepStatus = getStepStatus(step.key);
          return (
            <React.Fragment key={step.key}>
              <View style={styles.statusStep}>
                <View
                  style={[
                    styles.stepCircle,
                    stepStatus === 'completed' && styles.completedStep,
                    stepStatus === 'active' && styles.activeStep,
                    stepStatus === 'pending' && styles.pendingStep,
                  ]}
                >
                  <Ionicons
                    name={step.icon as any}
                    size={16}
                    color={
                      stepStatus === 'pending'
                        ? isDark
                          ? '#64748B'
                          : '#94A3B8'
                        : '#FFFFFF'
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.stepText,
                    stepStatus === 'active' && {
                      color: '#4F46E5',
                      fontWeight: '700',
                    },
                    stepStatus === 'completed' && {
                      color: '#10B981',
                      fontWeight: '700',
                    },
                  ]}
                >
                  {step.label}
                </Text>
              </View>
              {index < steps.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    stepStatus === 'completed' && styles.completedLine,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  const renderStatusContent = () => {
    const animatedStyle = {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    };

    switch (application.status) {
      case 'none':
        return (
          <Animated.View style={[styles.content, animatedStyle]}>
            <View style={styles.header}>
              <Text style={styles.title}>Become a Seller</Text>
              <Text style={styles.subtitle}>
                Start your journey as a seller and reach millions of customers
              </Text>
            </View>

            <View style={styles.mainCard}>
              <View style={styles.statusHeader}>
                <View style={styles.statusInfo}>
                  <View style={[styles.statusIconContainer, styles.noneChip]}>
                    <FontAwesome5 name="store" size={24} color="#3B82F6" />
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusTitle}>Ready to Start</Text>
                    <Text style={styles.statusSubtitle}>
                      Begin your seller application process
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusChip, styles.noneChip]}>
                  <FontAwesome5 name="store" size={14} color="#1D4ED8" />
                  <Text style={[styles.chipText, styles.noneText]}>
                    GET STARTED
                  </Text>
                </View>
              </View>

              <View style={[styles.alertCard, styles.infoAlert]}>
                <View style={styles.alertHeader}>
                  <Ionicons
                    name="rocket-outline"
                    size={20}
                    color="#3B82F6"
                    style={{ marginRight: 12 }}
                  />
                  <View style={styles.alertContent}>
                    <Text style={[styles.highlightText, { color: '#1D4ED8' }]}>
                      Start Your Seller Journey
                    </Text>
                    <Text style={styles.text}>
                      Join our marketplace and start selling to millions of
                      customers. Complete your application to get started with
                      your seller account.
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleStartApplication}
              >
                <Feather name="edit-3" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Start Application</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );

      case 'pending':
        return (
          <Animated.View style={[styles.content, animatedStyle]}>
            <View style={styles.header}>
              <Text style={styles.title}>Application Review</Text>
              <Text style={styles.subtitle}>
                Your application is currently under review by our team
              </Text>
            </View>

            {renderStatusSteps('pending')}

            <View style={styles.mainCard}>
              <View style={styles.statusHeader}>
                <View style={styles.statusInfo}>
                  <View
                    style={[styles.statusIconContainer, styles.pendingChip]}
                  >
                    <Ionicons name="time-outline" size={24} color="#F59E0B" />
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusTitle}>Under Review</Text>
                    <Text style={styles.statusSubtitle}>
                      Submitted on{' '}
                      {application.submittedAt?.toLocaleDateString() ||
                        new Date().toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusChip, styles.pendingChip]}>
                  <Ionicons name="time-outline" size={14} color="#D97706" />
                  <Text style={[styles.chipText, styles.pendingText]}>
                    UNDER REVIEW
                  </Text>
                </View>
              </View>

              <View style={[styles.alertCard]}>
                <View style={styles.alertHeader}>
                  <Ionicons
                    name="hourglass-outline"
                    size={20}
                    color="#F59E0B"
                    style={{ marginRight: 12 }}
                  />
                  <View style={styles.alertContent}>
                    <Text style={[styles.highlightText, { color: '#F59E0B' }]}>
                      Application Under Review
                    </Text>
                    <Text style={styles.text}>
                      Your seller application is being carefully reviewed by our
                      team. We appreciate your patience during this process.
                    </Text>

                    <View style={styles.adminMessageCard}>
                      <Text style={styles.adminMessageTitle}>
                        Current Status Details:
                      </Text>
                      {application.pendingDetails?.reason ? (
                        <Text style={styles.reasonText}>
                          {application.pendingDetails.reason}
                        </Text>
                      ) : (
                        <Text style={styles.noReasonText}>
                          Your application is in the queue for review. No
                          additional details available at the moment.
                        </Text>
                      )}

                      {application.pendingDetails?.durationInDays ? (
                        <Text
                          style={[
                            styles.reasonText,
                            {
                              fontSize: 12,
                              color: '#F59E0B',
                              fontWeight: '600',
                            },
                          ]}
                        >
                          Estimated review time:{' '}
                          {application.pendingDetails.durationInDays} business
                          days
                        </Text>
                      ) : (
                        <Text style={[styles.noReasonText, { fontSize: 12 }]}>
                          Typical review time: 3-7 business days
                        </Text>
                      )}
                    </View>

                    {application.uniqOsId && (
                      <View style={styles.idBadge}>
                        <Text
                          style={[
                            styles.text,
                            {
                              fontSize: 12,
                              color: '#3B82F6',
                              fontWeight: '600',
                              marginBottom: 4,
                            },
                          ]}
                        >
                          Application ID:
                        </Text>
                        <Text style={styles.uniqOsId}>
                          {application.uniqOsId}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        );

      case 'approved':
        return (
          <Animated.View style={[styles.content, animatedStyle]}>
            <View style={styles.header}>
              <Text style={styles.title}>Congratulations! 🎉</Text>
              <Text style={styles.subtitle}>
                Your seller application has been approved
              </Text>
            </View>

            {renderStatusSteps('approved')}

            <View style={styles.mainCard}>
              <View style={styles.statusHeader}>
                <View style={styles.statusInfo}>
                  <View
                    style={[styles.statusIconContainer, styles.approvedChip]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#10B981"
                    />
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusTitle}>Application Approved</Text>
                    <Text style={styles.statusSubtitle}>
                      Welcome to our seller community!
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusChip, styles.approvedChip]}>
                  <Ionicons name="checkmark-circle" size={14} color="#047857" />
                  <Text style={[styles.chipText, styles.approvedText]}>
                    APPROVED
                  </Text>
                </View>
              </View>

              <View style={[styles.alertCard, styles.successAlert]}>
                <View style={styles.alertHeader}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color="#10B981"
                    style={{ marginRight: 12 }}
                  />
                  <View style={styles.alertContent}>
                    <Text style={[styles.highlightText, { color: '#047857' }]}>
                      Welcome to Seller Dashboard!
                    </Text>
                    <Text style={styles.text}>
                      Your seller account has been successfully activated. You
                      can now start listing your products and managing your
                      store.
                    </Text>

                    <View style={styles.idBadge}>
                      <Text
                        style={[
                          styles.text,
                          {
                            fontSize: 12,
                            color: '#047857',
                            fontWeight: '600',
                            marginBottom: 4,
                          },
                        ]}
                      >
                        Your Seller ID:
                      </Text>
                      <Text style={[styles.uniqOsId, { color: '#047857' }]}>
                        {application.uniqOsId || 'OS-SELLER-001'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleGoToDashboard}
              >
                <Feather name="shopping-bag" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Go to Seller Dashboard</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );

      case 'rejected':
        return (
          <Animated.View style={[styles.content, animatedStyle]}>
            <View style={styles.header}>
              <Text style={styles.title}>Application Update</Text>
              <Text style={styles.subtitle}>
                There's an update regarding your application
              </Text>
            </View>

            <View style={styles.mainCard}>
              <View style={styles.statusHeader}>
                <View style={styles.statusInfo}>
                  <View
                    style={[styles.statusIconContainer, styles.rejectedChip]}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusTitle}>
                      Application Not Approved
                    </Text>
                    <Text style={styles.statusSubtitle}>
                      Submitted on{' '}
                      {application.submittedAt?.toLocaleDateString() ||
                        new Date().toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusChip, styles.rejectedChip]}>
                  <Ionicons name="close-circle" size={14} color="#DC2626" />
                  <Text style={[styles.chipText, styles.rejectedText]}>
                    REJECTED
                  </Text>
                </View>
              </View>

              <View style={[styles.alertCard, styles.errorAlert]}>
                <View style={styles.alertHeader}>
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color="#EF4444"
                    style={{ marginRight: 12 }}
                  />
                  <View style={styles.alertContent}>
                    <Text style={[styles.highlightText, { color: '#DC2626' }]}>
                      Application Not Approved
                    </Text>

                    <View style={styles.adminMessageCard}>
                      <Text style={styles.adminMessageTitle}>
                        ❗ Application Review Result:
                      </Text>
                      {application.rejectionReason ? (
                        <Text style={styles.reasonText}>
                          {application.rejectionReason}
                        </Text>
                      ) : (
                        <Text style={styles.noReasonText}>
                          Your application did not meet our current
                          requirements. Please contact support for more details.
                        </Text>
                      )}
                    </View>

                    <Text style={[styles.text, { marginTop: 12 }]}>
                      We appreciate your interest in becoming a seller. If you
                      believe this was a mistake or would like more information,
                      please contact our support team.
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleContactSupport}
              >
                <MaterialIcons
                  name="contact-support"
                  size={16}
                  color={isDark ? '#4F46E5' : '#4F46E5'}
                />
                <Text style={styles.secondaryButtonText}>
                  Contact Support Team
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );

      default:
        return (
          <Animated.View style={[styles.content, animatedStyle]}>
            <View style={[styles.alertCard, styles.errorAlert]}>
              <Text style={[styles.highlightText, { color: '#DC2626' }]}>
                Unknown Status
              </Text>
              <Text style={styles.text}>
                There was an issue loading your application status. Please try
                again later.
              </Text>
            </View>
          </Animated.View>
        );
    }
  };

  if (loading) {
    return renderLoading();
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.safeAreaContent}
        showsVerticalScrollIndicator={false}
      >
        {renderStatusContent()}
      </ScrollView>
    </View>
  );
};

export default SellerStatusScreen;
