// components/onboarding/Step2.tsx
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
import Icon from 'react-native-vector-icons/MaterialIcons';

export interface OnboardingStepProps {
  onNext?: () => void;
  onSkip?: () => void;
  isLastStep?: boolean;
}

const { width, height } = Dimensions.get('window');

const Step2: React.FC<OnboardingStepProps> = ({ onNext, onSkip }) => {
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
            source={require('../../../components/animations/lotties/Saving Order.json')}
            style={styles.lottie}
            loop={true}
            autoPlay={false}
          />
        </Animated.View>

        {/* Content Section - Linear Gradient */}
        <Animated.View
          style={[
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
              Choose Your <Text style={styles.highlight}>Vehicle</Text>
            </Text>

            {/* Subtitle */}
            <Text style={styles.subtitle}>Ride & Deliver with FWS</Text>

            {/* Description */}
            <Text style={styles.description}>
              Register as a RIDER (Bike/Car) for quick deliveries or TRUCK
              (Tempo/Large Vehicle) for bulk orders
            </Text>

            {/* Vehicle Options */}
            <View style={styles.optionsContainer}>
              <View style={styles.optionCard}>
                <LinearGradient
                  colors={['#008CFF', '#00A3FF']}
                  style={styles.optionIcon}
                >
                  <Icon name="two-wheeler" size={28} color="#FFF" />
                </LinearGradient>
                <Text style={styles.optionTitle}>Rider</Text>
                <Text style={styles.optionDesc}>Bike / Car</Text>
                <View style={styles.optionBadge}>
                  <Text style={styles.optionBadgeText}>Quick Deliveries</Text>
                </View>
              </View>

              <View style={styles.optionCard}>
                <LinearGradient
                  colors={['#008CFF', '#00A3FF']}
                  style={styles.optionIcon}
                >
                  <Icon name="local-shipping" size={28} color="#FFF" />
                </LinearGradient>
                <Text style={styles.optionTitle}>Truck</Text>
                <Text style={styles.optionDesc}>Tempo / Large Vehicle</Text>
                <View style={styles.optionBadge}>
                  <Text style={styles.optionBadgeText}>Bulk Orders</Text>
                </View>
              </View>
            </View>

            {/* Dots Indicator */}
            <View style={styles.dotsContainer}>
              <View style={[styles.dot, styles.inactiveDot]} />
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.inactiveDot]} />
            </View>

            {/* Next Button */}
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
    flex: 0.55,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  lottie: {
    width: width * 0.85,
    height: width * 0.85,
  },
  contentContainer: {
    width: width,
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 30,
    marginBottom: -120,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 8,
  },
  highlight: {
    color: '#008CFF',
    fontSize: 28,
    fontFamily: 'Poppins-Light',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Light',
    color: '#008CFF',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Poppins-Light',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
    marginBottom: 24,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 28,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 11,
    fontFamily: 'Poppins-Light',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
  },
  optionBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionBadgeText: {
    fontSize: 10,
    fontFamily: 'Poppins-Light',
    color: '#008CFF',
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

export default Step2;
