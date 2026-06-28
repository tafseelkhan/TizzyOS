// TizzyGo.tsx
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
import {
  loadSound,
  Sound,
  playSound,
  releaseSound,
  createAnimations,
} from '../../utils/animations/splashUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Signup: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function TizzyGo() {
  const { isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const soundRef = useRef<Sound | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [soundLoaded, setSoundLoaded] = useState(false);
  const [soundError, setSoundError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.8)).current;
  const lottieAnim = useRef(new Animated.Value(0)).current;

  // Colors based on theme
  const backgroundColor = isDark ? '#0F172A' : '#FFFFFF';
  const primaryColor = isDark ? '#34D399' : '#10B981';
  const subtitleColor = isDark ? '#94A3B8' : '#6b7280';

  console.log('=========================================');
  console.log('TizzyGo Component Mounted');
  console.log('Platform:', Platform.OS);
  console.log('=========================================');

  // Load sound
  useEffect(() => {
    const initSound = async () => {
      const sound = await loadSound({
        soundFile: require('../../../assets/sounds/splash_sound.mp3'),
        onLoadSuccess: () => {
          setSoundLoaded(true);
          setSoundError(null);
        },
        onLoadError: error => {
          setSoundError(`Load failed: ${error.message}`);
          setSoundLoaded(false);
        },
      });

      soundRef.current = sound;
    };

    initSound();

    return () => {
      releaseSound(soundRef.current);
    };
  }, []);

  const handlePlaySound = () => {
    playSound(soundRef.current, soundLoaded);
    setIsPressed(true);
    setTimeout(() => {
      setIsPressed(false);
    }, 200);
  };

  // Start animations on mount
  useEffect(() => {
    const animations = createAnimations();

    Animated.parallel([
      Animated.timing(fadeAnim, animations.fadeIn),
      Animated.spring(logoScaleAnim, animations.logoSpring),
      Animated.timing(lottieAnim, animations.lottieFade),
    ]).start();
  }, []);

  // Handle press animation
  useEffect(() => {
    const animations = createAnimations();
    Animated.spring(scaleAnim, animations.pressScale(isPressed)).start();
  }, [isPressed]);

  // Auth check and navigation with role
  useEffect(() => {
    const checkAuthAndNavigate = async () => {
      try {
        console.log('Step 1');

        await SplashService.waitMinimumTime(3000);
        setMinTimeElapsed(true);

        console.log('Step 2');

        // Check auth and get user role
        const result = await SplashService.checkAuthAndGetDestination();

        if (result.success && result.userRole) {
          setUserRole(result.userRole);
          console.log('✅ User Role from Splash:', result.userRole);

          // ✅ Store role for later use
          // You can save it to AsyncStorage or Context
          // await AsyncStorage.setItem('userRole', result.userRole);
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

  return (
    <TouchableWithoutFeedback onPress={handlePlaySound}>
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
            {'Tap anywhere to hearing'}
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
            Built with Flixora ❤️
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
