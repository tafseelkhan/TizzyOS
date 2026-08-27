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
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LottieView from 'lottie-react-native';
import { useTheme } from '../../contexts/theme/ThemeContext';
import { SplashService } from '../../services/animations/SplashService';

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
  const [userRole, setUserRole] = useState<string | null>(null);

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

  console.log('=========================================');
  console.log('TizzyOS Component Mounted');
  console.log('Platform:', Platform.OS);
  console.log('=========================================');

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

  // Auth check and navigation with role
  useEffect(() => {
    const checkAuthAndNavigate = async () => {
      try {
        console.log('Step 1');

        await SplashService.waitMinimumTime(3000);
        setMinTimeElapsed(true);

        console.log('Step 2');

        const result = await SplashService.checkAuthAndGetDestination();

        if (result.success && result.userRole) {
          setUserRole(result.userRole);
          console.log('✅ User Role from Splash:', result.userRole);
        }

        console.log('Step 3', result);

        navigation.navigate(result.shouldNavigateTo);

        console.log('Step 4');
      } catch (e) {
        console.error('Splash Error =>', e);
      }
    };

    checkAuthAndNavigate();
  }, [navigation]);

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
          <Animated.View style={[styles.logoContainer]}>
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
              {
                opacity: lottieAnim,
              },
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
