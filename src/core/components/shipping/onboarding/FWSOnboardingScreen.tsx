// components/onboarding/FWSOnboardingScreen.tsx
import React, { useState, useRef } from 'react';
import { View, FlatList, StatusBar, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Step1 from '../../../modules/shipping/onboarding/fws-Step1';
import Step2 from '../../../modules/shipping/onboarding/fws-Step2';
import Step3 from '../../../modules/shipping/onboarding/fws-Step3';

interface Props {
  onComplete: () => void;
}

const FWSOnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const steps = [
    { id: '1', component: Step1 },
    { id: '2', component: Step2 },
    { id: '3', component: Step3 },
  ];

  const handleNext = () => {
    if (currentIndex < steps.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    } else {
      // Last step - complete onboarding
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      onComplete();
    } catch (error) {
      console.log('Error saving onboarding status:', error);
      onComplete();
    }
  };

  const renderItem = ({ item }: { item: (typeof steps)[0] }) => {
    const StepComponent = item.component;
    const isLastStep = currentIndex === steps.length - 1;

    return (
      <StepComponent
        onNext={handleNext}
        onSkip={handleSkip}
        isLastStep={isLastStep}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <FlatList
        ref={flatListRef}
        data={steps}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        scrollEnabled={false} // 🔥 Disable manual swiping
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default FWSOnboardingScreen;
