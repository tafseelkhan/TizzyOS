import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Modal,
  FlatList,
  Image,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../../../contexts/theme/ThemeContext';

// Import vector icons from react-native-vector-icons
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AntDesign from 'react-native-vector-icons/AntDesign';

// Import Haptics from react-native-haptic-feedback
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const { width } = Dimensions.get('window');

// Haptics configuration
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Type definitions
type RootStackParamList = {
  SellerOrders: undefined;
  OrderDetails: { orderId: string; orderData?: Order };
  ManualShippingSelect: { orderId: string; orderData: Order };
};

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'SellerOrders'>;
};

type BuyerAddress = {
  address?: string;
  googlePlaceId?: string;
  latitude?: number;
  longitude?: number;
};

type SellerAddress = {
  address?: string;
  googlePlaceId?: string;
  latitude?: number;
  longitude?: number;
};

type ProductData = {
  _id?: string;
  id?: string;
  title?: string;
  brand?: string;
  description?: string;
  category?: string;
  subcategory?: string;
};

type OrderItem = {
  quantity?: number;
  productData?: ProductData;
  selectedVariant?: Record<string, string>;
  productId?: string;
};

type Order = {
  _id?: string;
  orderId?: string;
  productId?: string;
  sellerId?: string;
  userId?: string;
  buyerName?: string;
  items?: OrderItem[];
  productPrice?: number;
  productMrp?: number;
  productFinalPrice?: number;
  productGst?: number;
  deliveryCharge?: number;
  finalAmount?: number;
  status?: string;
  deliveryStatus?: string;
  paymentIntentId?: string;
  paymentStatus?: string;
  buyerAddress?: BuyerAddress;
  sellerAddress?: SellerAddress;
  createdAt?: string;
  updatedAt?: string;
  isConfirmed?: boolean;
  shippingRider?: {
    id: string;
    name: string;
    phoneNumber?: string;
    vehicleType?: string;
  };
};

type OrderStats = {
  assigned: number;
  delivered: number;
  remaining: number;
};

type ShippingPartner = {
  id: string;
  userId: string;
  name: string;
  rating: number;
  deliveryTime?: string;
  vehicleType: string;
  price?: number;
  imageUrl?: string;
  vehicleImage?: string;
  isAvailable: boolean;
  phoneNumber?: string;
  maxOrdersPerDay: number;
  currentOrders: number;
  orderStats?: OrderStats;
};

const API_BASE_URL = 'http://172.20.10.12:5000';

// Premium theme-based color definitions
const getThemeColors = (isDark: boolean) => {
  return {
    primaryGradient: isDark ? ['#667EEA', '#764BA2'] : ['#2196F3', '#21CBF3'],
    successGradient: isDark ? ['#059669', '#10B981'] : ['#10B981', '#34D399'],
    warningGradient: isDark ? ['#F59E0B', '#D97706'] : ['#F59E0B', '#FBBF24'],
    background: isDark ? '#0F172A' : '#F8FAFC',
    chatbackground: isDark ? '#0F172A' : '#ffffffff',
    cardBackground: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#F1F5F9' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    textTertiary: isDark ? '#64748B' : '#94A3B8',
    primary: '#2196F3',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    purple: '#8B5CF6',
    pending: '#F59E0B',
    confirmed: '#10B981',
    pending_rider_acceptance: '#8B5CF6',
    assigned_to_rider: '#3B82F6',
    shipped: '#8B5CF6',
    delivered: '#10B981',
    cancelled: '#EF4444',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    shadow: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.08)',
    headerBackground: isDark
      ? 'rgba(15, 23, 42, 0.95)'
      : 'rgba(248, 250, 252, 0.95)',
    headerText: isDark ? '#FFFFFF' : '#0F172A',
    headerSubtext: isDark ? '#94A3B8' : '#64748B',
    modalBackground: isDark
      ? 'rgba(15, 23, 42, 0.95)'
      : 'rgba(248, 250, 252, 0.98)',
    modalOverlay: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
  };
};

