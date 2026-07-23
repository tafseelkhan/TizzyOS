// components/BottomNavigation.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Modal,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';
import { useTheme } from '../../contexts/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

// Type definitions for props
interface BottomNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Define navigation param types
type RootStackParamList = {
  BottomNavigator: { screen: string };
  Home: undefined;
  Seller: undefined;
  Rider: undefined;
  Renter: undefined;
  Shipper: undefined;
  Chat: undefined;
  MyAds: undefined;
  Profile: undefined;
  ShopDetails: undefined;
  [key: string]: any;
};

// Haptic options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Account type - Updated to match backend response
interface LinkedAccount {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  roles: string;
  isActive: boolean;
  isPrimary?: boolean;
}

// New Account Form Data
interface NewAccountData {
  name: string;
  email: string;
  phone: string;
  roles: string;
}

// ✅ Role-based icons mapping
const ROLE_ICONS = {
  SELLER: {
    icon: 'storefront' as const,
    label: 'Seller',
    route: 'ShopDetails',
  },
  FWS: {
    icon: 'warehouse' as const,
    label: 'FWS',
    route: 'FWS',
  },
  SHIPPING: {
    icon: 'local-shipping' as const,
    label: 'Shipping',
    route: 'Shipper',
  },
  CAB: {
    icon: 'directions-car' as const, // ✅ FIXED: taxi → directions-car
    label: 'Cab',
    route: 'CabDriver',
  },
  RENT: {
    icon: 'car' as const,
    label: 'Rent',
    route: 'Renter',
  },
  BUYER: {
    icon: 'shopping-bag' as const,
    label: 'Buy',
    route: 'Buy',
  },
};

// Role colors for accounts
const ROLE_COLORS = {
  SELLER: '#3B82F6',
  FWS: '#8B5CF6',
  SHIPPING: '#10B981',
  CAB: '#F59E0B',
  RENT: '#EC4899',
  BUYER: '#06B6D4',
};

// ✅ Allowed roles for linking - CAB ADDED
const ALLOWED_ROLES = ['SELLER', 'FWS', 'SHIPPING', 'CAB'];

