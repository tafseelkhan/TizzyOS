// src/screens/driver/SidebarWithDriver.tsx
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
  SafeAreaView,
  Platform,
  UIManager,
  StatusBar,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import BottomNavigation from '../../home/BottomNavigation';
import LottieView from 'lottie-react-native';

// ✅ me() — user profile
import { me } from '../../../../api/features/public/authPublicSlice';

// ✅ getDriverProfile() — driver profile (NEW SLICE)
import {
  getDriverProfile,
  DriverProfile,
} from '../../../../api/features/private/driverProfileSlice';

import { ApiError } from '../../../../core/utils/handler/apiClient';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

type RootStackParamList = {
  DriverRegistration: undefined;
  MyRides: undefined;
  DriverEarnings: undefined;
  RideHistory: undefined;
  DriverDocuments: undefined;
  DriverReviews: undefined;
  DriverProfile: undefined;
  DriverAvailability: undefined;
  DriverVehicles: undefined;
  DriverSupport: undefined;
  [key: string]: undefined | object;
};

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

// ============================================================
// 🔧 IMAGE HELPER
// ============================================================

const getImageUrl = (image?: string): string => {
  if (!image) return '';
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  return '';
};

// ============================================================
// 📋 STATIC MENU — no API
// ============================================================

const getDriverMenu = (): MenuSection[] => [
  {
    segment: 'driver',
    title: 'Driver Management',
    iconName: 'car-sport-outline',
    iconColor: '#4F46E5',
    children: [
      {
        segment: 'driver-registration',
        title: 'Driver Registration',
        iconName: 'person-add-outline',
        iconColor: '#4F46E5',
      },
      {
        segment: 'my-rides',
        title: 'My Rides',
        iconName: 'car-outline',
        iconColor: '#10B981',
      },
      {
        segment: 'earnings',
        title: 'My Earnings',
        iconName: 'wallet-outline',
        iconColor: '#F59E0B',
      },
      {
        segment: 'driver-availability',
        title: 'Driver Availability',
        iconName: 'radio-button-on-outline',
        iconColor: '#8B5CF6',
      },
    ],
  },
];

// ============================================================
// 🎨 THEME HOOK (same as before)
// ============================================================

const useTheme = () => {
  const [isDark] = useState(false);
  const resolvedTheme = isDark ? 'dark' : 'light';
  return { isDark, resolvedTheme };
};

// ============================================================
// 🧩 COMPONENT
// ============================================================

const SidebarWithDriver: React.FC = () => {
  const { isDark } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [activeTab, setActiveTab] = useState('menu');
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    driver: true,
  });
  const [activeItem, setActiveItem] = useState<string>('');
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(
    null,
  );
  const [menuData, setMenuData] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const [profileData, setProfileData] = useState({
    _id: '',
    name: 'User',
    email: '',
    phone: '',
    image: '',
  });

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

  // ============================================================
  // ✅ FETCH USER PROFILE — me() API
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      try {
        const response = await me();

        if (cancelled) return;

        if (response?.success && response?.user) {
          const user = response.user as {
            id?: string;
            displayName?: string;
            firstName?: string;
            lastName?: string;
            username?: string;
            email?: string;
            phone?: string;
            profilePhoto?: string;
          };

          const displayName =
            user.displayName ||
            [user.firstName, user.lastName]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            user.username ||
            'User';

          setProfileData({
            _id: user.id ?? '',
            name: displayName,
            email: user.email ?? '',
            phone: user.phone ?? '',
            image: getImageUrl(user.profilePhoto),
          });
        }
      } catch (error) {
        if (cancelled) return;

        if (__DEV__) {
          console.warn('[SidebarWithDriver.fetchProfile]', error);
        }

        // 401 → apiClient ne already tokens clear kar diye
        if (error instanceof ApiError && error.status === 401) {
          // Optional: navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
        }
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // ✅ FETCH DRIVER PROFILE — getDriverProfile() API (NEW)
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    const loadDriverData = async () => {
      try {
        setLoading(true);

        const driverProfileData = await getDriverProfile();

        if (cancelled) return;

        setDriverProfile(driverProfileData);
        setMenuData(getDriverMenu());
      } catch (error) {
        if (cancelled) return;

        if (__DEV__) {
          console.warn('[SidebarWithDriver.loadDriverData]', error);
        }

        // 401 → apiClient ne tokens clear kar diye
        // Driver not registered (404) → profile null rahega
        // Menu phir bhi dikhega (static)
        setMenuData(getDriverMenu());
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDriverData();

    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // NAVIGATION HANDLERS
  // ============================================================
  const handleItemPress = (segment: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveItem(segment);

    switch (segment) {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'rejected':
        return '#EF4444';
      case 'suspended':
        return '#6B7280';
      default:
        return '#3B82F6';
    }
  };

  // ============================================================
  // LOADING STATE
  // ============================================================
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
            Loading driver profile...
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
        backgroundColor={colors.background}
        translucent={false}
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

              {driverProfile && driverProfile.driverCode ? (
                <View style={styles.userDetailRow}>
                  <Icon
                    name="card-outline"
                    size={14}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.userDetailText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {driverProfile.driverCode}
                  </Text>
                </View>
              ) : null}

              {driverProfile && driverProfile.vehicleNumber ? (
                <View style={styles.userDetailRow}>
                  <Icon
                    name="car-outline"
                    size={14}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.userDetailText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {driverProfile.vehicleNumber}
                  </Text>
                </View>
              ) : null}

              {driverProfile && driverProfile.status ? (
                <View style={styles.userDetailRow}>
                  <Icon
                    name="ellipse"
                    size={12}
                    color={getStatusColor(driverProfile.status)}
                  />
                  <Text
                    style={[
                      styles.userDetailText,
                      { color: getStatusColor(driverProfile.status) },
                    ]}
                  >
                    {driverProfile.status.toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ============ MENU SECTIONS ============ */}
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
          ))}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <BottomNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </SafeAreaView>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================
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

export default SidebarWithDriver;