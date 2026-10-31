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
  SellerEarnings: undefined;
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

  // CabDriver Screens
  CabDriver: undefined;
  DriverRegistration: undefined;
  DriverStatus: undefined;
  DriverAvailability: undefined;
  // ✅ FIX: ActiveTrip now expects trackingId as primary param
  RideTracking: { trackingId: string; bookingId?: string; quoteId: string };
  // ✅ FIX: RideQRScanner now accepts scanType + booking references
  RideQRScanner: {
    scanType: 'pickup' | 'drop';
    bookingId?: string;
    trackingId?: string;
    quoteId?: string;
  };
};