const BottomNavigation = ({
  activeTab,
  setActiveTab,
}: BottomNavigationProps) => {
  const { isDark, resolvedTheme } = useTheme();
  const [userRole, setUserRole] = useState<string>('SELLER');
  const [isRoleLoaded, setIsRoleLoaded] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastPressTime, setLastPressTime] = useState(0);
  const [pressTimer, setPressTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  // Add Account States
  const [isAddAccountModalVisible, setIsAddAccountModalVisible] =
    useState(false);
  const [newAccountData, setNewAccountData] = useState<NewAccountData>({
    name: '',
    email: '',
    phone: '',
    roles: 'SELLER',
  });
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Safe area insets for proper spacing
  const insets = useSafeAreaInsets();

  // Screen dimensions
  const screenHeight = Dimensions.get('window').height;
  const drawerHeight = screenHeight * 0.6;

  // ✅ Get user role from JWT Token
  useEffect(() => {
    const getUserRoleFromToken = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          console.warn('⚠️ No token found, defaulting to SELLER');
          setUserRole('SELLER');
          setIsRoleLoaded(true);
          return;
        }

        const decoded: any = jwtDecode(token);
        console.log('🔓 Decoded Token:', decoded);

        const role =
          decoded.role ||
          decoded.roles ||
          decoded.user?.role ||
          decoded.user?.roles ||
          'SELLER';

        const userId = decoded.id || decoded.userId || decoded.sub || '';
        setCurrentUserId(userId);

        console.log('👤 Role from Token:', role);

        setUserRole(role);
        setIsRoleLoaded(true);
      } catch (error) {
        console.error('❌ Error getting role from token:', error);
        setUserRole('SELLER');
        setIsRoleLoaded(true);
      }
    };

    getUserRoleFromToken();
  }, []);

  // Haptic feedback functions
  const triggerLightHaptic = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
  };

  const triggerMediumHaptic = () => {
    ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
  };

  const triggerHeavyHaptic = () => {
    ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
  };

  const triggerSuccessHaptic = () => {
    ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
  };

  const triggerErrorHaptic = () => {
    ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
  };

  // ✅ Get role-based navigation
  const handleRoleNavigation = () => {
    const roleData = ROLE_ICONS[userRole as keyof typeof ROLE_ICONS];
    triggerMediumHaptic();

    if (roleData) {
      navigation.navigate(roleData.route);
    } else {
      navigation.navigate('ShopDetails');
    }
  };

  // ✅ Fetch linked accounts
  const fetchLinkedAccounts = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      console.log('=========================================');
      console.log('📡 FETCHING LINKED ACCOUNTS');
      console.log('=========================================');

      if (!token) {
        console.error('❌ No token found');
        return;
      }

      const response = await fetch(
        'http://10.48.121.121:5000/api/v0/auth/linked-accounts',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch linked accounts');
      }

      const data = await response.json();
      console.log('📋 Raw Response:', JSON.stringify(data, null, 2));

      const accountsData = data.linkedAccounts || data.accounts || [];
      console.log(`📊 Found ${accountsData.length} accounts`);

      // ✅ Get current user ID from token
      const currentToken = await AsyncStorage.getItem('authToken');
      let currentUserIdFromToken = '';
      if (currentToken) {
        try {
          const decoded: any = jwtDecode(currentToken);
          currentUserIdFromToken =
            decoded.id || decoded.userId || decoded.sub || '';
        } catch (e) {
          console.error('Error decoding token:', e);
        }
      }

      const transformedAccounts: LinkedAccount[] = accountsData.map(
        (account: any, index: number) => {
          const userId = account.userId || account._id || `acc_${index}`;
          // ✅ Check if this account is the current one
          const isActive = userId === currentUserIdFromToken;

          return {
            id: userId,
            userId: userId,
            name: account.name || 'Unknown User',
            email: account.email || '',
            phone: account.phone || '',
            roles: account.roles || account.role || 'SELLER',
            isActive: isActive,
            isPrimary: account.isPrimary || false,
          };
        },
      );

      console.log(
        '🔄 Transformed Accounts:',
        JSON.stringify(transformedAccounts, null, 2),
      );

      setLinkedAccounts(transformedAccounts);
      console.log(`📊 Showing ${transformedAccounts.length} accounts`);
    } catch (error) {
      console.error('❌ Error fetching linked accounts:', error);
      triggerErrorHaptic();
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // ✅ Switch account API call with app refresh
  const switchAccount = async (accountId: string) => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      console.log(`🔄 Switching to account ID: ${accountId}`);

      if (!token) {
        console.error('❌ No token found');
        return;
      }

      const response = await fetch(
        'http://10.48.121.121:5000/api/v0/auth/switch-account',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accountId }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to switch account');
      }

      const data = await response.json();
      console.log('✅ Account switched:', data);

      if (data.token) {
        await AsyncStorage.setItem('authToken', data.token);
      }

      const decoded: any = jwtDecode(data.token || token);
      const newRole = decoded.role || decoded.roles || 'SELLER';
      const newUserId = decoded.id || decoded.userId || decoded.sub || '';
      setUserRole(newRole);
      setCurrentUserId(newUserId);

      triggerSuccessHaptic();
      setIsDrawerVisible(false);

      await fetchLinkedAccounts();

      // ✅ Refresh the app - reset navigation and reload
      Alert.alert(
        'Account Switched!',
        `Switched to ${data.account?.name || 'new account'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // ✅ Reset navigation to force app refresh
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    { name: 'BottomNavigator', params: { screen: 'Home' } },
                  ],
                }),
              );
            },
          },
        ],
      );
    } catch (error) {
      console.error('❌ Error switching account:', error);
      triggerErrorHaptic();
      Alert.alert('Error', 'Failed to switch account');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NEW: Double Tap Switch Account API with refresh
  const doubleTapSwitchAccount = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      console.log('=========================================');
      console.log('🔄 DOUBLE TAP SWITCH API CALLED');
      console.log('=========================================');

      if (!token) {
        console.error('❌ No token found');
        Alert.alert('Error', 'Please login again');
        return;
      }

      const response = await fetch(
        'http://10.48.121.121:5000/api/v0/auth/double-tap-switch',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to switch account');
      }

      const data = await response.json();
      console.log(
        '✅ Double Tap Switch Response:',
        JSON.stringify(data, null, 2),
      );

      // ✅ Store new token
      if (data.token) {
        await AsyncStorage.setItem('authToken', data.token);

        // ✅ Decode new token to get updated role
        const decoded: any = jwtDecode(data.token);
        const newRole = decoded.roles || decoded.role || 'SELLER';
        const newUserId = decoded.userId || decoded.id || '';
        console.log(`🎯 New role from token: ${newRole}`);
        setUserRole(newRole);
        setCurrentUserId(newUserId);
      }

      triggerSuccessHaptic();

      // ✅ Refresh accounts list
      await fetchLinkedAccounts();

      // ✅ Refresh the app
      Alert.alert(
        'Account Switched!',
        data.message || `Switched to ${data.account?.roles} account`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    { name: 'BottomNavigator', params: { screen: 'Home' } },
                  ],
                }),
              );
            },
          },
        ],
      );

      console.log('=========================================');
    } catch (error: any) {
      console.error('❌ Double tap switch error:', error);
      triggerErrorHaptic();

      if (error.message.includes('No other accounts')) {
        Alert.alert('Info', 'No other accounts available to switch');
      } else {
        Alert.alert('Error', error.message || 'Failed to switch account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Add Linked Account API Call
  const addLinkedAccount = async () => {
    if (!newAccountData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter account name');
      return;
    }

    if (!newAccountData.roles) {
      Alert.alert('Validation Error', 'Please select a role');
      return;
    }

    try {
      setIsAddingAccount(true);
      const token = await AsyncStorage.getItem('authToken');

      console.log('=========================================');
      console.log('📡 ADDING LINKED ACCOUNT');
      console.log('📦 Data:', newAccountData);
      console.log('=========================================');

      if (!token) {
        console.error('❌ No token found');
        Alert.alert('Error', 'Please login again');
        return;
      }

      const response = await fetch(
        'http://10.48.121.121:5000/api/v0/auth/add-linked-account',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newAccountData),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Failed to add account');
      }

      console.log('✅ Account added successfully:', data);
      triggerSuccessHaptic();

      setNewAccountData({
        name: '',
        email: '',
        phone: '',
        roles: 'SELLER',
      });

      setIsAddAccountModalVisible(false);
      await fetchLinkedAccounts();

      Alert.alert('Success', 'Account linked successfully!');
    } catch (error: any) {
      console.error('❌ Error adding account:', error);
      triggerErrorHaptic();
      Alert.alert('Error', error.message || 'Failed to add account');
    } finally {
      setIsAddingAccount(false);
    }
  };

  // ✅ Open drawer
  const openDrawer = async () => {
    await fetchLinkedAccounts();
    setIsDrawerVisible(true);
    triggerHeavyHaptic();
  };

  // ✅ Close drawer
  const closeDrawer = () => {
    setIsDrawerVisible(false);
  };

  // ✅ Profile press handler - UPDATED with Double Tap API
  const handleProfilePress = () => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastPressTime;

    if (timeDiff < 500) {
      // ✅ Double click detected - Call Double Tap API
      console.log('🔄 Double click detected - calling double-tap-switch API');
      doubleTapSwitchAccount();
      setLastPressTime(0);
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
    } else {
      setLastPressTime(currentTime);
      // Single press - navigate to profile
      const timer = setTimeout(() => {
        triggerMediumHaptic();
        setActiveTab('profile');
        navigation.navigate('Profile');
        setLastPressTime(0);
      }, 300);
      setPressTimer(timer);
    }
  };

  // ✅ Profile long press handler
  const handleLongPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    triggerHeavyHaptic();
    openDrawer();
  };

  // ✅ Render account item - FIXED colors and states
  const renderAccountItem = ({ item }: { item: LinkedAccount }) => {
    const roleKey = (item.roles || 'SELLER').toUpperCase();
    const roleColor =
      ROLE_COLORS[roleKey as keyof typeof ROLE_COLORS] || '#6B7280';
    const isActive = item.isActive || false;

    return (
      <TouchableOpacity
        style={[
          styles.accountItem,
          {
            backgroundColor: isActive
              ? isDark
                ? '#1E3A5F'
                : '#EFF6FF'
              : isDark
                ? 'rgba(255,255,255,0.05)'
                : '#FFFFFF',
            borderColor: isActive ? roleColor : isDark ? '#334155' : '#E5E7EB',
            borderWidth: isActive ? 3 : 1,
            opacity: isActive ? 1 : 0.8,
          },
        ]}
        onPress={() => {
          if (!isActive) {
            console.log(`🔄 Switching to: ${item.name}`);
            switchAccount(item.id);
          } else {
            triggerLightHaptic();
            Alert.alert(
              'Current Account',
              `You are currently using "${item.name}"`,
            );
          }
        }}
        disabled={isActive}
      >
        <View
          style={[
            styles.accountAvatar,
            {
              backgroundColor: isActive ? roleColor : roleColor + '20',
              borderWidth: isActive ? 2 : 0,
              borderColor: isActive ? '#FFFFFF' : 'transparent',
            },
          ]}
        >
          <Text
            style={[
              styles.accountAvatarText,
              {
                color: isActive ? '#FFFFFF' : roleColor,
                fontWeight: isActive ? '700' : '600',
              },
            ]}
          >
            {item.name?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.accountInfo}>
          <Text
            style={[
              styles.accountName,
              {
                color: isActive ? roleColor : themeColors.text,
                fontWeight: isActive ? '700' : '500',
              },
            ]}
          >
            {item.name || 'Unknown'}
            {isActive && ' (Current)'}
          </Text>
          <Text
            style={[styles.accountEmail, { color: themeColors.text + '80' }]}
          >
            {item.email || item.phone || 'No contact'}
          </Text>
          <View
            style={[
              styles.accountRoleBadge,
              {
                backgroundColor: isActive ? roleColor : roleColor + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.accountRoleText,
                {
                  color: isActive ? '#FFFFFF' : roleColor,
                  fontWeight: isActive ? '700' : '600',
                },
              ]}
            >
              {roleKey}
            </Text>
          </View>
        </View>
        {isActive && (
          <View style={styles.activeBadge}>
            <Feather name="check-circle" size={24} color={roleColor} />
          </View>
        )}
        {!isActive && (
          <View style={styles.switchBadge}>
            <Feather
              name="chevron-right"
              size={20}
              color={themeColors.text + '60'}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Dynamic colors based on theme
  const themeColors = {
    background: isDark ? '#1E293B' : '#ffffff',
    text: isDark ? '#F1F5F9' : '#6b7280',
    activeText: isDark ? '#60A5FA' : '#3b82f6',
    activeBg: isDark ? '#334155' : '#eff6ff',
    border: isDark ? '#334155' : '#e5e7eb',
    shadow: isDark ? '#000' : '#000',
    fabBg: isDark ? 'rgba(15, 23, 42, 1)' : 'rgba(241, 245, 249, 1)',
    fabIconColor: isDark ? '#60A5FA' : '#3b82f6',
    drawerBg: isDark ? '#1E293B' : '#FFFFFF',
    drawerText: isDark ? '#F1F5F9' : '#1F2937',
    inputBg: isDark ? '#334155' : '#F3F4F6',
    inputText: isDark ? '#F1F5F9' : '#1F2937',
    inputBorder: isDark ? '#475569' : '#D1D5DB',
  };

  const solidStyle = {
    backgroundColor: themeColors.background,
    borderWidth: 1,
    borderColor: themeColors.border,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  };

  const coloredSolidStyle = {
    backgroundColor: themeColors.fabBg,
    borderWidth: 1,
    borderColor: themeColors.border,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  };

  // ✅ Get role icon for FAB
  const getRoleFabIcon = () => {
    const roleData = ROLE_ICONS[userRole as keyof typeof ROLE_ICONS];
    return roleData?.icon || 'storefront';
  };

  return (
    <>
      <View
        style={[
          styles.bottomNav,
          solidStyle,
          {
            bottom: Math.max(insets.bottom, 16),
            left: Math.max(insets.left, 16),
            right: Math.max(insets.right, 16),
          },
        ]}
      >
        <View style={styles.navContent}>
          {/* Home Button */}
          <TouchableOpacity
            style={[
              styles.navButton,
              activeTab === 'home' && [
                styles.activeNavButton,
                { backgroundColor: themeColors.activeBg },
              ],
            ]}
            onPress={() => {
              triggerLightHaptic();
              setActiveTab('home');
              navigation.navigate('Home');
            }}
          >
            <View style={styles.navIconContainer}>
              <Image
                source={require('../../../assets/images/tizzy-logo.jpg')}
                style={styles.navIconImage}
              />
            </View>
          </TouchableOpacity>

          {/* Chat Button */}
          <TouchableOpacity
            style={[
              styles.navButton,
              activeTab === 'chat' && [
                styles.activeNavButton,
                { backgroundColor: themeColors.activeBg },
              ],
            ]}
            onPress={() => {
              triggerLightHaptic();
              setActiveTab('chat');
              navigation.navigate('Chat');
            }}
          >
            <View style={styles.navIconContainer}>
              <Image
                source={require('../../../assets/images/nex-logo.png')}
                style={styles.navIconImage}
              />
            </View>
          </TouchableOpacity>

          {/* Center FAB */}
          <View style={styles.fabContainer}>
            <TouchableOpacity
              style={[styles.fab, coloredSolidStyle]}
              onPress={handleRoleNavigation}
            >
              <MaterialIcon
                name={getRoleFabIcon()}
                size={26}
                color={themeColors.fabIconColor}
              />
            </TouchableOpacity>
          </View>

          {/* My Ads Button */}
          <TouchableOpacity
            style={[
              styles.navButton,
              activeTab === 'ads' && [
                styles.activeNavButton,
                { backgroundColor: themeColors.activeBg },
              ],
            ]}
            onPress={() => {
              triggerLightHaptic();
              setActiveTab('ads');
              navigation.navigate('MyAds');
            }}
          >
            <Feather
              name="bell"
              size={22}
              color={
                activeTab === 'ads'
                  ? isDark
                    ? '#60A5FA'
                    : '#3b82f6'
                  : themeColors.text
              }
            />
          </TouchableOpacity>

          {/* Profile Button */}
          <TouchableOpacity
            style={[
              styles.navButton,
              activeTab === 'profile' && [
                styles.activeNavButton,
                { backgroundColor: themeColors.activeBg },
              ],
            ]}
            onPress={handleProfilePress}
            onLongPress={handleLongPress}
            delayLongPress={600}
          >
            <Feather
              name="user"
              size={22}
              color={
                activeTab === 'profile'
                  ? isDark
                    ? '#60A5FA'
                    : '#3b82f6'
                  : themeColors.text
              }
            />
          </TouchableOpacity>
        </View>

        {/* Static Half Screen Drawer - NO GESTURE, ONLY SCROLLING ACCOUNTS */}
        <Modal
          visible={isDrawerVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={closeDrawer}
        >
          <View style={styles.modalContainer}>
            <Pressable style={styles.backdrop} onPress={closeDrawer} />

            <View
              style={[
                styles.drawer,
                {
                  height: drawerHeight,
                  backgroundColor: themeColors.drawerBg,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  borderColor: themeColors.border,
                },
              ]}
            >
              {/* Drag Handle - Just for visual, not draggable */}
              <View style={styles.dragHandleContainer}>
                <View
                  style={[
                    styles.dragHandle,
                    { backgroundColor: themeColors.border },
                  ]}
                />
                <Text
                  style={[
                    styles.drawerTitle,
                    { color: themeColors.drawerText },
                  ]}
                >
                  Switch Account
                </Text>
                <Text
                  style={[
                    styles.drawerSubtitle,
                    { color: themeColors.drawerText + '80' },
                  ]}
                >
                  {linkedAccounts.length > 0
                    ? `${
                        linkedAccounts.filter(a => a.isActive).length
                      } active, ${
                        linkedAccounts.filter(a => !a.isActive).length
                      } available`
                    : 'No accounts available'}
                </Text>
              </View>

              {/* Account List - ONLY THIS SCROLLS */}
              <View style={styles.accountListContainer}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text
                      style={{ color: themeColors.drawerText, marginTop: 10 }}
                    >
                      Loading accounts...
                    </Text>
                  </View>
                ) : linkedAccounts.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Feather
                      name="users"
                      size={48}
                      color={themeColors.drawerText + '40'}
                    />
                    <Text
                      style={[
                        styles.emptyText,
                        { color: themeColors.drawerText },
                      ]}
                    >
                      No linked accounts found
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={linkedAccounts}
                    keyExtractor={(item, index) => item.id + index}
                    renderItem={renderAccountItem}
                    contentContainerStyle={styles.accountList}
                    showsVerticalScrollIndicator={true}
                    style={styles.accountFlatList}
                    nestedScrollEnabled={true}
                    scrollEnabled={true}
                    bounces={true}
                  />
                )}
              </View>

              {/* Add Account Button */}
              <TouchableOpacity
                style={[
                  styles.addAccountButton,
                  { backgroundColor: '#3B82F6' },
                ]}
                onPress={() => {
                  triggerMediumHaptic();
                  setIsAddAccountModalVisible(true);
                }}
              >
                <Feather name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.addAccountButtonText}>
                  Add Linked Account
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>

      {/* Add Account Modal */}
      <Modal
        visible={isAddAccountModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAddAccountModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: themeColors.drawerBg,
                borderColor: themeColors.border,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { color: themeColors.drawerText }]}
              >
                Add Linked Account
              </Text>
              <TouchableOpacity
                onPress={() => setIsAddAccountModalVisible(false)}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color={themeColors.drawerText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text
                  style={[styles.inputLabel, { color: themeColors.drawerText }]}
                >
                  Account Name *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: themeColors.inputBg,
                      color: themeColors.inputText,
                      borderColor: themeColors.inputBorder,
                    },
                  ]}
                  placeholder="Enter account name"
                  placeholderTextColor={themeColors.drawerText + '60'}
                  value={newAccountData.name}
                  onChangeText={text =>
                    setNewAccountData(prev => ({ ...prev, name: text }))
                  }
                />
              </View>

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text
                  style={[styles.inputLabel, { color: themeColors.drawerText }]}
                >
                  Email (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: themeColors.inputBg,
                      color: themeColors.inputText,
                      borderColor: themeColors.inputBorder,
                    },
                  ]}
                  placeholder="Enter email address"
                  placeholderTextColor={themeColors.drawerText + '60'}
                  value={newAccountData.email}
                  onChangeText={text =>
                    setNewAccountData(prev => ({ ...prev, email: text }))
                  }
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Phone Input */}
              <View style={styles.inputGroup}>
                <Text
                  style={[styles.inputLabel, { color: themeColors.drawerText }]}
                >
                  Phone (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: themeColors.inputBg,
                      color: themeColors.inputText,
                      borderColor: themeColors.inputBorder,
                    },
                  ]}
                  placeholder="Enter phone number"
                  placeholderTextColor={themeColors.drawerText + '60'}
                  value={newAccountData.phone}
                  onChangeText={text =>
                    setNewAccountData(prev => ({ ...prev, phone: text }))
                  }
                  keyboardType="phone-pad"
                />
              </View>

              {/* Role Selection - NOW INCLUDES CAB */}
              <View style={styles.inputGroup}>
                <Text
                  style={[styles.inputLabel, { color: themeColors.drawerText }]}
                >
                  Role *
                </Text>
                <View style={styles.roleContainer}>
                  {ALLOWED_ROLES.map(roles => {
                    const roleColor =
                      ROLE_COLORS[roles as keyof typeof ROLE_COLORS] ||
                      '#6B7280';
                    const isSelected = newAccountData.roles === roles;
                    return (
                      <TouchableOpacity
                        key={roles}
                        style={[
                          styles.roleChip,
                          {
                            backgroundColor: isSelected
                              ? roleColor
                              : themeColors.inputBg,
                            borderColor: isSelected
                              ? roleColor
                              : themeColors.inputBorder,
                            borderWidth: 2,
                          },
                        ]}
                        onPress={() =>
                          setNewAccountData(prev => ({ ...prev, roles }))
                        }
                      >
                        <Text
                          style={[
                            styles.roleChipText,
                            {
                              color: isSelected
                                ? '#FFFFFF'
                                : themeColors.drawerText,
                            },
                          ]}
                        >
                          {ROLE_ICONS[roles as keyof typeof ROLE_ICONS]
                            ?.label || roles}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.cancelButton,
                    { backgroundColor: themeColors.inputBg },
                  ]}
                  onPress={() => setIsAddAccountModalVisible(false)}
                  disabled={isAddingAccount}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      { color: themeColors.drawerText },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.submitButton,
                    {
                      backgroundColor: isAddingAccount ? '#9CA3AF' : '#3B82F6',
                    },
                  ]}
                  onPress={addLinkedAccount}
                  disabled={isAddingAccount}
                >
                  {isAddingAccount ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalButtonText}>Add Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    borderRadius: 24,
    paddingVertical: 8,
    zIndex: 1000,
    elevation: 50,
  },
  navContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 48,
    borderRadius: 16,
    gap: 4,
  },
  activeNavButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    transform: [{ scale: 1.1 }],
  },
  navIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    overflow: 'hidden',
  },
  navIconImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  fabContainer: {
    position: 'relative',
    alignItems: 'center',
    marginTop: -30,
    zIndex: 1001,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1002,
    flexDirection: 'column',
    gap: 2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    position: 'relative',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  drawerSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  accountListContainer: {
    flex: 1,
    minHeight: 150,
    maxHeight: 300,
  },
  accountFlatList: {
    flex: 1,
  },
  accountList: {
    paddingBottom: 10,
    paddingTop: 5,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  accountAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  accountAvatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: 13,
    marginBottom: 4,
  },
  accountRoleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  accountRoleText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  activeBadge: {
    marginLeft: 8,
  },
  switchBadge: {
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 16,
    marginTop: 8,
    gap: 8,
  },
  addAccountButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  roleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  roleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
  },
  roleChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  submitButton: {
    elevation: 2,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default BottomNavigation;
