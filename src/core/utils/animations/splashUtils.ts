// utils/splashUtils.ts
import { Platform, PermissionsAndroid } from 'react-native';
import Sound from 'react-native-sound';

export interface SoundConfig {
  soundFile: any;
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
}
// Export Sound type for use in components
export type { Sound };
/**
 * Request Android permission for audio playback
 */
export const requestAndroidAudioPermission = async (): Promise<boolean> => {
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
      console.warn('Permission error:', err);
      return false;
    }
  }
  return true;
};

/**
 * Setup audio for iOS
 */
export const setupIOSAudio = (): void => {
  if (Platform.OS === 'ios') {
    console.log('🍎 Setting iOS category...');
    Sound.setCategory('Playback', true);
    Sound.setActive(true);
    console.log('✅ iOS audio setup complete');
  }
};

/**
 * Load sound file with react-native-sound
 */
export const loadSound = async (config: SoundConfig): Promise<Sound | null> => {
  const { soundFile, onLoadSuccess, onLoadError } = config;

  try {
    console.log('🔊 Loading sound file...');

    // Request permission for Android
    const hasPermission = await requestAndroidAudioPermission();
    if (!hasPermission && Platform.OS === 'android') {
      console.log('⚠️ Permission not granted, sound may not work');
    }

    // Setup iOS audio
    setupIOSAudio();

    return new Promise(resolve => {
      const sound = new Sound(soundFile, error => {
        if (error) {
          console.log('❌ Sound load failed:', error);
          onLoadError?.(error);
          resolve(null);
          return;
        }

        console.log('✅ Sound loaded successfully');
        console.log('Duration:', sound.getDuration());
        onLoadSuccess?.();
        resolve(sound);
      });
    });
  } catch (error: any) {
    console.log('🔥 Audio setup crashed:', error);
    onLoadError?.(error);
    return null;
  }
};

/**
 * Play sound with error handling
 */
export const playSound = (
  soundRef: Sound | null,
  isLoaded: boolean,
): boolean => {
  console.log('🎯 Attempting to play sound...');
  console.log('Sound ref exists:', !!soundRef);
  console.log('Sound loaded state:', isLoaded);

  if (!soundRef) {
    console.log('❌ No sound reference - sound not loaded');
    return false;
  }

  if (!isLoaded) {
    console.log('❌ Sound not loaded yet');
    return false;
  }

  try {
    console.log('🔄 Resetting to start');
    soundRef.setCurrentTime(0);

    console.log('▶️ Playing sound');
    soundRef.play(success => {
      if (success) {
        console.log('✅ Sound played successfully!');
      } else {
        console.log('❌ Sound playback failed');
      }
    });

    console.log('✅ Play command sent');
    return true;
  } catch (error: any) {
    console.log('💥 Exception in playSound:', error);
    return false;
  }
};

/**
 * Release sound resources
 */
export const releaseSound = (soundRef: Sound | null): void => {
  if (soundRef) {
    soundRef.release();
    console.log('✅ Sound released');
  }
};

/**
 * Create animation configurations
 */
export const createAnimations = () => {
  return {
    fadeIn: {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    },
    logoSpring: {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    },
    lottieFade: {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    },
    pressScale: (isPressed: boolean) => ({
      toValue: isPressed ? 0.98 : 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }),
  };
};
