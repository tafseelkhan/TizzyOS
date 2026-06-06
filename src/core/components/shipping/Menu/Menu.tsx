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
  PlatformColor,
  UIManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from '../../home/BottomNavigation';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const BASE_URL = 'http://172.20.10.12:5000';

// Define navigation param list
type RootStackParamList = {
  ApplyShipping: undefined;
  AddShipment: undefined;
  MyShipments: undefined;
  Tracking: undefined;
  ShippingOrders: undefined;
  ShippingReviews: undefined;
  [key: string]: undefined | object;
};

// Types
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

interface MenuItem {
  segment: string;
  title: string;
  icon: React.ReactNode;
  badge?: number;
}

interface MenuSection {
  segment: string;
  title: string;
  icon: React.ReactNode;
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
      const response = await fetch(`${BASE_URL}/api/shipping/profile`, {
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
        title: 'Shipping Dashboard',
        icon: <Icon name="boat" size={24} color="#FFFFFF" />,
        children: [
          {
            segment: 'apply-shipping',
            title: 'Apply for Shipping ID',
            icon: <Icon name="person-add" size={22} color="#2196F3" />,
            badge: 2,
          },
          {
            segment: 'shipments',
            title: 'My Shipments',
            icon: <Icon name="cube" size={22} color="#FF9800" />,
            badge: 15,
          },
          {
            segment: 'shipping-orders',
            title: 'Shipping Orders',
            icon: <Icon name="cart" size={22} color="#F44336" />,
            badge: 8,
          },
          {
            segment: 'shipping-reviews',
            title: 'Shipping Reviews',
            icon: <Icon name="star" size={22} color="#FF9800" />,
          },
        ],
      },
    ];
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
  });
  const [activeItem, setActiveItem] = useState<string>('');
  const [shippingProfile, setShippingProfile] =
    useState<ShippingProfile | null>(null);
  const [menuData, setMenuData] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState({
    _id: '',
    name: 'User',
    image: 'https://via.placeholder.com/150',
  });

  // Colors - Blue theme
  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#F1F5F9' : '#1E293B',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    textMuted: isDark ? '#64748B' : '#94A3B8',
    border: isDark ? '#334155' : '#E2E8F0',
    accent: '#1976D2',
    accentLight: isDark ? '#2196F3' : '#1976D2',
    gradientStart: isDark ? '#1976D2' : '#2196F3',
    gradientEnd: isDark ? '#0D47A1' : '#1565C0',
    badge: '#F44336',
    success: '#4CAF50',
    warning: '#FF9800',
    info: '#2196F3',
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
    loadShippingData();
  }, []);

  const loadShippingData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const [profile, menu] = await Promise.all([
        shippingApi.getShippingProfile(token || ''),
        shippingApi.getShippingMenu(),
      ]);
      setShippingProfile(profile);
      setMenuData(menu);
    } catch (error) {
      console.error('Error loading shipping data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Navigation handler
  const handleItemPress = (segment: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveItem(segment);

    switch (segment) {
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
        <View
          style={[
            styles.loadingContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={colors.accentLight} />
          <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
            Loading Shipping Hub...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Section with Shipping Profile */}
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerContent}>
              {/* Shipping Profile Image and Name */}
              <View style={styles.shippingProfileContainer}>
                <Image
                  source={{ uri: profileData.image }}
                  style={styles.shippingImage}
                />
                <View style={styles.shippingInfo}>
                  <Text style={styles.shippingName}>{profileData.name}</Text>
                </View>
              </View>

              <Text style={styles.headerTitle}>Shipping Hub</Text>
              <Text style={styles.headerSubtitle}>
                Manage your shipments efficiently
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Icon name="cube" size={20} color={colors.warning} />
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
              {shippingProfile?.stats.shipments}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Shipments
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Icon name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
              {shippingProfile?.stats.delivered}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Delivered
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Icon name="navigate" size={20} color={colors.info} />
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
              {shippingProfile?.stats.inTransit}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              In Transit
            </Text>
          </View>
        </View>

        {/* Shipping Menu Sections */}
        {menuData.map(section => (
          <View key={section.segment} style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.segment)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={
                  expandedSections[section.segment]
                    ? [colors.gradientStart, colors.gradientEnd]
                    : [colors.card, colors.card]
                }
                style={styles.sectionHeaderGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.sectionHeaderContent}>
                  <View style={styles.sectionHeaderLeft}>
                    <View
                      style={[
                        styles.iconContainer,
                        expandedSections[section.segment] &&
                          styles.iconContainerActive,
                      ]}
                    >
                      {section.icon}
                    </View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        {
                          color: expandedSections[section.segment]
                            ? '#FFF'
                            : colors.textPrimary,
                        },
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
                    size={20}
                    color={
                      expandedSections[section.segment]
                        ? '#FFF'
                        : colors.textSecondary
                    }
                  />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {expandedSections[section.segment] && (
              <View style={[styles.subMenu, { backgroundColor: colors.card }]}>
                {section.children.map((item, index) => (
                  <TouchableOpacity
                    key={item.segment}
                    style={[
                      styles.subMenuItem,
                      { borderBottomColor: colors.border },
                      activeItem === item.segment && [
                        styles.subMenuItemActive,
                        {
                          borderLeftColor: colors.accent,
                          backgroundColor: isDark ? '#0D1B2A' : '#E3F2FD',
                        },
                      ],
                      index === section.children.length - 1 &&
                        styles.lastSubMenuItem,
                    ]}
                    onPress={() => handleItemPress(item.segment)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.subMenuItemLeft}>
                      <View
                        style={[
                          styles.itemIconContainer,
                          { backgroundColor: isDark ? '#0D1B2A' : '#E3F2FD' },
                          activeItem === item.segment && {
                            backgroundColor: colors.accent + '20',
                          },
                        ]}
                      >
                        {item.icon}
                      </View>
                      <View style={styles.textContainer}>
                        <Text
                          style={[
                            styles.subMenuText,
                            {
                              color:
                                activeItem === item.segment
                                  ? colors.accentLight
                                  : colors.textPrimary,
                            },
                          ]}
                        >
                          {item.title}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.rightContent}>
                      {item.badge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                      <Icon
                        name="chevron-forward"
                        size={16}
                        color={
                          activeItem === item.segment
                            ? colors.accentLight
                            : colors.textMuted
                        }
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Refresh Button */}
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: colors.card }]}
          onPress={loadShippingData}
        >
          <Icon name="refresh" size={20} color={colors.accentLight} />
          <Text style={[styles.refreshText, { color: colors.accentLight }]}>
            Refresh Data
          </Text>
        </TouchableOpacity>

        {/* Extra space for bottom navigation */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </SafeAreaView>
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
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    borderRadius: 20,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  headerGradient: {
    borderRadius: 20,
    padding: 24,
  },
  headerContent: {
    alignItems: 'center',
  },
  shippingProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    width: '100%',
  },
  shippingImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  shippingInfo: {
    marginLeft: 12,
    flex: 1,
  },
  shippingName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  activeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  activeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statCard: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  sectionHeader: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  sectionHeaderGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconContainerActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  subMenu: {
    borderRadius: 16,
    marginTop: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  subMenuItemActive: {
    borderLeftWidth: 4,
  },
  lastSubMenuItem: {
    borderBottomWidth: 0,
  },
  subMenuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subMenuText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#F44336',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  refreshText: {
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  bottomSpacer: {
    height: 80,
  },
});

export default SidebarWithShipping;
