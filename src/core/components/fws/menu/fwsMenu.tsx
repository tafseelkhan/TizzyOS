// components/FWSMenu.tsx
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
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const BASE_URL = 'http://172.20.10.12:5000';

// Define navigation param list for FWS
type RootStackParamList = {
  // FWS Navigation Screens
  ApplyFWS: undefined;
  MyFWS: undefined;
  FWSOrders: undefined;
  FWSReviews: undefined;
  HandoverScanner: undefined;
  VerifyForDispatch: undefined;
  // Employee Navigation Screens
  CreateEmployee: undefined;
  EmployeeList: undefined;
  EmployeeAttendance: undefined;
  EmployeeLeave: undefined;
  EmployeePayroll: undefined;
  [key: string]: undefined | object;
};

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

// FWS API Service
const fwsApi = {
  getFWSProfile: async (token: string): Promise<FWSProfile> => {
    try {
      const response = await fetch(`${BASE_URL}/api/fws`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          id: data._id || 'fws_123',
          name: data.name || 'FWS Logistics',
          image: getImageUrl(data.image),
          isActive: data.isActive || true,
          stats: {
            totalOrders: data.stats?.totalOrders || 89,
            completed: data.stats?.completed || 45,
            inProgress: data.stats?.inProgress || 28,
            pending: data.stats?.pending || 16,
          },
        };
      }
    } catch (error) {
      console.error('Error fetching FWS profile:', error);
    }

    // Return mock data if API fails
    return {
      id: 'fws_123',
      name: 'FWS Logistics',
      image: 'https://via.placeholder.com/150',
      isActive: true,
      stats: {
        totalOrders: 89,
        completed: 45,
        inProgress: 28,
        pending: 16,
      },
    };
  },

  getFWSMenu: async (): Promise<MenuSection[]> => {
    return [
      {
        segment: 'fws',
        title: 'FWS Management',
        iconName: 'business-outline',
        iconColor: '#10B981',
        children: [
          {
            segment: 'apply-fws',
            title: 'Apply for FWS',
            iconName: 'person-add-outline',
            iconColor: '#10B981',
          },
          {
            segment: 'fws-scanned-orders',
            title: 'Scanned Orders',
            iconName: 'cart-outline',
            iconColor: '#EF4444',
          },
          {
            segment: 'fws-reviews',
            title: 'FWS Reviews',
            iconName: 'star-outline',
            iconColor: '#F59E0B',
          },
          // ✅ Handover Scanner
          {
            segment: 'handover-scanner',
            title: 'Handover Scanner',
            iconName: 'qr-code-outline',
            iconColor: '#6366F1',
          },
          // ✅ Verify QR & Mark Ready for Dispatch
          {
            segment: 'verifyqr-andmarkready-fordispatch',
            title: 'Verify for Dispatch',
            iconName: 'checkmark-done-outline',
            iconColor: '#10B981',
          },
          // ✅ Employee Management
          {
            segment: 'create-employee',
            title: 'Create Employee',
            iconName: 'person-add-outline',
            iconColor: '#8B5CF6',
          },
          {
            segment: 'employee-list',
            title: 'All Employees',
            iconName: 'people-outline',
            iconColor: '#8B5CF6',
          },
          // Commented out features - can be enabled later
          // {
          //   segment: 'employee-attendance',
          //   title: 'Attendance',
          //   iconName: 'calendar-outline',
          //   iconColor: '#F59E0B',
          // },
          // {
          //   segment: 'employee-leave',
          //   title: 'Leave Management',
          //   iconName: 'time-outline',
          //   iconColor: '#EF4444',
          // },
          // {
          //   segment: 'employee-payroll',
          //   title: 'Payroll',
          //   iconName: 'cash-outline',
          //   iconColor: '#10B981',
          // },
        ],
      },
    ];
  },
};

// Custom hook for theme
const useTheme = () => {
  const [isDark, setIsDark] = useState(false);
  const resolvedTheme = isDark ? 'dark' : 'light';

  return { isDark, resolvedTheme };
};

interface FWSMenuProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

const FWSMenu: React.FC<FWSMenuProps> = ({
  activeTab = 'menu',
  setActiveTab,
}) => {
  const { isDark, resolvedTheme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    fws: true,
  });
  const [activeItem, setActiveItem] = useState<string>('');
  const [fwsProfile, setFwsProfile] = useState<FWSProfile | null>(null);
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

        const response = await fetch(`${BASE_URL}/api/profile/me`, {
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
    loadFWSData();
  }, []);

  const loadFWSData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      // Load FWS data
      const [fwsProfileData, fwsMenuData] = await Promise.all([
        fwsApi.getFWSProfile(token || ''),
        fwsApi.getFWSMenu(),
      ]);

      setFwsProfile(fwsProfileData);
      setMenuData(fwsMenuData);
    } catch (error) {
      console.error('Error loading FWS data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Navigation handler
  const handleItemPress = (segment: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveItem(segment);

    switch (segment) {
      // FWS navigation
      case 'apply-fws':
        navigation.navigate('ApplyFWS');
        break;
      case 'fws-scanned-orders':
        navigation.navigate('FWSScannedOrders');
        break;
      case 'fws-reviews':
        navigation.navigate('FWSReviews');
        break;
      case 'handover-scanner':
        navigation.navigate('HandoverScanner');
        break;
      case 'verifyqr-andmarkready-fordispatch':
        navigation.navigate('VerifyForDispatch');
        break;

      // Employee navigation
      case 'create-employee':
        navigation.navigate('CreateEmployee');
        break;
      case 'employee-list':
        navigation.navigate('EmployeeList');
        break;
      case 'employee-attendance':
        navigation.navigate('EmployeeAttendance');
        break;
      case 'employee-leave':
        navigation.navigate('EmployeeLeave');
        break;
      case 'employee-payroll':
        navigation.navigate('EmployeePayroll');
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

  // FWS Stats Cards
  const renderFWSStats = () => {
    if (!fwsProfile) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <View style={[styles.statIconBg, { backgroundColor: '#EDE9FE' }]}>
            <Icon name="cube-outline" size={18} color="#8B5CF6" />
          </View>
          <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
            {fwsProfile.stats.totalOrders}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Orders
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <View style={[styles.statIconBg, { backgroundColor: '#D1FAE5' }]}>
            <Icon name="checkmark-circle" size={18} color="#10B981" />
          </View>
          <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
            {fwsProfile.stats.completed}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Completed
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <View style={[styles.statIconBg, { backgroundColor: '#FEF3C7' }]}>
            <Icon name="time-outline" size={18} color="#F59E0B" />
          </View>
          <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
            {fwsProfile.stats.inProgress}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            In Progress
          </Text>
        </View>
      </View>
    );
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
            Loading FWS Menu...
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
          {/* User Profile Section */}
          <View
            style={[
              styles.userProfileContainer,
              { backgroundColor: colors.card },
            ]}
          >
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

          {/* FWS Stats Cards */}
          {renderFWSStats()}

          {/* FWS Menu Sections */}
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
                  {section.children.map(item => (
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

          {/* Extra space for bottom */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
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

export default FWSMenu;
