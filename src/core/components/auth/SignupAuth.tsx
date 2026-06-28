// SignupScreen.tsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
  Keyboard,
  Animated,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import LottieView from 'lottie-react-native';
import { signup, verifySignup, resendOtp } from '../../services/AuthService';
import { RootStackParamList } from '../../types/NavigationTypes';
import {
  validateSignupForm,
  isPhoneNumber,
  isEmail,
  validateOTP,
} from '../../utils/auth/validationUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<RootStackParamList>;

// ✅ Role options with icons
const ROLE_OPTIONS = [
  {
    id: 'SELLER',
    label: 'Seller',
    icon: 'storefront-outline',
    description: 'Sell products on TizzyGo',
  },
  {
    id: 'FWS',
    label: 'FWS',
    icon: 'warehouse-outline',
    description: 'Manage Fulfillment Warehouse',
  },
  {
    id: 'SHIPPING',
    label: 'Shipping',
    icon: 'car-outline',
    description: 'Deliver orders as Rider/Truck',
  },
];

export default function SignupScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('SELLER');
  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState('');
  const [waitTime, setWaitTime] = useState(0);
  const [errors, setErrors] = useState({
    name: '',
    emailOrPhone: '',
    role: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const lottieRef = useRef<LottieView>(null);

  // Animation values
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-30)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formScale = useRef(new Animated.Value(0.9)).current;
  const nameInputOpacity = useRef(new Animated.Value(0)).current;
  const nameInputTranslateX = useRef(new Animated.Value(-20)).current;
  const emailInputOpacity = useRef(new Animated.Value(0)).current;
  const emailInputTranslateX = useRef(new Animated.Value(-20)).current;
  const roleInputOpacity = useRef(new Animated.Value(0)).current;
  const roleInputTranslateX = useRef(new Animated.Value(-20)).current;
  const checkboxOpacity = useRef(new Animated.Value(0)).current;
  const checkboxTranslateY = useRef(new Animated.Value(20)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(20)).current;
  const lottieOpacity = useRef(new Animated.Value(1)).current;

  const isPhone = isPhoneNumber(emailOrPhone);
  const isEmailAddress = isEmail(emailOrPhone);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        Animated.timing(lottieOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        Animated.timing(lottieOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Initial animations
  useEffect(() => {
    // Header animation
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Form animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(formScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }, 200);

    // Name input animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(nameInputOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(nameInputTranslateX, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 400);

    // Email input animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(emailInputOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(emailInputTranslateX, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 600);

    // Role input animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(roleInputOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(roleInputTranslateX, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 700);

    // Checkbox animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(checkboxOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(checkboxTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 800);

    // Button animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(buttonTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 1000);
  }, []);

  useEffect(() => {
    if (waitTime > 0) {
      const timer = setTimeout(() => setWaitTime(waitTime - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [waitTime]);

  const handleEmailPhoneFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 200, animated: true });
    }, 100);
  };

  // =============================================
  // ✅ FIXED: handleSignup - Proper response handling
  // =============================================
  const handleSignup = async () => {
    const validationErrors = validateSignupForm(name, emailOrPhone);

    if (Object.keys(validationErrors).length > 0) {
      setErrors({
        name: validationErrors.name || '',
        emailOrPhone: validationErrors.emailOrPhone || '',
        role: '',
      });
      return;
    }

    if (!selectedRole) {
      setErrors({ ...errors, role: 'Please select a role' });
      return;
    }

    if (!agreeTerms) {
      Alert.alert(
        'Terms Required',
        'Please agree to Terms of Use and Privacy Policy',
      );
      return;
    }

    setIsLoading(true);

    try {
      const res = await signup({
        identifier: emailOrPhone,
        role: selectedRole,
      });

      console.log('📥 Signup Response:', JSON.stringify(res, null, 2));

      // ✅ FIXED: Check response properly - Backend returns { msg: "OTP sent..." }
      // Success if:
      // 1. res.success === true
      // 2. OR res.msg contains "OTP sent"
      // 3. OR res.identifier exists
      const isSuccess =
        res?.success === true ||
        res?.msg?.includes('OTP sent') ||
        res?.identifier;

      if (isSuccess) {
        setMsg(res?.msg || `OTP sent to ${emailOrPhone}`);
        setStep('otp'); // ✅ GO TO OTP SCREEN
        setWaitTime(30);
        // Optional: Show success alert
        Alert.alert(
          'Success',
          'OTP sent successfully! Please check your messages.',
        );
      } else {
        Alert.alert(
          'Error',
          res?.msg || 'Failed to send OTP. Please try again.',
        );
      }
    } catch (error: any) {
      console.error('❌ Signup error:', error);
      Alert.alert(
        'Error',
        error?.message || 'Something went wrong. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================
  // ✅ FIXED: handleVerify - Proper response handling
  // =============================================
  const handleVerify = async () => {
    if (!validateOTP(otp)) {
      Alert.alert('OTP Required', 'Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);

    try {
      const res = await verifySignup({
        identifier: emailOrPhone,
        otp,
        name,
        role: selectedRole,
      });

      console.log('📥 Verify Response:', JSON.stringify(res, null, 2));

      // ✅ FIXED: Check response properly
      const isSuccess = res?.success === true && res?.token && res?.user;

      if (isSuccess) {
        Alert.alert('Success', 'Account created successfully!');
        navigation.navigate('Home');
      } else {
        Alert.alert('Error', res?.msg || 'Invalid OTP. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Verify error:', error);
      Alert.alert(
        'Error',
        error?.message || 'Verification failed. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================
  // ✅ FIXED: handleResendOTP - Proper response handling
  // =============================================
  const handleResendOTP = async () => {
    if (waitTime > 0) return;

    setIsLoading(true);

    try {
      const res = await resendOtp({ identifier: emailOrPhone });

      console.log('📥 Resend Response:', JSON.stringify(res, null, 2));

      const isSuccess =
        res?.success === true ||
        res?.msg?.includes('OTP sent') ||
        res?.identifier;

      if (isSuccess) {
        setMsg(res?.msg || `OTP resent to ${emailOrPhone}`);
        setWaitTime(30);
        Alert.alert('Success', 'OTP resent successfully!');
      } else {
        Alert.alert('Error', res?.msg || 'Failed to resend OTP');
      }
    } catch (error: any) {
      console.error('❌ Resend error:', error);
      Alert.alert('Error', error?.message || 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // Animated styles
  const headerAnimatedStyle = {
    opacity: headerOpacity,
    transform: [{ translateY: headerTranslateY }],
  };

  const formAnimatedStyle = {
    opacity: formOpacity,
    transform: [{ scale: formScale }],
  };

  const nameInputAnimatedStyle = {
    opacity: nameInputOpacity,
    transform: [{ translateX: nameInputTranslateX }],
  };

  const emailInputAnimatedStyle = {
    opacity: emailInputOpacity,
    transform: [{ translateX: emailInputTranslateX }],
  };

  const roleInputAnimatedStyle = {
    opacity: roleInputOpacity,
    transform: [{ translateX: roleInputTranslateX }],
  };

  const checkboxAnimatedStyle = {
    opacity: checkboxOpacity,
    transform: [{ translateY: checkboxTranslateY }],
  };

  const buttonAnimatedStyle = {
    opacity: buttonOpacity,
    transform: [{ translateY: buttonTranslateY }],
  };

  const lottieAnimatedStyle = {
    opacity: lottieOpacity,
  };

  // ✅ Render Role Selection
  const renderRoleSelection = () => (
    <Animated.View style={[styles.roleContainer, roleInputAnimatedStyle]}>
      <Text style={styles.inputLabel}>Select Your Role *</Text>
      <View style={styles.roleOptionsContainer}>
        {ROLE_OPTIONS.map(role => (
          <TouchableOpacity
            key={role.id}
            style={[
              styles.roleOption,
              selectedRole === role.id && styles.roleOptionSelected,
            ]}
            onPress={() => {
              setSelectedRole(role.id);
              setErrors({ ...errors, role: '' });
            }}
            activeOpacity={0.8}
          >
            <View style={styles.roleIconContainer}>
              <Icon
                name={role.icon}
                size={24}
                color={selectedRole === role.id ? '#3b82f6' : '#9ca3af'}
              />
            </View>
            <Text
              style={[
                styles.roleLabel,
                selectedRole === role.id && styles.roleLabelSelected,
              ]}
            >
              {role.label}
            </Text>
            <Text style={styles.roleDescription}>{role.description}</Text>
            {selectedRole === role.id && (
              <View style={styles.roleCheckmark}>
                <Icon name="checkmark-circle" size={20} color="#3b82f6" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {errors.role ? <Text style={styles.errorText}>{errors.role}</Text> : null}
    </Animated.View>
  );

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Background Gradient */}
          <View style={styles.background}>
            <View style={[styles.gradientLayer, styles.gradientStart]} />
            <View style={[styles.gradientLayer, styles.gradientEnd]} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContainer,
              isKeyboardVisible && styles.scrollContainerKeyboardOpen,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            {!isKeyboardVisible && (
              <Animated.View style={[styles.header, headerAnimatedStyle]}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../../../assets/images/tizzy-logo.jpg')}
                    style={styles.appLogo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.title}>Welcome to TizzyGo</Text>
                <Text style={styles.subtitle}>
                  {step === 'form'
                    ? 'Create your account to get started'
                    : 'Verify your account'}
                </Text>
              </Animated.View>
            )}

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity style={[styles.tab, styles.tabActive]}>
                <Icon
                  name="person-add-outline"
                  size={20}
                  color="#ffffff"
                  style={styles.tabIcon}
                />
                <Text style={styles.tabTextActive}>SignUp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tab}
                onPress={() => navigation.navigate('Login')}
              >
                <Icon
                  name="log-in-outline"
                  size={20}
                  color="#6b7280"
                  style={styles.tabIcon}
                />
                <Text style={styles.tabText}>LogIn</Text>
              </TouchableOpacity>
            </View>

            {/* Form Container */}
            <Animated.View style={[styles.formContainer, formAnimatedStyle]}>
              {step === 'form' ? (
                <View style={styles.formContent}>
                  {/* Name Input */}
                  <Animated.View
                    style={[
                      styles.inputContainer,
                      errors.name && styles.inputError,
                      nameInputAnimatedStyle,
                    ]}
                  >
                    <Text style={styles.inputLabel}>Full Name *</Text>
                    <View style={styles.inputWrapper}>
                      <FontAwesome
                        name="user-o"
                        size={20}
                        color="#9ca3af"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your full name"
                        placeholderTextColor="#9ca3af"
                        value={name}
                        onChangeText={text => {
                          setName(text);
                          setErrors({ ...errors, name: '' });
                        }}
                        returnKeyType="next"
                      />
                    </View>
                    {errors.name ? (
                      <Text style={styles.errorText}>{errors.name}</Text>
                    ) : null}
                  </Animated.View>

                  {/* Email/Phone Input */}
                  <Animated.View
                    style={[
                      styles.inputContainer,
                      errors.emailOrPhone && styles.inputError,
                      emailInputAnimatedStyle,
                    ]}
                  >
                    <Text style={styles.inputLabel}>Email or Phone *</Text>
                    <View style={styles.inputWrapper}>
                      <MaterialIcon
                        name="email"
                        size={20}
                        color="#9ca3af"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter email or phone number"
                        placeholderTextColor="#9ca3af"
                        value={emailOrPhone}
                        onChangeText={text => {
                          setEmailOrPhone(text);
                          setErrors({ ...errors, emailOrPhone: '' });
                        }}
                        keyboardType={isPhone ? 'phone-pad' : 'email-address'}
                        autoCapitalize="none"
                        returnKeyType="done"
                        onFocus={handleEmailPhoneFocus}
                      />
                    </View>
                    {errors.emailOrPhone ? (
                      <Text style={styles.errorText}>
                        {errors.emailOrPhone}
                      </Text>
                    ) : null}
                  </Animated.View>

                  {/* ✅ Role Selection */}
                  {renderRoleSelection()}

                  {/* Checkbox - Terms & Privacy */}
                  <Animated.View
                    style={[styles.checkboxContainer, checkboxAnimatedStyle]}
                  >
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setAgreeTerms(!agreeTerms)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          agreeTerms && styles.checkboxChecked,
                        ]}
                      >
                        {agreeTerms && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkboxLabel}>
                        I agree to <Text style={styles.link}>Terms</Text> and{' '}
                        <Text style={styles.link}>Privacy Policy</Text>
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Signup Button */}
                  <Animated.View style={buttonAnimatedStyle}>
                    <TouchableOpacity
                      style={[
                        styles.button,
                        isLoading && styles.buttonDisabled,
                      ]}
                      onPress={handleSignup}
                      disabled={isLoading}
                      activeOpacity={0.9}
                    >
                      <View style={styles.buttonGradient}>
                        {isLoading ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <>
                            <Icon
                              name="arrow-forward-outline"
                              size={20}
                              color="#ffffff"
                              style={styles.buttonIcon}
                            />
                            <Text style={styles.buttonText}>
                              Create Account
                            </Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              ) : (
                <View style={styles.otpContent}>
                  {/* OTP Message */}
                  <View style={styles.otpMessage}>
                    <MaterialIcon
                      name="mail-outline"
                      size={32}
                      color="#3b82f6"
                    />
                    <Text style={styles.otpMessageText}>{msg}</Text>
                    <Text style={styles.otpMessageSubtext}>
                      Check your messages for the OTP
                    </Text>
                  </View>

                  {/* OTP Input */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Verification Code</Text>
                    <View style={styles.inputWrapper}>
                      <MaterialIcon
                        name="vpn-key"
                        size={20}
                        color="#9ca3af"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor="#9ca3af"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        maxLength={6}
                        onFocus={handleEmailPhoneFocus}
                      />
                    </View>
                  </View>

                  {/* Verify Button */}
                  <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                    onPress={handleVerify}
                    disabled={isLoading}
                    activeOpacity={0.9}
                  >
                    <View style={styles.buttonGradient}>
                      {isLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <>
                          <Icon
                            name="checkmark-outline"
                            size={20}
                            color="#ffffff"
                            style={styles.buttonIcon}
                          />
                          <Text style={styles.buttonText}>
                            Verify & Continue
                          </Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Resend OTP */}
                  <TouchableOpacity
                    style={[
                      styles.resendButton,
                      (waitTime > 0 || isLoading) &&
                        styles.resendButtonDisabled,
                    ]}
                    onPress={handleResendOTP}
                    disabled={waitTime > 0 || isLoading}
                    activeOpacity={0.7}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#3b82f6" size="small" />
                    ) : waitTime > 0 ? (
                      <Text style={styles.resendTextDisabled}>
                        Resend in {waitTime}s
                      </Text>
                    ) : (
                      <Text style={styles.resendText}>Resend OTP</Text>
                    )}
                  </TouchableOpacity>

                  {/* Back to Signup */}
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setStep('form')}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name="arrow-back-outline"
                      size={18}
                      color="#6b7280"
                      style={styles.backIcon}
                    />
                    <Text style={styles.backText}> Back to Signup</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  background: {
    ...StyleSheet.absoluteFill,
  },
  gradientLayer: {
    ...StyleSheet.absoluteFill,
  },
  gradientStart: {
    backgroundColor: '#eff6ff',
    opacity: 0.8,
  },
  gradientEnd: {
    backgroundColor: '#dbeafe',
    opacity: 0.6,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  scrollContainerKeyboardOpen: {
    paddingTop: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 100,
  },
  logoContainer: {
    width: 100,
    height: 100,
    marginBottom: -30,
    marginLeft: 50,
  },
  appLogo: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 6,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabIcon: {
    marginRight: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  formContent: {
    gap: 20,
  },
  otpContent: {
    gap: 20,
  },
  inputContainer: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  inputError: {
    borderColor: '#f87171',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  checkboxContainer: {
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  link: {
    color: '#3b82f6',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    height: 56,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  otpMessage: {
    backgroundColor: '#eff6ff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    gap: 8,
  },
  otpMessageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    textAlign: 'center',
  },
  otpMessageSubtext: {
    fontSize: 12,
    color: '#2563eb',
    textAlign: 'center',
  },
  resendButton: {
    backgroundColor: '#eff6ff',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  resendButtonDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  resendText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '500',
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  backIcon: {
    marginRight: 4,
  },
  backText: {
    color: '#6b7280',
    fontSize: 14,
    marginLeft: 4,
  },
  // ✅ Role Selection Styles
  roleContainer: {
    marginBottom: 8,
  },
  roleOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  roleOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  roleIconContainer: {
    marginBottom: 6,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  roleLabelSelected: {
    color: '#1f2937',
  },
  roleDescription: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },
  roleCheckmark: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
});
