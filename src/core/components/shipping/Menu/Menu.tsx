import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Dimensions,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  UIManager,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from '../../home/BottomNavigation';
import LottieView from 'lottie-react-native';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const BASE_URL = 'http://10.48.121.121:5000';

// Define navigation param list
type RootStackParamList = {
  ApplyShipping: undefined;
  AddShipment: undefined;
  MyShipments: undefined;
  Tracking: undefined;
  ShippingOrders: undefined;
  ShippingReviews: undefined;
  // FWS Navigation Screens
  ApplyFWS: undefined;
  MyFWS: undefined;
  FWSOrders: undefined;
  FWSReviews: undefined;
  // Employee Navigation Screens
  EmployeeManagement: undefined;
  EmployeeList: undefined;
  EmployeeAttendance: undefined;
  EmployeeLeave: undefined;
  EmployeePayroll: undefined;
  CreateEmployee: undefined; // Added for Apply Employee
  [key: string]: undefined | object;
};

// Types for Shipping
interface ShippingStats {
  shipments: number;
  delivered: number;
  inTransit: number;
  pending: number;
}

interface ShippingProfile {
  id: string;
  name: string;
  image: string;
  isActive: boolean;
  stats: ShippingStats;
}

// Types for FWS (Freight & Warehouse Services)
interface FWSStats {
  totalOrders: number;
  completed: number;
  inProgress: number;
  pending: number;
}

interface FWSProfile {
  id: string;
  name: string;
  image: string;
  isActive: boolean;
  stats: FWSStats;
}

// Types for Employee
interface EmployeeStats {
  totalEmployees: number;
  active: number;
  onLeave: number;
  pendingApproval: number;
}

interface EmployeeProfile {
  id: string;
  name: string;
  image: string;
  isActive: boolean;
  stats: EmployeeStats;
}

interface MenuItem {
  segment: string;
  title: string;
  iconName: string;
  iconColor: string;
}

interface MenuSection {
  segment: string;
  title: string;
  iconName: string;
  iconColor: string;
  children: MenuItem[];
}

// Helper function to get image URL
const getImageUrl = (image?: string): string => {
  if (!image) return 'https://via.placeholder.com/150';
  if (image.startsWith('http')) return image;
  return 'https://via.placeholder.com/150';
};

// Shipping API Service
const shippingApi = {
  getShippingProfile: async (token: string): Promise<ShippingProfile> => {
    try {
      const response = await fetch(`${BASE_URL}/api/v0/shipping`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          id: data._id || 'shipping_123',
          name: data.name || 'Express Logistics',
          image: getImageUrl(data.image),
          isActive: data.isActive || true,
          stats: {
            shipments: data.stats?.shipments || 125,
            delivered: data.stats?.delivered || 98,
            inTransit: data.stats?.inTransit || 15,
            pending: data.stats?.pending || 12,
          },
        };
      }
    } catch (error) {
      console.error('Error fetching shipping profile:', error);
    }

    // Return mock data if API fails
    return {
      id: 'shipping_123',
      name: 'Express Logistics',
      image: 'https://via.placeholder.com/150',
      isActive: true,
      stats: {
        shipments: 125,
        delivered: 98,
        inTransit: 15,
        pending: 12,
      },
    };
  },

  getShippingMenu: async (): Promise<MenuSection[]> => {
    return [
      {
        segment: 'shipping',
        title: 'Shippings Management',
        iconName: 'grid-outline',
        iconColor: '#4F46E5',
        children: [
          {
            segment: 'apply-shipping',
            title: 'Apply for Shipping',
            iconName: 'person-add-outline',
            iconColor: '#4F46E5',
          },
          {
            segment: 'shipments',
            title: 'My Shipments',
            iconName: 'cube-outline',
            iconColor: '#F59E0B',
          },
          {
            segment: 'shipping-orders',
            title: 'Orders Tracking',
            iconName: 'cart-outline',
            iconColor: '#EF4444',
          },
        ],
      },
    ];
  },
};

// Employee API Service
const employeeApi = {
  getEmployeeProfile: async (token: string): Promise<EmployeeProfile> => {
    try {
      const response = await fetch(`${BASE_URL}/api/v0/employee`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          id: data._id || 'emp_123',
          name: data.name || 'HR Department',
          image: getImageUrl(data.image),
          isActive: data.isActive || true,
          stats: {
            totalEmployees: data.stats?.totalEmployees || 45,
            active: data.stats?.active || 30,
            onLeave: data.stats?.onLeave || 8,
            pendingApproval: data.stats?.pendingApproval || 7,
          },
        };
      }
    } catch (error) {
      console.error('Error fetching employee profile:', error);
    }

    // Return mock data if API fails
    return {
      id: 'emp_123',
      name: 'HR Department',
      image: 'https://via.placeholder.com/150',
      isActive: true,
      stats: {
        totalEmployees: 45,
        active: 30,
        onLeave: 8,
        pendingApproval: 7,
      },
    };
  },
};

// Custom hook for theme (replace with your actual ThemeContext)
const useTheme = () => {
  const [isDark, setIsDark] = useState(false);
  const resolvedTheme = isDark ? 'dark' : 'light';

  return { isDark, resolvedTheme };
};

