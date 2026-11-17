// EditProfileScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/theme/ThemeContext';

import { updateAppRole } from '../../../api/features/public/authPublicSlice';
import { ApiError } from '../../../core/utils/handler/apiClient';

// ============================================================
// CONSTANTS
// ============================================================

const TIZZYOS_ROLES = ['SELLER', 'FWS', 'SHIPPING', 'CAB', 'RENT'] as const;
type TizzyosRole = (typeof TIZZYOS_ROLES)[number];

const APP_NAME = 'TIZZYOS';

// ============================================================
// COMPONENT
// ============================================================

function EditProfileScreen() {
  const { isDark } = useTheme();
  const navigation = useNavigation();

  // Multi-select role state
  const [selectedRoles, setSelectedRoles] = useState<TizzyosRole[]>([]);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ===== Colors =====
  const backgroundColor = isDark ? '#1E293B' : '#f9fafb';
  const textColor = isDark ? '#F1F5F9' : '#1f2937';
  const subtitleColor = isDark ? '#94A3B8' : '#6b7280';
  const cardBackground = isDark ? '#1E293B' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const inputBackground = isDark ? '#374151' : '#f9fafb';
  const inputBorder = isDark ? '#475569' : '#d1d5db';
  const gradientColors: string[] = isDark
    ? ['#1E293B', '#1E293B', '#1E293B']
    : ['#f9fafb', '#f9fafb', '#f9fafb'];
  const buttonGradient: string[] = isDark
    ? ['#7C3AED', '#6D28D9']
    : ['#8b5cf6', '#3b82f6'];
  const errorBackground = isDark ? '#7f1d1d' : '#fef2f2';
  const errorBorder = isDark ? '#991b1b' : '#fecaca';
  const successBackground = isDark ? '#14532d' : '#f0fdf4';
  const successBorder = isDark ? '#166534' : '#bbf7d0';

  // ============================================================
  // TOGGLE ROLE
  // ============================================================
  const toggleRole = (role: TizzyosRole) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role],
    );
    setError('');
    setSuccess('');
  };

  // ============================================================
  // UPDATE APP ROLE
  // ============================================================
  const handleUpdateAppRole = async () => {
    if (selectedRoles.length === 0) {
      setError('Please select at least one role.');
      return;
    }

    setIsUpdatingRole(true);
    setError('');
    setSuccess('');

    try {
      const result = await updateAppRole({
        app: APP_NAME,
        roles: selectedRoles,
      });

      if (result.success) {
        setSuccess(
          result.message ||
            `${APP_NAME} roles updated to [${selectedRoles.join(', ')}]`,
        );
      } else {
        setError(result.message || 'Failed to update roles');
      }
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Network error. Please try again.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon
              name="arrow-back"
              size={24}
              color={isDark ? '#94A3B8' : '#6b7280'}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>
            Edit Profile
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Messages */}
        {error ? (
          <View
            style={[
              styles.errorMessage,
              { backgroundColor: errorBackground, borderColor: errorBorder },
            ]}
          >
            <Text
              style={[
                styles.errorText,
                { color: isDark ? '#FCA5A5' : '#dc2626' },
              ]}
            >
              {error}
            </Text>
          </View>
        ) : null}
        {success ? (
          <View
            style={[
              styles.successMessage,
              { backgroundColor: successBackground, borderColor: successBorder },
            ]}
          >
            <Text
              style={[
                styles.successText,
                { color: isDark ? '#86EFAC' : '#16a34a' },
              ]}
            >
              {success}
            </Text>
          </View>
        ) : null}

        {/* ============ APP ROLE CARD ============ */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: cardBackground, borderColor: cardBorder },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            🎭 {APP_NAME} Roles
          </Text>
          <Text style={[styles.sectionSubtitle, { color: subtitleColor }]}>
            Select one or more roles. You can pick as many as you need.
          </Text>

          {/* Role chips */}
          <View style={styles.chipRow}>
            {TIZZYOS_ROLES.map(role => {
              const isSelected = selectedRoles.includes(role);
              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? '#8b5cf6' : inputBackground,
                      borderColor: isSelected ? '#8b5cf6' : inputBorder,
                    },
                  ]}
                  onPress={() => toggleRole(role)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      color: isSelected ? '#fff' : textColor,
                      fontWeight: '600',
                    }}
                  >
                    {role}
                  </Text>
                  {isSelected && (
                    <Icon
                      name="check"
                      size={14}
                      color="#fff"
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected summary */}
          {selectedRoles.length > 0 && (
            <Text style={[styles.selectedSummary, { color: subtitleColor }]}>
              Selected: {selectedRoles.join(', ')}
            </Text>
          )}

          {/* Update button */}
          <TouchableOpacity
            onPress={handleUpdateAppRole}
            disabled={isUpdatingRole || selectedRoles.length === 0}
            style={[
              styles.primaryButton,
              (isUpdatingRole || selectedRoles.length === 0) && {
                opacity: 0.5,
              },
            ]}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={buttonGradient}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {isUpdatingRole ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                🔄 Update {APP_NAME} Roles
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  sectionCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  selectedSummary: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorMessage: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  successMessage: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomSpacer: { height: 40 },
});

export default EditProfileScreen;