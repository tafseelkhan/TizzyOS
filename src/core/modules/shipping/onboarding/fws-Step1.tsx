// components/onboarding/Step1.tsx
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';

export interface OnboardingStepProps {
  onNext?: () => void;
  isLastStep?: boolean;
}

const { width, height } = Dimensions.get('window');

const Step1: React.FC<OnboardingStepProps> = ({ onNext }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      lottieRef.current?.play();
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={false}
      />

      <View style={styles.container}>
        {/* Lottie Animation Section */}
        <Animated.View
          style={[
            styles.animationContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <LottieView
            ref={lottieRef}
            source={require('../../../components/animations/lotties/Delivery tracking.json')}
            style={styles.lottie}
            loop={true}
            autoPlay={false}
          />
        </Animated.View>

        {/* Content Section */}
        <Animated.View
          style={[
            styles.contentWrapper,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#ffffff', '#ffffff', '#ffffff']}
            style={styles.contentContainer}
          >
            {/* Title */}
            <Text style={styles.title}>
              Become an <Text style={styles.highlight}>FWS Partner</Text>
            </Text>

            {/* Description */}
            <Text style={styles.description}>
              Join our Fast Way Shipping network and start earning by delivering
              orders in your city. Enjoy a flexible schedule, great pay, and
              weekly payouts.
            </Text>

            {/* Spacer */}
            <View style={styles.spacer} />

            {/* Dots Indicator */}
            <View style={styles.dotsContainer}>
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.inactiveDot]} />
              <View style={[styles.dot, styles.inactiveDot]} />
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.button}
              activeOpacity={0.85}
              onPress={onNext}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  animationContainer: {
    flex: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  lottie: {
    width: width * 0.95,
    height: width * 0.95,
  },
  contentWrapper: {
    flex: 0.5,
    justifyContent: 'flex-end',
  },
  contentContainer: {
    width: width,
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 16,
  },
  highlight: {
    color: '#008CFF',
    fontSize: 28,
    fontFamily: 'Poppins-Light',
  },
  description: {
    fontSize: 15,
    fontFamily: 'Poppins-Light',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#008CFF',
  },
  inactiveDot: {
    backgroundColor: '#CBD5E1',
  },
  button: {
    backgroundColor: '#008CFF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#008CFF',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Poppins-Light',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default Step1;
