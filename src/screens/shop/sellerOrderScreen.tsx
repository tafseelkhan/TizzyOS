import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import SellerOrdersScreen from '../../core/components/shop/Orders/Oders';

// Define your RootStackParamList - Add all screens from your app
type RootStackParamList = {
  SellerOrders: undefined;
  OrderDetails: { orderId: string; orderData?: any };
  ManualShippingSelect: { orderId: string; orderData: any };
  // Add any other screens from your navigation stack
};

export default function OrdersScreen() {
  // Use the correct type for navigation
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, 'SellerOrders'>>();

  // Pass navigation as props with proper typing
  return <SellerOrdersScreen navigation={navigation} />;
}
