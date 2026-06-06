import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import TizzyGo from '../screens/animations/splashScreen';
import LoginScreen from '../screens/auth/loginScreen';
import SignupScreen from '../screens/auth/signupScreen';
import HomeScreen from '../screens/home/homeScreen';
import ProfileScreen from '../screens/profile/profileScreen';
import EditProfileScreen from '../screens/profile/profileEditScreen';
import SettingsScreen from '../screens/settings/settingScreen';
import ShipperScreen from '../screens/shipping/menuScreen';
import ApplyShippingScreen from '../screens/shipping/applyShippingScreen';
import RegistrationSuccess from '../screens/shipping/registrationSuccessScreen';
// import AddShipmentScreen from '../screens/shipping/AddShipmentScreen';
// import MyShipmentsScreen from '../screens/shipping/MyShipmentsScreen';
// import TrackingScreen from '../screens/shipping/TrackingScreen';
import ShippingOrdersScreen from '../screens/shipping/shippingOrderScreen';
// import ShippingReviewsScreen from '../screens/shipping/ShippingReviewsScreen';
import ShopScreen from '../screens/shop/menuScreen';
import ApplySellerScreen from '../screens/shop/appleSellerScreen';
import SellerStatus from '../screens/shop/statusApplicationScreen';
import ProductListingScreen from '../screens/shop/productListingScreen';
import SellerProductsScreen from '../screens/shop/sellerProductsScreen';
// import ProtectionPlansScreen from "../screens/shop/ProtectionPlansScreen";
import SellerOrdersScreen from '../screens/shop/sellerOrderScreen';
import SellerPayoutPortalScreen from '../screens/shop/sellerPayoutPortalScreen';
import SetupWallet from '../screens/shop/setupWalletScreen';
// import SellerReviewsScreen from "../screens/shop/SellerReviewsScreen";

// ✅ Complete RootStackParamList with all screens
export type RootStackParamList = {
  // Auth & Splash
  Splash: undefined;
  Login: undefined;
  Signup: undefined;

  // Main Screens
  Home: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;

  // Shop Screens
  ShopDetails: undefined;
  ApplySeller: undefined;
  SellerStatus: undefined;
  ProductListing: undefined;
  MyProducts: undefined;
  PayoutPortal: undefined;
  SetupWallet: undefined;
  SellerOrders: undefined;

  // Shipping Screens (commented for now)
  ApplyShipping: undefined;
  Shipper: undefined;
  RegistrationSuccess: undefined;
  // MyShipments: undefined;
  ShippingOrders: undefined;
  // ShippingReviews: undefined;
  // ProtectionPlans: undefined;
  // SellerReviews: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Splash" component={TizzyGo} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />

        {/* Shop Screens */}
        <Stack.Screen name="ShopDetails" component={ShopScreen} />
        <Stack.Screen name="ApplySeller" component={ApplySellerScreen} />
        <Stack.Screen name="SellerStatus" component={SellerStatus} />
        <Stack.Screen name="ProductListing" component={ProductListingScreen} />
        <Stack.Screen name="MyProducts" component={SellerProductsScreen} />
        <Stack.Screen
          name="PayoutPortal"
          component={SellerPayoutPortalScreen}
        />
        <Stack.Screen name="SetupWallet" component={SetupWallet} />
        <Stack.Screen name="SellerOrders" component={SellerOrdersScreen} />

        {/* Commented Shipping Screens - Add when needed */}
        <Stack.Screen name="Shipper" component={ShipperScreen} />
        <Stack.Screen name="ApplyShipping" component={ApplyShippingScreen} />
        <Stack.Screen name="RegistrationSuccess" component={RegistrationSuccess} />
        {/* <Stack.Screen name="MyShipments" component={MyShipmentsScreen} />  */}
        <Stack.Screen name="ShippingOrders" component={ShippingOrdersScreen} />
        {/* <Stack.Screen name="ShippingReviews" component={ShippingReviewsScreen} /> */}
        {/* <Stack.Screen name="ProtectionPlans" component={ProtectionPlansScreen} /> */}
        {/* <Stack.Screen name="SellerReviews" component={SellerReviewsScreen} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
