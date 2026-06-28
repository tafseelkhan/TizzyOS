// screens/fws/EmployeeDetailScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { EmployeeService } from '../../../../services/fws/employeeServices';

interface EmployeeDetailScreenProps {
  navigation: any;
  route: {
    params: {
      name: string;
      role: string;
    };
  };
}

interface EmployeeDetail {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  fwsCode: string;
  isActive: boolean;
  joiningDate: string;
  address?: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    phone: string;
  };
}

const EmployeeDetailScreen: React.FC<EmployeeDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { name, role } = route.params;
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);

  useEffect(() => {
    fetchEmployeeDetail();
  }, []);

  const fetchEmployeeDetail = async () => {
    try {
      setLoading(true);
      console.log('📤 Fetching employee detail with:', { name, role });

      // ✅ API call with name and role
      const response = await EmployeeService.getEmployeeByNameAndRole(
        name,
        role,
      );

      console.log('📥 Response:', response);

      if (response.success && response.data && response.data.length > 0) {
        setEmployee(response.data[0]);
      } else {
        Alert.alert('Error', 'Employee not found');
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('Error fetching employee detail:', error);
      Alert.alert('Error', error.message || 'Failed to fetch employee details');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      MANAGER: '#2563EB',
      SUPERVISOR: '#7C3AED',
      SCANNER: '#059669',
      PACKER: '#D97706',
      DISPATCHER: '#DC2626',
    };
    return colors[role] || '#6B7280';
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? '#10B981' : '#EF4444';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading employee details...</Text>
      </SafeAreaView>
    );
  }

  if (!employee) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Employee not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backIcon}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Employee Details</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {employee.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{employee.name}</Text>
          <View
            style={[
              styles.roleBadgeLarge,
              { backgroundColor: getRoleColor(employee.role) },
            ]}
          >
            <Text style={styles.roleBadgeLargeText}>{employee.role}</Text>
          </View>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusDotLarge,
                { backgroundColor: getStatusColor(employee.isActive) },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(employee.isActive) },
              ]}
            >
              {employee.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Personal Information</Text>

          <View style={styles.detailItem}>
            <Icon name="email" size={20} color="#6B7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{employee.email}</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Icon name="phone" size={20} color="#6B7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{employee.phone}</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Icon name="store" size={20} color="#6B7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>FWS Code</Text>
              <Text style={styles.detailValue}>{employee.fwsCode}</Text>
            </View>
          </View>

          {employee.address && (
            <View style={styles.detailItem}>
              <Icon name="home" size={20} color="#6B7280" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>{employee.address}</Text>
              </View>
            </View>
          )}

          <View style={styles.detailItem}>
            <Icon name="calendar-today" size={20} color="#6B7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Joining Date</Text>
              <Text style={styles.detailValue}>
                {new Date(employee.joiningDate).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* User Info Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>User Information</Text>

          <View style={styles.detailItem}>
            <Icon name="person" size={20} color="#6B7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{employee.userId.name}</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Icon name="email" size={20} color="#6B7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{employee.userId.email}</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Icon name="phone" size={20} color="#6B7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{employee.userId.phone}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#475569',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backIcon: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarLargeText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2563EB',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
  },
  roleBadgeLarge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  roleBadgeLargeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    paddingLeft: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
    marginTop: 2,
  },
});

export default EmployeeDetailScreen;
