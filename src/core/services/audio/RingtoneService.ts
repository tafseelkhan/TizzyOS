// src/services/audio/RingtoneService.ts

import Sound from 'react-native-sound';
import { Vibration, Platform, AppState } from 'react-native';

class RingtoneService {
  private static instance: RingtoneService;
  private sound: Sound | null = null;
  private isPlaying = false;
  private vibrationInterval: ReturnType<typeof setInterval> | null = null;
  private isSetup = false;
  private soundTimeout: ReturnType<typeof setTimeout> | null = null;
  private appStateListener: any = null;
  private playCount = 0;
  // ✅ FIX: Simple boolean variable, no useRef needed
  private isPlayingSync = false;

  private constructor() {
    this.appStateListener = AppState.addEventListener(
      'change',
      this.handleAppStateChange,
    );
  }

  private handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      console.log('🔊 App in background, stopping sound...');
      this.stopRingtone();
    }
  };

  static getInstance(): RingtoneService {
    if (!RingtoneService.instance) {
      RingtoneService.instance = new RingtoneService();
    }
    return RingtoneService.instance;
  }

  async setup(): Promise<void> {
    if (this.isSetup) return;
    try {
      Sound.setCategory('Playback', true);
      this.isSetup = true;
      console.log('✅ Ringtone service setup complete');
    } catch (error) {
      console.error('❌ Failed to setup Sound:', error);
    }
  }

  // ✅ FIX: IDEMPOTENT - Only plays if not already playing
  async playRideRequestRingtone(): Promise<void> {
    console.log(
      `🔊 [RingtoneService] playRideRequestRingtone() called (play #${++this.playCount})`,
    );

    // ✅ FIX: Use simple boolean for atomic check
    if (this.isPlayingSync || this.isPlaying) {
      console.log('🔊 Ringtone already playing, skipping restart');
      return;
    }

    // ✅ Stop any previous sound first
    await this.stopRingtone();

    try {
      await this.setup();

      // ✅ METHOD 1: Load from raw resource (Android)
      if (Platform.OS === 'android') {
        try {
          console.log('🔊 Trying to load from raw resource: ride_request');
          this.sound = new Sound('ride_request', Sound.MAIN_BUNDLE, error => {
            if (error) {
              console.error('❌ Raw resource load failed:', error);
              this.tryLoadFromAssets();
              return;
            }
            this.playLoadedSound();
          });
          return;
        } catch (error) {
          console.error('❌ Raw resource error:', error);
          this.tryLoadFromAssets();
          return;
        }
      }

      this.tryLoadFromAssets();
    } catch (error) {
      console.error('❌ Failed to play ringtone:', error);
      this.isPlaying = false;
      this.isPlayingSync = false;
      this.fallbackVibrationOnly();
    }
  }

  private tryLoadFromAssets(): void {
    try {
      console.log('🔊 Trying to load from assets...');
      this.sound = new Sound(
        require('../../../assets/sounds/ride_request.mp3'),
        error => {
          if (error) {
            console.error('❌ Assets load failed:', error);
            this.tryLoadFromNetwork();
            return;
          }
          this.playLoadedSound();
        },
      );
    } catch (error) {
      console.error('❌ Assets error:', error);
      this.tryLoadFromNetwork();
    }
  }

  private tryLoadFromNetwork(): void {
    try {
      console.log('🔊 Trying to load from network URL...');
      const url =
        'https://storage.googleapis.com/tizzygo-os.firebasestorage.app/sounds/ride_request.mp3';
      this.sound = new Sound(url, undefined, error => {
        if (error) {
          console.error('❌ Network load failed:', error);
          this.fallbackVibrationOnly();
          return;
        }
        this.playLoadedSound();
      });
    } catch (error) {
      console.error('❌ Network error:', error);
      this.fallbackVibrationOnly();
    }
  }

  private playLoadedSound(): void {
    if (!this.sound) {
      this.fallbackVibrationOnly();
      return;
    }

    console.log('✅ Sound loaded successfully');
    this.sound.setNumberOfLoops(2);
    this.sound.setVolume(1.0);

    if (this.soundTimeout) {
      clearTimeout(this.soundTimeout);
    }
    this.soundTimeout = setTimeout(() => {
      console.log('⏰ Auto-stopping sound after 10 seconds...');
      this.stopRingtone();
    }, 10000);

    this.sound.play(success => {
      if (success) {
        console.log('🔊 Ringtone playing');
        this.isPlaying = true;
        this.isPlayingSync = true;
        this.startVibration();
      } else {
        console.log('❌ Sound playback failed');
        this.isPlaying = false;
        this.isPlayingSync = false;
        this.fallbackVibrationOnly();
      }
    });
  }

  private fallbackVibrationOnly(): void {
    console.log('📳 Using vibration only fallback');
    this.isPlaying = true;
    this.isPlayingSync = true;
    this.startVibration();

    if (this.soundTimeout) {
      clearTimeout(this.soundTimeout);
    }
    this.soundTimeout = setTimeout(() => {
      console.log('⏰ Auto-stopping vibration after 10 seconds...');
      this.stopRingtone();
    }, 10000);
  }

  async stopRingtone(): Promise<void> {
    console.log('🔊 [RingtoneService] stopRingtone() called');
    this.isPlaying = false;
    this.isPlayingSync = false;

    if (this.soundTimeout) {
      clearTimeout(this.soundTimeout);
      this.soundTimeout = null;
    }

    try {
      if (this.sound) {
        this.sound.stop(() => {
          this.sound?.release();
          this.sound = null;
          console.log('🔊 Sound stopped and released');
        });
      }
      this.stopVibration();
      console.log('✅ Ringtone stopped successfully');
    } catch (error) {
      console.error('❌ Failed to stop ringtone:', error);
      this.stopVibration();
      if (this.sound) {
        try {
          this.sound.release();
          this.sound = null;
        } catch (e) {}
      }
    }
  }

  private startVibration(): void {
    console.log('📳 startVibration() called');
    this.stopVibration();

    const vibrateLoop = () => {
      if (this.isPlaying) {
        try {
          Vibration.vibrate([500, 300, 500, 300, 500], false);
        } catch (error) {
          console.error('❌ Vibration error:', error);
        }
      }
    };

    this.vibrationInterval = setInterval(vibrateLoop, 3000);
    vibrateLoop();
  }

  private stopVibration(): void {
    if (this.vibrationInterval) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }
    try {
      Vibration.cancel();
    } catch (error) {}
  }

  isRingtonePlaying(): boolean {
    return this.isPlaying || this.isPlayingSync;
  }

  async cleanup(): Promise<void> {
    console.log('🧹 cleanup() called');
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
    await this.stopRingtone();
    this.isSetup = false;
    console.log('✅ Cleanup complete');
  }
}

export const ringtoneService = RingtoneService.getInstance();

export const trackPlayerBackgroundHandler = async () => {
  console.log('🎵 TrackPlayer background handler ready');
};