// Manual Shipping Selection Modal Component
const ManualShippingModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSelectPartner: (partner: ShippingPartner) => void;
  order: Order | null;
  colors: any;
  isDark: boolean;
  authToken: string | null;
}> = ({
  visible,
  onClose,
  onSelectPartner,
  order,
  colors,
  isDark,
  authToken,
}) => {
  const [shippingPartners, setShippingPartners] = useState<ShippingPartner[]>(
    [],
  );
  const [loadingPartners, setLoadingPartners] = useState<boolean>(true);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible && order && authToken) {
      fetchShippingPartners();
    } else {
      setShippingPartners([]);
      setSelectedPartner(null);
      setLoadingPartners(true);
    }
  }, [visible, order, authToken]);

  const fetchShippingPartners = async () => {
    try {
      setLoadingPartners(true);

      console.log('🔍 Fetching shipping partners...');
      console.log('📱 Auth Token Present:', !!authToken);
      console.log('📦 Order ID:', order?.orderId);

      if (!authToken) {
        console.error('❌ No auth token available');
        setShippingPartners([]);
        return;
      }

      const apiUrl = `${API_BASE_URL}/api/shipping/available-riders`;

      const headers = {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(apiUrl, {
        headers,
        timeout: 10000,
      });

      let ridersArray: any[] = [];

      if (response.data) {
        if (response.data.success && Array.isArray(response.data.riders)) {
          ridersArray = response.data.riders;
        } else if (Array.isArray(response.data)) {
          ridersArray = response.data;
        } else if (
          response.data.riders &&
          !Array.isArray(response.data.riders)
        ) {
          if (
            typeof response.data.riders === 'object' &&
            response.data.riders !== null
          ) {
            ridersArray = Object.values(response.data.riders);
          }
        }
      }

      const mappedPartners: ShippingPartner[] = [];

      if (Array.isArray(ridersArray)) {
        ridersArray.forEach((rider: any, index: number) => {
          try {
            const maxOrdersPerDay = rider.maxOrdersPerDay || 10;
            const currentOrders = rider.currentOrders || 0;
            const ordersRemaining = Math.max(
              0,
              maxOrdersPerDay - currentOrders,
            );

            const orderStats: OrderStats = rider.orderStats || {
              assigned: currentOrders || 0,
              delivered: rider.deliveredOrders || 0,
              remaining: ordersRemaining > 0 ? ordersRemaining : 0,
            };

            const riderUserId = rider.userId || rider._id || `rider-${index}`;

            mappedPartners.push({
              id: rider._id || rider.id || `rider-${index}-${Date.now()}`,
              userId: riderUserId,
              name: rider.fullName || rider.name || 'Delivery Partner',
              rating: rider.rating || 4.0 + Math.random() * 0.5,
              vehicleType: rider.vehicleType || 'Bike',
              vehicleImage:
                rider.vehicleImage ||
                'https://storage.googleapis.com/tizzygo-os.firebasestorage.app/shipping/vehicle-icon.png',
              price: rider.deliveryCharge || 50,
              imageUrl: rider.profileImage,
              isAvailable: rider.isAvailable !== false && ordersRemaining > 0,
              phoneNumber: rider.phoneNumber || rider.contactNumber,
              maxOrdersPerDay: maxOrdersPerDay,
              currentOrders: currentOrders,
              orderStats: orderStats,
            });
          } catch (error) {
            console.error(`❌ Error mapping rider ${index}:`, error);
          }
        });
      }

      setShippingPartners(mappedPartners);
    } catch (error: any) {
      console.error('❌ Error fetching available riders:', error);
      setShippingPartners([]);
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleTizzyChat = (partner: ShippingPartner) => {
    ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    Alert.alert('TizzyChat', `Start chat with ${partner.name}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start Chat',
        onPress: () => {
          console.log('Starting chat with:', partner.name);
        },
      },
    ]);
  };

  const renderShippingPartner = ({ item }: { item: ShippingPartner }) => {
    const ordersRemaining = item.maxOrdersPerDay - item.currentOrders;
    const isAtCapacity = ordersRemaining <= 0;
    const availabilityStatus = item.isAvailable && !isAtCapacity;

    return (
      <TouchableOpacity
        style={[
          styles.shippingPartnerCard,
          {
            backgroundColor: colors.cardBackground,
            borderColor:
              selectedPartner === item.id ? colors.primary : colors.border,
            borderWidth: selectedPartner === item.id ? 2 : 1,
            opacity: availabilityStatus ? 1 : 0.6,
          },
        ]}
        onPress={() => {
          if (availabilityStatus) {
            ReactNativeHapticFeedback.trigger('selection', hapticOptions);
            setSelectedPartner(item.id);
          }
        }}
        disabled={!availabilityStatus}
      >
        <View style={styles.shippingPartnerHeader}>
          <View style={styles.shippingPartnerInfo}>
            <View style={styles.vehicleImageContainer}>
              {item.vehicleImage ? (
                <Image
                  source={{ uri: item.vehicleImage }}
                  style={styles.vehicleImage}
                  resizeMode="contain"
                />
              ) : (
                <View
                  style={[
                    styles.vehicleIconPlaceholder,
                    { backgroundColor: colors.primary + '20' },
                  ]}
                >
                  <Ionicons
                    name="bicycle-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
              )}
            </View>

            <View style={styles.driverDetails}>
              <View style={styles.driverNameRow}>
                <Text
                  style={[styles.driverName, { color: colors.textPrimary }]}
                >
                  {item.name}
                </Text>
                {availabilityStatus ? (
                  <View
                    style={[
                      styles.availableBadge,
                      { backgroundColor: colors.success + '20' },
                    ]}
                  >
                    <Text
                      style={[styles.availableText, { color: colors.success }]}
                    >
                      Available
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.availableBadge,
                      { backgroundColor: colors.danger + '20' },
                    ]}
                  >
                    <Text
                      style={[styles.availableText, { color: colors.danger }]}
                    >
                      {isAtCapacity ? 'Full' : 'Busy'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text
                  style={[styles.ratingText, { color: colors.textSecondary }]}
                >
                  {item.rating.toFixed(1)}
                </Text>
                <Text
                  style={[styles.vehicleText, { color: colors.textTertiary }]}
                >
                  • {item.vehicleType}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.capacityInfo}>
            <Text
              style={[
                styles.capacityNumber,
                {
                  color:
                    ordersRemaining > 3
                      ? colors.success
                      : ordersRemaining > 0
                      ? colors.warning
                      : colors.danger,
                },
              ]}
            >
              {ordersRemaining}/{item.maxOrdersPerDay}
            </Text>
            <Text
              style={[styles.capacityLabel, { color: colors.textSecondary }]}
            >
              Orders Remaining
            </Text>
          </View>
        </View>

        <View style={styles.orderStatsContainer}>
          <View style={styles.orderStatItem}>
            <View
              style={[styles.orderStatDot, { backgroundColor: colors.primary }]}
            />
            <Text style={[styles.orderStatText, { color: colors.textPrimary }]}>
              Assigned:{' '}
              <Text style={{ fontWeight: '700' }}>
                {item.orderStats?.assigned || 0}
              </Text>
            </Text>
          </View>
          <View style={styles.orderStatItem}>
            <View
              style={[styles.orderStatDot, { backgroundColor: colors.success }]}
            />
            <Text style={[styles.orderStatText, { color: colors.textPrimary }]}>
              Delivered:{' '}
              <Text style={{ fontWeight: '700' }}>
                {item.orderStats?.delivered || 0}
              </Text>
            </Text>
          </View>
          <View style={styles.orderStatItem}>
            <View
              style={[
                styles.orderStatDot,
                {
                  backgroundColor:
                    item.orderStats?.remaining || 0 > 0
                      ? colors.warning
                      : colors.danger,
                },
              ]}
            />
            <Text style={[styles.orderStatText, { color: colors.textPrimary }]}>
              Remaining:{' '}
              <Text
                style={{
                  fontWeight: '700',
                  color:
                    item.orderStats?.remaining || 0 > 0
                      ? colors.warning
                      : colors.danger,
                }}
              >
                {item.orderStats?.remaining || 0}
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.shippingPartnerFooter}>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => handleTizzyChat(item)}
            activeOpacity={0.8}
          >
            <View style={styles.chatButtonContent}>
              <Image
                source={require('../../../../assets/images/nex-logo.png')}
                style={styles.chatIcon}
              />
              <Text style={styles.chatButtonText}>TizzyChat</Text>
            </View>
          </TouchableOpacity>
        </View>

        {selectedPartner === item.id && (
          <View
            style={[
              styles.selectedIndicator,
              { backgroundColor: colors.primary + '10' },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.selectedText, { color: colors.primary }]}>
              Selected
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!order) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.modalBackground },
          ]}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons
                name="person-circle-outline"
                size={24}
                color={colors.primary}
              />
              <View>
                <Text
                  style={[styles.modalTitle, { color: colors.textPrimary }]}
                >
                  Select Delivery Rider
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Order: {order.orderId || 'N/A'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.orderInfoCard,
              { backgroundColor: colors.cardBackground },
            ]}
          >
            <View style={styles.orderInfoRow}>
              <View style={styles.orderInfoItem}>
                <Text
                  style={[
                    styles.orderInfoLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Delivery To
                </Text>
                <Text
                  style={[styles.orderInfoValue, { color: colors.textPrimary }]}
                >
                  {order.buyerName || 'Customer'}
                </Text>
              </View>
              <View style={styles.orderInfoItem}>
                <Text
                  style={[
                    styles.orderInfoLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Amount
                </Text>
                <Text
                  style={[styles.orderInfoValue, { color: colors.success }]}
                >
                  ₹{order.finalAmount?.toFixed(2) || '0.00'}
                </Text>
              </View>
            </View>
            {order.buyerAddress?.address && (
              <Text
                style={[styles.addressText, { color: colors.textSecondary }]}
              >
                {order.buyerAddress.address.substring(0, 50)}...
              </Text>
            )}
          </View>

          <Text style={[styles.partnersTitle, { color: colors.textPrimary }]}>
            Available Riders (
            {
              shippingPartners.filter(
                p => p.isAvailable && p.maxOrdersPerDay - p.currentOrders > 0,
              ).length
            }
            )
          </Text>

          {loadingPartners ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[styles.loadingText, { color: colors.textSecondary }]}
              >
                Finding available riders...
              </Text>
            </View>
          ) : shippingPartners.length === 0 ? (
            <View style={styles.emptyPartnersContainer}>
              <Ionicons
                name="car-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text
                style={[
                  styles.emptyPartnersText,
                  { color: colors.textPrimary },
                ]}
              >
                No riders available
              </Text>
              <Text
                style={[
                  styles.emptyPartnersSubtext,
                  { color: colors.textSecondary },
                ]}
              >
                Please try AUTO assign or check back later
              </Text>
            </View>
          ) : (
            <FlatList
              data={shippingPartners}
              renderItem={renderShippingPartner}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.partnersList}
              showsVerticalScrollIndicator={false}
            />
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.cancelButton,
                { backgroundColor: colors.cardBackground },
              ]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.confirmButton,
                {
                  backgroundColor: selectedPartner
                    ? colors.primary
                    : colors.textTertiary,
                  opacity: selectedPartner ? 1 : 0.5,
                },
              ]}
              onPress={() => {
                if (selectedPartner) {
                  const partner = shippingPartners.find(
                    p => p.id === selectedPartner,
                  );
                  if (partner) {
                    ReactNativeHapticFeedback.trigger(
                      'notificationSuccess',
                      hapticOptions,
                    );
                    onSelectPartner(partner);
                  }
                }
              }}
              disabled={!selectedPartner}
            >
              <Ionicons name="checkmark" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Main SellerOrdersScreen Component
const SellerOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const { isDark, resolvedTheme, theme } = useTheme();
  const colors = getThemeColors(isDark);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    'all' | 'pending' | 'assigned'
  >('all');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showShippingModal, setShowShippingModal] = useState<boolean>(false);
  const [selectedOrderForShipping, setSelectedOrderForShipping] =
    useState<Order | null>(null);

  // Helper functions (keep all the existing helper functions - extractSellerIdFromToken, formatDate, mapApiOrderToUI, etc.)
  // They remain the same as in your original code, just remove expo-haptics imports

  const extractSellerIdFromToken = async (): Promise<string | null> => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      if (!storedToken) return null;
      setAuthToken(storedToken);

      try {
        // First try to parse as JSON
        const tokenData = JSON.parse(storedToken);
        const userId =
          tokenData.userId ||
          tokenData.id ||
          tokenData.user?.id ||
          tokenData.sub;
        if (userId) {
          setSellerId(userId);
          return userId;
        }
      } catch (jsonError) {
        // Token is not JSON, try JWT decode
        try {
          const tokenParts = storedToken.split('.');
          if (tokenParts.length === 3) {
            const payloadBase64 = tokenParts[1];

            // ✅ FIX: Use base64 decode without atob or Buffer
            // For React Native, we can use a simple base64 decode function
            let payloadJson;

            // Simple base64 decode function for React Native
            const base64Decode = (base64: string): string => {
              // Replace non-url compatible chars with base64 standard chars
              let str = base64.replace(/-/g, '+').replace(/_/g, '/');
              // Pad out with '=' characters
              while (str.length % 4) {
                str += '=';
              }

              // For React Native, we can use decodeURIComponent with atob polyfill
              // Create a simple atob replacement
              const chars =
                'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
              let output = '';
              str = str.replace(/[^A-Za-z0-9+/=]/g, '');

              for (let i = 0; i < str.length; i += 4) {
                const enc1 = chars.indexOf(str[i]);
                const enc2 = chars.indexOf(str[i + 1]);
                const enc3 = chars.indexOf(str[i + 2]);
                const enc4 = chars.indexOf(str[i + 3]);

                const chr1 = (enc1 << 2) | (enc2 >> 4);
                const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                const chr3 = ((enc3 & 3) << 6) | enc4;

                output += String.fromCharCode(chr1);
                if (enc3 !== 64) output += String.fromCharCode(chr2);
                if (enc4 !== 64) output += String.fromCharCode(chr3);
              }

              return decodeURIComponent(escape(output));
            };

            payloadJson = base64Decode(payloadBase64);
            const payload = JSON.parse(payloadJson);
            const userId = payload.userId || payload.sub || payload.id;
            if (userId) {
              setSellerId(userId);
              return userId;
            }
          }
        } catch (jwtError) {
          console.error('Error decoding JWT:', jwtError);
        }
      }

      // If still no ID found, try using token as is if it looks like an ID
      if (
        storedToken.length < 50 &&
        !storedToken.includes('.') &&
        !storedToken.includes(' ')
      ) {
        console.log('✅ Using token as sellerId (plain ID):', storedToken);
        setSellerId(storedToken);
        return storedToken;
      }

      return null;
    } catch (error) {
      console.error('Error extracting sellerId:', error);
      return null;
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Date not available';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (error) {
      return 'Date format error';
    }
  };

  const mapApiOrderToUI = (apiOrder: any): Order => {
    let productId = apiOrder.productId;
    if (!productId && apiOrder.items && apiOrder.items.length > 0) {
      productId =
        apiOrder.items[0].productId ||
        apiOrder.items[0].productData?._id ||
        apiOrder.items[0].productData?.id;
    }
    if (!productId) {
      productId = apiOrder._id || `product_${Date.now()}`;
    }

    return {
      _id: apiOrder._id,
      orderId: apiOrder.orderId,
      productId: productId,
      userId: apiOrder.userId || apiOrder.buyerId,
      buyerName: apiOrder.buyerName,
      status: apiOrder.status,
      deliveryStatus: apiOrder.deliveryStatus,
      paymentStatus: apiOrder.paymentStatus || apiOrder.status,
      createdAt: apiOrder.createdAt,
      updatedAt: apiOrder.updatedAt,
      finalAmount: apiOrder.finalAmount,
      productFinalPrice: apiOrder.productFinalPrice,
      items: apiOrder.items,
      buyerAddress: apiOrder.buyerAddress,
      sellerAddress: apiOrder.sellerAddress,
      productPrice: apiOrder.productPrice,
      productMrp: apiOrder.productMrp,
      productGst: apiOrder.productGst,
      deliveryCharge: apiOrder.deliveryCharge,
      isConfirmed:
        apiOrder.isConfirmed ||
        apiOrder.status === 'confirmed' ||
        apiOrder.status === 'approved',
      shippingRider: apiOrder.shippingRider || apiOrder.rider,
      paymentIntentId: apiOrder.paymentIntentId,
    };
  };

  const fetchOrders = async (currentSellerId: string): Promise<void> => {
    try {
      if (!currentSellerId) {
        console.error('❌ No sellerId provided');
        Alert.alert('Error', 'Unable to get seller information');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      let tokenToUse = authToken;
      if (!tokenToUse) {
        tokenToUse = await AsyncStorage.getItem('authToken');
        if (tokenToUse) {
          setAuthToken(tokenToUse);
        } else {
          console.error('❌ No auth token available');
          Alert.alert('Error', 'Authentication required. Please login again.');
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      const apiUrl = `${API_BASE_URL}/api/seller/orders?sellerId=${currentSellerId}`;
      const headers = {
        Authorization: `Bearer ${tokenToUse}`,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(apiUrl, { headers, timeout: 10000 });

      let ordersArray: any[] = [];
      if (response.data) {
        if (response.data.success && Array.isArray(response.data.orders)) {
          ordersArray = response.data.orders;
        } else if (Array.isArray(response.data)) {
          ordersArray = response.data;
        } else if (
          response.data.orders &&
          Array.isArray(response.data.orders)
        ) {
          ordersArray = response.data.orders;
        }
      }

      const mappedOrders: Order[] = [];
      if (Array.isArray(ordersArray)) {
        ordersArray.forEach((order: any) => {
          try {
            mappedOrders.push(mapApiOrderToUI(order));
          } catch (error) {
            console.error('❌ Error mapping order:', error);
          }
        });
      }

      setOrders(mappedOrders);
    } catch (error: any) {
      console.error('❌ Error fetching orders:', error);
      let errorMessage = 'Failed to fetch orders. Please try again.';
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Session expired. Please login again.';
          await AsyncStorage.removeItem('authToken');
          setAuthToken(null);
        } else if (error.response.status === 404) {
          errorMessage = 'Seller not found.';
        } else if (error.response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          errorMessage = error.response.data?.message || errorMessage;
        }
      } else if (error.request) {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      Alert.alert('Error', errorMessage);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const extractProductIdFromOrder = (order: Order): string => {
    if (order.productId && order.productId !== 'undefined') {
      return order.productId;
    }
    if (order.items && order.items.length > 0) {
      if (order.items[0].productId) return order.items[0].productId;
      if (order.items[0].productData?._id)
        return order.items[0].productData._id;
      if (order.items[0].productData?.id) return order.items[0].productData.id;
    }
    return order._id || `fallback_product_${Date.now()}`;
  };

  const getOrderSection = (order: Order): 'pending' | 'assigned' | 'other' => {
    const deliveryStatus = order.deliveryStatus?.toLowerCase() || '';
    if (deliveryStatus === 'waiting_for_seller') {
      return 'pending';
    } else if (
      deliveryStatus === 'pending_rider_accept' ||
      deliveryStatus === 'assigned' ||
      deliveryStatus === 'waiting_for_rider' ||
      deliveryStatus === 'picked_up' ||
      deliveryStatus === 'delivered'
    ) {
      return 'assigned';
    }
    return 'other';
  };

  const getDeliveryStatusColor = (
    deliveryStatus: string | undefined,
  ): string => {
    if (!deliveryStatus) return colors.textTertiary;
    const statusLower = deliveryStatus.toLowerCase();
    switch (statusLower) {
      case 'waiting_for_seller':
        return colors.warning;
      case 'pending_rider_accept':
        return colors.purple;
      case 'assigned':
        return colors.info;
      case 'waiting_for_rider':
        return colors.primary;
      case 'picked_up':
        return colors.purple;
      case 'delivered':
        return colors.success;
      default:
        return colors.textTertiary;
    }
  };

  const formatDeliveryStatusText = (
    deliveryStatus: string | undefined,
  ): string => {
    if (!deliveryStatus) return 'Waiting';
    const statusMap: Record<string, string> = {
      waiting_for_seller: 'Pending',
      pending_rider_accept: 'Awaiting Rider',
      assigned: 'Assigned',
      waiting_for_rider: 'Rider En Route',
      picked_up: 'Picked Up',
      delivered: 'Delivered',
    };
    return statusMap[deliveryStatus.toLowerCase()] || deliveryStatus;
  };

  const getDeliveryStatusIcon = (deliveryStatus: string | undefined) => {
    if (!deliveryStatus)
      return <MaterialIcons name="access-time" size={12} color="#FFFFFF" />;
    const statusLower = deliveryStatus.toLowerCase();
    switch (statusLower) {
      case 'waiting_for_seller':
        return <MaterialIcons name="access-time" size={12} color="#FFFFFF" />;
      case 'pending_rider_accept':
      case 'assigned':
      case 'waiting_for_rider':
        return <MaterialIcons name="person" size={12} color="#FFFFFF" />;
      case 'picked_up':
        return (
          <MaterialIcons name="local-shipping" size={12} color="#FFFFFF" />
        );
      case 'delivered':
        return <MaterialIcons name="check-circle" size={12} color="#FFFFFF" />;
      default:
        return <MaterialIcons name="warning" size={12} color="#FFFFFF" />;
    }
  };

  const getPaymentStatusInfo = (order: Order) => {
    const paymentStatus =
      order.paymentStatus?.toLowerCase() || order.status?.toLowerCase() || '';
    const paymentIntentId = order.paymentIntentId;

    if (
      !paymentIntentId ||
      paymentIntentId === 'cod' ||
      paymentStatus === 'cod'
    ) {
      return {
        text: 'COD',
        color: colors.warning,
        icon: <FontAwesome name="money" size={10} color="#FFFFFF" />,
      };
    }

    switch (paymentStatus) {
      case 'succeeded':
      case 'paid':
      case 'confirmed':
        return {
          text: 'Paid',
          color: colors.success,
          icon: <FontAwesome name="check-circle" size={10} color="#FFFFFF" />,
        };
      case 'pending':
      case 'processing':
        return {
          text: 'Processing',
          color: colors.warning,
          icon: <MaterialIcons name="access-time" size={10} color="#FFFFFF" />,
        };
      case 'failed':
      case 'cancelled':
        return {
          text: 'Failed',
          color: colors.danger,
          icon: <MaterialIcons name="error" size={10} color="#FFFFFF" />,
        };
      default:
        return {
          text: paymentStatus || 'Pending',
          color: colors.textTertiary,
          icon: <MaterialIcons name="payment" size={10} color="#FFFFFF" />,
        };
    }
  };

  const autoAssignRider = async (order: Order): Promise<void> => {
    try {
      let tokenToUse = authToken;
      if (!tokenToUse) {
        tokenToUse = await AsyncStorage.getItem('authToken');
        if (!tokenToUse) {
          Alert.alert('Error', 'Authentication token not found');
          return;
        }
        setAuthToken(tokenToUse);
      }

      setProcessingOrder(order._id || order.orderId || '');

      const sellerAddress = order.sellerAddress || {};
      const buyerAddress = order.buyerAddress || {};
      const productId = extractProductIdFromOrder(order);

      const requestData = {
        orderId: order.orderId,
        productId: productId,
        mode: 'auto',
        buyerName: order.buyerName || 'Customer',
        sellerId: sellerId,
        buyerId: order.userId,
        finalAmount: order.finalAmount,
        status: order.status,
        sellerAddress: {
          latitude: sellerAddress.latitude || 0,
          longitude: sellerAddress.longitude || 0,
          address: sellerAddress.address || 'Seller Address',
        },
        buyerAddress: {
          latitude: buyerAddress.latitude || 0,
          longitude: buyerAddress.longitude || 0,
          address: buyerAddress.address || 'Buyer Address',
        },
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/shipping/assign-rider`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      if (response.data && response.data.success) {
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        Alert.alert(
          'Success',
          'Rider assigned successfully! Rider will receive the delivery request.',
        );
        setOrders(prevOrders =>
          prevOrders.map(o =>
            o.orderId === order.orderId || o._id === order._id
              ? {
                  ...o,
                  deliveryStatus: 'pending_rider_accept',
                  isConfirmed: true,
                  shippingRider: response.data.rider,
                }
              : o,
          ),
        );
      } else {
        throw new Error(response.data?.message || 'Failed to assign rider');
      }
    } catch (error: any) {
      console.error('Error auto assigning rider:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message ||
          'Failed to assign rider. Please try again.',
      );
    } finally {
      setProcessingOrder(null);
    }
  };

  const manualAssignRider = async (
    order: Order,
    shippingPartner: ShippingPartner,
  ): Promise<void> => {
    try {
      let tokenToUse = authToken;
      if (!tokenToUse) {
        tokenToUse = await AsyncStorage.getItem('authToken');
        if (!tokenToUse) {
          Alert.alert('Error', 'Authentication token not found');
          return;
        }
        setAuthToken(tokenToUse);
      }

      setProcessingOrder(order._id || order.orderId || '');

      const sellerAddress = order.sellerAddress || {};
      const buyerAddress = order.buyerAddress || {};
      const productId = extractProductIdFromOrder(order);
      const riderId = shippingPartner.id;

      const requestData = {
        orderId: order.orderId,
        productId: productId,
        mode: 'manual',
        buyerName: order.buyerName || 'Customer',
        status: order.status,
        finalAmount: order.finalAmount,
        sellerId: sellerId,
        buyerId: order.userId,
        sellerAddress: {
          latitude: sellerAddress.latitude || 0,
          longitude: sellerAddress.longitude || 0,
          address: sellerAddress.address || 'Seller Address',
        },
        buyerAddress: {
          latitude: buyerAddress.latitude || 0,
          longitude: buyerAddress.longitude || 0,
          address: buyerAddress.address || 'Buyer Address',
        },
        selectedRider: {
          name: shippingPartner.name,
          vehicleType: shippingPartner.vehicleType,
        },
        riderId: riderId,
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/shipping/assign-rider`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      if (response.data && response.data.success) {
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        Alert.alert(
          'Success',
          `Order assigned! ${shippingPartner.name} will receive the delivery request.`,
        );
        setOrders(prevOrders =>
          prevOrders.map(o =>
            o.orderId === order.orderId || o._id === order._id
              ? {
                  ...o,
                  deliveryStatus: 'pending_rider_accept',
                  isConfirmed: true,
                  shippingRider: response.data.rider || shippingPartner,
                }
              : o,
          ),
        );
        setShowShippingModal(false);
        setSelectedOrderForShipping(null);
      } else {
        throw new Error(response.data?.message || 'Failed to assign rider');
      }
    } catch (error: any) {
      console.error('Error manual assigning rider:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message ||
          'Failed to assign rider. Please try again.',
      );
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleApproveOrder = (order: Order) => {
    ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    Alert.alert(
      'Assign Delivery Rider',
      'How would you like to assign rider?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () =>
            ReactNativeHapticFeedback.trigger('selection', hapticOptions),
        },
        {
          text: 'AUTO Assign Rider',
          onPress: () => {
            ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
            autoAssignRider(order);
          },
        },
        {
          text: 'MANUAL Select Rider',
          onPress: () => {
            ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
            setSelectedOrderForShipping(order);
            setShowShippingModal(true);
          },
        },
      ],
    );
  };

  const handleSelectShippingPartner = (shippingPartner: ShippingPartner) => {
    if (selectedOrderForShipping) {
      manualAssignRider(selectedOrderForShipping, shippingPartner);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      return () => {};
    }, []),
  );

  const loadData = async (): Promise<void> => {
    setLoading(true);
    const id = await extractSellerIdFromToken();
    if (id) {
      await fetchOrders(id);
    } else {
      Alert.alert('Error', 'Unable to get seller information');
      setLoading(false);
    }
  };

  const onRefresh = async (): Promise<void> => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setRefreshing(true);
    const id = sellerId || (await extractSellerIdFromToken());
    if (id) {
      await fetchOrders(id);
    } else {
      setRefreshing(false);
      Alert.alert('Error', 'Unable to get seller information');
    }
  };

  const isOrderPending = (order: Order): boolean =>
    getOrderSection(order) === 'pending';
  const isOrderAssigned = (order: Order): boolean =>
    getOrderSection(order) === 'assigned';
  const shouldShowAssignButton = (order: Order): boolean =>
    order.deliveryStatus?.toLowerCase() === 'waiting_for_seller';

  const getFilteredOrders = () => {
    switch (selectedTab) {
      case 'pending':
        return orders.filter(order => isOrderPending(order));
      case 'assigned':
        return orders.filter(order => isOrderAssigned(order));
      default:
        return orders;
    }
  };

  const getProductTitle = (order: Order): string => {
    if (
      order.items &&
      order.items.length > 0 &&
      order.items[0].productData?.title
    ) {
      return order.items[0].productData.title;
    }
    return 'Product';
  };

  const getItemCount = (order: Order): number => {
    if (order.items && order.items.length > 0) {
      return order.items.reduce(
        (total, item) => total + (item.quantity || 1),
        0,
      );
    }
    return 0;
  };

  const renderStatsCard = () => {
    const pendingOrdersCount = orders.filter(order =>
      isOrderPending(order),
    ).length;
    const assignedOrdersCount = orders.filter(order =>
      isOrderAssigned(order),
    ).length;
    const totalRevenue = orders.reduce(
      (sum, order) => sum + (order.finalAmount || 0),
      0,
    );

    return (
      <View style={styles.statsContainer}>
        <View
          style={[styles.statCard, { backgroundColor: colors.cardBackground }]}
        >
          <View
            style={[
              styles.statIconContainer,
              { backgroundColor: colors.primary + '15' },
            ]}
          >
            <MaterialIcons
              name="shopping-bag"
              size={18}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
            {orders.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total
          </Text>
        </View>
        <View
          style={[styles.statCard, { backgroundColor: colors.cardBackground }]}
        >
          <View
            style={[
              styles.statIconContainer,
              { backgroundColor: colors.warning + '15' },
            ]}
          >
            <MaterialIcons
              name="access-time"
              size={18}
              color={colors.warning}
            />
          </View>
          <Text style={[styles.statNumber, { color: colors.warning }]}>
            {pendingOrdersCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Pending
          </Text>
        </View>
        <View
          style={[styles.statCard, { backgroundColor: colors.cardBackground }]}
        >
          <View
            style={[
              styles.statIconContainer,
              { backgroundColor: colors.success + '15' },
            ]}
          >
            <MaterialIcons
              name="check-circle"
              size={18}
              color={colors.success}
            />
          </View>
          <Text style={[styles.statNumber, { color: colors.success }]}>
            {assignedOrdersCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Assigned
          </Text>
        </View>
      </View>
    );
  };

  const renderOrderItem = (order: Order, index: number) => {
    const productTitle = getProductTitle(order);
    const itemCount = getItemCount(order);
    const displayAmount = order.finalAmount || order.productFinalPrice || 0;
    const formattedDate = formatDate(order.createdAt);
    const statusText = formatDeliveryStatusText(order.deliveryStatus);
    const statusColor = getDeliveryStatusColor(order.deliveryStatus);
    const statusIcon = getDeliveryStatusIcon(order.deliveryStatus);
    const paymentStatusInfo = getPaymentStatusInfo(order);
    const isProcessing =
      processingOrder === order.orderId || processingOrder === order._id;
    const hasRiderAssigned = order.shippingRider;
    const showAssignButton = shouldShowAssignButton(order);

    return (
      <TouchableOpacity
        key={order.orderId || order._id || `order-${index}`}
        style={[
          styles.orderCard,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
          },
        ]}
        onPress={() => {
          ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
          if (order.orderId) {
            navigation.navigate('OrderDetails', {
              orderId: order.orderId,
              orderData: order,
            });
          }
        }}
        activeOpacity={0.9}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <View
              style={[
                styles.orderIconContainer,
                { backgroundColor: statusColor + '15' },
              ]}
            >
              <MaterialIcons
                name="shopping-bag"
                size={16}
                color={statusColor}
              />
            </View>
            <View style={styles.orderInfo}>
              <Text style={[styles.orderId, { color: colors.textPrimary }]}>
                {order.orderId || `ORDER${index + 1000}`}
              </Text>
              <Text style={[styles.orderTime, { color: colors.textTertiary }]}>
                {formattedDate}
              </Text>
            </View>
          </View>
          <View style={styles.statusBadgeRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColor, marginRight: 6 },
              ]}
            >
              {statusIcon}
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: paymentStatusInfo.color },
              ]}
            >
              {paymentStatusInfo.icon}
              <Text style={styles.statusText}>{paymentStatusInfo.text}</Text>
            </View>
          </View>
        </View>

        {(hasRiderAssigned ||
          order.deliveryStatus === 'pending_rider_accept' ||
          order.deliveryStatus === 'assigned' ||
          order.deliveryStatus === 'waiting_for_rider' ||
          order.deliveryStatus === 'picked_up' ||
          order.deliveryStatus === 'delivered') && (
          <View
            style={[
              styles.riderBadge,
              {
                backgroundColor: colors.info + '15',
                marginTop: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons
                name="delivery-dining"
                size={10}
                color={colors.info}
              />
              <Text
                style={[
                  styles.riderText,
                  { color: colors.info, marginLeft: 4 },
                ]}
              >
                {order.shippingRider?.name
                  ? `${order.shippingRider.name} • ${
                      order.shippingRider?.vehicleType || 'Bike'
                    }`
                  : 'Rider to be assigned'}
              </Text>
            </View>
            {order.shippingRider?.vehicleType && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons
                  name={
                    order.shippingRider.vehicleType
                      .toLowerCase()
                      .includes('bike')
                      ? 'bicycle'
                      : order.shippingRider.vehicleType
                          .toLowerCase()
                          .includes('car')
                      ? 'car'
                      : 'bicycle'
                  }
                  size={10}
                  color={colors.info}
                />
                <Text
                  style={[
                    styles.riderText,
                    { color: colors.info, marginLeft: 2 },
                  ]}
                >
                  {order.shippingRider.vehicleType}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.divider} />
        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <FontAwesome name="user" size={12} color={colors.textSecondary} />
            <Text
              style={[
                styles.detailText,
                { color: colors.textPrimary, marginLeft: 6 },
              ]}
            >
              {order.buyerName || 'N/A'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <FontAwesome
              name="calendar"
              size={12}
              color={colors.textSecondary}
            />
            <Text
              style={[
                styles.detailText,
                { color: colors.textSecondary, marginLeft: 6 },
              ]}
            >
              Ordered: {formattedDate.split(',')[0]}
            </Text>
          </View>
          <View style={styles.productInfo}>
            <Text style={[styles.productTitle, { color: colors.textPrimary }]}>
              {productTitle}
            </Text>
            <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.amountSection}>
            <View style={styles.amountRow}>
              <FontAwesome name="rupee" size={14} color={colors.success} />
              <Text style={[styles.orderAmount, { color: colors.success }]}>
                ₹{displayAmount.toFixed(2)}
              </Text>
            </View>
            {order.productMrp && order.productMrp > displayAmount && (
              <Text style={[styles.mrpAmount, { color: colors.textTertiary }]}>
                M.R.P: ₹{order.productMrp.toFixed(2)}
              </Text>
            )}
          </View>
          <View style={styles.quickStats}>
            <View
              style={[
                styles.statPill,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.03)',
                },
              ]}
            >
              <Text
                style={[styles.statPillText, { color: colors.textSecondary }]}
              >
                ₹{order.productPrice?.toFixed(2) || '0.00'}
              </Text>
              <Text
                style={[styles.statPillLabel, { color: colors.textTertiary }]}
              >
                Price
              </Text>
            </View>
            {order.productGst && order.productGst > 0 && (
              <View
                style={[
                  styles.statPill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.03)',
                  },
                ]}
              >
                <Text
                  style={[styles.statPillText, { color: colors.textSecondary }]}
                >
                  ₹{order.productGst.toFixed(2)}
                </Text>
                <Text
                  style={[styles.statPillLabel, { color: colors.textTertiary }]}
                >
                  GST
                </Text>
              </View>
            )}
            <View
              style={[
                styles.statPill,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.03)',
                },
              ]}
            >
              <Text
                style={[
                  styles.statPillText,
                  {
                    color:
                      order.deliveryCharge === 0
                        ? colors.success
                        : colors.textSecondary,
                  },
                ]}
              >
                {order.deliveryCharge === 0
                  ? 'FREE'
                  : `₹${order.deliveryCharge?.toFixed(2) || '0.00'}`}
              </Text>
              <Text
                style={[styles.statPillLabel, { color: colors.textTertiary }]}
              >
                Delivery
              </Text>
            </View>
          </View>

          {showAssignButton && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.success },
                isProcessing && styles.processingButton,
              ]}
              onPress={e => {
                e.stopPropagation();
                handleApproveOrder(order);
              }}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons
                    name="check-circle"
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionButtonText}>Assign Rider</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.viewDetails}
            onPress={() => {
              ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
              if (order.orderId) {
                navigation.navigate('OrderDetails', {
                  orderId: order.orderId,
                  orderData: order,
                });
              }
            }}
          >
            <Text style={[styles.viewDetailsText, { color: colors.primary }]}>
              View Details
            </Text>
            <MaterialIcons
              name="arrow-forward-ios"
              size={10}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const pendingOrdersCount = orders.filter(order =>
    isOrderPending(order),
  ).length;
  const assignedOrdersCount = orders.filter(order =>
    isOrderAssigned(order),
  ).length;
  const filteredOrders = getFilteredOrders();

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your orders...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar
        backgroundColor="transparent"
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />

      <View
        style={[
          styles.headerContainer,
          { backgroundColor: colors.headerBackground },
        ]}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>
              My Orders
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: colors.headerSubtext }]}
            >
              Seller ID:{' '}
              {sellerId ? sellerId.substring(0, 19) + '......' : 'Loading...'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View
              style={[
                styles.orderCountBadge,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.orderCountText}>{orders.length}</Text>
            </View>
          </View>
        </View>
      </View>

      {orders.length > 0 && renderStatsCard()}

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedTab === 'all' && [
              styles.activeTabButton,
              { backgroundColor: colors.primary },
            ],
            { backgroundColor: colors.cardBackground },
          ]}
          onPress={() => {
            ReactNativeHapticFeedback.trigger('selection', hapticOptions);
            setSelectedTab('all');
          }}
        >
          <View style={styles.tabContent}>
            <MaterialIcons
              name="shopping-bag"
              size={14}
              color={
                selectedTab === 'all'
                  ? isDark
                    ? '#FFFFFF'
                    : '#000000'
                  : colors.textSecondary
              }
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color:
                    selectedTab === 'all'
                      ? isDark
                        ? '#FFFFFF'
                        : '#000000'
                      : colors.textSecondary,
                  fontWeight: selectedTab === 'all' ? '700' : '600',
                },
              ]}
            >
              All ({orders.length})
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedTab === 'pending' && [
              styles.activeTabButton,
              { backgroundColor: colors.warning },
            ],
            { backgroundColor: colors.cardBackground },
          ]}
          onPress={() => {
            ReactNativeHapticFeedback.trigger('selection', hapticOptions);
            setSelectedTab('pending');
          }}
        >
          <View style={styles.tabContent}>
            <MaterialIcons
              name="access-time"
              size={14}
              color={
                selectedTab === 'pending'
                  ? isDark
                    ? '#FFFFFF'
                    : '#000000'
                  : colors.textSecondary
              }
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color:
                    selectedTab === 'pending'
                      ? isDark
                        ? '#FFFFFF'
                        : '#000000'
                      : colors.textSecondary,
                  fontWeight: selectedTab === 'pending' ? '700' : '600',
                },
              ]}
            >
              Pending ({pendingOrdersCount})
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedTab === 'assigned' && [
              styles.activeTabButton,
              { backgroundColor: colors.success },
            ],
            { backgroundColor: colors.cardBackground },
          ]}
          onPress={() => {
            ReactNativeHapticFeedback.trigger('selection', hapticOptions);
            setSelectedTab('assigned');
          }}
        >
          <View style={styles.tabContent}>
            <MaterialIcons
              name="check-circle"
              size={14}
              color={
                selectedTab === 'assigned'
                  ? isDark
                    ? '#FFFFFF'
                    : '#000000'
                  : colors.textSecondary
              }
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color:
                    selectedTab === 'assigned'
                      ? isDark
                        ? '#FFFFFF'
                        : '#000000'
                      : colors.textSecondary,
                  fontWeight: selectedTab === 'assigned' ? '700' : '600',
                },
              ]}
            >
              Assigned ({assignedOrdersCount})
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            titleColor={colors.textPrimary}
            progressBackgroundColor={colors.background}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          filteredOrders.length === 0 && styles.emptyScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconContainer,
                { backgroundColor: colors.cardBackground },
              ]}
            >
              <MaterialIcons
                name="shopping-bag"
                size={40}
                color={colors.textTertiary}
              />
            </View>
            <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
              {selectedTab === 'all'
                ? 'No orders yet'
                : selectedTab === 'pending'
                ? 'No pending orders'
                : 'No assigned orders'}
            </Text>
            <Text
              style={[styles.emptySubtext, { color: colors.textSecondary }]}
            >
              {selectedTab === 'all'
                ? 'When customers place orders, they will appear here'
                : selectedTab === 'pending'
                ? 'All orders are currently assigned'
                : 'Assign riders to pending orders to see them here'}
            </Text>
            <TouchableOpacity
              style={[
                styles.refreshButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={onRefresh}
            >
              <Text style={styles.refreshButtonText}>Refresh Orders</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {selectedTab === 'all'
                ? 'All Orders'
                : selectedTab === 'pending'
                ? 'Pending Orders'
                : 'Assigned Orders'}{' '}
              • {filteredOrders.length}
            </Text>
            {filteredOrders
              .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
              })
              .map((order: Order, index: number) =>
                renderOrderItem(order, index),
              )}
            <View style={{ height: 80 }} />
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.floatingButton,
          { backgroundColor: colors.primary, shadowColor: colors.primary },
        ]}
        onPress={() => {
          ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
          onRefresh();
        }}
      >
        <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {selectedOrderForShipping && (
        <ManualShippingModal
          visible={showShippingModal}
          onClose={() => {
            ReactNativeHapticFeedback.trigger('selection', hapticOptions);
            setShowShippingModal(false);
            setSelectedOrderForShipping(null);
          }}
          onSelectPartner={handleSelectShippingPartner}
          order={selectedOrderForShipping}
          colors={colors}
          isDark={isDark}
          authToken={authToken}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
    opacity: 0.8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  orderCountText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 15,
    marginBottom: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: 10, fontWeight: '500', opacity: 0.8 },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  activeTabButton: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: { marginRight: 6 },
  tabButtonText: { fontSize: 12, letterSpacing: -0.2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyScrollContent: { flexGrow: 1, justifyContent: 'center' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyContainer: { alignItems: 'center', paddingTop: 20, paddingBottom: 40 },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginHorizontal: 30,
    marginBottom: 24,
    lineHeight: 18,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 5,
    letterSpacing: -0.3,
  },
  orderCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  orderIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  orderInfo: { flex: 1 },
  orderId: {
    fontSize: 10,
    fontWeight: '200',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  orderTime: { fontSize: 10, fontWeight: '500', opacity: 0.8 },
  statusBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: { color: '#FFFFFF', fontSize: 9, fontWeight: '600' },
  riderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  riderText: { fontSize: 10, fontWeight: '600' },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 12,
  },
  orderDetails: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailText: { fontSize: 12, fontWeight: '500' },
  productInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.3,
  },
  itemCount: { fontSize: 11, fontWeight: '500', opacity: 0.8 },
  amountSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderAmount: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  mrpAmount: {
    fontSize: 11,
    textDecorationLine: 'line-through',
    fontWeight: '500',
    opacity: 0.7,
  },
  quickStats: { flexDirection: 'row', gap: 6, marginTop: 8 },
  statPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  statPillText: { fontSize: 10, fontWeight: '600' },
  statPillLabel: { fontSize: 8, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  processingButton: { opacity: 0.8 },
  actionButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
    paddingVertical: 4,
  },
  viewDetailsText: { fontSize: 11, fontWeight: '600' },
  refreshButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  refreshButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1000,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 12, marginTop: 2, opacity: 0.8 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderInfoCard: {
    margin: 20,
    marginTop: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderInfoItem: { alignItems: 'flex-start' },
  orderInfoLabel: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  orderInfoValue: { fontSize: 14, fontWeight: '700' },
  addressText: { fontSize: 12, marginTop: 4 },
  partnersTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 20,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyPartnersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyPartnersText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyPartnersSubtext: { fontSize: 14, textAlign: 'center', color: '#64748B' },
  partnersList: { paddingHorizontal: 20, paddingBottom: 20 },
  shippingPartnerCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  shippingPartnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  shippingPartnerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  vehicleImageContainer: { marginRight: 10 },
  vehicleImage: { width: 30, height: 30, borderRadius: 8 },
  vehicleIconPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: { flex: 1 },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  driverName: { fontSize: 14, fontWeight: '700', marginRight: 8 },
  availableBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  availableText: { fontSize: 10, fontWeight: '600' },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, fontWeight: '600', marginLeft: 2 },
  vehicleText: { fontSize: 11, fontWeight: '500' },
  capacityInfo: { alignItems: 'flex-end' },
  capacityNumber: { fontSize: 14, fontWeight: '700' },
  capacityLabel: { fontSize: 10, marginTop: 2, opacity: 0.8 },
  orderStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  orderStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderStatDot: { width: 6, height: 6, borderRadius: 3 },
  orderStatText: { fontSize: 11, fontWeight: '500' },
  shippingPartnerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chatIcon: { width: 16, height: 16, borderRadius: 4 },
  chatButtonText: { color: '#000000ff', fontSize: 12, fontWeight: '600' },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  selectedText: { fontSize: 12, fontWeight: '600' },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  cancelButtonText: { fontSize: 14, fontWeight: '600' },
  confirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default SellerOrdersScreen;
