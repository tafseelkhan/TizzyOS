// SettingsScreen.tsx - FIXED VERSION

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
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';
import { SettingsItem } from './SettingItem';
import {
  SettingsItem as SettingsItemType,
  ThemeMode,
  ProfileData,
} from '../../types/Settings';
import { useTheme } from '../../contexts/theme/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { profileApi } from '../../../api/features/private/profilePrivateSlice';

// Helper function to get image URL
const getImageUrl = (image?: string): string => {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads')) {
    return `http://your-server-url:5000${image}`; // Apne server URL se replace karo
  }
  return image;
};

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    theme,
    setTheme,
    isDark,
    resolvedTheme,
    loading: themeLoading,
  } = useTheme();
  const [previewImage, setPreviewImage] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [themeModal, setThemeModal] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await profileApi.getProfile();

      console.log('✅ Profile data received:', JSON.stringify(data, null, 2));

      // ✅ Profile data set karo
      if (data) {
        const profile: ProfileData = {
          _id: data.userId || data._id || '',
          name: data.name || '',
          image: data.image || '',
          email: data.email || '',
          phone: data.phone || '',
          joinDate: data.joinDate || new Date().toISOString(),
          verified: data.verified || false,
        };

        setProfileData(profile);

        // ✅ Image set karo
        const imageUrl = getImageUrl(profile.image);
        console.log('🖼️ Setting image URL:', imageUrl);
        setPreviewImage(imageUrl);
      } else {
        throw new Error('Invalid profile data received');
      }
    } catch (error: any) {
      console.error('❌ Profile fetch error:', error);
      Alert.alert('Error', error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const Sparkles = () => (
    <MaterialCommunityIcon name="star-four-points" size={24} color="#FFD700" />
  );

  const handleItemPress = (segment: string) => {
    if (segment === 'security') {
      navigation.navigate('Security' as never);
    } else if (segment === 'privacy') {
      navigation.navigate('Privacy' as never);
    } else if (segment === 'help') {
      navigation.navigate('Help' as never);
    } else if (segment === 'about') {
      navigation.navigate('About' as never);
    } else if (segment === 'YourOrders') {
      navigation.navigate('YourOrders' as never);
    } else {
      console.log('Navigating to:', segment);
      Alert.alert('Info', `Feature coming soon: ${segment}`);
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
          try {
            await AsyncStorage.multiRemove([
              'authToken',
              'userData',
              'app-theme',
            ]);
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' as never }],
            });
          } catch (error) {
            console.error('Logout error:', error);
          }
        },
      },
    ]);
  };

  const getThemeDisplayValue = () => {
    if (theme === 'system') {
      return `System (${resolvedTheme})`;
    }
    return theme === 'light' ? 'Light' : 'Dark';
  };

  const handleThemeSelect = async (selectedTheme: ThemeMode) => {
    await setTheme(selectedTheme);
    setThemeModal(false);
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
          backgroundColor: isDark ? '#2D3748' : '#F8FAFC',
          borderColor: theme === mode ? '#6366F1' : 'transparent',
        },
      ]}
      onPress={() => handleThemeSelect(mode)}
      disabled={themeLoading}
    >
      <View style={styles.themeOptionContent}>
        <View style={styles.themeOptionHeader}>
          <Icon
            name={icon}
            size={24}
            color={theme === mode ? '#6366F1' : isDark ? '#94A3B8' : '#64748B'}
          />
          <Text
            style={[
              styles.themeText,
              {
                color: isDark
                  ? theme === mode
                    ? '#6366F1'
                    : '#F1F5F9'
                  : theme === mode
                  ? '#6366F1'
                  : '#1E293B',
              },
            ]}
          >
            {label}
          </Text>
          {theme === mode && (
            <Icon name="check-circle" size={20} color="#6366F1" />
          )}
          {themeLoading && theme === mode && (
            <ActivityIndicator
              size="small"
              color="#6366F1"
              style={{ marginLeft: 8 }}
            />
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
        <Icon
          name="keyboard-arrow-right"
          size={24}
          color={isDark ? '#94A3B8' : '#64748B'}
        />
      ),
    },
    {
      segment: ``,
      title: 'Appearance',
      icon: <Icon name="palette" size={24} color="#6366F1" />,
      value: getThemeDisplayValue(),
      onPress: () => setThemeModal(true),
      rightElement: themeLoading ? (
        <ActivityIndicator size="small" color="#6366F1" />
      ) : (
        <Icon
          name="keyboard-arrow-right"
          size={24}
          color={isDark ? '#94A3B8' : '#64748B'}
        />
      ),
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
      value: 'Do have any changes. Please enter your issue here!',
      rightElement: (
        <Icon
          name="keyboard-arrow-right"
          size={24}
          color={isDark ? '#94A3B8' : '#64748B'}
        />
      ),
    },
    {
      segment: `privacy`,
      title: 'Privacy Policy',
      icon: <Icon name="privacy-tip" size={24} color="#6B7280" />,
      value: 'Did You have any questions? Click this.',
      rightElement: (
        <Icon
          name="keyboard-arrow-right"
          size={24}
          color={isDark ? '#94A3B8' : '#64748B'}
        />
      ),
    },
    {
      segment: `YourOrders`,
      title: 'Your Orders',
      icon: <FeatherIcon name="shopping-bag" size={24} color="#10B981" />,
      value: "'Orders History' will be there!",
      rightElement: (
        <Icon
          name="keyboard-arrow-right"
          size={24}
          color={isDark ? '#94A3B8' : '#64748B'}
        />
      ),
    },
    {
      segment: `help`,
      title: 'Help & Support',
      icon: <Icon name="help-center" size={24} color="#8B5CF6" />,
      value: 'Contact us',
      rightElement: (
        <Icon
          name="keyboard-arrow-right"
          size={24}
          color={isDark ? '#94A3B8' : '#64748B'}
        />
      ),
    },
    {
      segment: `about`,
      title: 'About App',
      icon: <Icon name="info" size={24} color="#06B6D4" />,
      value: 'Version 2.4.1',
      rightElement: (
        <Icon
          name="keyboard-arrow-right"
          size={24}
          color={isDark ? '#94A3B8' : '#64748B'}
        />
      ),
    },
    {
      segment: ``,
      title: 'Logout',
      icon: <Icon name="logout" size={24} color="#F44336" />,
      value: 'Sign out',
      onPress: handleLogout,
      rightElement: (
        <Icon
          name="keyboard-arrow-right"
          size={24}
          color={isDark ? '#94A3B8' : '#64748B'}
        />
      ),
    },
  ];

  // ✅ Render profile image component
  const renderProfileImage = () => {
    if (loading) {
      return (
        <View
          style={[
            styles.profileIcon,
            { backgroundColor: isDark ? '#334155' : '#F1F5F9' },
          ]}
        >
          <ActivityIndicator
            size="small"
            color={isDark ? '#94A3B8' : '#6366F1'}
          />
        </View>
      );
    }

    // ✅ Agar image hai to dikhao
    if (previewImage && previewImage !== '' && !imageError) {
      return (
        <Image
          source={{ uri: previewImage }}
          style={styles.profileImage}
          onError={() => {
            console.log('❌ Image load error:', previewImage);
            setImageError(true);
          }}
        />
      );
    }

    // ✅ Fallback - Lottie animation
    return (
      <View
        style={[
          styles.profileIcon,
          {
            backgroundColor: isDark ? '#334155' : '#F1F5F9',
            overflow: 'hidden',
          },
        ]}
      >
        <LottieView
          ref={animationRef}
          source={require('../animations/lotties/Login icon (1).json')}
          style={styles.lottieAnimation}
          autoPlay={true}
          loop={true}
        />
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' },
      ]}
    >
      {/* Header with Back Button */}
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
            Manage your preferences
          </Text>
        </View>

        <TouchableOpacity
          style={styles.profileImageContainer}
          onPress={() => navigation.navigate('Profile' as never)}
        >
          {renderProfileImage()}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {settingsData.map((item, index) => (
          <SettingsItem
            key={index}
            item={item}
            onItemPress={handleItemPress}
            isDark={isDark}
          />
        ))}

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
              thumbColor={
                notifications ? '#FFFFFF' : isDark ? '#94A3B8' : '#F1F5F9'
              }
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
              thumbColor={
                biometric ? '#FFFFFF' : isDark ? '#94A3B8' : '#F1F5F9'
              }
            />
          </View>
        </View>

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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: { flex: 1 },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  profileImageContainer: { marginLeft: 16 },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  profileIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottieAnimation: {
    width: 50,
    height: 50,
  },
  scrollView: { flex: 1, paddingTop: 10 },
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
  toggleSubtitle: { fontSize: 14 },
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
  modalScrollView: { flex: 1 },
  themeOption: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
  },
  themeOptionSelected: {},
  themeOptionContent: { flex: 1 },
  themeOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  themeText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  themeDescription: {
    fontSize: 14,
    marginLeft: 36,
    marginTop: 2,
  },
});

export default SettingsScreen;
