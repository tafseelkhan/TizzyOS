// LoginScreen.tsx - No role selection, just login
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Keyboard,
  Animated,
  Platform,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { AuthService } from '../../services/auth/authLoginService';
import { RootStackParamList } from '../../types/NavigationTypes';
import {
  clearErrors,
  setupKeyboardListeners,
  createLoginAnimations,
  scrollToInput,
} from '../../utils/auth/authLoginUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [waitTime, setWaitTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Animation values
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-30)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formScale = useRef(new Animated.Value(0.9)).current;
  const identifierInputOpacity = useRef(new Animated.Value(0)).current;
  const identifierInputTranslateX = useRef(new Animated.Value(-20)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(20)).current;
  const lottieOpacity = useRef(new Animated.Value(1)).current;

  // Keyboard listeners
  useEffect(() => {
    const cleanup = setupKeyboardListeners(setIsKeyboardVisible, lottieOpacity);
    return cleanup;
  }, []);

  // Initial animations
  useEffect(() => {
    const animations = createLoginAnimations();

    Animated.parallel([
      Animated.timing(headerOpacity, animations.header.opacity),
      Animated.timing(headerTranslateY, animations.header.translateY),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(formOpacity, animations.form.opacity),
        Animated.spring(formScale, animations.form.scale),
      ]).start();
    }, 200);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(identifierInputOpacity, animations.input.opacity),
        Animated.timing(identifierInputTranslateX, animations.input.translateX),
      ]).start();
    }, 400);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(buttonOpacity, animations.button.opacity),
        Animated.timing(buttonTranslateY, animations.button.translateY),
      ]).start();
    }, 600);
  }, []);

  useEffect(() => {
    if (waitTime > 0) {
      const timer = setTimeout(() => setWaitTime(waitTime - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [waitTime]);

  const handleIdentifierFocus = () => {
    scrollToInput(scrollViewRef);
  };

  const handleClearErrors = () => {
    clearErrors(setError, setMsg);
  };

  const handleLogin = async () => {
    handleClearErrors();
    setIsLoading(true);

    const result = await AuthService.sendOTP(identifier);

    if (result.success) {
      setMsg(result.msg || 'OTP sent successfully');
      setStep('otp');
      setWaitTime(30);
    } else {
      setError(result.msg || 'Login failed. Please try again.');
    }

    setIsLoading(false);
  };

  const handleVerify = async () => {
    handleClearErrors();
    setIsLoading(true);

    const result = await AuthService.verifyOTPAndLogin(identifier, otp);

    if (result.success) {
      // ✅ Login successful - user can now switch accounts using linked accounts
      navigation.navigate('Home');
    } else {
      setError(result.msg || 'OTP verification failed');
    }

    setIsLoading(false);
  };

  const handleResendOTP = async () => {
    if (waitTime > 0) return;

    setIsLoading(true);
    handleClearErrors();

    const result = await AuthService.resendOTP(identifier);

    if (result.success) {
      setMsg(result.msg || 'OTP resent successfully');
      setWaitTime(30);
    } else {
      setError(result.msg || 'Failed to resend OTP');
    }

    setIsLoading(false);
  };

  const handleBackToLogin = () => {
    setStep('input');
    handleClearErrors();
  };

  const headerAnimatedStyle = {
    opacity: headerOpacity,
    transform: [{ translateY: headerTranslateY }],
  };

  const formAnimatedStyle = {
    opacity: formOpacity,
    transform: [{ scale: formScale }],
  };

  const identifierInputAnimatedStyle = {
    opacity: identifierInputOpacity,
    transform: [{ translateX: identifierInputTranslateX }],
  };

  const buttonAnimatedStyle = {
    opacity: buttonOpacity,
    transform: [{ translateY: buttonTranslateY }],
  };

  const lottieAnimatedStyle = {
    opacity: lottieOpacity,
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
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
            {!isKeyboardVisible && (
              <Animated.View style={[styles.header, headerAnimatedStyle]}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../../../assets/images/tizzy-logo.jpg')}
                    style={styles.appLogo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                  {step === 'input'
                    ? 'Login to your account'
                    : 'Verify your identity'}
                </Text>
              </Animated.View>
            )}

            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={styles.tab}
                onPress={() => navigation.navigate('Signup')}
              >
                <Icon
                  name="person-add-outline"
                  size={20}
                  color="#6b7280"
                  style={styles.tabIcon}
                />
                <Text style={styles.tabText}>SignUp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, styles.tabActive]}>
                <Icon
                  name="log-in-outline"
                  size={20}
                  color="#ffffff"
                  style={styles.tabIcon}
                />
                <Text style={styles.tabTextActive}>LogIn</Text>
              </TouchableOpacity>
            </View>

            <Animated.View style={[styles.formContainer, formAnimatedStyle]}>
              {step === 'input' ? (
                <View style={styles.formContent}>
                  <Animated.View
                    style={[
                      styles.inputContainer,
                      error && styles.inputError,
                      identifierInputAnimatedStyle,
                    ]}
                  >
                    <Text style={styles.inputLabel}>Email or Phone</Text>
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
                        value={identifier}
                        onChangeText={text => {
                          setIdentifier(text);
                          handleClearErrors();
                        }}
                        keyboardType="default"
                        autoCapitalize="none"
                        returnKeyType="done"
                        onFocus={handleIdentifierFocus}
                      />
                    </View>
                    {error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : null}
                  </Animated.View>

                  <Animated.View style={buttonAnimatedStyle}>
                    <TouchableOpacity
                      style={[
                        styles.button,
                        isLoading && styles.buttonDisabled,
                      ]}
                      onPress={handleLogin}
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
                            <Text style={styles.buttonText}>Send OTP</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>

                  <View style={styles.termsContainer}>
                    <Text style={styles.termsText}>
                      By logging in, you agree to our{' '}
                      <Text style={styles.link}>Terms of Service</Text> and{' '}
                      <Text style={styles.link}>Privacy Policy</Text>
                    </Text>
                  </View>

                  <View style={styles.signupContainer}>
                    <Text style={styles.signupText}>
                      Don't have an account?{' '}
                      <Text
                        style={styles.signupLink}
                        onPress={() => navigation.navigate('Signup')}
                      >
                        SignUp
                      </Text>
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.otpContent}>
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
                        onChangeText={text => {
                          setOtp(text);
                          handleClearErrors();
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                        onFocus={handleIdentifierFocus}
                      />
                    </View>
                    {error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : null}
                  </View>

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
                          <Text style={styles.buttonText}>Verify & Login</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>

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

                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBackToLogin}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name="arrow-back-outline"
                      size={18}
                      color="#6b7280"
                      style={styles.backIcon}
                    />
                    <Text style={styles.backText}> Back to Login</Text>
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

// Styles remain the same as your original LoginScreen styles
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
  termsContainer: {
    marginTop: 8,
  },
  termsText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  link: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  signupContainer: {
    marginTop: 8,
  },
  signupText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  signupLink: {
    color: '#3b82f6',
    fontWeight: '600',
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
});
