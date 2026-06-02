import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LineChart } from 'react-native-chart-kit';
import Svg, { Circle, G, Text as SvgText, Path } from 'react-native-svg';
import * as Progress from 'react-native-progress';
import BottomNavigation from '../../core/components/home/BottomNavigation';

const { width: screenWidth } = Dimensions.get('window');

// Type definitions
interface DonutChartProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

interface Category {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface ActiveUser {
  country: string;
  users: number;
  percentage: number;
}

interface ConversionStep {
  name: string;
  value: number;
  percentage: number;
}

type TrendType = 'up' | 'down';

interface StatItem {
  value: number;
  change: number;
  trend: TrendType;
}

const DashboardScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');

  // Dummy data with proper typing
  const stats: {
    totalSales: StatItem;
    totalOrders: StatItem;
    totalVisitors: StatItem;
    conversionRate: StatItem;
  } = {
    totalSales: { value: 983410, change: 3.4, trend: 'up' },
    totalOrders: { value: 58375, change: 2.8, trend: 'down' },
    totalVisitors: { value: 237782, change: 8.2, trend: 'up' },
    conversionRate: { value: 12.4, change: 1.2, trend: 'up' },
  };

  const revenueData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [12000, 15000, 13500, 18000, 22000, 19500, 25000],
        color: (opacity: number = 1) => `rgba(59, 130, 246, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Revenue ($)'],
  };

  const monthlyTarget = 85;

  const categories: Category[] = [
    { name: 'Electronics', value: 1200000, percentage: 35, color: '#3b82f6' },
    { name: 'Fashion', value: 950000, percentage: 28, color: '#60a5fa' },
    { name: 'Home & Living', value: 680000, percentage: 20, color: '#93c5fd' },
    { name: 'Beauty', value: 450000, percentage: 13, color: '#bfdbfe' },
    { name: 'Sports', value: 150000, percentage: 4, color: '#dbeafe' },
  ];

  const activeUsersByCountry: ActiveUser[] = [
    { country: 'United States', users: 12450, percentage: 45 },
    { country: 'India', users: 8750, percentage: 32 },
    { country: 'United Kingdom', users: 3450, percentage: 12 },
    { country: 'Canada', users: 2980, percentage: 11 },
  ];

  const conversionSteps: ConversionStep[] = [
    { name: 'Product View', value: 100, percentage: 100 },
    { name: 'Add to Cart', value: 68, percentage: 68 },
    { name: 'Checkout', value: 42, percentage: 42 },
    { name: 'Purchase', value: 24, percentage: 24 },
  ];

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity: number = 1) => `rgba(59, 130, 246, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#3b82f6',
    },
  };

  const DonutChart: React.FC<DonutChartProps> = ({ percentage, size = 100, strokeWidth = 12 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#3b82f6"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
        <SvgText
          x={size / 2}
          y={size / 2 + 4}
          textAnchor="middle"
          fontSize="16"
          fontWeight="bold"
          fill="#1f2937"
        >
          {percentage}%
        </SvgText>
      </Svg>
    );
  };

  const CategoryDonut: React.FC = () => {
    const size = 120;
    const strokeWidth = 16;
    let currentAngle = 0;

    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {categories.map((category, index) => {
            const angle = (category.percentage / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = startAngle + angle;
            currentAngle = endAngle;

            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            const radius = (size - strokeWidth) / 2;
            const center = size / 2;

            const x1 = center + radius * Math.cos(startRad);
            const y1 = center + radius * Math.sin(startRad);
            const x2 = center + radius * Math.cos(endRad);
            const y2 = center + radius * Math.sin(endRad);

            const largeArcFlag = angle > 180 ? 1 : 0;

            const pathData = `
              M ${center} ${center}
              L ${x1} ${y1}
              A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
              Z
            `;

            return (
              <Path
                key={index}
                d={pathData}
                fill={category.color}
                stroke="white"
                strokeWidth={2}
              />
            );
          })}
        </G>
      </Svg>
    );
  };

  const renderStatCard = (
    title: string,
    value: string | number,
    change: number,
    trend: TrendType,
    iconName: string,
    iconColor: string,
    isBlue?: boolean
  ) => (
    <View style={[styles.statCard, isBlue && styles.statCardBlue]}>
      <View style={styles.statIconContainer}>
        <MaterialIcons name={iconName as any} size={24} color={iconColor} />
      </View>
      <Text style={styles.statLabel}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statTrend}>
        <Icon
          name={trend === 'up' ? 'arrow-up' : 'arrow-down'}
          size={14}
          color={trend === 'up' ? '#10b981' : '#ef4444'}
        />
        <Text
          style={[
            styles.statChange,
            { color: trend === 'up' ? '#10b981' : '#ef4444' },
          ]}
        >
          {change}%
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Header with Search and Notifications */}
          <View style={styles.header}>
            <View style={styles.searchContainer}>
              <Icon name="search-outline" size={20} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor="#9ca3af"
              />
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Icon name="notifications-outline" size={24} color="#374151" />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>

          {/* Stats Cards Grid */}
          <View style={styles.statsGrid}>
            {renderStatCard(
              'Total Sales',
              `$${stats.totalSales.value.toLocaleString()}`,
              stats.totalSales.change,
              stats.totalSales.trend,
              'attach-money',
              '#3b82f6',
              true
            )}
            {renderStatCard(
              'Total Orders',
              stats.totalOrders.value.toLocaleString(),
              stats.totalOrders.change,
              stats.totalOrders.trend,
              'shopping-bag',
              '#f59e0b',
              false
            )}
            {renderStatCard(
              'Total Visitors',
              stats.totalVisitors.value.toLocaleString(),
              stats.totalVisitors.change,
              stats.totalVisitors.trend,
              'people',
              '#8b5cf6',
              false
            )}
            {renderStatCard(
              'Conversion Rate',
              `${stats.conversionRate.value}%`,
              stats.conversionRate.change,
              stats.conversionRate.trend,
              'trending-up',
              '#06b6d4',
              false
            )}
          </View>

          {/* Revenue Analytics + Monthly Target Row */}
          <View style={styles.row}>
            <View style={[styles.card, styles.revenueCard]}>
              <Text style={styles.cardTitle}>Revenue Analytics</Text>
              <Text style={styles.cardSubtitle}>Last 7 days</Text>
              <LineChart
                data={revenueData}
                width={screenWidth - 80}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withDots={true}
                withInnerLines={false}
                withOuterLines={false}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                formatYLabel={(value: string) => `$${parseInt(value) / 1000}k`}
              />
            </View>

            <View style={[styles.card, styles.targetCard]}>
              <Text style={styles.cardTitle}>Monthly Target</Text>
              <Text style={styles.cardSubtitle}>Target vs Revenue</Text>
              <View style={styles.targetContainer}>
                <DonutChart percentage={monthlyTarget} size={120} strokeWidth={12} />
              </View>
              <View style={styles.targetDetails}>
                <View style={styles.targetItem}>
                  <View style={[styles.targetDot, { backgroundColor: '#3b82f6' }]} />
                  <Text style={styles.targetLabel}>Achieved</Text>
                  <Text style={styles.targetValue}>${(850000).toLocaleString()}</Text>
                </View>
                <View style={styles.targetItem}>
                  <View style={[styles.targetDot, { backgroundColor: '#e5e7eb' }]} />
                  <Text style={styles.targetLabel}>Remaining</Text>
                  <Text style={styles.targetValue}>${(150000).toLocaleString()}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Top Categories Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Categories</Text>
            <View style={styles.categoriesContainer}>
              <View style={styles.categoryDonutContainer}>
                <CategoryDonut />
              </View>
              <View style={styles.categoryList}>
                {categories.map((category, index) => (
                  <View key={index} style={styles.categoryItem}>
                    <View style={styles.categoryInfo}>
                      <View style={[styles.categoryColor, { backgroundColor: category.color }]} />
                      <Text style={styles.categoryName}>{category.name}</Text>
                    </View>
                    <Text style={styles.categoryValue}>${(category.value / 1000).toFixed(0)}k</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Active Users Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Active Users by Country</Text>
            <Text style={styles.totalUsersText}>Total: 27,630 active users</Text>
            {activeUsersByCountry.map((country, index) => (
              <View key={index} style={styles.countryItem}>
                <View style={styles.countryHeader}>
                  <Text style={styles.countryName}>{country.country}</Text>
                  <Text style={styles.countryUsers}>{country.users.toLocaleString()} users</Text>
                </View>
                <Progress.Bar
                  progress={country.percentage / 100}
                  width={null}
                  color="#3b82f6"
                  unfilledColor="#e5e7eb"
                  borderWidth={0}
                  height={8}
                  borderRadius={4}
                  style={styles.progressBar}
                />
                <Text style={styles.countryPercentage}>{country.percentage}%</Text>
              </View>
            ))}
          </View>

          {/* Conversion Rate Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Conversion Funnel</Text>
            <Text style={styles.cardSubtitle}>Product View → Add to Cart → Checkout → Purchase</Text>
            {conversionSteps.map((step, index) => (
              <View key={index} style={styles.conversionStep}>
                <View style={styles.conversionHeader}>
                  <Text style={styles.conversionName}>{step.name}</Text>
                  <Text style={styles.conversionValue}>{step.percentage}%</Text>
                </View>
                <Progress.Bar
                  progress={step.percentage / 100}
                  width={null}
                  color="#3b82f6"
                  unfilledColor="#e5e7eb"
                  borderWidth={0}
                  height={8}
                  borderRadius={4}
                  style={styles.conversionBar}
                />
              </View>
            ))}
            <View style={styles.conversionStats}>
              <View style={styles.conversionStatItem}>
                <Text style={styles.conversionStatLabel}>Drop-off Rate</Text>
                <Text style={styles.conversionStatValue}>76%</Text>
              </View>
              <View style={styles.conversionStatItem}>
                <Text style={styles.conversionStatLabel}>Avg. Cart Value</Text>
                <Text style={styles.conversionStatValue}>$125.40</Text>
              </View>
            </View>
          </View>
          
          {/* Add bottom padding to prevent content from hiding behind bottom navigation */}
          <View style={styles.bottomPadding} />
        </ScrollView>
        
        {/* Bottom Navigation */}
        <BottomNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  bottomPadding: {
    height: 80, // Add padding to prevent content from hiding behind bottom nav
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  notificationButton: {
    marginLeft: 16,
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    width: '48%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statCardBlue: {
    backgroundColor: '#eff6ff',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statTrend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statChange: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  revenueCard: {
    flex: 2,
  },
  targetCard: {
    flex: 1.2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 16,
  },
  chart: {
    marginLeft: -20,
    borderRadius: 16,
  },
  targetContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  targetDetails: {
    marginTop: 8,
  },
  targetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  targetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  targetLabel: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
  },
  targetValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  categoriesContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  categoryDonutContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryList: {
    flex: 1.5,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 14,
    color: '#374151',
  },
  categoryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  totalUsersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 16,
  },
  countryItem: {
    marginBottom: 16,
  },
  countryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  countryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  countryUsers: {
    fontSize: 13,
    color: '#6b7280',
  },
  progressBar: {
    marginBottom: 4,
  },
  countryPercentage: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'right',
  },
  conversionStep: {
    marginBottom: 16,
  },
  conversionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  conversionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  conversionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  conversionBar: {
    marginBottom: 4,
  },
  conversionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  conversionStatItem: {
    alignItems: 'center',
  },
  conversionStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  conversionStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
});

export default DashboardScreen;