const SidebarWithShipping: React.FC = () => {
  const { isDark, resolvedTheme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState('menu');
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    shipping: true,
    fws: true,
    employee: true, // Added Employee section expanded by default
  });
  const [activeItem, setActiveItem] = useState<string>('');
  const [shippingProfile, setShippingProfile] =
    useState<ShippingProfile | null>(null);
  const [fwsProfile, setFwsProfile] = useState<FWSProfile | null>(null);
  const [employeeProfile, setEmployeeProfile] =
    useState<EmployeeProfile | null>(null);
  const [menuData, setMenuData] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [profileData, setProfileData] = useState({
    _id: '',
    name: 'User',
    email: '',
    phone: '',
    image: 'https://via.placeholder.com/150',
  });

  // Colors - Premium Modern Minimalist Theme
  const colors = {
    background: isDark ? '#0F0F12' : '#F8F9FC',
    card: isDark ? '#16161D' : '#FFFFFF',
    textPrimary: isDark ? '#F3F4F6' : '#111827',
    textSecondary: isDark ? '#9CA3AF' : '#4B5563',
    textMuted: isDark ? '#6B7280' : '#9CA3AF',
    border: isDark ? '#22222B' : '#E5E7EB',
    accent: '#6366F1',
    accentLight: '#818CF8',
    gradientStart: isDark ? '#4F46E5' : '#6366F1',
    gradientEnd: isDark ? '#4338CA' : '#4F46E5',
    badge: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
  };

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        const response = await fetch(`${BASE_URL}/api/v0/profile/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (response.ok) {
          const normalized = getImageUrl(data?.image);
          setProfileData({
            _id: data?._id ?? '',
            name: data?.name ?? 'User',
            email: data?.email ?? 'user@example.com',
            phone: data?.phone ?? '+91 9876543210',
            image: normalized,
          });
        } else {
          console.error(
            'Error fetching profile:',
            data?.message ?? 'Unknown error',
          );
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, []);

  // Load data from API
  useEffect(() => {
    loadShippingFWSAndEmployeeData();
  }, []);

  const loadShippingFWSAndEmployeeData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      // Load all three data in parallel
      const [shippingProfileData, shippingMenuData] = await Promise.all([
        shippingApi.getShippingProfile(token || ''),
        shippingApi.getShippingMenu(),
      ]);

      setShippingProfile(shippingProfileData);
      // Combine all three menus
      setMenuData([...shippingMenuData]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Navigation handler
  const handleItemPress = (segment: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveItem(segment);

    switch (segment) {
      // Shipping navigation
      case 'apply-shipping':
        navigation.navigate('ApplyShipping');
        break;
      case 'add-shipment':
        navigation.navigate('AddShipment');
        break;
      case 'shipments':
        navigation.navigate('MyShipments');
        break;
      case 'tracking':
        navigation.navigate('Tracking');
        break;
      case 'shipping-orders':
        navigation.navigate('ShippingOrders');
        break;
      case 'shipping-reviews':
        navigation.navigate('ShippingReviews');
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

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
          translucent={false}
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
            Finding your network.....
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={false}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Simple User Profile Section - Only Name and Image */}
          <View
            style={[
              styles.userProfileContainer,
              { backgroundColor: colors.card },
            ]}
          >
            {/* Profile Image with Lottie fallback */}
            {imageError ? (
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
              {/* Added Email */}
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
              {/* Added Phone */}
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
            </View>
          </View>

          {/* Employee Stats Cards - COMMENTED OUT */}
          {/* {employeeProfile && (
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View style={[styles.statIconBg, { backgroundColor: '#EDE9FE' }]}>
                  <Icon name="people-outline" size={18} color="#8B5CF6" />
                </View>
                <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
                  {employeeProfile.stats.totalEmployees}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Total Employees
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View style={[styles.statIconBg, { backgroundColor: '#D1FAE5' }]}>
                  <Icon name="checkmark-circle" size={18} color={colors.success} />
                </View>
                <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
                  {employeeProfile.stats.active}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Active
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View style={[styles.statIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Icon name="time-outline" size={18} color={colors.warning} />
                </View>
                <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
                  {employeeProfile.stats.onLeave}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  On Leave
                </Text>
              </View>
            </View>
          )} */}

          {menuData.map(section => (
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
                  {section.children.map((item, index) => (
                    <TouchableOpacity
                      key={item.segment}
                      style={[
                        styles.subMenuItem,
                        activeItem === item.segment && styles.subMenuItemActive,
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
          ))}

          {/* Extra space for bottom navigation */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Poppins-Medium',
    letterSpacing: 0.3,
  },
  lottieLoading: {
    width: 120,
    height: 120,
  },
  // Premium Modern Header Structure
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
  userProfileLottie: {
    width: 68,
    height: 68,
  },
  userInfo: {
    marginLeft: 18,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  userDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  userDetailText: {
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
  },
  section: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  subMenuItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  subMenuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  subMenuText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomSpacer: {
    height: 90,
  },
});

export default SidebarWithShipping;
