// TizzyGo.tsx
import React, { useEffect, useRef, useState, useContext } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  Animated,
  Easing,
  PermissionsAndroid,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';
import Sound from 'react-native-sound';
import { useTheme } from '../../contexts/theme/ThemeContext';
import { verifyToken } from '../../services/SplashService';

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

  // Request Android permission for audio
  const requestAndroidPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to storage to play sounds',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ Storage permission granted');
          return true;
        } else {
          console.log('❌ Storage permission denied');
          return false;
        }
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  // Load sound with react-native-sound
  useEffect(() => {
    let mounted = true;

    const loadSound = async () => {
      try {
        console.log('🔊 INITIALIZING REACT-NATIVE-SOUND...');

        // Request permission for Android
        const hasPermission = await requestAndroidPermission();
        if (!hasPermission && Platform.OS === 'android') {
          console.log('⚠️ Permission not granted, sound may not work');
        }

        // Set category for iOS
        if (Platform.OS === 'ios') {
          console.log('🍎 Setting iOS category...');
          Sound.setCategory('Playback', true);
          console.log('✅ iOS category set');
        }

        console.log('📁 Loading sound file: splash_sound.mp3');

        // Enable playback in silence mode (for iOS)
        Sound.setActive(true);

        const sound = new Sound(
          require('../../../assets/sounds/splash_sound.mp3'),
          error => {
            if (error) {
              console.log('❌❌❌ SOUND LOAD FAILED ❌❌❌');
              console.log('Error code:', error.code);
              console.log('Error message:', error.message);
              console.log('Full error:', error);
              setSoundError(`Load failed: ${error.message}`);
              setSoundLoaded(false);
              return;
            }

            console.log('✅✅✅ SOUND LOADED SUCCESSFULLY ✅✅✅');
            console.log('Sound duration:', sound.getDuration());
            console.log('Number of channels:', sound.getNumberOfChannels());
            console.log('Volume:', sound.getVolume());
            console.log('Is loaded:', sound.isLoaded());

            soundRef.current = sound;
            setSoundLoaded(true);
            setSoundError(null);
          },
        );

        console.log('🎵 Sound object created');
      } catch (error: any) {
        console.log('🔥 Audio setup crashed:', error);
        console.log('Error:', error.message);
        setSoundError(`Setup error: ${error.message}`);
      }
    };

    loadSound();

    return () => {
      console.log('🧹 Cleaning up: releasing sound');
      if (soundRef.current) {
        soundRef.current.release();
        console.log('✅ Sound released');
      }
    };
  }, []);

  const playSound = () => {
    console.log('🎯 playSound() called');
    console.log('Sound ref exists:', !!soundRef.current);
    console.log('Sound loaded state:', soundLoaded);
    console.log('Sound error:', soundError);

    if (!soundRef.current) {
      console.log('❌ No sound reference - sound not loaded');
      console.log('Sound error details:', soundError);
      return;
    }

    if (!soundLoaded) {
      console.log('❌ Sound not loaded yet, waiting...');
      return;
    }

    try {
      console.log('🔄 Resetting to start (setCurrentTime 0)');
      soundRef.current.setCurrentTime(0);

      console.log('▶️ Calling play()');
      soundRef.current.play(success => {
        if (success) {
          console.log('✅✅✅ SOUND PLAYED SUCCESSFULLY! ✅✅✅');
        } else {
          console.log('❌❌❌ SOUND PLAYBACK FAILED ❌❌❌');
          console.log('Playback failed - no specific error provided');
        }
      });
      console.log('✅ Play command sent');
    } catch (error: any) {
      console.log('💥 Exception in playSound:', error);
      console.log('Error:', error.message);
      setSoundError(`Playback exception: ${error.message}`);
    }
  };

  const handleTap = () => {
    console.log('=========================================');
    console.log('👆👆👆 TAP DETECTED! 👆👆👆');
    console.log('=========================================');
    playSound();
    setIsPressed(true);
    setTimeout(() => {
      console.log('Reset press state');
      setIsPressed(false);
    }, 200);
  };

  // Start animations on mount
  useEffect(() => {
    console.log('🎬 Starting animations...');
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(lottieAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      console.log('✅ Animations finished');
    });
  }, []);

  // Handle press animation
  useEffect(() => {
    console.log('🖱️ Press state changed:', isPressed);
    Animated.spring(scaleAnim, {
      toValue: isPressed ? 0.98 : 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isPressed]);

  // Auth check and navigation
  useEffect(() => {
    console.log('🔐 Setting up auth timer...');
    const minTimer = setTimeout(() => {
      console.log('⏰ 3 seconds elapsed, setting minTimeElapsed = true');
      setMinTimeElapsed(true);
    }, 3000);

    const checkAuth = async () => {
      try {
        console.log('🔍 Checking auth token...');
        const token = await AsyncStorage.getItem('authToken');
        console.log('Token present:', !!token);

        if (minTimeElapsed) {
          console.log('✅ Min time elapsed, proceeding with navigation...');
          if (!token) {
            console.log('🚀 No token, navigating to Signup');
            navigation.navigate('Signup');
            return;
          }

          console.log('🔄 Verifying token with server...');
          const { success } = await verifyToken(token);
          console.log('Token verification result:', success);

          if (success) {
            console.log('✅ Token valid, navigating to Home');
            navigation.navigate('Home');
          } else {
            console.log('❌ Token invalid, removing and navigating to Login');
            await AsyncStorage.removeItem('authToken');
            navigation.navigate('Login');
          }
        }
      } catch (error) {
        console.error('❌ Auth error:', error);
        if (minTimeElapsed) {
          navigation.navigate('Signup');
        }
      }
    };

    checkAuth();

    return () => {
      console.log('🧹 Cleaning up auth timer');
      clearTimeout(minTimer);
    };
  }, [navigation, minTimeElapsed]);

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
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
            Tap anywhere to hearing
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
