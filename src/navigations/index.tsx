import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import TizzyGo from '../screens/animations/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import HomeScreen from '../screens/home/home';
import ProfileScreen from '../screens/profile/Profile';
import EditProfileScreen from '../screens/profile/ProfileEdit';
import SettingsScreen from '../screens/settings/Settings';
import ShipperScreen from '../screens/shipping/MenuScreen';
import ApplyShippingScreen from '../screens/shipping/ApplyShipping';
import RegistrationSuccess from '../screens/shipping/RegistrationSuccess';
// import AddShipmentScreen from '../screens/shipping/AddShipmentScreen';
// import MyShipmentsScreen from '../screens/shipping/MyShipmentsScreen';
// import TrackingScreen from '../screens/shipping/TrackingScreen';
import ShippingOrdersScreen from '../screens/shipping/ShippingOrdersScreen';
// import ShippingReviewsScreen from '../screens/shipping/ShippingReviewsScreen';
import ShopScreen from '../screens/shop/MenuScreen';
import ApplySellerScreen from '../screens/shop/ApplySellerScreen';
import SellerStatus from '../screens/shop/StatusScreen';
import ProductListingScreen from '../screens/shop/ProductListing';
import SellerProductsScreen from '../screens/shop/SellerProductsScreen';
// import ProtectionPlansScreen from "../screens/shop/ProtectionPlansScreen";
import SellerOrdersScreen from '../screens/shop/SellerOrdersScreen';
import SellerPayoutPortalScreen from '../screens/shop/SellerPayoutPortalScreen';
import SetupWallet from '../screens/shop/SetupWallet';
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
