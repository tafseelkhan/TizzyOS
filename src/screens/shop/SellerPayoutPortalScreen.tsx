import React from 'react';
import { useNavigation } from '@react-navigation/native';
import PayoutPortal from '../../core/components/shop/Payout/Portal/Wallet';

export default function Wallet() {
  const navigation = useNavigation();
  return <PayoutPortal navigation={navigation as any} />;
}
