// components/onboarding/Step3.tsx
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
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

export interface OnboardingStepProps {
  onNext?: () => void;
  onSkip?: () => void;
  isLastStep?: boolean;
}

const { width, height } = Dimensions.get('window');

const Step3: React.FC<OnboardingStepProps> = ({ onNext, onSkip }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

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
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={false}
      />

      <View style={styles.container}>
        {/* Image Section */}
        <Animated.View
          style={[
            styles.imageContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Image
            source={require('../../../../assets/svg/Mail sent-bro.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Content Section - Linear Gradient */}
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
            {/* Success Badge */}
            <View style={styles.badgeContainer}>
              <LinearGradient
                colors={['#00C853', '#00E676']}
                style={styles.badgeIcon}
              >
                <Icon name="check-circle" size={32} color="#FFF" />
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={styles.title}>
              Start <Text style={styles.highlight}>Earning Today</Text>
            </Text>

            {/* Subtitle */}
            <Text style={styles.subtitle}>FWS Partner - Ready to Ride</Text>

            {/* Description */}
            <Text style={styles.description}>
              Complete KYC verification and get verified to start receiving
              delivery requests instantly
            </Text>

            {/* Benefits Section */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitItem}>
                <LinearGradient
                  colors={['#008CFF', '#00A3FF']}
                  style={styles.benefitIcon}
                >
                  <Icon name="verified" size={16} color="#FFF" />
                </LinearGradient>
                <Text style={styles.benefitText}>Quick KYC</Text>
              </View>
              <View style={styles.benefitItem}>
                <LinearGradient
                  colors={['#008CFF', '#00A3FF']}
                  style={styles.benefitIcon}
                >
                  <Icon name="bolt" size={16} color="#FFF" />
                </LinearGradient>
                <Text style={styles.benefitText}>Instant Activation</Text>
              </View>
              <View style={styles.benefitItem}>
                <LinearGradient
                  colors={['#008CFF', '#00A3FF']}
                  style={styles.benefitIcon}
                >
                  <Icon name="attach-money" size={16} color="#FFF" />
                </LinearGradient>
                <Text style={styles.benefitText}>Daily Earnings</Text>
              </View>
            </View>

            {/* Spacer to push dots and button down */}
            <View style={styles.spacer} />

            {/* Dots Indicator */}
            <View style={styles.dotsContainer}>
              <View style={[styles.dot, styles.inactiveDot]} />
              <View style={[styles.dot, styles.inactiveDot]} />
              <View style={[styles.dot, styles.activeDot]} />
            </View>

            {/* Get Started Button */}
            <TouchableOpacity
              style={styles.button}
              activeOpacity={0.85}
              onPress={onNext}
            >
              <Text style={styles.buttonText}>Get Started</Text>
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
  imageContainer: {
    flex: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  image: {
    width: '80%',
    height: '80%',
    top: -50,
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
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
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
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  benefitItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
  },
  benefitIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 10,
    fontFamily: 'Poppins-Light',
    color: '#1E293B',
    fontWeight: '500',
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

export default Step3;
