// SellerOrdersScreen.tsx - FULLY FIXED FOR BOTH SELLER & FWS

import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../../../contexts/theme/ThemeContext';

// Import vector icons
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Import Haptics
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const { width, height } = Dimensions.get('window');

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

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

type TrackingHistoryEntry = {
  status: string;
  holderType: string;
  holderId?: string;
  timestamp?: string;
  location?: string;
  notes?: string;
  scanInfo?: {
    status: string;
    holderType: string;
    holderId: string;
    holderName?: string;
    note: string;
    fwsProcessingStage?: string;
    createdAt: string;
  };
};

type QROwnershipEntry = {
  holderId: string;
  holderType: string;
  holderName: string;
  receivedAt: string;
  releasedAt?: string;
};

type QRCodeData = {
  showQR: boolean;
  completed?: boolean;
  message?: string;
  qrCodeUrl?: string;
  qrData?: string;
  holderType?: string;
  status?: string;
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
  productGstRate?: number;
  deliveryCharge?: number;
  finalAmount?: number;
  status?: string;
  paymentIntentId?: string;
  paymentStatus?: string;
  buyerAddress?: BuyerAddress;
  sellerAddress?: SellerAddress;
  createdAt?: string;
  updatedAt?: string;
  isConfirmed?: boolean;
  fulfillmentType?: 'SELLER' | 'FWS';
  currentHolderType?: string;
  currentStatus?: string;
  shippingRider?: {
    id: string;
    name: string;
    phoneNumber?: string;
    vehicleType?: string;
  };
  metadata?: {
    idempotencyKey?: string;
    cartId?: string;
    createdAt?: string;
  };
  trackingHistory?: TrackingHistoryEntry[] | null;
  qrOwnershipHistory?: QROwnershipEntry[] | null;
  qrCodeData?: QRCodeData | null;
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
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleNumber?: string;
  price?: number;
  imageUrl?: string;
  vehicleImage?: string;
  isAvailable: boolean;
  phoneNumber?: string;
  maxOrdersPerDay: number;
  currentOrders: number;
  orderStats?: OrderStats;
  shippingType?: string;
  city?: string;
  state?: string;
  kyc?: any;
};

const API_BASE_URL = 'http://172.20.245.121:5000';

