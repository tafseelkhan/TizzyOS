// File: UploadProgressModal.tsx - 100% FULL SCREEN
// Yeh component pura screen cover karega

import React, { useRef, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import LottieView from 'lottie-react-native';

const { width, height } = Dimensions.get('window');

// ==================== TYPES ====================
interface UploadProgressModalProps {
  visible: boolean;
  progress: {
    total: number;
    uploaded: number;
    percent: number;
  };
  isTakingLong: boolean;
}

// ==================== MAIN COMPONENT ====================
const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  visible,
  progress,
  isTakingLong,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [lineColor, setLineColor] = useState('#3b82f6');
  const [lottieError, setLottieError] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.timing(progressAnim, {
        toValue: progress.percent,
        duration: 300,
        useNativeDriver: false,
      }).start();

      if (progress.percent < 33) {
        setLineColor('#ef4444');
      } else if (progress.percent < 66) {
        setLineColor('#3b82f6');
      } else {
        setLineColor('#10b981');
      }
    }
  }, [progress.percent, visible]);

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Lottie source
  const getLottieSource = () => {
    try {
      const paths = [
        require('../../../../animations/lotties/Uploading to cloud.json'),
      ];
      return paths[0];
    } catch (e) {
      setLottieError(true);
      return null;
    }
  };

  const lottieSource = getLottieSource();

  // Lottie component with error handling
  const renderLottie = () => {
    try {
      if (lottieError || !lottieSource) {
        return renderFallback();
      }
      return (
        <LottieView
          source={lottieSource}
          autoPlay
          loop
          style={styles.uploadLottie}
        />
      );
    } catch (e) {
      return renderFallback();
    }
  };

  // Fallback UI agar Lottie load na ho
  const renderFallback = () => {
    return (
      <View style={styles.fallbackContainer}>
        <View style={styles.fallbackIconContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <View style={styles.fallbackDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </View>
        <Text style={styles.fallbackText}>Uploading...</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.fullScreenContainer}>
        <View style={styles.contentContainer}>
          {renderLottie()}

          <Text style={styles.title}>Uploading Files</Text>
          <Text style={styles.subtitle}>
            {progress.uploaded} of {progress.total} files uploaded
          </Text>

          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: animatedWidth,
                  backgroundColor: lineColor,
                },
              ]}
            />
          </View>

          <Text style={[styles.percentText, { color: lineColor }]}>
            {progress.percent}%
          </Text>

          {isTakingLong && (
            <Text style={styles.takingLongText}>
              Taking longer than expected... Please wait
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  uploadLottie: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentText: {
    fontSize: 34,
    fontWeight: '800',
    marginTop: 4,
  },
  takingLongText: {
    fontSize: 14,
    color: '#f59e0b',
    marginTop: 16,
    textAlign: 'center',
  },
  // Fallback styles
  fallbackContainer: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  fallbackIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fallbackDots: {
    flexDirection: 'row',
    marginTop: 50,
    position: 'absolute',
    bottom: -20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginHorizontal: 4,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  fallbackText: {
    fontSize: 14,
    color: '#3b82f6',
    marginTop: 30,
    fontWeight: '500',
  },
});

export default UploadProgressModal;
