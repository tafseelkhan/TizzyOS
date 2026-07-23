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
  Switch,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from '../../home/BottomNavigation';
import LottieView from 'lottie-react-native';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const BASE_URL = 'http://10.48.121.121:5000';

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

interface DriverStats {
  totalRides: number;
  completed: number;
  cancelled: number;
  earnings: number;
  rating: number;
}

interface DriverProfile {
  id: string;
  name: string;
  image: string;
  isActive: boolean;
  stats: DriverStats;
  driverCode: string;
  vehicleNumber: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
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

const getImageUrl = (image?: string): string => {
  if (!image) return 'https://via.placeholder.com/150';
  if (image.startsWith('http')) return image;
  return 'https://via.placeholder.com/150';
};

const driverApi = {
  getDriverProfile: async (token: string): Promise<DriverProfile> => {
    try {
      const response = await fetch(`${BASE_URL}/api/v0/driver/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          id: data._id || 'driver_123',
          name: data.name || 'John Driver',
          image: getImageUrl(data.image),
          isActive: data.isActive || true,
          driverCode: data.driverCode || 'DRV001',
          vehicleNumber: data.vehicleNumber || 'MH01AB1234',
          status: data.status || 'approved',
          stats: {
            totalRides: data.stats?.totalRides || 156,
            completed: data.stats?.completed || 142,
            cancelled: data.stats?.cancelled || 8,
            earnings: data.stats?.earnings || 45230,
            rating: data.stats?.rating || 4.8,
          },
        };
      }
    } catch (error) {
      console.error('Error fetching driver profile:', error);
    }

    return {
      id: 'driver_123',
      name: 'John Driver',
      image: 'https://via.placeholder.com/150',
      isActive: true,
      driverCode: 'DRV001',
      vehicleNumber: 'MH01AB1234',
      status: 'approved',
      stats: {
        totalRides: 156,
        completed: 142,
        cancelled: 8,
        earnings: 45230,
        rating: 4.8,
      },
    };
  },

  getDriverMenu: async (): Promise<MenuSection[]> => {
    return [
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
  },
};

const useTheme = () => {
  const [isDark, setIsDark] = useState(false);
  const resolvedTheme = isDark ? 'dark' : 'light';
  return { isDark, resolvedTheme };
};

const SidebarWithDriver: React.FC = () => {
  const { isDark, resolvedTheme } = useTheme();
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
  const [isOnline, setIsOnline] = useState(true);
  const [isLocationOn, setIsLocationOn] = useState(true);
  const [profileData, setProfileData] = useState({
    _id: '',
    name: 'User',
    email: '',
    phone: '',
    image: 'https://via.placeholder.com/150',
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

  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      const [driverProfileData, driverMenuData] = await Promise.all([
        driverApi.getDriverProfile(token || ''),
        driverApi.getDriverMenu(),
      ]);

      setDriverProfile(driverProfileData);
      setMenuData([...driverMenuData]);
    } catch (error) {
      console.error('Error loading driver data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleOnlineToggle = (value: boolean) => {
    setIsOnline(value);
    Alert.alert(
      value ? 'Online' : 'Offline',
      value
        ? 'You are now online and available for rides'
        : 'You are now offline and will not receive ride requests',
      [{ text: 'OK' }],
    );
  };

  const handleLocationToggle = (value: boolean) => {
    setIsLocationOn(value);
    Alert.alert(
      value ? 'Location On' : 'Location Off',
      value
        ? 'Your location is now visible to riders'
        : 'Your location is now hidden from riders',
      [{ text: 'OK' }],
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
            Loading driver profile...
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

              {driverProfile && (
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
              )}

              {driverProfile && (
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
              )}

              {driverProfile && (
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
              )}
            </View>
          </View>

          {/* {driverProfile && (
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View
                  style={[styles.statIconBg, { backgroundColor: '#EDE9FE' }]}
                >
                  <Icon name="car-outline" size={18} color="#8B5CF6" />
                </View>
                <Text
                  style={[styles.statNumber, { color: colors.textPrimary }]}
                >
                  {driverProfile.stats.totalRides}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Total Rides
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View
                  style={[styles.statIconBg, { backgroundColor: '#D1FAE5' }]}
                >
                  <Icon
                    name="checkmark-circle"
                    size={18}
                    color={colors.success}
                  />
                </View>
                <Text
                  style={[styles.statNumber, { color: colors.textPrimary }]}
                >
                  {driverProfile.stats.completed}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Completed
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View
                  style={[styles.statIconBg, { backgroundColor: '#FEF3C7' }]}
                >
                  <Icon name="star" size={18} color={colors.warning} />
                </View>
                <Text
                  style={[styles.statNumber, { color: colors.textPrimary }]}
                >
                  {driverProfile.stats.rating}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Rating
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
                  {section.children.map(item => {
                    if (item.segment === 'driver-availability') {
                      return (
                        <View
                          key={item.segment}
                          style={styles.driverAvailabilityContainer}
                        >
                          <TouchableOpacity
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
                        </View>
                      );
                    }

                    return (
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
                    );
                  })}
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
  driverAvailabilityContainer: {
    marginBottom: 4,
  },
});

export default SidebarWithDriver;
