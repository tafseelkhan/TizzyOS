import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Image,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import CountryPicker, {
  Country,
  CountryCode,
} from 'react-native-country-picker-modal';

// 👇 SVG Imports
import SignupIllustration from '../../../assets/svg/illustrations/tizzygo-os_sign-up_qamz.svg';
import ProfileIllustration from '../../../assets/svg/illustrations/tizzygo-os_profile-image_2hi8.svg';
import AccessIllustration from '../../../assets/svg/illustrations/tizzygo-os_access-account_aydp.svg';
import ForgotPasswordIllustration from '../../../assets/svg/illustrations/tizzygo-os_forgot-password_nttj.svg';

import { RootStackParamList } from '../../types/NavigationTypes';
import {
  signup,
  verifyPhone,
  resendOtp,
} from '../../../api/features/public/authPublicSlice';
import { ApiError } from '../../../core/utils/handler/apiClient';
import TermsPolicyDialog from './terms-policy';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function SignupScreen() {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);

  const [step, setStep] = useState<number | 'otp'>(1);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Country Picker State
  const [countryCode, setCountryCode] = useState<CountryCode>('IN');
  const [callingCode, setCallingCode] = useState('91');
  const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);

  const [agreeTerms, setAgreeTerms] = useState(false);

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // API State
  const [verificationId, setVerificationId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // OTP State
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);
  const otpInputs = useRef<Array<React.ElementRef<typeof TextInput> | null>>(
    [],
  );
  const boxAnims = useRef(
    Array(6)
      .fill(0)
      .map(() => new Animated.Value(0)),
  ).current;

  // OTP Timer State
  const [expirationTimestamp, setExpirationTimestamp] = useState<number | null>(
    null,
  );
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [isAnimating, setIsAnimating] = useState(false);

  const otp = otpArray.join('');

  const primaryColor = '#5EE817';
  const errorColor = '#FF4D4D';

  // --- OTP TIMER EFFECT ---
  useEffect(() => {
    if (!expirationTimestamp) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((expirationTimestamp - Date.now()) / 1000),
      );
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    const initialRemaining = Math.max(
      0,
      Math.ceil((expirationTimestamp - Date.now()) / 1000),
    );
    setTimeLeft(initialRemaining);

    return () => clearInterval(interval);
  }, [expirationTimestamp]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isOtpExpired = timeLeft <= 0 && expirationTimestamp !== null;
  const canResend =
    isOtpExpired &&
    !!verificationId &&
    !isResending &&
    !isAnimating &&
    !isLoading;

  // --- OTP ANIMATIONS ---
  const playWrongOtpAnimation = () => {
    setIsAnimating(true);
    const animations = boxAnims.map((anim, index) => {
      const delay = (5 - index) * 100;
      return Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: -150,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.parallel(animations).start(() => {
      setOtpArray(['', '', '', '', '', '']);
      boxAnims.forEach(anim => anim.setValue(0));
      setIsAnimating(false);
      setErrors({ ...errors, otp: 'Invalid OTP. Please try again.' });
      otpInputs.current[0]?.focus();
    });
  };

  const playSuccessOtpAnimation = () => {
    setIsAnimating(true);
    const animations = boxAnims.map((anim, index) => {
      const delay = index * 100;
      return Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 150,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.parallel(animations).start(() => {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    });
  };

  // --- OTP HANDLERS ---
  const handleOtpChange = (text: string, index: number) => {
    if (isAnimating) return;
    const cleaned = text.replace(/[^0-9]/g, '');

    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6).split('');
      const newOtp = [...otpArray];
      pasted.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtpArray(newOtp);
      const lastFilled = Math.min(index + pasted.length, 5);
      otpInputs.current[lastFilled]?.focus();
      return;
    }

    const newOtp = [...otpArray];
    newOtp[index] = cleaned;
    setOtpArray(newOtp);
    setErrors({ ...errors, otp: '' });

    if (cleaned && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  // --- VALIDATIONS ---
  const validateStep1 = () => {
    let newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!/^[a-z0-9._-]{3,50}$/i.test(username.trim())) {
      newErrors.username = '3-50 chars (letters, numbers, . _ -)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    let newErrors: Record<string, string> = {};
    if (!/^\d{8,15}$/.test(phone.replace(/[\s\-()]/g, ''))) {
      newErrors.phone = 'Enter valid phone number';
    }
    if (password.length < 8) {
      newErrors.password = 'Must be at least 8 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    Keyboard.dismiss();
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  // --- API CALLS ---
  const handleSignup = async () => {
    if (!agreeTerms) return;
    Keyboard.dismiss();
    setIsLoading(true);
    try {
      const res = await signup({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        username: username.trim().toLowerCase(),
        password,
        confirmPassword,
        phone: `+${callingCode} ${phone.trim()}`,
        termsAccepted: agreeTerms,
      });

      if (res.verificationId) {
        setVerificationId(res.verificationId);
        const expiresIn = res.expiresInSeconds ?? 240;
        const expiresAt = Date.now() + expiresIn * 1000;
        setExpirationTimestamp(expiresAt);
        setTimeLeft(expiresIn);
        setStep('otp');
      }
    } catch (err) {
      Alert.alert(
        'Signup Error',
        err instanceof ApiError ? err.message : 'Something went wrong.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isOtpExpired) {
      Alert.alert('OTP Expired', 'Please request a new OTP to continue.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setErrors({ otp: 'Enter valid 6-digit OTP' });
      return;
    }
    Keyboard.dismiss();
    setIsLoading(true);
    setErrors({});
    try {
      await verifyPhone({ verificationId, code: otp });
      playSuccessOtpAnimation();
    } catch (err) {
      playWrongOtpAnimation();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || !verificationId) return;

    Keyboard.dismiss();
    setIsResending(true);
    setErrors({ ...errors, otp: '' });

    try {
      const res = await resendOtp({ verificationId });

      if (res.verificationId) {
        setVerificationId(res.verificationId);
      }

      // 👇 Backend response ke expiresInSeconds se timer set karo
      const expiresIn = res.expiresInSeconds ?? 240;
      const expiresAt = Date.now() + expiresIn * 1000;
      setExpirationTimestamp(expiresAt);
      setTimeLeft(expiresIn);

      setOtpArray(['', '', '', '', '', '']);
      boxAnims.forEach(anim => anim.setValue(0));
      otpInputs.current[0]?.focus();

      Alert.alert('OTP Sent', res.message || 'A new OTP has been sent.');
    } catch (err) {
      Alert.alert(
        'Resend Failed',
        err instanceof ApiError ? err.message : 'Unable to resend OTP.',
      );
    } finally {
      setIsResending(false);
    }
  };

  const getInputContainerStyle = (fieldName: string) => [
    styles.inputContainer,
    focusedInput === fieldName && {
      borderColor: primaryColor,
      backgroundColor: '#FFFFFF',
    },
    errors[fieldName] && { borderColor: errorColor },
  ];

  const renderHeader = () => {
    if (step === 'otp') return 'Verify Number';
    return ['', 'Create Account', 'Security Setup', 'Review Details'][step];
  };

  const renderIllustration = () => {
    if (step === 1) return <SignupIllustration width={280} height={180} />;
    if (step === 2) return <ProfileIllustration width={280} height={180} />;
    if (step === 3) return <AccessIllustration width={280} height={180} />;
    if (step === 'otp')
      return <ForgotPasswordIllustration width={280} height={180} />;
    return null;
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#F2FCE4', '#FFFFFF']}
        style={styles.backgroundGradient}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <KeyboardAwareScrollView
            innerRef={ref => {
              scrollViewRef.current = ref as any;
            }}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            extraScrollHeight={Platform.OS === 'android' ? 80 : 20}
            extraHeight={Platform.OS === 'android' ? 100 : 0}
          >
            <View style={styles.navBar}>
              {step !== 1 ? (
                <TouchableOpacity
                  style={styles.backCircle}
                  onPress={() => {
                    Keyboard.dismiss();
                    if (step === 'otp') {
                      setStep(3);
                      return;
                    }
                    setStep((step as number) - 1);
                  }}
                  disabled={isAnimating}
                >
                  <Icon name="chevron-left" size={24} color="#000" />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 40 }} />
              )}
              <View style={{ flex: 1 }} />
            </View>

            <View style={styles.headerContent}>
              <Text style={styles.title}>{renderHeader()}</Text>
              <Text style={styles.subtitle}>
                {step === 1
                  ? 'Please enter your details to continue'
                  : step === 2
                    ? 'Create a secure password for your account'
                    : step === 3
                      ? 'Review your info before creating account'
                      : 'Enter the OTP sent to your phone'}
              </Text>
            </View>

            <View style={styles.illustrationContainer}>
              {renderIllustration()}
            </View>

            {step === 1 && (
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>First Name</Text>
                  <View style={getInputContainerStyle('firstName')}>
                    <Icon
                      name="user"
                      size={20}
                      color="#555"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Your first name"
                      placeholderTextColor="#999"
                      value={firstName}
                      onChangeText={t => {
                        setFirstName(t);
                        setErrors({ ...errors, firstName: '' });
                      }}
                      onFocus={() => setFocusedInput('firstName')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                  {errors.firstName && (
                    <Text style={styles.errorText}>{errors.firstName}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Last Name (Optional)</Text>
                  <View style={getInputContainerStyle('lastName')}>
                    <Icon
                      name="user"
                      size={20}
                      color="#555"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Your last name"
                      placeholderTextColor="#999"
                      value={lastName}
                      onChangeText={setLastName}
                      onFocus={() => setFocusedInput('lastName')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Username</Text>
                  <View style={getInputContainerStyle('username')}>
                    <Icon
                      name="at-sign"
                      size={20}
                      color="#555"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your unique username"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      value={username}
                      onChangeText={t => {
                        setUsername(t);
                        setErrors({ ...errors, username: '' });
                      }}
                      onFocus={() => setFocusedInput('username')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                  {errors.username && (
                    <Text style={styles.errorText}>{errors.username}</Text>
                  )}
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone</Text>
                  <View style={getInputContainerStyle('phone')}>
                    <CountryPicker
                      countryCode={countryCode}
                      withFilter
                      withFlag
                      withCallingCode
                      withEmoji
                      visible={isCountryPickerVisible}
                      onSelect={(country: Country) => {
                        setCountryCode(country.cca2);
                        setCallingCode(country.callingCode[0]);
                        setIsCountryPickerVisible(false);
                      }}
                      onClose={() => setIsCountryPickerVisible(false)}
                      containerButtonStyle={styles.countryPickerButton}
                    />
                    <TouchableOpacity
                      style={styles.countryPickerTrigger}
                      onPress={() => setIsCountryPickerVisible(true)}
                    >
                      <Text style={styles.countryCodeText}>+{callingCode}</Text>
                      <Icon
                        name="chevron-down"
                        size={16}
                        color="#555"
                        style={{ marginLeft: 4 }}
                      />
                    </TouchableOpacity>
                    <View style={styles.dividerVertical} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your phone number"
                      placeholderTextColor="#999"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={t => {
                        setPhone(t);
                        setErrors({ ...errors, phone: '' });
                      }}
                      onFocus={() => setFocusedInput('phone')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                  {errors.phone && (
                    <Text style={styles.errorText}>{errors.phone}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={getInputContainerStyle('password')}>
                    <Icon
                      name="lock"
                      size={20}
                      color="#555"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Create a strong password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={t => {
                        setPassword(t);
                        setErrors({ ...errors, password: '' });
                      }}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      <Icon
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color="#555"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password && (
                    <Text style={styles.errorText}>{errors.password}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={getInputContainerStyle('confirmPassword')}>
                    <Icon
                      name="lock"
                      size={20}
                      color="#555"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm your password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={t => {
                        setConfirmPassword(t);
                        setErrors({ ...errors, confirmPassword: '' });
                      }}
                      onFocus={() => setFocusedInput('confirmPassword')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      style={styles.eyeIcon}
                    >
                      <Icon
                        name={showConfirmPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color="#555"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPassword && (
                    <Text style={styles.errorText}>
                      {errors.confirmPassword}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {step === 3 && (
              <View style={styles.formContainer}>
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Name</Text>
                    <Text style={styles.summaryValue}>
                      {firstName} {lastName}
                    </Text>
                  </View>
                  <View style={styles.dividerHorizontal} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Username</Text>
                    <Text style={styles.summaryValue}>@{username}</Text>
                  </View>
                  <View style={styles.dividerHorizontal} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Phone</Text>
                    <Text style={styles.summaryValue}>
                      +{callingCode} {phone}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => setIsTermsOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.termsText}>
                    By creating an account, you acknowledge that you have read
                    and agree to our{' '}
                    <Text style={styles.termsLink}>Terms & Policy</Text>.
                    Acceptance is required to proceed with account creation.
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'otp' && (
              <View style={styles.formContainer}>
                <Text style={styles.label}>Enter 6-Digit OTP</Text>
                <View style={styles.otpRow}>
                  {otpArray.map((digit, index) => {
                    const translateY = boxAnims[index].interpolate({
                      inputRange: [-150, 0, 150],
                      outputRange: [-150, 0, 150],
                      extrapolate: 'clamp',
                    });
                    const translateX = boxAnims[index].interpolate({
                      inputRange: [-150, 0, 150],
                      outputRange: [0, 0, 150],
                      extrapolate: 'clamp',
                    });

                    return (
                      <Animated.View
                        key={index}
                        style={[
                          styles.otpBox,
                          focusedInput === `otp-${index}` &&
                            styles.otpBoxFocused,
                          digit ? styles.otpBoxFilled : null,
                          errors.otp ? styles.otpBoxError : null,
                          {
                            transform: [{ translateY }, { translateX }],
                            opacity: boxAnims[index].interpolate({
                              inputRange: [-150, -100, 0, 100, 150],
                              outputRange: [0, 1, 1, 1, 0],
                              extrapolate: 'clamp',
                            }),
                          },
                        ]}
                      >
                        <TextInput
                          ref={ref => {
                            otpInputs.current[index] = ref;
                          }}
                          style={styles.otpInput}
                          value={digit}
                          onChangeText={text => handleOtpChange(text, index)}
                          onKeyPress={e => handleOtpKeyPress(e, index)}
                          keyboardType="number-pad"
                          maxLength={6}
                          selectTextOnFocus
                          autoFocus={index === 0}
                          onFocus={() => setFocusedInput(`otp-${index}`)}
                          onBlur={() => setFocusedInput(null)}
                          editable={!isOtpExpired && !isAnimating}
                        />
                      </Animated.View>
                    );
                  })}
                </View>

                {errors.otp && (
                  <Text style={styles.errorText}>{errors.otp}</Text>
                )}

                <View style={styles.timerRow}>
                  {isOtpExpired ? (
                    <Text style={styles.timerExpiredText}>OTP has expired</Text>
                  ) : (
                    <Text style={styles.timerText}>
                      OTP expires in {formatTime(timeLeft)}
                    </Text>
                  )}
                </View>

                {/* 👇 Resend OTP button - SIRF tab dikhega jab timer khatam ho */}
                {isOtpExpired && (
                  <TouchableOpacity
                    style={[
                      styles.resendButton,
                      !canResend && styles.resendButtonDisabled,
                    ]}
                    onPress={handleResendOtp}
                    disabled={!canResend}
                    activeOpacity={0.7}
                  >
                    {isResending ? (
                      <ActivityIndicator size="small" color="#5EE817" />
                    ) : (
                      <Text style={styles.resendButtonText}>Resend OTP</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={{ flex: 1, minHeight: 40 }} />

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: primaryColor },
                !agreeTerms && step === 3 && { opacity: 0.5 },
                step === 'otp' && isOtpExpired && { opacity: 0.5 },
                isAnimating && { opacity: 0.7 },
              ]}
              onPress={
                step === 3
                  ? handleSignup
                  : step === 'otp'
                    ? handleVerify
                    : handleNextStep
              }
              disabled={
                isLoading ||
                (!agreeTerms && step === 3) ||
                (step === 'otp' && isOtpExpired) ||
                isAnimating
              }
              activeOpacity={0.8}
            >
              {isLoading || isAnimating ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {step === 1
                    ? 'Continue'
                    : step === 2
                      ? 'Continue'
                      : step === 3
                        ? 'Sign Up'
                        : 'Verify & Login'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Already have an account - ONLY ON STEP 1 */}
            {step === 1 && (
              <View style={styles.loginRedirectRow}>
                <Text style={styles.loginRedirectText}>
                  Already have an account?{' '}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login' as never)}
                >
                  <Text style={styles.loginRedirectLink}>Login</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.brandFooter}>
              <View style={styles.brandRow}>
                <Image
                  source={require('../../../assets/images/tizzy-logo.jpg')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
                <Text style={styles.brandName}>TizzyGo</Text>
              </View>
              <View style={styles.builtWithRow}>
                <Image
                  source={require('../../../assets/images/quton-alphabet.png')}
                  style={styles.qutonLogo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <TermsPolicyDialog
        open={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
        onAccept={() => {
          setAgreeTerms(true);
          setIsTermsOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    paddingBottom: 20,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    height: 180,
  },
  headerContent: { marginBottom: 16, alignItems: 'center' },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#777777',
    lineHeight: 22,
    textAlign: 'center',
  },
  formContainer: { gap: 16 },
  inputGroup: { marginBottom: 2 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1A1A1A', height: '100%' },
  eyeIcon: { padding: 8 },
  countryPickerButton: { width: 0, height: 0 },
  countryPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  countryCodeText: { fontSize: 16, color: '#1A1A1A', fontWeight: '500' },
  dividerVertical: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 12,
  },
  errorText: {
    color: '#FF4D4D',
    fontSize: 13,
    marginTop: 4,
    marginLeft: 8,
    fontWeight: '500',
  },
  summaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  summaryLabel: { fontSize: 14, color: '#777777', fontWeight: '500' },
  summaryValue: { fontSize: 15, color: '#1A1A1A', fontWeight: '600' },
  dividerHorizontal: { height: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  termsText: { flex: 1, fontSize: 14, color: '#555555', lineHeight: 22 },
  termsLink: { color: '#10B981', fontWeight: '700' },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#5EE817',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loginRedirectRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  loginRedirectText: { fontSize: 14, color: '#555555', fontWeight: '500' },
  loginRedirectLink: { fontSize: 14, color: '#10B981', fontWeight: '800' },
  brandFooter: { alignItems: 'center', marginTop: 12, marginBottom: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  brandLogo: { width: 24, height: 24, marginRight: 8, borderRadius: 4 },
  brandName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  builtWithRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qutonLogo: { width: 180, height: 54 },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxFocused: { borderColor: '#5EE817', backgroundColor: '#FFFFFF' },
  otpBoxFilled: { borderColor: '#5EE817' },
  otpBoxError: {
    borderColor: '#FF4D4D',
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
  },
  otpInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    width: '100%',
    height: '100%',
    padding: 0,
  },
  timerRow: { alignItems: 'center', marginTop: 12 },
  timerText: { fontSize: 14, color: '#777777', fontWeight: '500' },
  timerExpiredText: { fontSize: 14, color: '#FF4D4D', fontWeight: '600' },
  resendButton: { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  resendButtonDisabled: { opacity: 0.55 },
  resendButtonText: { fontSize: 14, color: '#5EE817', fontWeight: '700' },
});
