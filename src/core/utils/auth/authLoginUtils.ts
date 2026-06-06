// utils/auth/authUtils.ts
import { Keyboard, Animated } from 'react-native';

/**
 * Clear all errors and messages
 */
export const clearErrors = (
  setError: (value: string) => void,
  setMsg: (value: string) => void,
) => {
  setError('');
  setMsg('');
};

/**
 * Format phone number by removing non-digit characters
 */
export const formatPhoneNumber = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

/**
 * Check if identifier is email or phone
 */
export const getIdentifierType = (
  identifier: string,
): 'email' | 'phone' | 'unknown' => {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) return 'email';
  if (/^\d+$/.test(trimmed.replace(/\D/g, ''))) return 'phone';
  return 'unknown';
};

/**
 * Countdown timer utility
 */
export const useCountdown = (
  waitTime: number,
  setWaitTime: (value: number) => void,
) => {
  if (waitTime > 0) {
    const timer = setTimeout(() => setWaitTime(waitTime - 1), 1000);
    return () => clearTimeout(timer);
  }
};

/**
 * Keyboard listeners setup
 */
export const setupKeyboardListeners = (
  setIsKeyboardVisible: (value: boolean) => void,
  lottieOpacity: Animated.Value,
) => {
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
};

/**
 * Animation configurations for login screen
 */
export const createLoginAnimations = () => {
  return {
    header: {
      opacity: { toValue: 1, duration: 800, useNativeDriver: true },
      translateY: { toValue: 0, duration: 800, useNativeDriver: true },
    },
    form: {
      opacity: { toValue: 1, duration: 1000, useNativeDriver: true },
      scale: { toValue: 1, friction: 8, tension: 40, useNativeDriver: true },
    },
    input: {
      opacity: { toValue: 1, duration: 500, useNativeDriver: true },
      translateX: { toValue: 0, duration: 500, useNativeDriver: true },
    },
    button: {
      opacity: { toValue: 1, duration: 500, useNativeDriver: true },
      translateY: { toValue: 0, duration: 500, useNativeDriver: true },
    },
  };
};

/**
 * Scroll to focused input
 */
export const scrollToInput = (
  scrollViewRef: React.RefObject<any>,
  yPosition: number = 150,
  delay: number = 100,
) => {
  setTimeout(() => {
    scrollViewRef.current?.scrollTo({ y: yPosition, animated: true });
  }, delay);
};