// Theme colors
const getThemeColors = (isDark: boolean) => {
  return {
    background: isDark ? '#0F172A' : '#F8FAFC',
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
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
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

// ==================================================
// QR CODE MODAL COMPONENT
// ==================================================
const QRCodeModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  qrCodeUrl: string;
  orderId: string;
  colors: any;
}> = ({ visible, onClose, qrCodeUrl, orderId, colors }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.qrModalOverlay}>
        <View
          style={[
            styles.qrModalContainer,
            { backgroundColor: colors.cardBackground },
          ]}
        >
          <View style={styles.qrModalHeader}>
            <Text style={[styles.qrModalTitle, { color: colors.textPrimary }]}>
              Handover QR Code
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.qrCloseButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.qrCodeWrapper}>
            {qrCodeUrl ? (
              <Image
                source={{ uri: qrCodeUrl }}
                style={styles.qrCodeImage}
                resizeMode="contain"
              />
            ) : (
              <ActivityIndicator size="large" color={colors.primary} />
            )}
          </View>

          <Text style={[styles.qrOrderId, { color: colors.textSecondary }]}>
            Order ID: {orderId}
          </Text>
          <Text style={[styles.qrInstruction, { color: colors.textTertiary }]}>
            Show this QR code to the rider/truck driver for handover
            verification
          </Text>

          <TouchableOpacity
            style={[styles.qrDoneButton, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={styles.qrDoneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ==================================================
// ✅ FIXED: TRACKING HISTORY HELPER FUNCTIONS
// ==================================================

const hasSellerAccepted = (
  trackingHistory?: TrackingHistoryEntry[] | null,
): boolean => {
  if (!trackingHistory) return false;
  return trackingHistory.some(
    entry =>
      entry.status === 'waiting_for_assignment' &&
      entry.holderType === 'SELLER',
  );
};

const hasAssignmentSent = (
  trackingHistory?: TrackingHistoryEntry[] | null,
): boolean => {
  if (!trackingHistory) return false;
  return trackingHistory.some(entry => entry.status === 'assignment_sent');
};

const hasIntransitToFWS = (
  trackingHistory?: TrackingHistoryEntry[] | null,
): boolean => {
  if (!trackingHistory) return false;
  return trackingHistory.some(entry => entry.status === 'in_transit_to_fws');
};

const hasReceivedAtFWS = (
  trackingHistory?: TrackingHistoryEntry[] | null,
): boolean => {
  if (!trackingHistory) return false;
  return trackingHistory.some(entry => entry.status === 'received_at_fws');
};

const hasScannedAtFWS = (
  trackingHistory?: TrackingHistoryEntry[] | null,
): boolean => {
  if (!trackingHistory) return false;
  return trackingHistory.some(entry => entry.status === 'scanned_at_fws');
};

const hasReadyForDispatch = (
  trackingHistory?: TrackingHistoryEntry[] | null,
): boolean => {
  if (!trackingHistory) return false;
  return trackingHistory.some(entry => entry.status === 'ready_for_dispatch');
};

const hasInTransit = (
  trackingHistory?: TrackingHistoryEntry[] | null,
): boolean => {
  if (!trackingHistory) return false;
  return trackingHistory.some(entry => entry.status === 'in_transit');
};

const isOrderDelivered = (
  trackingHistory?: TrackingHistoryEntry[] | null,
): boolean => {
  if (!trackingHistory) return false;
  return trackingHistory.some(entry => entry.status === 'delivered');
};

// ✅ FIXED: Get Delivery Status Text - DELIVERED FIRST PRIORITY
const getDeliveryStatusText = (order: Order): string => {
  const trackingHistory = order.trackingHistory;

  // 🔴 HIGHEST PRIORITY: Check delivered first
  if (isOrderDelivered(trackingHistory)) return 'Delivered';
  if (hasInTransit(trackingHistory)) return 'In Transit';
  if (hasReadyForDispatch(trackingHistory)) return 'Ready for Dispatch';
  if (hasScannedAtFWS(trackingHistory)) return 'Scanned at FWS';
  if (hasReceivedAtFWS(trackingHistory)) return 'Received at FWS';
  if (hasIntransitToFWS(trackingHistory)) return 'In Transit to FWS';
  if (hasAssignmentSent(trackingHistory)) return 'Assignment Sent';
  if (hasSellerAccepted(trackingHistory)) return 'Accepted';

  return 'Pending';
};

// ✅ FIXED: Get Delivery Status Color - DELIVERED FIRST PRIORITY
const getDeliveryStatusColor = (order: Order): string => {
  const trackingHistory = order.trackingHistory;

  // 🔴 HIGHEST PRIORITY: Delivered = Green
  if (isOrderDelivered(trackingHistory)) return '#10B981';
  if (hasInTransit(trackingHistory)) return '#3B82F6';
  if (hasReadyForDispatch(trackingHistory)) return '#8B5CF6';
  if (hasScannedAtFWS(trackingHistory)) return '#06B6D4';
  if (hasReceivedAtFWS(trackingHistory)) return '#10B981';
  if (hasIntransitToFWS(trackingHistory)) return '#F59E0B';
  if (hasAssignmentSent(trackingHistory)) return '#F59E0B';
  if (hasSellerAccepted(trackingHistory)) return '#3B82F6';

  return '#F59E0B';
};

// ==================================================
// QR CODE BUTTON LOGIC - FIXED FOR FWS
// ==================================================
const shouldShowQRCodeButton = (order: Order): boolean => {
  const trackingHistory = order.trackingHistory;
  const qrOwnershipHistory = order.qrOwnershipHistory;
  const currentHolderType = order.currentHolderType;

  if (!trackingHistory) return false;

  // Don't show if delivered
  if (isOrderDelivered(trackingHistory)) return false;

  // ✅ CRITICAL: Only show QR if current holder is SELLER
  if (currentHolderType && currentHolderType !== 'SELLER') {
    return false;
  }

  // ✅ Check QR ownership history - last holder must be SELLER with no release
  if (qrOwnershipHistory && qrOwnershipHistory.length > 0) {
    const lastHolder = qrOwnershipHistory[qrOwnershipHistory.length - 1];
    if (lastHolder.holderType !== 'SELLER') {
      return false;
    }
    if (lastHolder.releasedAt) {
      return false;
    }
  }

  // For FWS fulfillment: Show QR when in_transit_to_fws
  if (order.fulfillmentType === 'FWS') {
    return hasIntransitToFWS(trackingHistory);
  }

  // For SELLER fulfillment: Show QR when assignment_sent
  if (order.fulfillmentType === 'SELLER') {
    return hasAssignmentSent(trackingHistory);
  }

  return false;
};

// ==================================================
// COMPLETION MESSAGE - FIXED FOR FWS
// ==================================================
const getCompletionMessage = (order: Order): string | null => {
  const trackingHistory = order.trackingHistory;

  // If delivered, show completion for both FWS and SELLER
  if (isOrderDelivered(trackingHistory)) {
    return 'Order delivered successfully!';
  }

  // For FWS fulfillment: Show completion when FWS received
  if (order.fulfillmentType === 'FWS') {
    if (hasReceivedAtFWS(trackingHistory) || hasScannedAtFWS(trackingHistory)) {
      return 'Parcel received at FWS warehouse! Your work is done.';
    }
  }

  // For SELLER fulfillment: Show completion when handed to rider/truck
  if (order.fulfillmentType === 'SELLER') {
    if (hasInTransit(trackingHistory)) {
      return 'Your work is done! Parcel handed over to delivery partner.';
    }
  }

  return null;
};

// ==================================================
// Manual Shipping Selection Modal Component
// ==================================================
const ManualShippingModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSelectPartner: (partner: ShippingPartner) => void;
  order: Order | null;
  colors: any;
  isDark: boolean;
  authToken: string | null;
}> = ({ visible, onClose, onSelectPartner, order, colors, authToken }) => {
  const [shippingPartners, setShippingPartners] = useState<ShippingPartner[]>(
    [],
  );
  const [loadingPartners, setLoadingPartners] = useState<boolean>(true);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

  useEffect(() => {
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
      const apiUrl = `${API_BASE_URL}/api/v0/shipping/available-shipping`;
      const headers = {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      };
      const response = await axios.get(apiUrl, { headers, timeout: 10000 });

      let ridersArray: any[] = [];
      if (response.data) {
        if (
          response.data.success &&
          Array.isArray(response.data.shippingPartners)
        ) {
          ridersArray = response.data.shippingPartners;
        } else if (Array.isArray(response.data)) {
          ridersArray = response.data;
        } else if (
          response.data.partners &&
          Array.isArray(response.data.partners)
        ) {
          ridersArray = response.data.partners;
        }
      }

      const mappedPartners: ShippingPartner[] = [];
      if (Array.isArray(ridersArray)) {
        ridersArray.forEach((rider: any, index: number) => {
          try {
            mappedPartners.push({
              id: rider._id || rider.id || `shipping-${index}`,
              userId: rider.userId,
              name: rider.name || 'Delivery Partner',
              rating: rider.rating || 4.0,
              vehicleType:
                rider.vehicleCategory ||
                (rider.shippingType === 'RIDER' ? 'Bike' : 'Truck'),
              vehicleBrand: rider.vehicleBrand,
              vehicleModel: rider.vehicleModel,
              vehicleNumber: rider.vehicleNumber,
              vehicleImage: rider.vehicleImage,
              isAvailable: rider.isOnline && rider.isAvailable,
              phoneNumber: rider.phoneNumber,
              maxOrdersPerDay: rider.maxOrdersPerDay || 10,
              currentOrders: rider.orderStats?.assigned || 0,
              orderStats: rider.orderStats,
              shippingType: rider.shippingType,
              city: rider.city,
              state: rider.state,
              kyc: rider.kyc,
            });
          } catch (error) {
            console.error(`Error mapping partner ${index}:`, error);
          }
        });
      }
      setShippingPartners(mappedPartners);
    } catch (error: any) {
      console.error('Error fetching shipping partners:', error);
      setShippingPartners([]);
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleSelectPartner = (partnerId: string, isAvailable: boolean) => {
    if (isAvailable) {
      ReactNativeHapticFeedback.trigger('selection', hapticOptions);
      setSelectedPartner(partnerId);
    }
  };

  const handleConfirm = () => {
    if (selectedPartner) {
      const partner = shippingPartners.find(p => p.id === selectedPartner);
      if (partner) {
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        onSelectPartner(partner);
        onClose();
      }
    }
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
        onPress={() => handleSelectPartner(item.id, availabilityStatus)}
        disabled={!availabilityStatus}
        activeOpacity={0.7}
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
                    name={
                      item.vehicleType === 'Bike'
                        ? 'bicycle-outline'
                        : 'bus-outline'
                    }
                    size={24}
                    color={colors.primary}
                  />
                </View>
              )}
            </View>
            <View style={styles.driverDetails}>
              <View style={styles.driverNameRow}>
                <Text
                  style={[styles.driverName, { color: colors.textPrimary }]}
                  numberOfLines={1}
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
              <View style={styles.capacityContainer}>
                <Text
                  style={[styles.capacityText, { color: colors.textTertiary }]}
                >
                  Orders: {item.currentOrders}/{item.maxOrdersPerDay}
                </Text>
              </View>
            </View>
          </View>
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
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
                  Select Shipping Partner
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Order: {order?.orderId || 'N/A'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.partnersTitle, { color: colors.textPrimary }]}>
            Available Partners (
            {shippingPartners.filter(p => p.isAvailable).length})
          </Text>
          {loadingPartners ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[styles.loadingText, { color: colors.textSecondary }]}
              >
                Finding available partners...
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
                No partners available
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
              onPress={handleConfirm}
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

// ==================================================
// MAIN SELLER ORDERS SCREEN
// ==================================================
const SellerOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [processingFWSOrder, setProcessingFWSOrder] = useState<string | null>(
    null,
  );
  const [selectedTab, setSelectedTab] = useState<
    'all' | 'pending' | 'assigned'
  >('all');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showShippingModal, setShowShippingModal] = useState<boolean>(false);
  const [selectedOrderForShipping, setSelectedOrderForShipping] =
    useState<Order | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState<boolean>(false);
  const [selectedQRCode, setSelectedQRCode] = useState<{
    url: string;
    orderId: string;
  } | null>(null);

  // ==================================================
  // QR CODE API
  // ==================================================
  const fetchQRCode = async (orderId: string): Promise<QRCodeData | null> => {
    try {
      const tokenToUse = authToken || (await AsyncStorage.getItem('authToken'));
      if (!tokenToUse) return null;

      const response = await axios.get(
        `${API_BASE_URL}/api/v0/delivery/tracking/${orderId}/qr`,
        {
          headers: { Authorization: `Bearer ${tokenToUse}` },
          timeout: 10000,
        },
      );

      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      console.error(`QR Code fetch error for ${orderId}:`, error.message);
      return null;
    }
  };

  const handleShowQRCode = async (order: Order) => {
    ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);

    const qrData = await fetchQRCode(order.orderId!);

    if (!qrData) {
      Alert.alert('Error', 'Unable to fetch QR code. Please try again.');
      return;
    }

    if (!qrData.showQR) {
      Alert.alert(
        'Not Available',
        qrData.message || 'QR code is not available for this order.',
      );
      return;
    }

    if (qrData.qrCodeUrl) {
      setSelectedQRCode({ url: qrData.qrCodeUrl, orderId: order.orderId! });
      setQrModalVisible(true);
    } else {
      Alert.alert('Error', 'QR code URL not found.');
    }
  };

  // ==================================================
  // TRACKING API INTEGRATION
  // ==================================================
  const fetchTrackingStatus = async (
    orderId: string,
  ): Promise<{
    trackingHistory: TrackingHistoryEntry[] | null;
    qrOwnershipHistory: QROwnershipEntry[] | null;
  }> => {
    try {
      const tokenToUse = authToken || (await AsyncStorage.getItem('authToken'));
      if (!tokenToUse)
        return { trackingHistory: null, qrOwnershipHistory: null };

      const response = await axios.get(
        `${API_BASE_URL}/api/v0/tracking/history/status`,
        {
          params: { orderId },
          headers: { Authorization: `Bearer ${tokenToUse}` },
          timeout: 10000,
        },
      );

      if (response.data && response.data.success) {
        return {
          trackingHistory: response.data.trackingHistory || null,
          qrOwnershipHistory: response.data.qrOwnershipHistory || null,
        };
      }
      return { trackingHistory: null, qrOwnershipHistory: null };
    } catch (error: any) {
      console.error(
        `Error fetching tracking for order ${orderId}:`,
        error.message,
      );
      return { trackingHistory: null, qrOwnershipHistory: null };
    }
  };

  // ==================================================
  // SELLER LOGIC HELPERS - FIXED
  // ==================================================
  const shouldShowAcceptButton = (order: Order): boolean =>
    !hasSellerAccepted(order.trackingHistory) &&
    !isOrderDelivered(order.trackingHistory);

  const shouldShowAssignButton = (order: Order): boolean => {
    return (
      order.fulfillmentType === 'SELLER' &&
      hasSellerAccepted(order.trackingHistory) &&
      !hasAssignmentSent(order.trackingHistory) &&
      !isOrderDelivered(order.trackingHistory)
    );
  };

  const shouldShowDeliverToFWSButton = (order: Order): boolean => {
    return (
      order.fulfillmentType === 'FWS' &&
      hasSellerAccepted(order.trackingHistory) &&
      !hasIntransitToFWS(order.trackingHistory) &&
      !isOrderDelivered(order.trackingHistory)
    );
  };

  const extractSellerIdFromToken = async (): Promise<string | null> => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      if (!storedToken) return null;
      setAuthToken(storedToken);
      try {
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
        try {
          const tokenParts = storedToken.split('.');
          if (tokenParts.length === 3) {
            const payloadBase64 = tokenParts[1];
            const base64Decode = (base64: string): string => {
              let str = base64.replace(/-/g, '+').replace(/_/g, '/');
              while (str.length % 4) str += '=';
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
            const payloadJson = base64Decode(payloadBase64);
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

  const mapApiOrderToUI = (
    apiOrder: any,
    trackingHistory?: TrackingHistoryEntry[] | null,
    qrOwnershipHistory?: QROwnershipEntry[] | null,
  ): Order => {
    return {
      _id: apiOrder._id,
      orderId: apiOrder.orderId,
      productId: apiOrder.productId,
      sellerId: apiOrder.sellerId,
      userId: apiOrder.userId || apiOrder.buyerId,
      buyerName: apiOrder.buyerName,
      status: apiOrder.status,
      paymentStatus: apiOrder.paymentStatus || apiOrder.status,
      createdAt: apiOrder.createdAt,
      updatedAt: apiOrder.updatedAt,
      finalAmount: apiOrder.finalAmount,
      productFinalPrice: apiOrder.productFinalPrice,
      productPrice: apiOrder.productPrice,
      productMrp: apiOrder.productMrp,
      productGstRate: apiOrder.productGstRate,
      deliveryCharge: apiOrder.deliveryCharge,
      items: apiOrder.items,
      buyerAddress: apiOrder.buyerAddress,
      sellerAddress: apiOrder.sellerAddress,
      isConfirmed: apiOrder.isConfirmed || apiOrder.status === 'confirmed',
      shippingRider: apiOrder.shippingRider || apiOrder.rider,
      paymentIntentId: apiOrder.paymentIntentId,
      fulfillmentType: apiOrder.fulfillmentType,
      metadata: apiOrder.metadata,
      trackingHistory: trackingHistory || null,
      qrOwnershipHistory: qrOwnershipHistory || null,
      qrCodeData: null,
      currentHolderType: apiOrder.currentHolderType || 'SELLER',
      currentStatus: apiOrder.currentStatus || apiOrder.status,
    };
  };

  const fetchOrders = async (currentSellerId: string): Promise<void> => {
    try {
      if (!currentSellerId) {
        console.error('No sellerId provided');
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
          console.error('No auth token available');
          Alert.alert('Error', 'Authentication required. Please login again.');
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      const apiUrl = `${API_BASE_URL}/api/v0/seller/orders?sellerId=${currentSellerId}`;
      const headers = {
        Authorization: `Bearer ${tokenToUse}`,
        'Content-Type': 'application/json',
      };
      const response = await axios.get(apiUrl, { headers, timeout: 10000 });

      let ordersArray: any[] = [];
      if (response.data) {
        if (response.data.success && Array.isArray(response.data.orders))
          ordersArray = response.data.orders;
        else if (Array.isArray(response.data)) ordersArray = response.data;
        else if (response.data.orders && Array.isArray(response.data.orders))
          ordersArray = response.data.orders;
      }

      const mappedOrders: Order[] = [];
      for (const order of ordersArray) {
        try {
          const { trackingHistory, qrOwnershipHistory } =
            await fetchTrackingStatus(order.orderId);
          mappedOrders.push(
            mapApiOrderToUI(order, trackingHistory, qrOwnershipHistory),
          );
        } catch (error) {
          console.error('Error processing order:', error);
          mappedOrders.push(mapApiOrderToUI(order, null, null));
        }
      }
      setOrders(mappedOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      let errorMessage = 'Failed to fetch orders. Please try again.';
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Session expired. Please login again.';
          await AsyncStorage.removeItem('authToken');
          setAuthToken(null);
        } else if (error.response.status === 404)
          errorMessage = 'Seller not found.';
        else if (error.response.status === 500)
          errorMessage = 'Server error. Please try again later.';
        else errorMessage = error.response.data?.message || errorMessage;
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

  const sellerAcceptOrder = async (order: Order): Promise<void> => {
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
      const response = await axios.post(
        `${API_BASE_URL}/api/v0/delivery/tracking/shipping/seller/accept-order`,
        { orderId: order.orderId },
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
          'Order accepted successfully! Now you can assign a shipping partner.',
        );
        if (order.orderId) {
          const { trackingHistory, qrOwnershipHistory } =
            await fetchTrackingStatus(order.orderId);
          setOrders(prevOrders =>
            prevOrders.map(o =>
              o.orderId === order.orderId
                ? {
                    ...o,
                    trackingHistory: trackingHistory || o.trackingHistory,
                    qrOwnershipHistory:
                      qrOwnershipHistory || o.qrOwnershipHistory,
                  }
                : o,
            ),
          );
        }
      } else {
        throw new Error(response.data?.message || 'Failed to accept order');
      }
    } catch (error: any) {
      console.error('Error accepting order:', error);
      let errorMessage = 'Failed to accept order. Please try again.';
      if (error.response)
        errorMessage =
          error.response.data?.error ||
          error.response.data?.message ||
          errorMessage;
      else if (error.request)
        errorMessage = 'Network error. Please check your connection.';
      Alert.alert('Error', errorMessage);
    } finally {
      setProcessingOrder(null);
    }
  };

  const sellerAssignShipping = async (
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
      let shippingTypeValue =
        shippingPartner.shippingType ||
        (shippingPartner.vehicleType?.toLowerCase() === 'bike'
          ? 'RIDER'
          : 'TRUCK');

      const response = await axios.post(
        `${API_BASE_URL}/api/v0/delivery/tracking/shipping/seller/assign/auto-manual`,
        {
          orderId: order.orderId,
          assignmentType: 'MANUAL',
          shippingType: shippingTypeValue,
          shippingId: shippingPartner.userId,
        },
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
          `${shippingPartner.vehicleType} assigned successfully!`,
        );
        if (order.orderId) {
          const { trackingHistory, qrOwnershipHistory } =
            await fetchTrackingStatus(order.orderId);
          setOrders(prevOrders =>
            prevOrders.map(o =>
              o.orderId === order.orderId
                ? {
                    ...o,
                    trackingHistory: trackingHistory || o.trackingHistory,
                    qrOwnershipHistory:
                      qrOwnershipHistory || o.qrOwnershipHistory,
                  }
                : o,
            ),
          );
        }
        setShowShippingModal(false);
        setSelectedOrderForShipping(null);
      } else {
        throw new Error(
          response.data?.message || 'Failed to assign shipping partner',
        );
      }
    } catch (error: any) {
      console.error('Error assigning shipping partner:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error ||
          error.response?.data?.message ||
          'Failed to assign shipping partner.',
      );
    } finally {
      setProcessingOrder(null);
    }
  };

  const promptForShippingTypeAndAutoAssign = (order: Order) => {
    Alert.alert(
      'Auto Assign Shipping',
      'Please choose the type of vehicle for auto-assignment:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () =>
            ReactNativeHapticFeedback.trigger('selection', hapticOptions),
        },
        {
          text: 'Rider',
          onPress: () => {
            ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
            sellerAutoAssignWithType(order, 'RIDER');
          },
        },
        {
          text: 'Truck',
          onPress: () => {
            ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
            sellerAutoAssignWithType(order, 'TRUCK');
          },
        },
      ],
    );
  };

  const sellerAutoAssignWithType = async (
    order: Order,
    shippingType: 'RIDER' | 'TRUCK',
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
      const response = await axios.post(
        `${API_BASE_URL}/api/v0/delivery/tracking/shipping/seller/assign/auto-manual`,
        { orderId: order.orderId, assignmentType: 'AUTO', shippingType },
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
          'Auto-Assign Success',
          `${shippingType} automatically assigned.`,
        );
        if (order.orderId) {
          const { trackingHistory, qrOwnershipHistory } =
            await fetchTrackingStatus(order.orderId);
          setOrders(prevOrders =>
            prevOrders.map(o =>
              o.orderId === order.orderId
                ? {
                    ...o,
                    trackingHistory: trackingHistory || o.trackingHistory,
                    qrOwnershipHistory:
                      qrOwnershipHistory || o.qrOwnershipHistory,
                  }
                : o,
            ),
          );
        }
      } else {
        throw new Error(
          response.data?.message || 'Failed to auto-assign shipping partner',
        );
      }
    } catch (error: any) {
      console.error('Error auto-assigning:', error);
      Alert.alert(
        'Auto-Assign Failed',
        error.response?.data?.error ||
          error.response?.data?.message ||
          'Auto-assignment failed. Please use manual mode.',
      );
    } finally {
      setProcessingOrder(null);
    }
  };

  const sellerDeliverToFWS = async (order: Order): Promise<void> => {
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

      setProcessingFWSOrder(order._id || order.orderId || '');
      const response = await axios.post(
        `${API_BASE_URL}/api/v0/delivery/tracking/shipping/seller/deliver-to-fws`,
        { orderId: order.orderId },
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
          'Order marked as Intransit To FWS successfully!',
        );
        if (order.orderId) {
          const { trackingHistory, qrOwnershipHistory } =
            await fetchTrackingStatus(order.orderId);
          setOrders(prevOrders =>
            prevOrders.map(o =>
              o.orderId === order.orderId
                ? {
                    ...o,
                    trackingHistory: trackingHistory || o.trackingHistory,
                    qrOwnershipHistory:
                      qrOwnershipHistory || o.qrOwnershipHistory,
                  }
                : o,
            ),
          );
        }
      } else {
        throw new Error(response.data?.message || 'Failed to intransit to FWS');
      }
    } catch (error: any) {
      console.error('Error intransit to FWS:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error ||
          error.response?.data?.message ||
          'Failed to intransit to FWS. Please try again.',
      );
    } finally {
      setProcessingFWSOrder(null);
    }
  };

  const handleAcceptOrder = (order: Order) => {
    ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    Alert.alert(
      'Accept Order',
      'Do you want to accept this order? After acceptance, you can assign a shipping partner.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () =>
            ReactNativeHapticFeedback.trigger('selection', hapticOptions),
        },
        {
          text: 'Accept Order',
          onPress: () => {
            ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
            sellerAcceptOrder(order);
          },
        },
      ],
    );
  };

  const handleAssignShipping = (order: Order) => {
    ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    Alert.alert('Assign Shipping Partner', 'How would you like to assign?', [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () =>
          ReactNativeHapticFeedback.trigger('selection', hapticOptions),
      },
      {
        text: 'AUTO Assign',
        onPress: () => promptForShippingTypeAndAutoAssign(order),
      },
      {
        text: 'MANUAL Select',
        onPress: () => {
          ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
          setSelectedOrderForShipping(order);
          setShowShippingModal(true);
        },
      },
    ]);
  };

  const handleSelectShippingPartner = (shippingPartner: ShippingPartner) => {
    if (selectedOrderForShipping)
      sellerAssignShipping(selectedOrderForShipping, shippingPartner);
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
    if (id) await fetchOrders(id);
    else {
      Alert.alert('Error', 'Unable to get seller information');
      setLoading(false);
    }
  };

  const onRefresh = async (): Promise<void> => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setRefreshing(true);
    const id = sellerId || (await extractSellerIdFromToken());
    if (id) await fetchOrders(id);
    else {
      setRefreshing(false);
      Alert.alert('Error', 'Unable to get seller information');
    }
  };

  const isOrderPending = (order: Order): boolean =>
    !hasSellerAccepted(order.trackingHistory) &&
    !isOrderDelivered(order.trackingHistory);

  const isOrderAssigned = (order: Order): boolean =>
    hasSellerAccepted(order.trackingHistory) &&
    !isOrderDelivered(order.trackingHistory);

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
    return `ORDER ${order.orderId || 'Product'}`;
  };

  const getItemCount = (order: Order): number => {
    if (order.items && order.items.length > 0) {
      return order.items.reduce(
        (total, item) => total + (item.quantity || 1),
        0,
      );
    }
    return 1;
  };

  const renderStatsCard = () => {
    const pendingOrdersCount = orders.filter(order =>
      isOrderPending(order),
    ).length;
    const assignedOrdersCount = orders.filter(order =>
      isOrderAssigned(order),
    ).length;
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
            Active
          </Text>
        </View>
      </View>
    );
  };

  const renderOrderItem = (order: Order, index: number) => {
    const productTitle = getProductTitle(order);
    const itemCount = getItemCount(order);
    const displayAmount = order.finalAmount || 0;
    const productPrice = order.productPrice || 0;
    const productMrp = order.productMrp || 0;
    const productGst = order.productGstRate || 0;
    const deliveryCharge = order.deliveryCharge || 0;
    const formattedDate = formatDate(order.createdAt);

    // ✅ FIXED: Use the new functions
    const statusText = getDeliveryStatusText(order);
    const statusColor = getDeliveryStatusColor(order);

    const statusIcon = (
      <MaterialIcons
        name={
          isOrderDelivered(order.trackingHistory)
            ? 'check-circle'
            : hasSellerAccepted(order.trackingHistory)
            ? 'check-circle'
            : 'access-time'
        }
        size={12}
        color="#FFFFFF"
      />
    );
    const paymentStatusInfo = getPaymentStatusInfo(order);
    const isProcessing =
      processingOrder === order.orderId || processingOrder === order._id;
    const isProcessingFWS =
      processingFWSOrder === order.orderId || processingFWSOrder === order._id;
    const hasRiderAssigned = order.shippingRider;
    const fulfillmentType = order.fulfillmentType || 'SELLER';

    const showAcceptButton = shouldShowAcceptButton(order);
    const showAssignButton = shouldShowAssignButton(order);
    const showDeliverToFWSButton = shouldShowDeliverToFWSButton(order);
    const showQRCodeButton = shouldShowQRCodeButton(order);
    const completionMessage = getCompletionMessage(order);

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
          if (order.orderId)
            navigation.navigate('OrderDetails', {
              orderId: order.orderId,
              orderData: order,
            });
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

        <View style={{ marginBottom: 8 }}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  fulfillmentType === 'FWS' ? colors.purple : colors.info,
                alignSelf: 'flex-start',
              },
            ]}
          >
            <MaterialIcons
              name={fulfillmentType === 'FWS' ? 'warehouse' : 'store'}
              size={10}
              color="#FFFFFF"
            />
            <Text style={styles.statusText}>
              {fulfillmentType === 'FWS'
                ? 'FWS Fulfillment'
                : 'Self Fulfillment'}
            </Text>
          </View>
        </View>

        {hasRiderAssigned && (
          <View
            style={[
              styles.riderBadge,
              {
                backgroundColor: colors.info + '15',
                marginTop: 4,
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
                  ? `${order.shippingRider.name}`
                  : 'Partner assigned'}
              </Text>
            </View>
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

          <View style={styles.productInfo}>
            <Text style={[styles.productTitle, { color: colors.textPrimary }]}>
              {productTitle}
            </Text>
            <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.priceSection}>
            <View style={styles.amountRow}>
              <Text style={[styles.orderAmount, { color: colors.success }]}>
                ₹{displayAmount.toFixed(2)}
              </Text>
            </View>
            {productMrp > displayAmount && (
              <Text style={[styles.mrpAmount, { color: colors.textTertiary }]}>
                M.R.P: ₹{productMrp.toFixed(2)}
              </Text>
            )}
          </View>

          <View style={styles.quickStatsRow}>
            <View style={styles.quickStatItem}>
              <Text
                style={[styles.quickStatValue, { color: colors.textPrimary }]}
              >
                ₹{productPrice.toFixed(2)}
              </Text>
              <Text
                style={[styles.quickStatLabel, { color: colors.textTertiary }]}
              >
                Price
              </Text>
            </View>
            {productGst > 0 && (
              <View style={styles.quickStatItem}>
                <Text
                  style={[styles.quickStatValue, { color: colors.textPrimary }]}
                >
                  ₹{productGst.toFixed(2)}
                </Text>
                <Text
                  style={[
                    styles.quickStatLabel,
                    { color: colors.textTertiary },
                  ]}
                >
                  GST ({order.productGstRate || 18}%)
                </Text>
              </View>
            )}
            <View style={styles.quickStatItem}>
              <Text
                style={[
                  styles.quickStatValue,
                  {
                    color:
                      deliveryCharge === 0
                        ? colors.success
                        : colors.textPrimary,
                  },
                ]}
              >
                {deliveryCharge === 0
                  ? 'FREE'
                  : `₹${deliveryCharge.toFixed(2)}`}
              </Text>
              <Text
                style={[styles.quickStatLabel, { color: colors.textTertiary }]}
              >
                Delivery
              </Text>
            </View>
          </View>

          {/* QR Code Button */}
          {showQRCodeButton && (
            <TouchableOpacity
              style={[styles.qrCodeButton, { backgroundColor: colors.success }]}
              onPress={e => {
                e.stopPropagation();
                handleShowQRCode(order);
              }}
            >
              <Ionicons name="qr-code" size={20} color="#FFFFFF" />
              <Text style={styles.qrCodeButtonText}>
                Show QR Code for Handover
              </Text>
            </TouchableOpacity>
          )}

          {/* Completion Message */}
          {completionMessage && (
            <View
              style={[
                styles.completionMessageContainer,
                { backgroundColor: colors.success + '15' },
              ]}
            >
              <MaterialIcons
                name="check-circle"
                size={18}
                color={colors.success}
              />
              <Text
                style={[
                  styles.completionMessageText,
                  { color: colors.success },
                ]}
              >
                {completionMessage}
              </Text>
            </View>
          )}

          {/* Deliver to FWS Button */}
          {!completionMessage &&
            !showQRCodeButton &&
            showDeliverToFWSButton && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.purple },
                  isProcessingFWS && styles.processingButton,
                ]}
                onPress={e => {
                  e.stopPropagation();
                  sellerDeliverToFWS(order);
                }}
                disabled={isProcessingFWS}
              >
                {isProcessingFWS ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="warehouse" size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>
                      Intransit to FWS
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

          {/* Assign Button */}
          {!completionMessage &&
            !showQRCodeButton &&
            showAssignButton &&
            fulfillmentType === 'SELLER' && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.primary },
                  isProcessing && styles.processingButton,
                ]}
                onPress={e => {
                  e.stopPropagation();
                  handleAssignShipping(order);
                }}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons
                      name="local-shipping"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Assign Partner</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

          {/* Accept Button */}
          {!completionMessage &&
            !showQRCodeButton &&
            !showAssignButton &&
            !showDeliverToFWSButton &&
            showAcceptButton && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.success },
                  isProcessing && styles.processingButton,
                ]}
                onPress={e => {
                  e.stopPropagation();
                  handleAcceptOrder(order);
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
                    <Text style={styles.actionButtonText}>Accept Order</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

          <TouchableOpacity
            style={styles.viewDetails}
            onPress={() => {
              ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
              if (order.orderId)
                navigation.navigate('OrderDetails', {
                  orderId: order.orderId,
                  orderData: order,
                });
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
              Active ({assignedOrdersCount})
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
                : 'No active orders'}
            </Text>
            <Text
              style={[styles.emptySubtext, { color: colors.textSecondary }]}
            >
              {selectedTab === 'all'
                ? 'When customers place orders, they will appear here'
                : selectedTab === 'pending'
                ? 'All orders have been accepted'
                : 'All accepted orders appear here'}
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
                : 'Active Orders'}{' '}
              • {filteredOrders.length}
            </Text>
            {filteredOrders
              .sort(
                (a, b) =>
                  (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
                  (a.createdAt ? new Date(a.createdAt).getTime() : 0),
              )
              .map((order, index) => renderOrderItem(order, index))}
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

      <QRCodeModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        qrCodeUrl={selectedQRCode?.url || ''}
        orderId={selectedQRCode?.orderId || ''}
        colors={colors}
      />
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
  priceSection: {
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
  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  quickStatValue: { fontSize: 12, fontWeight: '700' },
  quickStatLabel: { fontSize: 9, fontWeight: '500', marginTop: 2 },
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
  qrCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  qrCodeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalContainer: {
    width: width * 0.85,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  qrModalTitle: { fontSize: 18, fontWeight: '700' },
  qrCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCodeWrapper: { width: 200, height: 200, marginVertical: 20 },
  qrCodeImage: { width: '100%', height: '100%' },
  qrOrderId: { fontSize: 12, marginTop: 10, textAlign: 'center' },
  qrInstruction: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  qrDoneButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  qrDoneButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  completionMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  completionMessageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.9,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
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
  vehicleImage: { width: 40, height: 40, borderRadius: 8 },
  vehicleIconPlaceholder: {
    width: 40,
    height: 40,
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
  driverName: { fontSize: 14, fontWeight: '700', marginRight: 8, flex: 1 },
  availableBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  availableText: { fontSize: 10, fontWeight: '600' },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, fontWeight: '600', marginLeft: 2 },
  vehicleText: { fontSize: 11, fontWeight: '500' },
  capacityContainer: { marginTop: 4 },
  capacityText: { fontSize: 10, fontWeight: '500' },
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
