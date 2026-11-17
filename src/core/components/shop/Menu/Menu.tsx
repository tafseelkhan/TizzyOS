// src/screens/home/MergedSidebar.tsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Image,
  SafeAreaView,
  Platform,
  UIManager,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import BottomNavigation from '../../home/BottomNavigation';
import LottieView from 'lottie-react-native';

// ✅ me() — user profile + apps + roles
import { me } from '../../../../api/features/public/authPublicSlice';
import { ApiError } from '../../../../core/utils/handler/apiClient';

// ✅ Optional — driver/FWS profile (agar chahiye to)
// import { getDriverProfile, DriverProfile } from '.../driverProfileSlice';
// import { getFWSProfile, FWSProfile } from '.../fwsProfileSlice';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================
// TYPES
// ============================================================

type TizzyOSRole = 'SELLER' | 'FWS' | 'SHIPPING' | 'CAB' | 'RENT';

type RootStackParamList = {
  // Seller
  ApplySeller: undefined;
  ProductListing: { shouldRequestLocation: boolean };
  MyProducts: undefined;
  SellerEarnings: undefined;
  SellerOrders: undefined;
  ProtectionPlans: undefined;
  SellerReviews: undefined;
  // FWS
  ApplyFWS: undefined;
  FWSScannedOrders: undefined;
  HandoverScanner: undefined;
  VerifyForDispatch: undefined;
  CreateEmployee: undefined;
  EmployeeList: undefined;
  // Shipping
  ApplyShipping: undefined;
  AddShipment: undefined;
  MyShipments: undefined;
  Tracking: undefined;
  ShippingOrders: undefined;
  ShippingReviews: undefined;
  // Driver / CAB
  DriverRegistration: undefined;
  MyRides: undefined;
  DriverEarnings: undefined;
  DriverAvailability: undefined;
  // Common
  Home: undefined;
  Login: undefined;
  [key: string]: undefined | object;
};

interface MenuItem {
  segment: string;
  title: string;
  iconName: string;
  iconColor: string;
  role: TizzyOSRole; // which role this item belongs to
}

interface MenuSection {
  segment: string;
  title: string;
  iconName: string;
  iconColor: string;
  role: TizzyOSRole;
  children: MenuItem[];
}

// ============================================================
// HELPERS
// ============================================================

const getImageUrl = (image?: string): string => {
  if (!image) return '';
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  return '';
};

// ============================================================
// ✅ ROLE-SPECIFIC MENU DEFINITIONS
// ============================================================

const SELLER_MENU: MenuSection = {
  segment: 'seller',
  title: 'Seller Dashboard',
  iconName: 'storefront-outline',
  iconColor: '#8B5CF6',
  role: 'SELLER',
  children: [
    {
      segment: 'apply-seller',
      title: 'Apply for Seller ID',
      iconName: 'person-add-outline',
      iconColor: '#8B5CF6',
      role: 'SELLER',
    },
    {
      segment: 'add-product',
      title: 'Add Products',
      iconName: 'add-circle-outline',
      iconColor: '#10B981',
      role: 'SELLER',
    },
    {
      segment: 'products',
      title: 'My Products',
      iconName: 'cube-outline',
      iconColor: '#F59E0B',
      role: 'SELLER',
    },
    {
      segment: 'payout-portal',
      title: 'Payout Portal',
      iconName: 'wallet-outline',
      iconColor: '#10B981',
      role: 'SELLER',
    },
    {
      segment: 'seller-orders',
      title: 'Orders & Sales',
      iconName: 'cart-outline',
      iconColor: '#EF4444',
      role: 'SELLER',
    },
  ],
};

const FWS_MENU: MenuSection = {
  segment: 'fws',
  title: 'FWS Management',
  iconName: 'business-outline',
  iconColor: '#10B981',
  role: 'FWS',
  children: [
    {
      segment: 'apply-fws',
      title: 'Apply for FWS',
      iconName: 'person-add-outline',
      iconColor: '#10B981',
      role: 'FWS',
    },
    {
      segment: 'fws-scanned-orders',
      title: 'Scanned Orders',
      iconName: 'cart-outline',
      iconColor: '#EF4444',
      role: 'FWS',
    },
    {
      segment: 'handover-scanner',
      title: 'Handover Scanner',
      iconName: 'qr-code-outline',
      iconColor: '#6366F1',
      role: 'FWS',
    },
    {
      segment: 'verifyqr-andmarkready-fordispatch',
      title: 'Verify for Dispatch',
      iconName: 'checkmark-done-outline',
      iconColor: '#10B981',
      role: 'FWS',
    },
    {
      segment: 'create-employee',
      title: 'Create Employee',
      iconName: 'person-add-outline',
      iconColor: '#8B5CF6',
      role: 'FWS',
    },
    {
      segment: 'employee-list',
      title: 'All Employees',
      iconName: 'people-outline',
      iconColor: '#8B5CF6',
      role: 'FWS',
    },
  ],
};

