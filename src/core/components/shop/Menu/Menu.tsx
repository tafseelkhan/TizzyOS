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
} from 'react-native';
import { useTheme } from '../../../contexts/theme/ThemeContext';
import BottomNavigation from '../../home/BottomNavigation';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import vector icons from react-native-vector-icons
import Ionicons from 'react-native-vector-icons/Ionicons';
import Foundation from 'react-native-vector-icons/Foundation';

// Import LinearGradient from react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';

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
  ApplySeller: undefined;
  ProductListing: { shouldRequestLocation: boolean };
  MyProducts: undefined;
  SetupWallet: undefined;
  ProtectionPlans: undefined;
  SellerOrders: undefined;
  SellerReviews: undefined;
  Home: undefined;
  Login: undefined;
};

// Types
interface SellerStats {
  revenue: number;
  likes: number;
  comments: number;
  orders: number;
}

interface SellerProfile {
  id: string;
  name: string;
  image: string;
  isActive: boolean;
  stats: SellerStats;
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

// Mock API Service
const sellerApi = {
  getSellerProfile: async (): Promise<SellerProfile> => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          id: 'seller_123',
          name: 'John Electronics',
          image: 'https://via.placeholder.com/150',
          isActive: true,
          stats: {
            revenue: 42500,
            likes: 1250,
            comments: 320,
            orders: 48,
          },
        });
      }, 1000);
    });
  },

  getSellerMenu: async (): Promise<MenuSection[]> => {
    return [
      {
        segment: 'seller',
        title: 'Seller Dashboard',
        icon: <Ionicons name="storefront" size={24} color="#FFFFFF" />,
        children: [
          {
            segment: 'apply-seller',
            title: 'Apply for Seller ID',
            icon: <Ionicons name="person-add" size={22} color="#8B5CF6" />,
            badge: 2,
          },
          {
            segment: 'add-product',
            title: 'Add Products',
            icon: <Ionicons name="add-circle" size={22} color="#10B981" />,
          },
          {
            segment: 'products',
            title: 'My Products',
            icon: <Ionicons name="cube" size={22} color="#F59E0B" />,
            badge: 15,
          },
          {
            segment: 'ttm/protection',
            title: 'Protection Plans',
            icon: (
              <Ionicons name="shield-checkmark" size={22} color="#3B82F6" />
            ),
          },
          {
            segment: 'payout-portal',
            title: 'Payout Portal',
            icon: <Foundation name="dollar" size={35} color="#10B981" />,
          },
          {
            segment: 'seller-orders',
            title: 'Orders & Sales',
            icon: <Ionicons name="cart" size={22} color="#EF4444" />,
            badge: 8,
          },
          {
            segment: 'reviews',
            title: 'Customer Reviews',
            icon: <Ionicons name="star" size={22} color="#F59E0B" />,
          },
        ],
      },
    ];
  },
};

const SidebarWithSeller: React.FC = () => {
  const { isDark, resolvedTheme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState('menu');
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    seller: true,
  });
  const [activeItem, setActiveItem] = useState<string>('');
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(
    null,
  );

  const getImageUrl = (image?: string): string => {
    if (!image) return 'https://via.placeholder.com/150';
    if (image.startsWith('http')) return image;
    return 'https://via.placeholder.com/150';
  };

  const [previewImage, setPreviewImage] = useState(
    'https://via.placeholder.com/150',
  );
  const [menuData, setMenuData] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState({
    _id: '',
    name: 'User',
    image: 'https://via.placeholder.com/150',
  });

  // Colors
  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#F1F5F9' : '#1E293B',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    textMuted: isDark ? '#64748B' : '#94A3B8',
    border: isDark ? '#334155' : '#E2E8F0',
    accent: '#7C3AED',
    accentLight: isDark ? '#8B5CF6' : '#7C3AED',
    gradientStart: isDark ? '#7C3AED' : '#6366F1',
    gradientEnd: isDark ? '#4C1D95' : '#4338CA',
    badge: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
  };

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem('authToken');

        const response = await fetch(
          'http://172.20.10.12:5000/api/profile/me',
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (response.ok) {
          const normalized = getImageUrl(data?.image);

          setProfileData({
            _id: data?._id ?? '',
            name: data?.name ?? 'User',
            image: normalized,
          });

          setPreviewImage(normalized);
        } else {
          console.error(
            'Error fetching profile:',
            data?.message ?? 'Unknown error',
          );
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Load data from API
  useEffect(() => {
    loadSellerData();
  }, []);

  const loadSellerData = async () => {
    try {
      setLoading(true);
      const [profile, menu] = await Promise.all([
        sellerApi.getSellerProfile(),
        sellerApi.getSellerMenu(),
      ]);
      setSellerProfile(profile);
      setMenuData(menu);
    } catch (error) {
      console.error('Error loading seller data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Navigation handler with proper typing
  const handleItemPress = (segment: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveItem(segment);

    // Navigation logic - using proper navigation without 'as any'
    switch (segment) {
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
        navigation.navigate('SetupWallet');
        break;
      case 'ttm/protection':
        navigation.navigate('ProtectionPlans');
        break;
      case 'seller-orders':
        navigation.navigate('SellerOrders');
        break;
      case 'reviews':
        navigation.navigate('SellerReviews');
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
            Loading Business Hub...
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
        {/* Header Section with Seller Profile */}
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerContent}>
              {/* Seller Profile Image and Name */}
              <View style={styles.sellerProfileContainer}>
                <Image
                  source={{ uri: profileData.image }}
                  style={styles.sellerImage}
                  defaultSource={require('../../../../assets/images/default-profile.png')}
                />
                <View style={styles.sellerInfo}>
                  <Text style={styles.sellerName}>{profileData.name}</Text>
                </View>
              </View>

              <Text style={styles.headerTitle}>Business Hub</Text>
              <Text style={styles.headerSubtitle}>
                Manage your business efficiently
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="cart" size={20} color={colors.warning} />
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
              48
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Orders
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="heart" size={20} color={colors.info} />
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
              {sellerProfile?.stats.likes.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Likes
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="chatbubble" size={20} color={colors.warning} />
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
              {sellerProfile?.stats.comments.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Comments
            </Text>
          </View>
        </View>

        {/* Seller Menu Sections */}
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
                  <Ionicons
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
                        { backgroundColor: isDark ? '#1E1B4B' : '#F5F3FF' },
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
                          { backgroundColor: isDark ? '#1E1B4B' : '#F5F3FF' },
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
                        {item.badge && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.rightContent}>
                      {item.badge && activeItem !== item.segment && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                      <Ionicons
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
          onPress={loadSellerData}
        >
          <Ionicons name="refresh" size={20} color={colors.accentLight} />
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
  sellerProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    width: '100%',
  },
  sellerImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  sellerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  sellerName: {
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
    backgroundColor: '#EF4444',
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

export default SidebarWithSeller;
