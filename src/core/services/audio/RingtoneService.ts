// src/services/audio/RingtoneService.ts

import Sound from 'react-native-sound';
import { Vibration, Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { CONFIG } from '../../../api/constants/rideRequestConfig';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

class RingtoneService {
  private static instance: RingtoneService;
  private sound: Sound | null = null;
  private isPlaying = false;
  private vibrationInterval: ReturnType<typeof setInterval> | null = null;
  private isSetup = false;

  private constructor() {}

  static getInstance(): RingtoneService {
    if (!RingtoneService.instance) {
      RingtoneService.instance = new RingtoneService();
    }
    return RingtoneService.instance;
  }

  /**
   * Setup Sound
   */
  async setup(): Promise<void> {
    if (this.isSetup) return;

    try {
      // Enable playback in silent mode
      Sound.setCategory('Playback', true);
      this.isSetup = true;
      console.log('🔊 Ringtone service setup complete');
    } catch (error) {
      console.error('Failed to setup Sound:', error);
    }
  }

  /**
   * Load and play ride request ringtone in loop
   */
  async playRideRequestRingtone(): Promise<void> {
    if (this.isPlaying) {
      console.log('Ringtone already playing');
      return;
    }

    try {
      await this.setup();

      // Load sound file
      this.sound = new Sound(
        'driverRequestAudio1.mp3',
        Sound.MAIN_BUNDLE,
        error => {
          if (error) {
            console.error('❌ Failed to load sound:', error);
            this.isPlaying = false;
            return;
          }

          // Sound loaded successfully
          console.log('✅ Sound loaded successfully');

          // Set to loop infinitely (-1 means infinite loop)
          this.sound?.setNumberOfLoops(-1);

          // Set volume
          this.sound?.setVolume(CONFIG.RINGTONE_VOLUME);

          // Play the sound
          this.sound?.play(success => {
            if (success) {
              console.log('🔊 Ringtone playing');
              this.isPlaying = true;
            } else {
              console.log('❌ Sound playback failed');
              this.isPlaying = false;
            }
          });

          // Start vibration
          this.startVibration();

          // Haptic feedback
          ReactNativeHapticFeedback.trigger(
            'notificationWarning',
            hapticOptions,
          );
        },
      );
    } catch (error) {
      console.error('❌ Failed to play ringtone:', error);
      this.isPlaying = false;
    }
  }

  /**
   * Stop ringtone and vibration
   */
  async stopRingtone(): Promise<void> {
    try {
      if (this.sound) {
        this.sound.stop();
        this.sound.release();
        this.sound = null;
      }

      this.isPlaying = false;
      console.log('🔊 Ringtone stopped');

      // Stop vibration
      this.stopVibration();
    } catch (error) {
      console.error('Failed to stop ringtone:', error);
      this.isPlaying = false;
      this.stopVibration();
    }
  }

  /**
   * Start repeating vibration pattern
   */
  private startVibration(): void {
    this.stopVibration();

    const pattern = CONFIG.VIBRATION_PATTERN;
    this.vibrationInterval = setInterval(() => {
      if (this.isPlaying) {
        Vibration.vibrate(pattern, false);
      }
    }, CONFIG.VIBRATION_INTERVAL);

    // Initial vibration
    Vibration.vibrate(pattern, false);
  }

  /**
   * Stop vibration
   */
  private stopVibration(): void {
    if (this.vibrationInterval) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }
    Vibration.cancel();
  }

  /**
   * Check if ringtone is playing
   */
  isRingtonePlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.stopRingtone();
    this.isSetup = false;
  }
}

export const ringtoneService = RingtoneService.getInstance();
