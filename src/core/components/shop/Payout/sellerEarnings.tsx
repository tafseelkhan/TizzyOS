import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  StatusBar,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconFA5 from 'react-native-vector-icons/FontAwesome5';
import IconIO from 'react-native-vector-icons/Ionicons';
import IconFeather from 'react-native-vector-icons/Feather';
import IconAD from 'react-native-vector-icons/AntDesign';
import IconOct from 'react-native-vector-icons/Octicons';

const { width } = Dimensions.get('window');

// Define navigation param types
type RootStackParamList = {
  PayoutPortal: undefined;
  SellerHome: { screen: string };
  // Add other screens here
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type IconType =
  | 'MaterialIcons'
  | 'FontAwesome5'
  | 'Ionicons'
  | 'Feather'
  | 'AntDesign'
  | 'Octicons';

interface TransactionItem {
  id: number;
  name: string;
  amount: number;
  date: string;
  status: 'Completed' | 'Pending' | 'Processed';
  type: 'credit' | 'debit';
}

interface MenuOption {
  id: number;
  title: string;
  subtitle: string;
  onPress: () => void;
  icon: string;
  iconType: IconType;
  color: string;
}

interface StatCardProps {
  title: string;
  amount: number;
  subtitle: string;
  icon: string;
  color: string;
  iconType?: IconType;
}

const SellerEarnings = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const earningsData = {
    totalEarnings: 34250.75,
    availableBalance: 18500.25,
    pendingAmount: 8750.5,
    thisMonth: 13250.0,
    lastMonth: 21000.75,
    totalWithdrawn: 45000.0,
  };

  const transactions: TransactionItem[] = [
    {
      id: 1,
      name: 'Order #A2378',
      amount: 4250,
      date: 'Today, 11:45 AM',
      status: 'Completed',
      type: 'credit',
    },
    {
      id: 2,
      name: 'Order #A2377',
      amount: 1850,
      date: 'Today, 09:30 AM',
      status: 'Completed',
      type: 'credit',
    },
    {
      id: 3,
      name: 'Order #A2376',
      amount: 3150,
      date: 'Yesterday, 03:15 PM',
      status: 'Pending',
      type: 'credit',
    },
    {
      id: 4,
      name: 'Withdrawal',
      amount: 10000,
      date: '2 days ago',
      status: 'Processed',
      type: 'debit',
    },
    {
      id: 5,
      name: 'Order #A2375',
      amount: 2750,
      date: '3 days ago',
      status: 'Completed',
      type: 'credit',
    },
  ];

  const menuOptions: MenuOption[] = [
    {
      id: 1,
      title: 'Link Bank Account',
      subtitle: 'To payout your money',
      onPress: () => {
        setModalVisible(false);
        navigation.navigate('PayoutPortal');
      },
      icon: 'university',
      iconType: 'FontAwesome5',
      color: '#4F46E5',
    },
    {
      id: 2,
      title: 'Transaction History',
      subtitle: 'View all your transactions',
      onPress: () => {
        setModalVisible(false);
        // Navigate to transaction history
      },
      icon: 'history',
      iconType: 'MaterialIcons',
      color: '#10B981',
    },
    {
      id: 3,
      title: 'Withdraw Money',
      subtitle: 'Withdraw to your bank account',
      onPress: () => {
        setModalVisible(false);
        // Open withdraw modal
      },
      icon: 'money-bill-wave',
      iconType: 'FontAwesome5',
      color: '#F59E0B',
    },
    {
      id: 4,
      title: 'Analytics',
      subtitle: 'Detailed earnings insights',
      onPress: () => {
        setModalVisible(false);
        // Navigate to analytics
      },
      icon: 'analytics',
      iconType: 'Ionicons',
      color: '#8B5CF6',
    },
    {
      id: 5,
      title: 'Tax Reports',
      subtitle: 'Download tax documents',
      onPress: () => {
        setModalVisible(false);
        // Open tax reports
      },
      icon: 'description',
      iconType: 'MaterialIcons',
      color: '#EF4444',
    },
    {
      id: 6,
      title: 'Help & Support',
      subtitle: 'Get help with your earnings',
      onPress: () => {
        setModalVisible(false);
        // Open help center
      },
      icon: 'help-circle',
      iconType: 'Feather',
      color: '#6B7280',
    },
  ];

  const renderIcon = (
    iconType: IconType,
    iconName: string,
    color: string,
    size: number = 24,
  ) => {
    switch (iconType) {
      case 'MaterialIcons':
        return <Icon name={iconName} size={size} color={color} />;
      case 'FontAwesome5':
        return <IconFA5 name={iconName} size={size} color={color} />;
      case 'Ionicons':
        return <IconIO name={iconName} size={size} color={color} />;
      case 'Feather':
        return <IconFeather name={iconName} size={size} color={color} />;
      case 'AntDesign':
        return <IconAD name={iconName} size={size} color={color} />;
      case 'Octicons':
        return <IconOct name={iconName} size={size} color={color} />;
      default:
        return <Icon name="circle" size={size} color={color} />;
    }
  };

  const StatCard = ({
    title,
    amount,
    subtitle,
    icon,
    color,
    iconType = 'MaterialIcons',
  }: StatCardProps) => (
    <View
      style={[
        styles.statCard,
        { backgroundColor: color + '10', borderColor: color + '20' },
      ]}
    >
      <View style={styles.statHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          {renderIcon(iconType, icon, color, 24)}
        </View>
        <Text style={[styles.statAmount, { color }]}>
          ₹{amount.toLocaleString('en-IN')}
        </Text>
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );

  interface TransactionItemProps {
    item: TransactionItem;
  }

  const TransactionItemComponent = ({ item }: TransactionItemProps) => (
    <View style={styles.transactionItem}>
      <View
        style={[
          styles.transactionIcon,
          {
            backgroundColor: item.type === 'credit' ? '#10B98115' : '#EF444415',
          },
        ]}
      >
        {item.type === 'credit' ? (
          <Icon name="trending-up" size={20} color="#10B981" />
        ) : (
          <Icon name="trending-down" size={20} color="#EF4444" />
        )}
      </View>
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionName}>{item.name}</Text>
        <Text style={styles.transactionDate}>{item.date}</Text>
      </View>
      <View style={styles.transactionAmountContainer}>
        <Text
          style={[
            styles.transactionAmount,
            { color: item.type === 'credit' ? '#10B981' : '#EF4444' },
          ]}
        >
          {item.type === 'credit' ? '+' : '-'}₹
          {item.amount.toLocaleString('en-IN')}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === 'Completed'
                  ? '#10B98115'
                  : item.status === 'Processed'
                  ? '#10B98115'
                  : '#F59E0B15',
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color:
                  item.status === 'Completed'
                    ? '#10B981'
                    : item.status === 'Processed'
                    ? '#10B981'
                    : '#F59E0B',
              },
            ]}
          >
            {item.status}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      {/* Header with Gradient */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Welcome back, 👋</Text>
            <Text style={styles.sellerName}>Alex Johnson</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setModalVisible(true)}
          >
            <IconIO name="settings-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>
            ₹{earningsData.totalEarnings.toLocaleString('en-IN')}
          </Text>
          <View style={styles.balanceChange}>
            <Icon name="trending-up" size={16} color="#10B981" />
            <Text style={styles.changeText}>+12.5% from last month</Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.quickStats}>
          <StatCard
            title="Available"
            amount={earningsData.availableBalance}
            subtitle="Ready to withdraw"
            icon="wallet-outline"
            color="#10B981"
            iconType="Ionicons"
          />
          <StatCard
            title="Pending"
            amount={earningsData.pendingAmount}
            subtitle="Processing"
            icon="clock"
            color="#F59E0B"
            iconType="Feather"
          />
        </View>

        {/* Monthly Earnings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Monthly Earnings</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.monthlyStats}>
            <View style={styles.monthItem}>
              <Text style={styles.monthLabel}>This Month</Text>
              <Text style={styles.monthAmount}>
                ₹{earningsData.thisMonth.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.monthItem}>
              <Text style={styles.monthLabel}>Last Month</Text>
              <Text style={styles.monthAmount}>
                ₹{earningsData.lastMonth.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.transactionsList}>
            {transactions.map(item => (
              <TransactionItemComponent key={item.id} item={item} />
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('PayoutPortal')}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: '#4F46E515' }]}
              >
                <IconFA5 name="university" size={20} color="#4F46E5" />
              </View>
              <Text style={styles.actionText}>Link Bank</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View
                style={[styles.actionIcon, { backgroundColor: '#10B98115' }]}
              >
                <IconFA5 name="money-bill-wave" size={20} color="#10B981" />
              </View>
              <Text style={styles.actionText}>Withdraw</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View
                style={[styles.actionIcon, { backgroundColor: '#8B5CF615' }]}
              >
                <IconIO name="analytics-outline" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.actionText}>Analytics</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View
                style={[styles.actionIcon, { backgroundColor: '#F59E0B15' }]}
              >
                <IconFeather name="download" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.actionText}>Reports</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <IconIO name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {menuOptions.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItem}
                  onPress={item.onPress}
                >
                  <View
                    style={[
                      styles.menuIconContainer,
                      { backgroundColor: item.color + '15' },
                    ]}
                  >
                    {renderIcon(item.iconType, item.icon, item.color, 24)}
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  <IconIO name="chevron-forward" size={20} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => setModalVisible(false)}
            >
              <Icon name="logout" size={20} color="#EF4444" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#E0E7FF',
    opacity: 0.9,
  },
  sellerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceContainer: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#E0E7FF',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  balanceChange: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  changeText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: -20,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  seeAll: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
  },
  monthlyStats: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  monthItem: {
    flex: 1,
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  monthAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  divider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  transactionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  actionButton: {
    width: (width - 60) / 4,
    alignItems: 'center',
    marginBottom: 16,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 24,
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
});

export default SellerEarnings;
