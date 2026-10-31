import React from 'react';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../../navigations/RootStackParamList';
import RideQRScanner from '../../../../core/components/cab/rideRequest/tracking/QR/RideQRScanner';

type RideQRScannerScreenProps = StackScreenProps<
  RootStackParamList,
  'RideQRScanner'
>;

export default function RideQRScannerScreen({
  navigation,
  route,
}: RideQRScannerScreenProps) {
  console.log('[RideQRScannerScreen] 🚀 route:', route);
  console.log('[RideQRScannerScreen] 📦 params:', route?.params);
  console.log('[RideQRScannerScreen] 🧭 nav exists:', !!navigation);

  return <RideQRScanner navigation={navigation} route={route} />;
}
