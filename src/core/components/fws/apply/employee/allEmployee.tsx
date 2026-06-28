// screens/fws/EmployeeListScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TextInput,
  RefreshControl,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { EmployeeService } from '../../../../services/fws/employeeServices';

const { width, height } = Dimensions.get('window');

interface EmployeeScreenProps {
  navigation: any;
}

interface Employee {
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

const EmployeeListScreen: React.FC<EmployeeScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchAllEmployees();
  }, []);

  const fetchAllEmployees = async () => {
    try {
      setLoading(true);
      const response = await EmployeeService.getAllEmployees();

      if (response.success) {
        setEmployees(response.data || []);
        setFilteredEmployees(response.data || []);
      } else {
        Alert.alert('Error', response.message || 'Failed to fetch employees');
      }
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      Alert.alert('Error', error.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllEmployees();
    setRefreshing(false);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    filterEmployees(text, selectedRole);
  };

  const handleRoleFilter = (role: string) => {
    setSelectedRole(role);
    filterEmployees(searchQuery, role);
  };

  const filterEmployees = (query: string, role: string) => {
    let filtered = employees;

    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(
        emp =>
          emp.name.toLowerCase().includes(lowerQuery) ||
          emp.email.toLowerCase().includes(lowerQuery) ||
          emp.role.toLowerCase().includes(lowerQuery) ||
          emp.fwsCode.toLowerCase().includes(lowerQuery),
      );
    }

    if (role !== 'ALL') {
      filtered = filtered.filter(emp => emp.role === role);
    }

    setFilteredEmployees(filtered);
  };

  const handleEmployeePress = (employee: Employee) => {
    navigation.navigate('EmployeeDetail', {
      employeeId: employee._id,
      name: employee.name,
      role: employee.role,
    });
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      MANAGER: '#4F46E5',
      SUPERVISOR: '#7C3AED',
      SCANNER: '#059669',
      PACKER: '#D97706',
      DISPATCHER: '#DC2626',
    };
    return colors[role] || '#6B7280';
  };

  const getRoleIcon = (role: string) => {
    const icons: { [key: string]: string } = {
      MANAGER: 'supervisor-account',
      SUPERVISOR: 'verified-user',
      SCANNER: 'qr-code-scanner',
      PACKER: 'inventory',
      DISPATCHER: 'local-shipping',
    };
    return icons[role] || 'person';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatPhoneNumber = (phone: string) => {
    if (phone.length === 10) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
    }
    return phone;
  };

  const renderEmployeeItem = ({ item }: { item: Employee }) => {
    const roleColor = getRoleColor(item.role);
    const roleIcon = getRoleIcon(item.role);

    return (
      <TouchableOpacity
        style={styles.employeeCard}
        onPress={() => handleEmployeePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          {/* Avatar Section */}
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: roleColor + '15' },
            ]}
          >
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {getInitials(item.name)}
            </Text>
          </View>

          {/* Info Section */}
          <View style={styles.infoContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.employeeName} numberOfLines={1}>
                {item.name}
              </Text>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: item.isActive ? '#10B981' : '#EF4444' },
                ]}
              />
            </View>

            <View style={styles.detailsRow}>
              <Icon name="email" size={14} color="#94A3B8" />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.email}
              </Text>
            </View>

            <View style={styles.detailsRow}>
              <Icon name="phone" size={14} color="#94A3B8" />
              <Text style={styles.detailText} numberOfLines={1}>
                {formatPhoneNumber(item.phone)}
              </Text>
            </View>
          </View>

          {/* Role Section */}
          <View style={styles.roleContainer}>
            <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
              <Icon name={roleIcon} size={12} color="#FFFFFF" />
              <Text style={styles.roleText}>{item.role}</Text>
            </View>
            <View style={styles.fwsCodeContainer}>
              <Icon name="label" size={10} color="#94A3B8" />
              <Text style={styles.fwsCodeText} numberOfLines={1}>
                {item.fwsCode}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="people-outline" size={64} color="#CBD5E1" />
      </View>
      <Text style={styles.emptyTitle}>No Employees Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try adjusting your search or filters'
          : 'Start adding employees to your team'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddEmployee')}
        >
          <Icon name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Employee</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading employees...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Team Members</Text>
          <Text style={styles.headerSubtitle}>
            {filteredEmployees.length} employee
            {filteredEmployees.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Icon
              name={showSearch ? 'close' : 'search'}
              size={22}
              color="#475569"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleRefresh}>
            <Icon name="refresh" size={22} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Icon
            name="search"
            size={20}
            color="#94A3B8"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, or code..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus={true}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearch('')}
              style={styles.clearButton}
            >
              <Icon name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Role Filters */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {[
            'ALL',
            'MANAGER',
            'SUPERVISOR',
            'SCANNER',
            'PACKER',
            'DISPATCHER',
          ].map(role => {
            const isActive = selectedRole === role;
            const roleColor = role === 'ALL' ? '#4F46E5' : getRoleColor(role);

            return (
              <TouchableOpacity
                key={role}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  isActive && {
                    borderColor: roleColor,
                    backgroundColor: roleColor + '12',
                  },
                ]}
                onPress={() => handleRoleFilter(role)}
              >
                {role !== 'ALL' && (
                  <Icon
                    name={getRoleIcon(role)}
                    size={14}
                    color={isActive ? roleColor : '#94A3B8'}
                    style={styles.filterIcon}
                  />
                )}
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && { color: roleColor, fontWeight: '600' },
                  ]}
                >
                  {role === 'ALL' ? 'All' : role}
                </Text>
                {isActive && (
                  <View
                    style={[styles.activeDot, { backgroundColor: roleColor }]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Employee List */}
      {filteredEmployees.length === 0 ? (
        <View style={styles.emptyWrapper}>{renderEmptyState()}</View>
      ) : (
        <FlatList
          data={filteredEmployees}
          renderItem={renderEmployeeItem}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#4F46E5']}
              tintColor="#4F46E5"
            />
          }
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}
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
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: '#0F172A',
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  filterWrapper: {
    marginTop: 16,
    marginBottom: 8,
  },
  filterContainer: {
    paddingHorizontal: 20,
  },
  filterContent: {
    paddingRight: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginRight: 8,
    position: 'relative',
  },
  filterChipActive: {
    borderWidth: 2,
    backgroundColor: '#F1F5F9',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    width: width - 40, // Full width minus padding
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    minHeight: 80,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoContainer: {
    flex: 1,
    marginRight: 10,
    minWidth: 0, // Important for text truncation
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginRight: 6,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  detailText: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 6,
    flex: 1,
  },
  roleContainer: {
    alignItems: 'flex-end',
    flexShrink: 0,
    marginLeft: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  fwsCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fwsCodeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginLeft: 3,
    maxWidth: 60,
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    width: '100%',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});

export default EmployeeListScreen;
