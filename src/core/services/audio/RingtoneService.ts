// src/services/audio/RingtoneService.ts

import TrackPlayer, {
  Capability,
  AppKilledPlaybackBehavior,
  RepeatMode,
  State,
} from 'react-native-track-player';
import { Vibration, Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { CONFIG } from '../../../api/constants/rideRequestConfig';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

class RingtoneService {
  private static instance: RingtoneService;
  private isPlaying = false;
  // In React Native timers return numbers, avoid NodeJS namespace issues
  private vibrationInterval: number | null = null;
  private isSetup = false;

  private constructor() {}

  static getInstance(): RingtoneService {
    if (!RingtoneService.instance) {
      RingtoneService.instance = new RingtoneService();
    }
    return RingtoneService.instance;
  }

  /**
   * Setup TrackPlayer
   */
  async setup(): Promise<void> {
    if (this.isSetup) return;

    try {
      await TrackPlayer.setupPlayer({
        waitForBuffer: true,
        autoHandleInterruptions: true,
      });

      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
        ],
      });

      this.isSetup = true;
      console.log('🔊 Ringtone service setup complete');
    } catch (error) {
      console.error('Failed to setup TrackPlayer:', error);
      // Fallback - try to recover
      if (error instanceof Error && error.message.includes('already setup')) {
        this.isSetup = true;
      }
    }
  }

  /**
   * Add ride request sound to queue
   */
  private async addRideRequestSound(): Promise<void> {
    try {
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: 'ride_request',
        url: require('../../../assets/sounds/driverRequestAudio1.mp3'),
        title: 'New Ride Request',
        artist: 'TizzyGo',
      });
    } catch (error) {
      console.error('Failed to add ride request sound:', error);
      throw error;
    }
  }

  /**
   * Play ride request ringtone in loop
   */
  async playRideRequestRingtone(): Promise<void> {
    if (this.isPlaying) {
      console.log('Ringtone already playing');
      return;
    }

    try {
      await this.setup();
      await this.addRideRequestSound();
      await TrackPlayer.setRepeatMode(RepeatMode.Queue);
      await TrackPlayer.setVolume(CONFIG.RINGTONE_VOLUME);
      await TrackPlayer.play();

      this.isPlaying = true;
      console.log('🔊 Ringtone started');

      // Start vibration
      this.startVibration();

      // Haptic feedback
      ReactNativeHapticFeedback.trigger('notificationWarning', hapticOptions);
    } catch (error) {
      console.error('Failed to play ringtone:', error);
      // Attempt recovery
      this.isPlaying = false;
    }
  }

  /**
   * Stop ringtone and vibration
   */
  async stopRingtone(): Promise<void> {
    try {
      const state = await TrackPlayer.getState();
      if (state === State.Playing || state === State.Buffering) {
        await TrackPlayer.stop();
      }
      await TrackPlayer.reset();

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

// Background handler for TrackPlayer
export const trackPlayerBackgroundHandler = async (): Promise<void> => {
  TrackPlayer.addEventListener('remote-play' as any, () => {
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener('remote-pause' as any, () => {
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener('remote-stop' as any, () => {
    TrackPlayer.stop();
    TrackPlayer.reset();
  });
};
