// TizzyOS.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LottieView from 'lottie-react-native';
import { useTheme } from '../../contexts/theme/ThemeContext';

// ✅ Splash auth — direct API + token check
import { me } from '../../../api/features/public/authPublicSlice';
import {
  getToken,
  getSessionToken,
} from '../../../api/connections/token/tokenSlice';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Signup: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function TizzyOS() {
  const { isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [isPressed, setIsPressed] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.8)).current;
  const lottieAnim = useRef(new Animated.Value(0)).current;

  // Colors based on theme
  const backgroundColor = isDark ? '#0F172A' : '#FFFFFF';
  // ✅ BLUE COLORS (instead of green)
  const primaryColor = isDark ? '#60A5FA' : '#2563EB';
  const subtitleColor = isDark ? '#94A3B8' : '#6b7280';
  // ✅ Added blue text color for TizzyOS
  const textColor = isDark ? '#60A5FA' : '#1D4ED8';

  // Start animations on mount
  useEffect(() => {
    const fadeIn = {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    };

    const logoSpring = {
      toValue: 1,
      friction: 7,
      tension: 70,
      useNativeDriver: true,
    };

    const lottieFade = {
      toValue: 1,
      duration: 1800,
      useNativeDriver: true,
      delay: 300,
    };

    Animated.parallel([
      Animated.timing(fadeAnim, fadeIn),
      Animated.spring(logoScaleAnim, logoSpring),
      Animated.timing(lottieAnim, lottieFade),
    ]).start();
  }, []);

  // Handle press animation
  useEffect(() => {
    const pressScale = {
      toValue: isPressed ? 0.97 : 1,
      friction: 7,
      tension: 70,
      useNativeDriver: true,
    };
    Animated.spring(scaleAnim, pressScale).start();
  }, [isPressed]);

  // ============================================================
  // MINIMUM SPLASH TIME — 3 seconds
  // ============================================================
  useEffect(() => {
    const minTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 3000);

    return () => clearTimeout(minTimer);
  }, []);

  // ============================================================
  // AUTH CHECK & NAVIGATION — direct Connect API calls
  //
  // 1. Local token check (fast fail) → Signup
  // 2. me() API call → user available? → Home
  // 3. Fail / 401 / network error → Login
  // ============================================================
  useEffect(() => {
    if (!minTimeElapsed) return;

    let cancelled = false;

    const checkAndNavigate = async () => {
      try {
        // Step 1: do we have any auth token?
        const [accessToken, sessionToken] = await Promise.all([
          getToken(),
          getSessionToken(),
        ]);

        if (cancelled) return;

        if (!accessToken && !sessionToken) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Signup' }],
          });
          return;
        }

        // Step 2: validate session with `me()`
        // If the access token is expired, apiClient auto-refreshes
        // using the stored session token. If refresh fails,
        // apiClient clears tokens and throws.
        const response = await me();

        if (cancelled) return;

        if (response?.success && response?.user) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
      } catch {
        // Network error, expired refresh token, etc.
        // apiClient already cleared tokens on refresh failure.
        if (!cancelled) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
      }
    };

    checkAndNavigate();

    return () => {
      cancelled = true;
    };
  }, [minTimeElapsed, navigation]);

  // Handle press - just animation, no sound
  const handlePress = () => {
    setIsPressed(true);
    setTimeout(() => {
      setIsPressed(false);
    }, 200);
  };

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={[styles.container, { backgroundColor }]}>
        <Animated.View
          style={[
            styles.mainContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Animated.View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/images/tizzy-logo.jpg')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.Text
            style={[
              styles.tizzyostagline,
              {
                color: isPressed ? primaryColor : subtitleColor,
                transform: [{ scale: isPressed ? 1.02 : 1 }],
              },
            ]}
          >
            TizzyOS
          </Animated.Text>

          <Animated.View
            style={[
              styles.lottieContainer,
              { opacity: lottieAnim },
            ]}
          >
            <LottieView
              source={require('../../../assets/lotties/Welcome.json')}
              autoPlay
              loop
              style={styles.lottie}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.Text
            style={[
              styles.tagline,
              {
                color: isPressed ? primaryColor : subtitleColor,
                transform: [{ scale: isPressed ? 1.02 : 1 }],
              },
            ]}
          >
            {'Tap anywhere'}
          </Animated.Text>

          <Animated.Text
            style={[
              styles.footerText,
              {
                color: subtitleColor,
                opacity: fadeAnim,
              },
            ]}
          >
            Built with Quton ❤️
          </Animated.Text>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: 160,
    height: 160,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  tizzyostagline: {
    fontSize: 30,
    fontFamily: 'Poppins-Light',
    textAlign: 'center',
    marginBottom: 10,
  },
  lottieContainer: {
    width: 200,
    height: 100,
    marginTop: 10,
    marginBottom: 20,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 15,
    fontWeight: '300',
    textAlign: 'center',
    position: 'absolute',
    bottom: 40,
  },
});