const SHIPPING_MENU: MenuSection = {
  segment: 'shipping',
  title: 'Shippings Management',
  iconName: 'grid-outline',
  iconColor: '#4F46E5',
  role: 'SHIPPING',
  children: [
    {
      segment: 'apply-shipping',
      title: 'Apply for Shipping',
      iconName: 'person-add-outline',
      iconColor: '#4F46E5',
      role: 'SHIPPING',
    },
    {
      segment: 'shipments',
      title: 'My Shipments',
      iconName: 'cube-outline',
      iconColor: '#F59E0B',
      role: 'SHIPPING',
    },
    {
      segment: 'shipping-orders',
      title: 'Orders Tracking',
      iconName: 'cart-outline',
      iconColor: '#EF4444',
      role: 'SHIPPING',
    },
  ],
};

const CAB_MENU: MenuSection = {
  segment: 'driver',
  title: 'Driver Management',
  iconName: 'car-sport-outline',
  iconColor: '#4F46E5',
  role: 'CAB',
  children: [
    {
      segment: 'driver-registration',
      title: 'Driver Registration',
      iconName: 'person-add-outline',
      iconColor: '#4F46E5',
      role: 'CAB',
    },
    {
      segment: 'my-rides',
      title: 'My Rides',
      iconName: 'car-outline',
      iconColor: '#10B981',
      role: 'CAB',
    },
    {
      segment: 'earnings',
      title: 'My Earnings',
      iconName: 'wallet-outline',
      iconColor: '#F59E0B',
      role: 'CAB',
    },
    {
      segment: 'driver-availability',
      title: 'Driver Availability',
      iconName: 'radio-button-on-outline',
      iconColor: '#8B5CF6',
      role: 'CAB',
    },
  ],
};

const RENT_MENU: MenuSection = {
  segment: 'rent',
  title: 'Rental Management',
  iconName: 'home-outline',
  iconColor: '#EC4899',
  role: 'RENT',
  children: [
    {
      segment: 'rent-apply',
      title: 'Apply for Rent',
      iconName: 'person-add-outline',
      iconColor: '#EC4899',
      role: 'RENT',
    },
    {
      segment: 'rent-listings',
      title: 'My Listings',
      iconName: 'list-outline',
      iconColor: '#F59E0B',
      role: 'RENT',
    },
    {
      segment: 'rent-bookings',
      title: 'Bookings',
      iconName: 'calendar-outline',
      iconColor: '#EF4444',
      role: 'RENT',
    },
  ],
};

// Map role -> menu definition
const ROLE_MENU_MAP: Record<TizzyOSRole, MenuSection> = {
  SELLER: SELLER_MENU,
  FWS: FWS_MENU,
  SHIPPING: SHIPPING_MENU,
  CAB: CAB_MENU,
  RENT: RENT_MENU,
};

// ============================================================
// 🎨 THEME HOOK (replace with real ThemeContext import)
// ============================================================

const useTheme = () => {
  const [isDark] = useState(false);
  return { isDark };
};

// ============================================================
// 🧩 COMPONENT
// ============================================================

interface MergedSidebarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

