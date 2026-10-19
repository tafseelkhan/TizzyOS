import React from 'react';
import { useNavigation } from '@react-navigation/native';
import SellerEarnings from '../../core/components/shop/PayoutPortal/sellerEarnings';

export default function Wallet() {
  const navigation = useNavigation();
  return <SellerEarnings />;
}
