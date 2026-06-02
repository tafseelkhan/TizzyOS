// screens/SettingsScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  TouchableOpacity,
  Modal,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import LottieView from 'lottie-react-native';
import { SettingsItem } from './SettingItem';
import {
  SettingsItem as SettingsItemType,
  ThemeMode,
  ProfileData,
} from '../../types/settings';
import { useTheme } from '../../contexts/theme/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

const getImageUrl = (image?: string): string => {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  return '';
};

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme, setTheme, isDark, resolvedTheme } = useTheme();
  const [previewImage, setPreviewImage] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [themeModal, setThemeModal] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [currency, setCurrency] = useState('INR');
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const lottieRef = useRef<LottieView>(null);

  // Profile fetch function
  useEffect(() => {
    fetchProfile();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Refresh profile when screen comes into focus
      fetchProfile();
    }, []),
  );

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      const response = await fetch('http://172.20.10.12:5000/api/profile/me', {
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
        setPreviewImage(normalized);
        setImageError(false);
      } else {
        console.error(
          'Error fetching profile:',
          data?.message ?? 'Unknown error',
        );
        Alert.alert('Error', 'Failed to load profile data');
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Custom icons
  const Sparkles = () => (
    <MaterialCommunityIcons name="star-four-points" size={24} color="#FFD700" />
  );
  const UserPlus = () => <Feather name="user-plus" size={24} color="#4CAF50" />;
  const GitPullRequestIcon = () => (
    <Feather name="git-pull-request" size={24} color="#FF5722" />
  );

  const handleItemPress = (segment: string) => {
    console.log('Navigating to:', segment);
    if (segment) {
      navigation.navigate(segment as never);
    }
  };

  const handleBiometricToggle = (value: boolean) => {
    setBiometric(value);
    if (value) {
      navigation.navigate('Security' as never);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' as never }],
          });
        },
      },
    ]);
  };

  // Theme display value with system mode
  const getThemeDisplayValue = () => {
    if (theme === 'system') {
      return `System Default (${resolvedTheme})`;
    }
    return theme === 'light' ? 'Light Mode' : 'Dark Mode';
  };

  const handleThemeSelect = async (selectedTheme: ThemeMode) => {
    try {
      await setTheme(selectedTheme);
      setThemeModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update theme');
    }
  };

  const ThemeOption = ({
    mode,
    label,
    icon,
    description,
  }: {
    mode: ThemeMode;
    label: string;
    icon: string;
    description?: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.themeOption,
        theme === mode && styles.themeOptionSelected,
        {
          backgroundColor: isDark
            ? theme === mode
              ? '#2D3748'
              : '#1E293B'
            : theme === mode
            ? '#F1F5F9'
            : 'transparent',
          borderColor: theme === mode ? '#6366F1' : 'transparent',
        },
      ]}
      onPress={() => handleThemeSelect(mode)}
    >
      <View style={styles.themeOptionContent}>
        <View style={styles.themeOptionHeader}>
          <Icon
            name={icon as any}
            size={24}
            color={theme === mode ? '#6366F1' : isDark ? '#94A3B8' : '#64748B'}
          />
          <Text
            style={[
              styles.themeText,
              {
                color:
                  theme === mode ? '#6366F1' : isDark ? '#F1F5F9' : '#1E293B',
                fontWeight: theme === mode ? '600' : '500',
              },
            ]}
          >
            {label}
          </Text>
          {theme === mode && (
            <Icon name="check-circle" size={20} color="#6366F1" />
          )}
        </View>
        {description && (
          <Text
            style={[
              styles.themeDescription,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Settings data WITH VALUES for all buttons
  const settingsData: SettingsItemType[] = [
    {
      kind: 'header',
      title: 'AI & Preferences',
    } as SettingsItemType,
    {
      segment: `xai-nexmind/tizzygo`,
      title: 'XAI-NexMind',
      icon: <Sparkles />,
      value: 'AI Assistant',
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
    },
    {
      segment: ``,
      title: 'Appearance',
      icon: <Icon name="palette" size={24} color="#6366F1" />,
      value: getThemeDisplayValue(),
      onPress: () => setThemeModal(true),
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
    },
    { kind: 'divider' } as SettingsItemType,
    {
      kind: 'header',
      title: 'Business Tools',
    } as SettingsItemType,
    {
      segment: ``,
      title: 'Appointments',
      icon: <Icon name="event-note" size={24} color="#2196F3" />,
      value: 'Manage bookings',
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
      children: [
        {
          segment: `appointments`,
          title: 'My Appointments',
          icon: <Icon name="ballot" size={24} color="#FF9800" />,
          value: 'View all',
          rightElement: (
            <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
          ),
        },
        {
          segment: `apply`,
          title: 'Apply Appointment',
          icon: <Icon name="approval" size={24} color="#4CAF50" />,
          value: 'New booking',
          rightElement: (
            <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
          ),
        },
        {
          segment: `calendar/history`,
          title: 'Calendar & History',
          icon: <Icon name="insert-invitation" size={24} color="#E91E63" />,
          value: 'Schedule',
          rightElement: (
            <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
          ),
        },
        {
          segment: `appointments/requests`,
          title: 'Appointment Requests',
          icon: <GitPullRequestIcon />,
          value: 'Pending',
          rightElement: (
            <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
          ),
        },
      ],
    },
    {
      segment: `/seller-payment`,
      title: 'Payout & Earnings',
      icon: <Icon name="attach-money" size={24} color="#4CAF50" />,
      value: 'View balance',
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
    },
    {
      segment: `pricing-guide`,
      title: 'Pricing Guide',
      icon: <Icon name="monetization-on" size={24} color="#FFC107" />,
      value: 'Rate cards',
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
    },
    {
      segment: ``,
      title: 'Invoice Management',
      icon: <Icon name="receipt" size={24} color="#795548" />,
      value: 'Billing',
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
      children: [
        {
          segment: `invoice`,
          title: 'All Invoices',
          icon: <Icon name="insert-drive-file" size={24} color="#607D8B" />,
          value: 'History',
          rightElement: (
            <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
          ),
        },
        {
          segment: `invoice/create`,
          title: 'Create Invoice',
          icon: <Icon name="add-circle" size={24} color="#10B981" />,
          value: 'New bill',
          rightElement: (
            <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
          ),
        },
      ],
    },
    {
      segment: ``,
      title: 'Vacancy & Hiring',
      icon: <UserPlus />,
      value: 'Recruitment',
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
      children: [
        {
          segment: `/Create-Vacancy`,
          title: 'Create Vacancy',
          icon: <Icon name="post-add" size={24} color="#2196F3" />,
          value: 'New job',
          rightElement: (
            <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
          ),
        },
        {
          segment: `Vacancies`,
          title: 'View Vacancies',
          icon: <Icon name="work-outline" size={24} color="#FF9800" />,
          value: 'Open positions',
          rightElement: (
            <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
          ),
        },
        {
          segment: `Vacancy-Reviews`,
          title: 'Vacancy Reviews',
          icon: <Icon name="reviews" size={24} color="#9C27B0" />,
          value: 'Applications',
          rightElement: (
            <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
          ),
        },
      ],
    },
    { kind: 'divider' } as SettingsItemType,
    {
      kind: 'header',
      title: 'Security & Account',
    } as SettingsItemType,
    {
      segment: `security`,
      title: 'Security Settings',
      icon: <Icon name="security" size={24} color="#EF4444" />,
      value: 'Privacy',
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
    },
    {
      segment: `privacy`,
      title: 'Privacy Policy',
      icon: <Icon name="privacy-tip" size={24} color="#6B7280" />,
      value: 'Legal',
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
    },
    {
      segment: `help`,
      title: 'Help & Support',
      icon: <Icon name="help-center" size={24} color="#8B5CF6" />,
      value: 'Contact us',
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
    },
    {
      segment: `about`,
      title: 'About App',
      icon: <Icon name="info" size={24} color="#06B6D4" />,
      value: 'Version 2.4.1',
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
    },
    {
      segment: ``,
      title: 'Logout',
      icon: <Icon name="logout" size={24} color="#F44336" />,
      value: 'Sign out',
      onPress: handleLogout,
      rightElement: (
        <Icon name="keyboard-arrow-right" size={24} color="#64748B" />
      ),
    },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' },
      ]}
    >
      {/* Header with Profile Image and Back Button */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? '#1E293B' : 'white',
            shadowColor: isDark ? '#000' : '#000',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon
            name="arrow-back"
            size={24}
            color={isDark ? '#F1F5F9' : '#1E293B'}
          />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? '#F1F5F9' : '#1E293B' },
            ]}
          >
            Settings
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            Manage your business preferences
          </Text>
        </View>

        <TouchableOpacity style={styles.profileImageContainer}>
          {profileData?.image && !imageError ? (
            <Image
              source={{ uri: profileData.image }}
              style={styles.profileImage}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.lottieContainer}>
              <LottieView
                ref={lottieRef}
                source={require('../animations/lotties/Login icon (1).json')}
                style={styles.lottieAnimation}
                autoPlay={true}
                loop={true}
                resizeMode="contain"
              />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text
            style={[
              styles.quickActionsTitle,
              { color: isDark ? '#F1F5F9' : '#1E293B' },
            ]}
          >
            Quick Actions
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? '#1E293B' : 'white',
                  shadowColor: isDark ? '#000' : '#000',
                },
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: isDark ? '#334155' : '#FFFBEB' },
                ]}
              >
                <Icon name="dashboard" size={24} color="#F59E0B" />
              </View>
              <Text
                style={[
                  styles.actionText,
                  { color: isDark ? '#F1F5F9' : '#1E293B' },
                ]}
              >
                Dashboard
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? '#1E293B' : 'white',
                  shadowColor: isDark ? '#000' : '#000',
                },
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: isDark ? '#334155' : '#F0FDF4' },
                ]}
              >
                <Icon name="analytics" size={24} color="#10B981" />
              </View>
              <Text
                style={[
                  styles.actionText,
                  { color: isDark ? '#F1F5F9' : '#1E293B' },
                ]}
              >
                Analytics
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? '#1E293B' : 'white',
                  shadowColor: isDark ? '#000' : '#000',
                },
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: isDark ? '#334155' : '#EFF6FF' },
                ]}
              >
                <Icon name="inventory" size={24} color="#3B82F6" />
              </View>
              <Text
                style={[
                  styles.actionText,
                  { color: isDark ? '#F1F5F9' : '#1E293B' },
                ]}
              >
                Inventory
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings List */}
        {settingsData.map((item, index) => (
          <SettingsItem
            key={index}
            item={item}
            onItemPress={handleItemPress}
            isDark={isDark}
          />
        ))}

        {/* Toggle Settings */}
        <View
          style={[
            styles.toggleContainer,
            {
              backgroundColor: isDark ? '#1E293B' : 'white',
              shadowColor: isDark ? '#000' : '#000',
            },
          ]}
        >
          <View style={styles.toggleItem}>
            <View style={styles.toggleLeft}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: isDark ? '#334155' : '#FEF3F2' },
                ]}
              >
                <Icon name="notifications" size={24} color="#DC2626" />
              </View>
              <View>
                <Text
                  style={[
                    styles.toggleTitle,
                    { color: isDark ? '#F1F5F9' : '#1E293B' },
                  ]}
                >
                  Push Notifications
                </Text>
                <Text
                  style={[
                    styles.toggleSubtitle,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Order updates & reminders
                </Text>
              </View>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{
                false: isDark ? '#374151' : '#E5E7EB',
                true: '#10B981',
              }}
              thumbColor={notifications ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>

          <View style={styles.toggleItem}>
            <View style={styles.toggleLeft}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: isDark ? '#334155' : '#FEF7CD' },
                ]}
              >
                <Icon name="fingerprint" size={24} color="#D97706" />
              </View>
              <View>
                <Text
                  style={[
                    styles.toggleTitle,
                    { color: isDark ? '#F1F5F9' : '#1E293B' },
                  ]}
                >
                  Biometric Login
                </Text>
                <Text
                  style={[
                    styles.toggleSubtitle,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Use fingerprint or face ID
                </Text>
              </View>
            </View>
            <Switch
              value={biometric}
              onValueChange={handleBiometricToggle}
              trackColor={{
                false: isDark ? '#374151' : '#E5E7EB',
                true: '#10B981',
              }}
              thumbColor={biometric ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text
            style={[
              styles.appVersion,
              { color: isDark ? '#94A3B8' : '#94A3B8' },
            ]}
          >
            Version 2.4.1
          </Text>
          <Text
            style={[
              styles.appCopyright,
              { color: isDark ? '#64748B' : '#CBD5E1' },
            ]}
          >
            © 2024 XAI-NexMind. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      {/* Theme Modal */}
      <Modal
        visible={themeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setThemeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? '#1E293B' : 'white',
                maxHeight: '50%',
                minHeight: 320,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? '#F1F5F9' : '#1E293B' },
                ]}
              >
                Select Theme
              </Text>
              <TouchableOpacity onPress={() => setThemeModal(false)}>
                <Icon
                  name="close"
                  size={24}
                  color={isDark ? '#94A3B8' : '#64748B'}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              <ThemeOption
                mode="light"
                label="Light Mode"
                icon="light-mode"
                description="Always use light theme"
              />
              <ThemeOption
                mode="dark"
                label="Dark Mode"
                icon="dark-mode"
                description="Always use dark theme"
              />
              <ThemeOption
                mode="system"
                label="System Default"
                icon="computer"
                description={`Follow your device theme (${resolvedTheme})`}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  profileImageContainer: {
    marginLeft: 16,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  lottieContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  lottieAnimation: {
    width: 60,
    height: 60,
  },
  scrollView: {
    flex: 1,
  },
  quickActions: {
    padding: 20,
    paddingBottom: 0,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
    padding: 12,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  toggleContainer: {
    margin: 16,
    borderRadius: 16,
    padding: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 14,
  },
  appInfo: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 32,
  },
  appVersion: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalScrollView: {
    flex: 1,
  },
  themeOption: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionSelected: {
    borderColor: '#6366F1',
  },
  themeOptionContent: {
    flex: 1,
  },
  themeOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  themeText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  themeDescription: {
    fontSize: 14,
    marginLeft: 36,
    marginTop: 2,
  },
});

export default SettingsScreen;