const MergedSidebar: React.FC<MergedSidebarProps> = ({
  activeTab = 'menu',
  setActiveTab,
}) => {
  const { isDark } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [activeItem, setActiveItem] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const [profileData, setProfileData] = useState({
    _id: '',
    name: 'User',
    email: '',
    phone: '',
    image: '',
  });

  // ✅ User's TIZZYOS roles
  const [userRoles, setUserRoles] = useState<TizzyOSRole[]>([]);

  const colors = {
    background: isDark ? '#0F0F12' : '#F8F9FC',
    card: isDark ? '#16161D' : '#FFFFFF',
    textPrimary: isDark ? '#F3F4F6' : '#111827',
    textSecondary: isDark ? '#9CA3AF' : '#4B5563',
    textMuted: isDark ? '#6B7280' : '#9CA3AF',
    border: isDark ? '#22222B' : '#E5E7EB',
    accent: '#6366F1',
    accentLight: '#818CF8',
  };

  // ============================================================
  // ✅ FETCH USER + ROLES FROM me()
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    const fetchUser = async () => {
      setLoading(true);

      try {
        const response = await me();

        if (cancelled) return;

        if (!response?.success || !response?.user) {
          return;
        }

        const user = response.user as {
          id?: string;
          displayName?: string;
          firstName?: string;
          lastName?: string;
          username?: string;
          email?: string;
          phone?: string;
          profilePhoto?: string;
          apps?: Array<{ app?: string; roles?: string[] }>;
        };

        // Display name
        const displayName =
          user.displayName ||
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          user.username ||
          'User';

        setProfileData({
          _id: user.id ?? '',
          name: displayName,
          email: user.email ?? '',
          phone: user.phone ?? '',
          image: getImageUrl(user.profilePhoto),
        });

        // Extract TIZZYOS roles
        const tizzyosApp = user.apps?.find(
          a => (a.app || '').toUpperCase() === 'TIZZYOS',
        );

        const roles = (tizzyosApp?.roles ?? [])
          .map(r => (r || '').toUpperCase())
          .filter((r): r is TizzyOSRole =>
            ['SELLER', 'FWS', 'SHIPPING', 'CAB', 'RENT'].includes(r),
          );

        if (__DEV__) {
          console.log('🎭 TIZZYOS roles:', roles);
        }

        setUserRoles(roles);

        // Expand all visible sections by default
        const initialExpanded: Record<string, boolean> = {};
        roles.forEach(role => {
          const menu = ROLE_MENU_MAP[role];
          if (menu) initialExpanded[menu.segment] = true;
        });
        setExpandedSections(initialExpanded);
      } catch (error) {
        if (cancelled) return;

        if (__DEV__) {
          console.warn('[MergedSidebar.fetchUser]', error);
        }

        if (error instanceof ApiError && error.status === 401) {
          // apiClient ne tokens clear kar diye
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // ✅ BUILD MERGED MENU — only for user's roles
  // ============================================================
  const menuData = useMemo<MenuSection[]>(() => {
    if (!userRoles.length) return [];
    return userRoles
      .map(role => ROLE_MENU_MAP[role])
      .filter((m): m is MenuSection => !!m);
  }, [userRoles]);

  // ============================================================
  // NAVIGATION
  // ============================================================
  const handleItemPress = (segment: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveItem(segment);

    switch (segment) {
      // SELLER
      case 'apply-seller':
        navigation.navigate('ApplySeller');
        break;
      case 'add-product':
        navigation.navigate('ProductListing', { shouldRequestLocation: true });
        break;
      case 'products':
        navigation.navigate('MyProducts');
        break;
      case 'payout-portal':
        navigation.navigate('SellerEarnings');
        break;
      case 'seller-orders':
        navigation.navigate('SellerOrders');
        break;
      // FWS
      case 'apply-fws':
        navigation.navigate('ApplyFWS');
        break;
      case 'fws-scanned-orders':
        navigation.navigate('FWSScannedOrders');
        break;
      case 'handover-scanner':
        navigation.navigate('HandoverScanner');
        break;
      case 'verifyqr-andmarkready-fordispatch':
        navigation.navigate('VerifyForDispatch');
        break;
      case 'create-employee':
        navigation.navigate('CreateEmployee');
        break;
      case 'employee-list':
        navigation.navigate('EmployeeList');
        break;
      // SHIPPING
      case 'apply-shipping':
        navigation.navigate('ApplyShipping');
        break;
      case 'shipments':
        navigation.navigate('MyShipments');
        break;
      case 'shipping-orders':
        navigation.navigate('ShippingOrders');
        break;
      // CAB
      case 'driver-registration':
        navigation.navigate('DriverRegistration');
        break;
      case 'my-rides':
        navigation.navigate('MyRides');
        break;
      case 'earnings':
        navigation.navigate('DriverEarnings');
        break;
      case 'driver-availability':
        navigation.navigate('DriverAvailability');
        break;
      default:
        console.log('Navigate to:', segment);
    }
  };

  const toggleSection = (section: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // ============================================================
  // LOADING
  // ============================================================
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
        />
        <View
          style={[
            styles.loadingContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <LottieView
            source={require('../../animations/lotties/Loading animation blue.json')}
            autoPlay
            loop
            style={styles.lottieLoading}
          />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ============ USER PROFILE CARD ============ */}
          <View
            style={[
              styles.userProfileContainer,
              { backgroundColor: colors.card },
            ]}
          >
            {imageError || !profileData.image ? (
              <View
                style={[
                  styles.userLottieContainer,
                  { borderColor: colors.border },
                ]}
              >
                <LottieView
                  source={require('../../animations/lotties/Login icon (1).json')}
                  autoPlay
                  loop
                  style={styles.userProfileLottie}
                />
              </View>
            ) : (
              <Image
                source={{ uri: profileData.image }}
                style={[
                  styles.userProfileImage,
                  { borderColor: colors.border },
                ]}
                onError={() => setImageError(true)}
              />
            )}

            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {profileData.name}
              </Text>

              {profileData.email ? (
                <View style={styles.userDetailRow}>
                  <Icon
                    name="mail-outline"
                    size={14}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.userDetailText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {profileData.email}
                  </Text>
                </View>
              ) : null}

              {profileData.phone ? (
                <View style={styles.userDetailRow}>
                  <Icon
                    name="call-outline"
                    size={14}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.userDetailText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {profileData.phone}
                  </Text>
                </View>
              ) : null}

              {/* Active roles summary */}
              {userRoles.length > 0 ? (
                <View style={styles.userDetailRow}>
                  <Icon
                    name="shield-checkmark-outline"
                    size={14}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.userDetailText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {userRoles.join(' • ')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ============ MENU SECTIONS ============ */}
          {menuData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon
                name="information-circle-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No active roles found. Please apply for a role to see your
                dashboard.
              </Text>
            </View>
          ) : (
            menuData.map(section => (
              <View key={section.segment} style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(section.segment)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sectionHeaderContent}>
                    <View style={styles.sectionHeaderLeft}>
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor: isDark
                              ? 'rgba(99, 102, 241, 0.15)'
                              : 'rgba(99, 102, 241, 0.08)',
                          },
                        ]}
                      >
                        <Icon
                          name={section.iconName}
                          size={18}
                          color={section.iconColor}
                        />
                      </View>
                      <Text
                        style={[
                          styles.sectionTitle,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {section.title}
                      </Text>
                    </View>
                    <Icon
                      name={
                        expandedSections[section.segment]
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={18}
                      color={colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {expandedSections[section.segment] && (
                  <View
                    style={[
                      styles.subMenu,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {section.children.map(item => (
                      <TouchableOpacity
                        key={item.segment}
                        style={[
                          styles.subMenuItem,
                          activeItem === item.segment &&
                            styles.subMenuItemActive,
                        ]}
                        onPress={() => handleItemPress(item.segment)}
                        activeOpacity={0.6}
                      >
                        <View style={styles.subMenuItemLeft}>
                          <View
                            style={[
                              styles.itemIconContainer,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(255,255,255,0.03)'
                                  : '#F3F4F6',
                              },
                            ]}
                          >
                            <Icon
                              name={item.iconName}
                              size={20}
                              color={item.iconColor}
                            />
                          </View>
                          <Text
                            style={[
                              styles.subMenuText,
                              {
                                color:
                                  activeItem === item.segment
                                    ? colors.accent
                                    : colors.textPrimary,
                              },
                            ]}
                          >
                            {item.title}
                          </Text>
                        </View>
                        <View style={styles.rightContent}>
                          <Icon
                            name="chevron-forward"
                            size={14}
                            color={colors.textMuted}
                          />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {setActiveTab ? (
          <BottomNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        ) : null}
      </SafeAreaView>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Poppins-Medium',
    letterSpacing: 0.3,
  },
  lottieLoading: { width: 120, height: 120 },

  userProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: Platform.OS === 'ios' ? 20 : 16,
    marginBottom: 20,
    shadowColor: '#5356FB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  userProfileImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
  },
  userLottieContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 2.5,
  },
  userProfileLottie: { width: 68, height: 68 },
  userInfo: { marginLeft: 18, flex: 1 },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  userDetailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  userDetailText: {
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },

  section: { marginBottom: 16, marginHorizontal: 16 },
  sectionHeader: { paddingVertical: 12, paddingHorizontal: 4 },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subMenu: {
    borderRadius: 20,
    marginTop: 8,
    paddingVertical: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 6,
    borderRadius: 14,
  },
  subMenuItemActive: { backgroundColor: 'rgba(99, 102, 241, 0.08)' },
  subMenuItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  itemIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  subMenuText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  rightContent: { flexDirection: 'row', alignItems: 'center' },
  bottomSpacer: { height: 90 },
});

export default MergedSidebar;