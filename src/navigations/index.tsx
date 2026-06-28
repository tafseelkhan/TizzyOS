import React, { useEffect, useRef } from 'react';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { AdsSDK } from '../api/ads';
import { handleNavigationStateChange } from './navigation';
import { createStackNavigator } from '@react-navigation/stack';
import TizzyGo from '../screens/animations/splashScreen';
import LoginScreen from '../screens/auth/loginScreen';
import SignupScreen from '../screens/auth/signupScreen';
import HomeScreen from '../screens/home/homeScreen';
import ProfileScreen from '../screens/profile/profileScreen';
import EditProfileScreen from '../screens/profile/profileEditScreen';
import SettingsScreen from '../screens/settings/settingScreen';

// Seller Imports*
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

// Shippings Imports*
import ShipperScreen from '../screens/shipping/menuScreen';
import ApplyShippingScreen from '../screens/shipping/applyShippingScreen';
import RegistrationSuccess from '../screens/shipping/registrationSuccessScreen';
// import AddShipmentScreen from '../screens/shipping/AddShipmentScreen';
// import MyShipmentsScreen from '../screens/shipping/MyShipmentsScreen';
// import TrackingScreen from '../screens/shipping/TrackingScreen';
import ShippingOrdersScreen from '../screens/shipping/shippingOrderScreen';
// import ShippingReviewsScreen from '../screens/shipping/ShippingReviewsScreen';

// FWS Imports*
import ApplyFWSScreen from '../screens/fws/applyFwsScreen';
// import MyFWSScreen from '../screens/fws/myFWSSrceen';
// import FWSOrderScreen from '../screens/fws/fwsOrderScreen';
// import fwsReviewScreen from '../screens/fws/fwsReviewScreen';

// Employee Imports*
import CreateEmployee from '../screens/fws/appleEmployeeScreen';
import EmployeeList from '../screens/fws/employeeList';
import EmployeeDetail from '../screens/fws/employeeDetail';
import HandoverScanner from '../screens/fws/handoverScanner/scanner';
import VerifyForDispatch from '../screens/fws/verifyForDispatch/verifyForDispatch';
import FWSMenuScreen from '../screens/fws/menu/fwsMenu';
import FWSScannedOrders from '../screens/fws/scannedOrders/scannedOrders';
// import EmployeeAttendance from '../screens/employee/EmployeeAttendance';
// import EmployeeLeave from '../screens/employee/EmployeeLeave';
// import EmployeePayroll from '../screens/employee/EmployeePayroll';
// import EmployeeManagement from '../screens/employee/EmployeeManagement';

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

  // Fws Screens
  ApplyFWS: undefined;
  MyFWS: undefined;
  FWSOrders: undefined;
  FWSReviews: undefined;

  // Employee Screens
  FWS: undefined;
  CreateEmployee: undefined;
  FWSScannedOrders: undefined;
  EmployeeList: undefined;
  EmployeeDetail: { name: string; role?: string | null };
  HandoverScanner: undefined;
  VerifyForDispatch: undefined;
  EmployeeAttendance: undefined;
  EmployeeLeave: undefined;
  EmployeePayroll: undefined;
  EmployeeManagement: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator(): React.ReactElement {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Register navigation ref for Ads SDK
  useEffect(() => {
    if (navigationRef.current) {
      AdsSDK.registerNavigationContainer(navigationRef.current);
    }
  }, [navigationRef.current]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={state => {
        // Handle navigation state changes for ad tracking
        handleNavigationStateChange(state);
      }}
      onReady={() => {
        // Register navigation ref when ready
        if (navigationRef.current) {
          AdsSDK.registerNavigationContainer(navigationRef.current);
        }
      }}
    >
      {' '}
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
        <Stack.Screen
          name="RegistrationSuccess"
          component={RegistrationSuccess}
        />
        {/* <Stack.Screen name="MyShipments" component={MyShipmentsScreen} />  */}
        <Stack.Screen name="ShippingOrders" component={ShippingOrdersScreen} />
        {/* <Stack.Screen name="ProtectionPlans" component={ProtectionPlansScreen} /> */}
        {/* <Stack.Screen name="SellerReviews" component={SellerReviewsScreen} /> */}

        {/* FWS Screens - Add when needed */}
        <Stack.Screen name="ApplyFWS" component={ApplyFWSScreen} />
        {/* <Stack.Screen name="MyFWS" component={MyFWSScreen} /> */}
        {/* <Stack.Screen name="FWSOrders" component={FWSOrderScreen} /> */}
        {/* <Stack.Screen name="FWSReviews" component={fwsReviewScreen} /> */}

        {/* Employee Screen - Add when needed */}
        <Stack.Screen name="CreateEmployee" component={CreateEmployee} />
        <Stack.Screen name="EmployeeList" component={EmployeeList} />
        <Stack.Screen name="EmployeeDetail" component={EmployeeDetail} />
        <Stack.Screen name="HandoverScanner" component={HandoverScanner} />
        <Stack.Screen name="VerifyForDispatch" component={VerifyForDispatch} />
        <Stack.Screen name="FWS" component={FWSMenuScreen} />
        <Stack.Screen name="FWSScannedOrders" component={FWSScannedOrders} />
        {/* <Stack.Screen name="EmployeeAttendance" component={EmployeeAttendance} />
        <Stack.Screen name="EmployeeLeave" component={EmployeeLeave} />
        <Stack.Screen name="EmployeePayroll" component={EmployeePayroll} />
        <Stack.Screen name="EmployeeManagement" component={EmployeeManagement} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
