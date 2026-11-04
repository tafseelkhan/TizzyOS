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

// 👇 SVG Imports
import EnterPasswordIllustration from '../../../assets/svg/illustrations/tizzygo-os_enter-password_1kl4.svg';
import ForgotPasswordIllustration from '../../../assets/svg/illustrations/tizzygo-os_forgot-password_nttj.svg';

import { RootStackParamList } from '../../types/NavigationTypes';
import {
  login,
  verifyLoginOtp,
  requestForgotPassword,
  verifyForgotPasswordOtp,
  resetPassword,
  resendOtp,
} from '../../../api/features/public/authPublicSlice';
import { ApiError } from '../../../core/utils/handler/apiClient';

type NavigationProp = StackNavigationProp<RootStackParamList>;

type ScreenStep =
  'login' | 'login_otp' | 'forgot_request' | 'forgot_otp' | 'forgot_reset';

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);

  // ─── Navigation between internal steps ───────────────────────────────────
  const [step, setStep] = useState<ScreenStep>('login');

  // ─── Login form ──────────────────────────────────────────────────────────
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ─── Forgot-password form ────────────────────────────────────────────────
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');

  // ─── Shared OTP state ────────────────────────────────────────────────────
  const [verificationId, setVerificationId] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);
  const otpInputs = useRef<Array<React.ElementRef<typeof TextInput> | null>>(
    [],
  );
  const boxAnims = useRef(
    Array(6)
      .fill(0)
      .map(() => new Animated.Value(0)),
  ).current;

  // ─── Timers ──────────────────────────────────────────────────────────────
  const [expirationTimestamp, setExpirationTimestamp] = useState<number | null>(
    null,
  );
  const [timeLeft, setTimeLeft] = useState(0);

  // ─── UI state ────────────────────────────────────────────────────────────
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const otp = otpArray.join('');
  const primaryColor = '#5EE817';
  const errorColor = '#FF4D4D';

  // ─── OTP expiry timer (Single timer based on backend expiry) ─────────────
  useEffect(() => {
    if (!expirationTimestamp) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((expirationTimestamp - Date.now()) / 1000),
      );
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    setTimeLeft(
      Math.max(0, Math.ceil((expirationTimestamp - Date.now()) / 1000)),
    );
    return () => clearInterval(interval);
  }, [expirationTimestamp]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isOtpExpired = timeLeft <= 0 && expirationTimestamp !== null;

  // 👇 Resend enable logic: Sirf timer expire hone par aur process chalte waqt disabled
  const canResend =
    isOtpExpired &&
    !!verificationId &&
    !isResending &&
    !isAnimating &&
    !isLoading;

  // ─── OTP animations ──────────────────────────────────────────────────────
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
      boxAnims.forEach(a => a.setValue(0));
      setIsAnimating(false);
      setErrors(prev => ({ ...prev, otp: 'Invalid OTP. Please try again.' }));
      otpInputs.current[0]?.focus();
    });
  };

  const playSuccessOtpAnimation = (onDone: () => void) => {
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
      setIsAnimating(false);
      onDone();
    });
  };

  // ─── OTP input handlers ──────────────────────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    if (isAnimating) return;
    const cleaned = text.replace(/[^0-9]/g, '');

    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6).split('');
      const next = [...otpArray];
      pasted.forEach((d, i) => {
        if (index + i < 6) next[index + i] = d;
      });
      setOtpArray(next);
      otpInputs.current[Math.min(index + pasted.length, 5)]?.focus();
      return;
    }

    const next = [...otpArray];
    next[index] = cleaned;
    setOtpArray(next);
    setErrors(prev => ({ ...prev, otp: '' }));
    if (cleaned && index < 5) otpInputs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const resetOtpState = () => {
    setOtpArray(['', '', '', '', '', '']);
    boxAnims.forEach(a => a.setValue(0));
    setErrors(prev => ({ ...prev, otp: '' }));
  };

  // 👇 Timer start function - Only backend expiresInSeconds used
  const startOtpTimer = (expiresInSeconds = 240) => {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    setExpirationTimestamp(expiresAt);
    setTimeLeft(expiresInSeconds);
  };

  // ─── LOGIN – Step 1: password ────────────────────────────────────────────
  const handleLoginStep1 = async () => {
    Keyboard.dismiss();
    const nextErrors: Record<string, string> = {};
    if (!loginValue.trim()) {
      nextErrors.login = 'Username or Connect address is required';
    }
    if (!password) {
      nextErrors.password = 'Password is required';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsLoading(true);
    try {
      const res = await login({
        login: loginValue.trim().toLowerCase(),
        password,
      });

      if (res.verificationRequired && res.verificationId) {
        setVerificationId(res.verificationId);
        setMaskedPhone(res.phone ?? '');
        startOtpTimer(res.expiresInSeconds ?? 240);
        resetOtpState();
        setStep('login_otp');
      } else if (res.accessToken) {
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      }
    } catch (err) {
      Alert.alert(
        'Login Error',
        err instanceof ApiError ? err.message : 'Unable to login.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── LOGIN – Step 2: OTP ─────────────────────────────────────────────────
  const handleLoginOtpVerify = async () => {
    if (isOtpExpired) {
      Alert.alert('OTP Expired', 'Please request a new OTP to continue.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setErrors(prev => ({ ...prev, otp: 'Enter a valid 6-digit OTP' }));
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setErrors({});

    try {
      await verifyLoginOtp({
        verificationId,
        code: otp,
      });
      playSuccessOtpAnimation(() => {
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      });
    } catch {
      playWrongOtpAnimation();
    } finally {
      setIsLoading(false);
    }
  };

  // ─── FORGOT PASSWORD – Step 1: request OTP ───────────────────────────────
  const handleForgotRequest = async () => {
    Keyboard.dismiss();
    if (!forgotIdentifier.trim()) {
      setErrors({ identifier: 'Username or Connect address is required' });
      return;
    }

    setIsLoading(true);
    setErrors({});
    try {
      const res = await requestForgotPassword({
        identifier: forgotIdentifier.trim().toLowerCase(),
      });

      if (res.verificationId) {
        setVerificationId(res.verificationId);
        setMaskedPhone(res.phone ?? '');
        startOtpTimer(res.expiresInSeconds ?? 240);
        resetOtpState();
        setStep('forgot_otp');
      } else {
        Alert.alert(
          'Check your phone',
          res.message ||
            'If an account exists and is eligible, an OTP has been sent.',
        );
      }
    } catch (err) {
      Alert.alert(
        'Request Failed',
        err instanceof ApiError ? err.message : 'Unable to process request.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── FORGOT PASSWORD – Step 2: verify OTP → get resetToken ───────────────
  const handleForgotOtpVerify = async () => {
    if (isOtpExpired) {
      Alert.alert('OTP Expired', 'Please request a new OTP to continue.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setErrors(prev => ({ ...prev, otp: 'Enter a valid 6-digit OTP' }));
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setErrors({});

    try {
      const res = await verifyForgotPasswordOtp({
        verificationId,
        code: otp,
      });

      if (res.resetToken) {
        setResetToken(res.resetToken);
        playSuccessOtpAnimation(() => {
          setStep('forgot_reset');
          resetOtpState();
        });
      } else {
        throw new Error('No reset token received');
      }
    } catch {
      playWrongOtpAnimation();
    } finally {
      setIsLoading(false);
    }
  };

  // ─── FORGOT PASSWORD – Step 3: set new password ──────────────────────────
  const handleResetPassword = async () => {
    Keyboard.dismiss();
    const nextErrors: Record<string, string> = {};
    if (!newPassword || newPassword.length < 8) {
      nextErrors.newPassword = 'Password must be at least 8 characters';
    }
    if (newPassword !== confirmNewPassword) {
      nextErrors.confirmNewPassword = 'Passwords do not match';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsLoading(true);
    try {
      await resetPassword({
        resetToken,
        newPassword,
        confirmPassword: confirmNewPassword,
      });

      Alert.alert(
        'Password Updated',
        'Your password has been reset. Please log in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => {
              setPassword('');
              setNewPassword('');
              setConfirmNewPassword('');
              setResetToken('');
              setVerificationId('');
              setStep('login');
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert(
        'Reset Failed',
        err instanceof ApiError ? err.message : 'Unable to reset password.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── RESEND OTP (shared for login_otp & forgot_otp) ──────────────────────
  const handleResendOtp = async () => {
    if (!canResend || !verificationId) return;

    Keyboard.dismiss();
    setIsResending(true);
    setErrors(prev => ({ ...prev, otp: '' }));

    try {
      const res = await resendOtp({ verificationId });
      if (res.verificationId) setVerificationId(res.verificationId);
      // 👇 Backend se naya expiresInSeconds aayega, usse timer restart hoga
      startOtpTimer(res.expiresInSeconds ?? 240);
      resetOtpState();
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

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const getInputContainerStyle = (fieldName: string) => [
    styles.inputContainer,
    focusedInput === fieldName && {
      borderColor: primaryColor,
      backgroundColor: '#FFFFFF',
    },
    errors[fieldName] && { borderColor: errorColor },
  ];

  const goBack = () => {
    Keyboard.dismiss();
    if (step === 'login_otp') {
      setStep('login');
      resetOtpState();
      return;
    }
    if (step === 'forgot_request') {
      setStep('login');
      return;
    }
    if (step === 'forgot_otp') {
      setStep('forgot_request');
      resetOtpState();
      return;
    }
    if (step === 'forgot_reset') {
      setStep('login');
      setResetToken('');
      return;
    }
  };

  const renderHeader = () => {
    switch (step) {
      case 'login':
        return 'Welcome Back';
      case 'login_otp':
        return 'Verify Login';
      case 'forgot_request':
        return 'Forgot Password';
      case 'forgot_otp':
        return 'Verify OTP';
      case 'forgot_reset':
        return 'New Password';
      default:
        return '';
    }
  };

  const renderSubtitle = () => {
    switch (step) {
      case 'login':
        return 'Log in to your TizzyGo account';
      case 'login_otp':
        return maskedPhone
          ? `Enter the OTP sent to ${maskedPhone}`
          : 'Enter the OTP sent to your registered phone';
      case 'forgot_request':
        return 'Enter your username or Connect address to receive a reset OTP';
      case 'forgot_otp':
        return maskedPhone
          ? `Enter the OTP sent to ${maskedPhone}`
          : 'Enter the OTP sent to your registered phone';
      case 'forgot_reset':
        return 'Choose a strong new password for your account';
      default:
        return '';
    }
  };

  const renderIllustration = () => {
    if (step === 'login' || step === 'forgot_reset') {
      return <EnterPasswordIllustration width={280} height={180} />;
    }
    return <ForgotPasswordIllustration width={280} height={180} />;
  };

  const primaryButtonLabel = () => {
    switch (step) {
      case 'login':
        return 'Continue';
      case 'login_otp':
        return 'Verify & Login';
      case 'forgot_request':
        return 'Send OTP';
      case 'forgot_otp':
        return 'Verify OTP';
      case 'forgot_reset':
        return 'Reset Password';
      default:
        return 'Continue';
    }
  };

  const onPrimaryPress = () => {
    switch (step) {
      case 'login':
        return handleLoginStep1();
      case 'login_otp':
        return handleLoginOtpVerify();
      case 'forgot_request':
        return handleForgotRequest();
      case 'forgot_otp':
        return handleForgotOtpVerify();
      case 'forgot_reset':
        return handleResetPassword();
    }
  };

  const isPrimaryDisabled =
    isLoading ||
    isAnimating ||
    ((step === 'login_otp' || step === 'forgot_otp') && isOtpExpired);

  // ─── Render OTP boxes (shared) ───────────────────────────────────────────
  const renderOtpSection = () => (
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
                focusedInput === `otp-${index}` && styles.otpBoxFocused,
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

      {errors.otp ? <Text style={styles.errorText}>{errors.otp}</Text> : null}

      <View style={styles.timerRow}>
        {isOtpExpired ? (
          <Text style={styles.timerExpiredText}>OTP has expired</Text>
        ) : (
          <Text style={styles.timerText}>
            OTP expires in {formatTime(timeLeft)}
          </Text>
        )}
      </View>

      {/* 👇 Resend OTP button - SIRF tab dikhega jab timer expire ho chuka ho */}
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
            <Text
              style={[
                styles.resendButtonText,
                !canResend && styles.resendButtonTextDisabled,
              ]}
            >
              Resend OTP
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

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
            enableOnAndroid
            enableAutomaticScroll
            extraScrollHeight={Platform.OS === 'android' ? 80 : 20}
            extraHeight={Platform.OS === 'android' ? 100 : 0}
          >
            {/* Top Navigation */}
            <View style={styles.navBar}>
              {step !== 'login' ? (
                <TouchableOpacity
                  style={styles.backCircle}
                  onPress={goBack}
                  disabled={isAnimating}
                >
                  <Icon name="chevron-left" size={24} color="#000" />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 40 }} />
              )}
              <View style={{ flex: 1 }} />
            </View>

            {/* Header */}
            <View style={styles.headerContent}>
              <Text style={styles.title}>{renderHeader()}</Text>
              <Text style={styles.subtitle}>{renderSubtitle()}</Text>
            </View>

            {/* Illustration */}
            <View style={styles.illustrationContainer}>
              {renderIllustration()}
            </View>

            {/* ── LOGIN form ── */}
            {step === 'login' && (
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Username or Connect Address</Text>
                  <View style={getInputContainerStyle('login')}>
                    <Icon
                      name="at-sign"
                      size={20}
                      color="#555"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="johndoe or johndoe@quton.com"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={loginValue}
                      onChangeText={t => {
                        setLoginValue(t);
                        setErrors(prev => ({ ...prev, login: '' }));
                      }}
                      onFocus={() => setFocusedInput('login')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                  {errors.login ? (
                    <Text style={styles.errorText}>{errors.login}</Text>
                  ) : null}
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
                      placeholder="Enter your password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={t => {
                        setPassword(t);
                        setErrors(prev => ({ ...prev, password: '' }));
                      }}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(v => !v)}
                      style={styles.eyeIcon}
                    >
                      <Icon
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color="#555"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password ? (
                    <Text style={styles.errorText}>{errors.password}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.forgotLinkRow}
                  onPress={() => {
                    setForgotIdentifier(loginValue);
                    setStep('forgot_request');
                    setErrors({});
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotLinkText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── LOGIN OTP / FORGOT OTP ── */}
            {(step === 'login_otp' || step === 'forgot_otp') &&
              renderOtpSection()}

            {/* ── FORGOT – request identifier ── */}
            {step === 'forgot_request' && (
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Username or Connect Address</Text>
                  <View style={getInputContainerStyle('identifier')}>
                    <Icon
                      name="at-sign"
                      size={20}
                      color="#555"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="johndoe or johndoe@quton.com"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={forgotIdentifier}
                      onChangeText={t => {
                        setForgotIdentifier(t);
                        setErrors(prev => ({ ...prev, identifier: '' }));
                      }}
                      onFocus={() => setFocusedInput('identifier')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                  {errors.identifier ? (
                    <Text style={styles.errorText}>{errors.identifier}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* ── FORGOT – set new password ── */}
            {step === 'forgot_reset' && (
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={getInputContainerStyle('newPassword')}>
                    <Icon
                      name="lock"
                      size={20}
                      color="#555"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="At least 8 characters"
                      placeholderTextColor="#999"
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={t => {
                        setNewPassword(t);
                        setErrors(prev => ({ ...prev, newPassword: '' }));
                      }}
                      onFocus={() => setFocusedInput('newPassword')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword(v => !v)}
                      style={styles.eyeIcon}
                    >
                      <Icon
                        name={showNewPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color="#555"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.newPassword ? (
                    <Text style={styles.errorText}>{errors.newPassword}</Text>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm New Password</Text>
                  <View style={getInputContainerStyle('confirmNewPassword')}>
                    <Icon
                      name="lock"
                      size={20}
                      color="#555"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Re-enter new password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showConfirmNewPassword}
                      value={confirmNewPassword}
                      onChangeText={t => {
                        setConfirmNewPassword(t);
                        setErrors(prev => ({
                          ...prev,
                          confirmNewPassword: '',
                        }));
                      }}
                      onFocus={() => setFocusedInput('confirmNewPassword')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmNewPassword(v => !v)}
                      style={styles.eyeIcon}
                    >
                      <Icon
                        name={showConfirmNewPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color="#555"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.confirmNewPassword ? (
                    <Text style={styles.errorText}>
                      {errors.confirmNewPassword}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            <View style={{ flex: 1, minHeight: 40 }} />

            {/* Primary Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: primaryColor },
                isPrimaryDisabled && { opacity: 0.5 },
              ]}
              onPress={onPrimaryPress}
              disabled={isPrimaryDisabled}
              activeOpacity={0.8}
            >
              {isLoading || isAnimating ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {primaryButtonLabel()}
                </Text>
              )}
            </TouchableOpacity>

            {/* Footer – only on main login step */}
            {step === 'login' && (
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Signup')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Brand footer */}
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

  errorText: {
    color: '#FF4D4D',
    fontSize: 13,
    marginTop: 4,
    marginLeft: 8,
    fontWeight: '500',
  },

  forgotLinkRow: {
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingVertical: 4,
  },
  forgotLinkText: {
    fontSize: 14,
    color: '#5EE817',
    fontWeight: '700',
  },

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

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#777777',
    fontSize: 14,
  },
  footerLink: {
    color: '#5EE817',
    fontSize: 14,
    fontWeight: '700',
  },

  brandFooter: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
    borderRadius: 4,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  builtWithRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qutonLogo: {
    width: 180,
    height: 54,
  },

  // OTP
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
  otpBoxFocused: {
    borderColor: '#5EE817',
    backgroundColor: '#FFFFFF',
  },
  otpBoxFilled: {
    borderColor: '#5EE817',
  },
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
  timerRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  timerText: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '500',
  },
  timerExpiredText: {
    fontSize: 14,
    color: '#FF4D4D',
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  resendButtonDisabled: {
    opacity: 0.55,
  },
  resendButtonText: {
    fontSize: 14,
    color: '#5EE817',
    fontWeight: '700',
  },
  resendButtonTextDisabled: {
    color: '#999999',
  },
});
