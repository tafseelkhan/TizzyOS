// ============================================================
// FILE: src/screens/ScannedOrdersScreen.tsx
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  getFWSOrders,
  getOrderById,
  OrderDetailsResponse,
} from '../../../../api/features/private/scanFwsOrderPrivateSlice';
import { fwsAssignShipping } from '../../../../api/features/private/fwsDispatchPrivateSlice';
import { FWSOrderWithTracking } from '../../../types/orderTypes';
import { format } from 'date-fns';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Feather from 'react-native-vector-icons/Feather';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = 'http://10.48.121.121:5000';

type TabType = 'current' | 'previous';

// ============================================================
// INTERFACES
// ============================================================

interface ShippingPartner {
  id: string;
  userId: string;
  name: string;
  rating: number;
  vehicleType: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleNumber?: string;
  isAvailable: boolean;
  phoneNumber?: string;
  maxOrdersPerDay: number;
  currentOrders: number;
  shippingType?: string;
  city?: string;
  state?: string;
  distance?: number;
  alreadyHandled?: boolean;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const ScannedOrdersScreen: React.FC = () => {
  const navigation = useNavigation();

  // ============================================================
  // States
  // ============================================================
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [currentOrders, setCurrentOrders] = useState<FWSOrderWithTracking[]>(
    [],
  );
  const [previousOrders, setPreviousOrders] = useState<FWSOrderWithTracking[]>(
    [],
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] =
    useState<FWSOrderWithTracking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<
    OrderDetailsResponse['data'] | null
  >(null);
  const [loadingOrderDetails, setLoadingOrderDetails] =
    useState<boolean>(false);

  // ============================================================
  // Assignment Modal States
  // ============================================================
  const [showAssignmentModal, setShowAssignmentModal] =
    useState<boolean>(false);
  const [assignmentMode, setAssignmentMode] = useState<'AUTO' | 'MANUAL'>(
    'AUTO',
  );
  const [selectedShippingType, setSelectedShippingType] = useState<
    'RIDER' | 'TRUCK'
  >('RIDER');
  const [shippingPartners, setShippingPartners] = useState<ShippingPartner[]>(
    [],
  );
  const [loadingPartners, setLoadingPartners] = useState<boolean>(false);
  const [selectedPartner, setSelectedPartner] =
    useState<ShippingPartner | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [excludedPartnerIds, setExcludedPartnerIds] = useState<string[]>([]);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ============================================================
  // Get Auth Token
  // ============================================================
  const getAuthToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) setAuthToken(token);
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  // ============================================================
  // Fetch Shipping Partners
  // ============================================================
  const fetchShippingPartners = async (shippingType?: 'RIDER' | 'TRUCK') => {
    try {
      setLoadingPartners(true);
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/v0/shipping/available-shipping`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      let partners: ShippingPartner[] = [];

      if (response.data && response.data.success) {
        const data = response.data.shippingPartners || response.data.data || [];
        partners = data
          .filter((item: any) => {
            if (shippingType) {
              const type = item.shippingType || item.vehicleCategory;
              return type === shippingType;
            }
            return true;
          })
          .map((item: any) => ({
            id: item._id || item.id,
            userId: item.userId,
            name: item.name || 'Unknown',
            rating: item.rating || 4.0,
            vehicleType: item.vehicleCategory || item.shippingType || 'RIDER',
            vehicleBrand: item.vehicleBrand,
            vehicleModel: item.vehicleModel,
            vehicleNumber: item.vehicleNumber,
            isAvailable: item.isOnline && item.isAvailable,
            phoneNumber: item.phoneNumber,
            maxOrdersPerDay: item.maxOrdersPerDay || 10,
            currentOrders: item.orderStats?.assigned || 0,
            shippingType: item.shippingType,
            city: item.city,
            state: item.state,
            distance: item.distance || 0,
            alreadyHandled: excludedPartnerIds.includes(item.userId),
          }));
      }

      setShippingPartners(partners);
    } catch (error: any) {
      console.error('Error fetching shipping partners:', error);
      Alert.alert('Error', 'Failed to fetch shipping partners');
      setShippingPartners([]);
    } finally {
      setLoadingPartners(false);
    }
  };

  // ============================================================
  // Load Orders
  // ============================================================
  const loadOrders = async () => {
    try {
      setLoading(true);
      await getAuthToken();
      const response = await getFWSOrders();

      if (response.success) {
        setCurrentOrders(response.data.currentOrders);
        setPreviousOrders(response.data.previousOrders);
        console.log('📦 Current Orders:', response.data.currentCount);
        console.log('📦 Previous Orders:', response.data.previousCount);
      }
    } catch (error: any) {
      console.error('❌ Load Orders Error:', error);
      Alert.alert('Error', error.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  // ============================================================
  // Get Current Tab Data
  // ============================================================
  const getCurrentData = (): FWSOrderWithTracking[] => {
    return activeTab === 'current' ? currentOrders : previousOrders;
  };

  const getEmptyMessage = (): string => {
    return activeTab === 'current'
      ? 'No current orders in FWS'
      : 'No previous orders history';
  };

  // ============================================================
  // Handle Order Press
  // ============================================================
  const handleOrderPress = async (order: FWSOrderWithTracking) => {
    if (!order.order) return;

    setSelectedOrder(order);
    setShowDetailModal(true);
    setLoadingOrderDetails(true);
    setOrderDetails(null);

    try {
      console.log('📊 Fetching order details for:', order.order.orderId);
      const response = await getOrderById(order.order.orderId);

      if (response.success) {
        setOrderDetails(response.data);
        console.log('✅ Order details loaded');
      } else {
        throw new Error(response.message || 'Failed to fetch order details');
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch order details:', error);
      Alert.alert('Error', error.message || 'Failed to load order details');
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  // ============================================================
  // Open Assignment Modal
  // ============================================================
  const openAssignmentModal = async (order: FWSOrderWithTracking) => {
    setSelectedOrder(order);
    setAssignmentMode('AUTO');
    setSelectedShippingType('RIDER');
    setSelectedPartner(null);
    setSearchQuery('');
    setExcludedPartnerIds([]);

    try {
      const token = await getAuthToken();
      if (token && order.order) {
        const trackingResponse = await axios.get(
          `${API_BASE_URL}/api/v0/tracking/history/status`,
          {
            params: { orderId: order.order.orderId },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          },
        );

        if (trackingResponse.data?.success) {
          const tracking = trackingResponse.data;
          const excluded: string[] = [];

          if (tracking.routeHistory) {
            tracking.routeHistory.forEach((r: any) => {
              if (
                r.fromHolderType === 'RIDER' ||
                r.fromHolderType === 'TRUCK'
              ) {
                excluded.push(r.fromHolderId);
              }
              if (r.toHolderType === 'RIDER' || r.toHolderType === 'TRUCK') {
                excluded.push(r.toHolderId);
              }
            });
          }

          if (tracking.assignmentHistory) {
            tracking.assignmentHistory.forEach((a: any) => {
              if (a.assigneeType === 'RIDER' || a.assigneeType === 'TRUCK') {
                excluded.push(a.assigneeId);
              }
            });
          }

          if (tracking.pendingAssignment) {
            if (
              tracking.pendingAssignment.assigneeType === 'RIDER' ||
              tracking.pendingAssignment.assigneeType === 'TRUCK'
            ) {
              excluded.push(tracking.pendingAssignment.assigneeId);
            }
          }

          setExcludedPartnerIds([...new Set(excluded)]);
        }
      }
    } catch (error) {
      console.error('Error fetching excluded partners:', error);
    }

    setShowAssignmentModal(true);
  };

  // ============================================================
  // Handle Assignment
  // ============================================================
  const handleAssignDispatch = async () => {
    if (!selectedOrder || !selectedOrder.order) return;

    setIsAssigning(true);

    try {
      let assignData: any = {
        orderId: selectedOrder.order.orderId,
        assignmentType: assignmentMode,
        shippingType: selectedShippingType,
      };

      if (assignmentMode === 'MANUAL' && selectedPartner) {
        assignData.shippingId = selectedPartner.userId;
      }

      console.log('📤 Assignment Data:', assignData);

      const response = await fwsAssignShipping(assignData);

      if (response.success) {
        Alert.alert(
          '✅ Dispatch Assigned',
          `${selectedShippingType} assigned successfully!`,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowAssignmentModal(false);
                loadOrders();
              },
            },
          ],
        );
      } else {
        throw new Error(response.message || 'Assignment failed');
      }
    } catch (error: any) {
      console.error('❌ Assignment Error:', error);

      if (
        error.message?.includes('already handled') ||
        error.message?.includes('already assigned') ||
        error.response?.data?.alreadyHandled === true
      ) {
        const errorData = error.response?.data || {};
        Alert.alert(
          '⚠️ Already Handled',
          errorData.message || 'This partner has already handled this order.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (assignmentMode === 'MANUAL') {
                  fetchShippingPartners(selectedShippingType);
                }
                if (assignmentMode === 'AUTO') {
                  Alert.alert(
                    '🔄 Auto Assign Again',
                    'System will try to find a different partner.',
                    [
                      {
                        text: 'Try Again',
                        onPress: () => handleAssignDispatch(),
                      },
                      {
                        text: 'Switch to Manual',
                        onPress: () => {
                          setAssignmentMode('MANUAL');
                          fetchShippingPartners(selectedShippingType);
                        },
                      },
                    ],
                  );
                }
              },
            },
          ],
        );
        return;
      }

      Alert.alert(
        '❌ Assignment Failed',
        error.message || 'Failed to assign dispatch',
      );
    } finally {
      setIsAssigning(false);
    }
  };

  // ============================================================
  // Handle Mode Change
  // ============================================================
  const handleModeChange = (mode: 'AUTO' | 'MANUAL') => {
    setAssignmentMode(mode);
    setSelectedPartner(null);
    setSearchQuery('');
    if (mode === 'MANUAL') {
      fetchShippingPartners(selectedShippingType);
    }
  };

  // ============================================================
  // Handle Shipping Type Change
  // ============================================================
  const handleShippingTypeChange = (type: 'RIDER' | 'TRUCK') => {
    setSelectedShippingType(type);
    setSelectedPartner(null);
    setSearchQuery('');
    if (assignmentMode === 'MANUAL') {
      fetchShippingPartners(type);
    }
  };

  // ============================================================
  // Get Stage Icon & Color
  // ============================================================
  const getStageIcon = (stage: string): string => {
    switch (stage) {
      case 'RECEIVED':
        return 'archive-outline';
      case 'SCANNED':
        return 'scan-outline';
      case 'READY_FOR_DISPATCH':
        return 'checkmark-circle-outline';
      case 'PICKED':
        return 'hand-left-outline';
      case 'DISPATCHED':
        return 'rocket-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const getStageColor = (stage: string): string => {
    switch (stage) {
      case 'RECEIVED':
        return '#FF9800';
      case 'SCANNED':
        return '#4CAF50';
      case 'READY_FOR_DISPATCH':
        return '#2196F3';
      case 'PICKED':
        return '#9C27B0';
      case 'DISPATCHED':
        return '#00BCD4';
      default:
        return '#999';
    }
  };

  const truncateOrderId = (orderId: string): string => {
    if (orderId.length <= 14) return orderId;
    return orderId.substring(0, 12) + '...';
  };

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
    ]).start();
  };

  // ============================================================
  // Render Order Item
  // ============================================================
  const renderOrderItem = ({ item }: { item: FWSOrderWithTracking }) => {
    const order = item.order;
    const tracking = item.tracking;
    if (!order) return null;

    const stage = tracking?.currentFWS?.processingStage || 'UNKNOWN';
    const isCurrent = item.isCurrentOrder;

    const hasPendingAssignment =
      tracking?.pendingAssignment &&
      tracking?.pendingAssignment.status === 'PENDING_ACCEPTANCE';

    const canAssign = isCurrent && stage === 'SCANNED' && !hasPendingAssignment;

    const isHovered = hoveredOrderId === order.orderId;

    return (
      <TouchableOpacity
        style={[styles.orderCard, isHovered && styles.orderCardHovered]}
        onPress={() => handleOrderPress(item)}
        activeOpacity={0.85}
        onPressIn={() => setHoveredOrderId(order.orderId)}
        onPressOut={() => setHoveredOrderId(null)}
      >
        <View style={styles.orderCardHeader}>
          <View style={styles.orderIdContainer}>
            <Text style={styles.hashText}>#</Text>
            <Text style={styles.orderIdText}>
              {truncateOrderId(order.orderId)}
            </Text>
          </View>
          <View style={styles.headerBadges}>
            {isCurrent && (
              <View style={styles.currentBadge}>
                <Icon name="location" size={10} color="#1976D2" />
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
            <View
              style={[
                styles.stageBadge,
                { backgroundColor: getStageColor(stage) },
              ]}
            >
              <Icon name={getStageIcon(stage)} size={10} color="#fff" />
              <Text style={styles.stageBadgeText}>{stage}</Text>
            </View>
          </View>
        </View>

        <View style={styles.orderCardBody}>
          <View style={styles.buyerContainer}>
            <FontAwesome5 name="user-circle" size={16} color="#666" />
            <Text style={styles.buyerNameText}>
              {order.buyerName || 'Unknown Buyer'}
            </Text>
          </View>
          <View style={styles.dateContainer}>
            <Feather name="calendar" size={13} color="#999" />
            <Text style={styles.orderDateText}>
              {format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')}
            </Text>
          </View>
          <View style={styles.amountContainer}>
            <FontAwesome5 name="rupee-sign" size={13} color="#FF6F00" />
            <Text style={styles.orderAmountText}>₹{order.finalAmount}</Text>
          </View>
        </View>

        {canAssign && (
          <View style={styles.readyContainer}>
            <View style={styles.readyBadge}>
              <MaterialIcons name="check-circle" size={14} color="#2E7D32" />
              <Text style={styles.readyBadgeText}>Ready for Dispatch</Text>
            </View>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[
                  styles.dispatchButtonSmall,
                  isHovered && styles.dispatchButtonSmallHovered,
                ]}
                onPress={() => {
                  animateButton();
                  openAssignmentModal(item);
                }}
                activeOpacity={0.7}
              >
                <FontAwesome5 name="truck" size={12} color="#fff" />
                <Text style={styles.dispatchButtonSmallText}>Assign</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {tracking?.pendingAssignment && (
          <View
            style={[
              styles.pendingBadge,
              tracking.pendingAssignment.status === 'PENDING_ACCEPTANCE'
                ? styles.pendingBadgeWarning
                : styles.pendingBadgeSuccess,
            ]}
          >
            <MaterialIcons
              name={
                tracking.pendingAssignment.status === 'PENDING_ACCEPTANCE'
                  ? 'pending'
                  : 'check-circle'
              }
              size={14}
              color={
                tracking.pendingAssignment.status === 'PENDING_ACCEPTANCE'
                  ? '#E65100'
                  : '#2E7D32'
              }
            />
            <Text
              style={[
                styles.pendingBadgeText,
                tracking.pendingAssignment.status === 'PENDING_ACCEPTANCE'
                  ? styles.pendingBadgeTextWarning
                  : styles.pendingBadgeTextSuccess,
              ]}
            >
              {tracking.pendingAssignment.status === 'PENDING_ACCEPTANCE'
                ? `Pending: ${tracking.pendingAssignment.assigneeType}`
                : `✓ Assigned to ${tracking.pendingAssignment.assigneeType}`}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ============================================================
  // Assignment Modal
  // ============================================================
  const AssignmentModal = () => {
    if (!selectedOrder || !selectedOrder.order) return null;

    const filteredPartners = shippingPartners.filter(
      partner =>
        partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.vehicleNumber
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()),
    );

    return (
      <Modal
        visible={showAssignmentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAssignmentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <MaterialIcons
                  name="local-shipping"
                  size={22}
                  color="#FF6F00"
                />
                <Text style={styles.modalTitle}>Assign Dispatch</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAssignmentModal(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Icon name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalOrderInfo}>
                <Text style={styles.modalOrderId}>
                  Order: {selectedOrder.order.orderId}
                </Text>
                <Text style={styles.modalOrderBuyer}>
                  Buyer: {selectedOrder.order.buyerName || 'Unknown'}
                </Text>
                {excludedPartnerIds.length > 0 && (
                  <View style={styles.excludedInfoContainer}>
                    <MaterialIcons
                      name="info-outline"
                      size={14}
                      color="#E65100"
                    />
                    <Text style={styles.excludedInfoText}>
                      {excludedPartnerIds.length} partner(s) already handled
                      this order
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.modeSelector}>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    assignmentMode === 'AUTO' && styles.modeButtonActive,
                  ]}
                  onPress={() => handleModeChange('AUTO')}
                >
                  <MaterialIcons
                    name="auto-awesome"
                    size={18}
                    color={assignmentMode === 'AUTO' ? '#fff' : '#666'}
                  />
                  <Text
                    style={[
                      styles.modeButtonText,
                      assignmentMode === 'AUTO' && styles.modeButtonTextActive,
                    ]}
                  >
                    AUTO
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    assignmentMode === 'MANUAL' && styles.modeButtonActive,
                  ]}
                  onPress={() => handleModeChange('MANUAL')}
                >
                  <MaterialIcons
                    name="person"
                    size={18}
                    color={assignmentMode === 'MANUAL' ? '#fff' : '#666'}
                  />
                  <Text
                    style={[
                      styles.modeButtonText,
                      assignmentMode === 'MANUAL' &&
                        styles.modeButtonTextActive,
                    ]}
                  >
                    MANUAL
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.shippingTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.shippingTypeButton,
                    selectedShippingType === 'RIDER' &&
                      styles.shippingTypeButtonActive,
                  ]}
                  onPress={() => handleShippingTypeChange('RIDER')}
                >
                  <FontAwesome5
                    name="motorcycle"
                    size={18}
                    color={selectedShippingType === 'RIDER' ? '#fff' : '#666'}
                  />
                  <Text
                    style={[
                      styles.shippingTypeText,
                      selectedShippingType === 'RIDER' &&
                        styles.shippingTypeTextActive,
                    ]}
                  >
                    RIDER
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.shippingTypeButton,
                    selectedShippingType === 'TRUCK' &&
                      styles.shippingTypeButtonActive,
                  ]}
                  onPress={() => handleShippingTypeChange('TRUCK')}
                >
                  <FontAwesome5
                    name="truck"
                    size={18}
                    color={selectedShippingType === 'TRUCK' ? '#fff' : '#666'}
                  />
                  <Text
                    style={[
                      styles.shippingTypeText,
                      selectedShippingType === 'TRUCK' &&
                        styles.shippingTypeTextActive,
                    ]}
                  >
                    TRUCK
                  </Text>
                </TouchableOpacity>
              </View>

              {assignmentMode === 'AUTO' && (
                <View style={styles.autoInfoContainer}>
                  <MaterialIcons
                    name="info-outline"
                    size={20}
                    color="#2196F3"
                  />
                  <Text style={styles.autoInfoText}>
                    System will automatically find the nearest available{' '}
                    {selectedShippingType}
                    {excludedPartnerIds.length > 0 &&
                      ` (excluding ${excludedPartnerIds.length} already handled)`}
                  </Text>
                </View>
              )}

              {assignmentMode === 'MANUAL' && (
                <View style={styles.manualContainer}>
                  <View style={styles.searchContainer}>
                    <MaterialIcons name="search" size={20} color="#999" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by name or vehicle number"
                      placeholderTextColor="#999"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>

                  {loadingPartners ? (
                    <View style={styles.loadingPartnersContainer}>
                      <ActivityIndicator size="large" color="#FF6F00" />
                      <Text style={styles.loadingPartnersText}>
                        Loading partners...
                      </Text>
                    </View>
                  ) : shippingPartners.length === 0 ? (
                    <View style={styles.emptyPartnersContainer}>
                      <MaterialIcons
                        name="people-outline"
                        size={48}
                        color="#ccc"
                      />
                      <Text style={styles.emptyPartnersText}>
                        No {selectedShippingType}s available
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      data={filteredPartners}
                      renderItem={({ item }) => {
                        const isExcluded = excludedPartnerIds.includes(
                          item.userId,
                        );
                        const isSelected = selectedPartner?.id === item.id;

                        return (
                          <TouchableOpacity
                            style={[
                              styles.partnerCard,
                              isSelected && styles.partnerCardSelected,
                              isExcluded && styles.partnerCardExcluded,
                            ]}
                            onPress={() => {
                              if (!isExcluded) {
                                setSelectedPartner(item);
                              } else {
                                Alert.alert(
                                  '⚠️ Already Handled',
                                  `${item.name} has already handled this order. Please select a different partner.`,
                                );
                              }
                            }}
                            disabled={isExcluded}
                            activeOpacity={0.7}
                          >
                            <View style={styles.partnerCardLeft}>
                              <View style={styles.partnerAvatar}>
                                <FontAwesome5
                                  name="user"
                                  size={16}
                                  color={isExcluded ? '#999' : '#FF6F00'}
                                />
                              </View>
                              <View>
                                <Text
                                  style={[
                                    styles.partnerName,
                                    isExcluded && styles.partnerNameExcluded,
                                  ]}
                                >
                                  {item.name}
                                  {isExcluded && ' ⚠️'}
                                </Text>
                                <Text
                                  style={[
                                    styles.partnerVehicle,
                                    isExcluded && styles.partnerVehicleExcluded,
                                  ]}
                                >
                                  {item.vehicleType} •{' '}
                                  {item.vehicleNumber || 'N/A'}
                                </Text>
                                <Text
                                  style={[
                                    styles.partnerDistance,
                                    isExcluded &&
                                      styles.partnerDistanceExcluded,
                                  ]}
                                >
                                  📍{' '}
                                  {item.distance
                                    ? `${item.distance.toFixed(1)} km`
                                    : 'Distance not available'}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.partnerCardRight}>
                              {isExcluded ? (
                                <View style={styles.excludedBadge}>
                                  <MaterialIcons
                                    name="block"
                                    size={14}
                                    color="#f44336"
                                  />
                                  <Text style={styles.excludedBadgeText}>
                                    Already Handled
                                  </Text>
                                </View>
                              ) : item.isAvailable ? (
                                <View style={styles.availableDot} />
                              ) : (
                                <View style={styles.unavailableDot} />
                              )}
                              {!isExcluded && (
                                <Text
                                  style={[
                                    styles.partnerStatus,
                                    item.isAvailable
                                      ? styles.availableText
                                      : styles.unavailableText,
                                  ]}
                                >
                                  {item.isAvailable ? 'Available' : 'Busy'}
                                </Text>
                              )}
                              {isSelected && !isExcluded && (
                                <MaterialIcons
                                  name="check-circle"
                                  size={20}
                                  color="#4CAF50"
                                />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                      keyExtractor={item => item.id}
                      contentContainerStyle={styles.partnersList}
                      showsVerticalScrollIndicator={false}
                    />
                  )}
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowAssignmentModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.confirmButton,
                    assignmentMode === 'MANUAL' &&
                      !selectedPartner &&
                      styles.confirmButtonDisabled,
                    isAssigning && styles.confirmButtonDisabled,
                  ]}
                  onPress={handleAssignDispatch}
                  disabled={
                    (assignmentMode === 'MANUAL' && !selectedPartner) ||
                    isAssigning
                  }
                >
                  {isAssigning ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.confirmButtonText}>Assign</Text>
                      <MaterialIcons
                        name="arrow-forward"
                        size={18}
                        color="#fff"
                      />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================================
  // Tab Bar
  // ============================================================
  const TabBar = () => {
    const currentCount = currentOrders.length;
    const previousCount = previousOrders.length;

    return (
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'current' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('current')}
          activeOpacity={0.7}
        >
          <View style={styles.tabContent}>
            <Icon
              name="location"
              size={18}
              color={activeTab === 'current' ? '#2E7D32' : '#888'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'current' && styles.tabTextActive,
              ]}
            >
              Current
            </Text>
            <View style={styles.tabCount}>
              <Text style={styles.tabCountText}>{currentCount}</Text>
            </View>
          </View>
          {activeTab === 'current' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'previous' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('previous')}
          activeOpacity={0.7}
        >
          <View style={styles.tabContent}>
            <MaterialIcons
              name="history"
              size={18}
              color={activeTab === 'previous' ? '#2E7D32' : '#888'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'previous' && styles.tabTextActive,
              ]}
            >
              Previous
            </Text>
            <View style={[styles.tabCount, styles.tabCountPrevious]}>
              <Text style={styles.tabCountText}>{previousCount}</Text>
            </View>
          </View>
          {activeTab === 'previous' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>
    );
  };

  // ============================================================
  // Order Detail Modal
  // ============================================================
  const OrderDetailModal = () => {
    if (!selectedOrder || !selectedOrder.order) return null;

    const { order, tracking, isCurrentOrder } = selectedOrder;
    const stage = tracking?.currentFWS?.processingStage || 'UNKNOWN';
    const canAssign =
      isCurrentOrder && stage === 'SCANNED' && !tracking?.pendingAssignment;
    const displayOrder = orderDetails || order;
    const items = (displayOrder as any).items || [];

    return (
      <Modal
        visible={showDetailModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconContainer}>
                  <MaterialIcons
                    name="shopping-bag"
                    size={22}
                    color="#2E7D32"
                  />
                </View>
                <Text style={styles.modalTitle}>Order Details</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Icon name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {loadingOrderDetails ? (
                <View style={styles.loadingDetailsContainer}>
                  <ActivityIndicator size="large" color="#2E7D32" />
                  <Text style={styles.loadingDetailsText}>
                    Loading order details...
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.statusBadgeContainer}>
                    <View
                      style={[
                        styles.statusBadge,
                        isCurrentOrder
                          ? styles.currentStatusBadge
                          : styles.previousStatusBadge,
                      ]}
                    >
                      <Icon
                        name={isCurrentOrder ? 'location' : 'time'}
                        size={16}
                        color={isCurrentOrder ? '#1976D2' : '#888'}
                      />
                      <Text style={styles.statusBadgeText}>
                        {isCurrentOrder ? 'Current Order' : 'Previous Order'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <MaterialIcons
                        name="info-outline"
                        size={18}
                        color="#2E7D32"
                      />
                      <Text style={styles.detailSectionTitle}>Order Info</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Order ID</Text>
                      <Text style={styles.detailValue}>
                        {displayOrder.orderId}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Tracking ID</Text>
                      <Text style={styles.detailValue}>
                        {displayOrder.trackingId}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status</Text>
                      <View style={styles.statusValueBadge}>
                        <Text style={styles.statusValueText}>
                          {displayOrder.status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>FWS Stage</Text>
                      <View
                        style={[
                          styles.stageValueBadge,
                          { backgroundColor: getStageColor(stage) },
                        ]}
                      >
                        <Icon
                          name={getStageIcon(stage)}
                          size={12}
                          color="#fff"
                        />
                        <Text style={styles.stageValueText}>{stage}</Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Fulfillment</Text>
                      <Text style={styles.detailValue}>
                        {displayOrder.fulfillmentType || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <MaterialIcons
                        name="inventory"
                        size={18}
                        color="#2E7D32"
                      />
                      <Text style={styles.detailSectionTitle}>
                        Items ({items.length})
                      </Text>
                    </View>
                    {items.length > 0 ? (
                      items.map((item: any, index: number) => {
                        const productData = item.productData || {};
                        return (
                          <View key={index} style={styles.itemCard}>
                            <View style={styles.itemRow}>
                              <Text style={styles.itemLabel}>Product ID</Text>
                              <Text style={styles.itemValue}>
                                {productData.productDataId || 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.itemRow}>
                              <Text style={styles.itemLabel}>Quantity</Text>
                              <Text style={styles.itemValue}>
                                {item.quantity || 1}
                              </Text>
                            </View>
                            {productData.productName && (
                              <View style={styles.itemRow}>
                                <Text style={styles.itemLabel}>
                                  Product Name
                                </Text>
                                <Text
                                  style={styles.itemValue}
                                  numberOfLines={1}
                                >
                                  {productData.productName}
                                </Text>
                              </View>
                            )}
                            {productData.productPrice && (
                              <View style={styles.itemRow}>
                                <Text style={styles.itemLabel}>Price</Text>
                                <Text style={styles.itemValue}>
                                  ₹{productData.productPrice}
                                </Text>
                              </View>
                            )}
                            {index < items.length - 1 && (
                              <View style={styles.itemDivider} />
                            )}
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.noItemsText}>No items found</Text>
                    )}
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <FontAwesome5
                        name="rupee-sign"
                        size={16}
                        color="#2E7D32"
                      />
                      <Text style={styles.detailSectionTitle}>
                        Price Details
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Product Price</Text>
                      <Text style={styles.detailValue}>
                        ₹
                        {(displayOrder as any).productPrice ||
                          displayOrder.finalAmount}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>MRP</Text>
                      <Text style={styles.detailValue}>
                        ₹{(displayOrder as any).productMrp || 'N/A'}
                      </Text>
                    </View>
                    {(displayOrder as any).productDiscount > 0 && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Discount</Text>
                        <Text
                          style={[styles.detailValue, { color: '#4CAF50' }]}
                        >
                          -{(displayOrder as any).productDiscount}%
                        </Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Final Amount</Text>
                      <Text style={styles.totalValue}>
                        ₹{displayOrder.finalAmount}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <FontAwesome5 name="user" size={16} color="#2E7D32" />
                      <Text style={styles.detailSectionTitle}>Buyer</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Name</Text>
                      <Text style={styles.detailValue}>
                        {displayOrder.buyerName || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  {(displayOrder as any).buyerAddress && (
                    <View style={styles.detailSection}>
                      <View style={styles.detailSectionHeader}>
                        <MaterialIcons
                          name="location-on"
                          size={18}
                          color="#2E7D32"
                        />
                        <Text style={styles.detailSectionTitle}>
                          Buyer Address
                        </Text>
                      </View>
                      <Text style={styles.addressText}>
                        {(displayOrder as any).buyerAddress?.address || 'N/A'}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <Feather name="clock" size={16} color="#2E7D32" />
                      <Text style={styles.detailSectionTitle}>Dates</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Created</Text>
                      <Text style={styles.detailValue}>
                        {format(
                          new Date(displayOrder.createdAt),
                          'dd MMM yyyy, hh:mm a',
                        )}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Updated</Text>
                      <Text style={styles.detailValue}>
                        {format(
                          new Date(
                            (displayOrder as any).updatedAt ||
                              displayOrder.createdAt,
                          ),
                          'dd MMM yyyy, hh:mm a',
                        )}
                      </Text>
                    </View>
                  </View>

                  {tracking?.trackingHistory &&
                    tracking.trackingHistory.length > 0 && (
                      <View style={styles.detailSection}>
                        <View style={styles.detailSectionHeader}>
                          <MaterialIcons
                            name="timeline"
                            size={18}
                            color="#2E7D32"
                          />
                          <Text style={styles.detailSectionTitle}>
                            Tracking History
                          </Text>
                        </View>
                        {tracking.trackingHistory
                          .slice(-5)
                          .reverse()
                          .map((item: any, index: number) => {
                            const isFWS = item.holderType === 'FWS';
                            return (
                              <View
                                key={index}
                                style={[
                                  styles.historyItem,
                                  isFWS && styles.fwsHistoryItem,
                                ]}
                              >
                                <View style={styles.historyHeader}>
                                  <View style={styles.historyStatusContainer}>
                                    {isFWS ? (
                                      <MaterialIcons
                                        name="warehouse"
                                        size={14}
                                        color="#2E7D32"
                                      />
                                    ) : (
                                      <MaterialIcons
                                        name="local-shipping"
                                        size={14}
                                        color="#888"
                                      />
                                    )}
                                    <Text style={styles.historyStatus}>
                                      {item.status}
                                    </Text>
                                  </View>
                                  <Text style={styles.historyTime}>
                                    {format(
                                      new Date(
                                        item.createdAt ||
                                          item.timestamp ||
                                          item.scannedAt,
                                      ),
                                      'dd MMM, hh:mm a',
                                    )}
                                  </Text>
                                </View>
                                {item.fwsProcessingStage && (
                                  <View style={styles.historyStageContainer}>
                                    <MaterialIcons
                                      name="label"
                                      size={12}
                                      color="#888"
                                    />
                                    <Text style={styles.historyStage}>
                                      Stage: {item.fwsProcessingStage}
                                    </Text>
                                  </View>
                                )}
                                <Text
                                  style={styles.historyNote}
                                  numberOfLines={2}
                                >
                                  {item.note}
                                </Text>
                              </View>
                            );
                          })}
                      </View>
                    )}

                  {canAssign && (
                    <TouchableOpacity
                      style={styles.dispatchButton}
                      onPress={() => {
                        setShowDetailModal(false);
                        openAssignmentModal(selectedOrder);
                      }}
                      disabled={isAssigning}
                      activeOpacity={0.8}
                    >
                      {isAssigning ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <FontAwesome5 name="truck" size={18} color="#fff" />
                          <Text style={styles.dispatchButtonText}>
                            Assign Dispatch
                          </Text>
                          <FontAwesome5
                            name="chevron-right"
                            size={14}
                            color="#fff"
                          />
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}

              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowDetailModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================================
  // Render
  // ============================================================
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  const data = getCurrentData();
  const isEmpty = data.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <MaterialIcons name="inventory" size={24} color="#2E7D32" />
          </View>
          <View>
            <Text style={styles.headerTitle}>FWS Orders</Text>
            <Text style={styles.headerSubtitle}>
              {activeTab === 'current'
                ? `${currentOrders.length} active orders in warehouse`
                : `${previousOrders.length} completed orders`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate('VerifyForDispatch' as never)}
          activeOpacity={0.8}
        >
          <Icon name="scan-outline" size={18} color="#fff" />
          <Text style={styles.scanButtonText}>Scan</Text>
        </TouchableOpacity>
      </View>

      <TabBar />

      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <MaterialIcons name="inbox" size={72} color="#ddd" />
          </View>
          <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
          <Text style={styles.emptySubText}>
            {activeTab === 'current'
              ? 'Scan a QR code to add orders to FWS'
              : 'No previous orders in history'}
          </Text>
          {activeTab === 'current' && (
            <TouchableOpacity
              style={styles.emptyScanButton}
              onPress={() => navigation.navigate('VerifyForDispatch' as never)}
              activeOpacity={0.8}
            >
              <Icon name="scan-outline" size={20} color="#fff" />
              <Text style={styles.emptyScanButtonText}>Scan QR Code</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderOrderItem}
          keyExtractor={(item, index) => item.order?._id || `order-${index}`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.ordersList}
        />
      )}

      <OrderDetailModal />
      <AssignmentModal />
    </View>
  );
};

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef0f3',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#1a2332' },
  headerSubtitle: { fontSize: 12, color: '#888', fontWeight: '400' },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 25,
    gap: 6,
  },
  scanButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eef0f3',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
    position: 'relative',
  },
  tabButtonActive: { backgroundColor: '#E8F5E9' },
  tabContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabText: { fontSize: 14, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#2E7D32', fontWeight: '600' },
  tabCount: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabCountPrevious: { backgroundColor: '#999' },
  tabCountText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: '30%',
    right: '30%',
    height: 3,
    backgroundColor: '#2E7D32',
    borderRadius: 2,
  },
  ordersList: { padding: 16 },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f2f5',
  },
  orderCardHovered: {
    borderColor: '#2E7D32',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdContainer: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  hashText: { fontSize: 13, fontWeight: '300', color: '#999' },
  orderIdText: {
    fontSize: 13,
    fontWeight: '300',
    color: '#1a2332',
    letterSpacing: 0.3,
  },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  currentBadgeText: { color: '#1976D2', fontSize: 9, fontWeight: '600' },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  stageBadgeText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  orderCardBody: { gap: 6 },
  buyerContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buyerNameText: { fontSize: 14, color: '#333', fontWeight: '500' },
  dateContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderDateText: { fontSize: 12, color: '#999', fontWeight: '400' },
  amountContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderAmountText: { fontSize: 18, fontWeight: '700', color: '#FF6F00' },
  readyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e8f5e9',
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  readyBadgeText: { color: '#2E7D32', fontSize: 11, fontWeight: '600' },
  dispatchButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6F00',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#FF6F00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  dispatchButtonSmallHovered: {
    backgroundColor: '#E65100',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dispatchButtonSmallText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  pendingBadgeWarning: { backgroundColor: '#FFF3E0' },
  pendingBadgeSuccess: { backgroundColor: '#E8F5E9' },
  pendingBadgeText: { fontSize: 11, fontWeight: '500' },
  pendingBadgeTextWarning: { color: '#E65100' },
  pendingBadgeTextSuccess: { color: '#2E7D32' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#888',
    fontWeight: '400',
  },
  loadingDetailsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDetailsText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: { marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptySubText: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  emptyScanButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 30,
    maxHeight: '92%',
  },
  modalScrollContent: { paddingBottom: 10 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 19, fontWeight: '700', color: '#1a2332' },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadgeContainer: { alignItems: 'center', marginBottom: 16 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 8,
  },
  currentStatusBadge: { backgroundColor: '#E3F2FD' },
  previousStatusBadge: { backgroundColor: '#f5f7fa' },
  statusBadgeText: { fontSize: 13, fontWeight: '600', color: '#333' },
  detailSection: {
    backgroundColor: '#f8f9fc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eef0f3',
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  detailSectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a2332' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eef0f3',
  },
  detailLabel: { fontSize: 13, color: '#888', fontWeight: '500' },
  detailValue: { fontSize: 13, color: '#333', fontWeight: '500' },
  statusValueBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusValueText: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
  stageValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  stageValueText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#FF6F00' },
  addressText: { fontSize: 13, color: '#333', marginTop: 4 },
  itemCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef0f3',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemLabel: { fontSize: 12, color: '#888', fontWeight: '500' },
  itemValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  itemDivider: { height: 1, backgroundColor: '#f0f2f5', marginVertical: 6 },
  noItemsText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 10,
  },
  historyItem: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef0f3',
  },
  fwsHistoryItem: { borderColor: '#4CAF50', backgroundColor: '#f6fdf7' },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyStatus: { fontSize: 13, fontWeight: '600', color: '#333' },
  historyStageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  historyStage: { fontSize: 11, color: '#888' },
  historyNote: { fontSize: 12, color: '#666', marginTop: 2 },
  historyTime: { fontSize: 11, color: '#999' },
  dispatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6F00',
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 12,
    gap: 10,
    shadowColor: '#FF6F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  dispatchButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  closeModalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  closeModalButtonText: { fontSize: 15, fontWeight: '600', color: '#888' },

  // ============================================================
  // Assignment Modal Styles
  // ============================================================
  modalOrderInfo: {
    backgroundColor: '#f8f9fc',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eef0f3',
  },
  modalOrderId: { fontSize: 13, fontWeight: '600', color: '#1a2332' },
  modalOrderBuyer: { fontSize: 12, color: '#666', marginTop: 2 },
  excludedInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  excludedInfoText: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: '500',
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eef0f3',
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  modeButtonText: { fontSize: 14, fontWeight: '600', color: '#666' },
  modeButtonTextActive: { color: '#fff' },
  shippingTypeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  shippingTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eef0f3',
    gap: 6,
  },
  shippingTypeButtonActive: {
    backgroundColor: '#FF6F00',
    borderColor: '#FF6F00',
  },
  shippingTypeText: { fontSize: 14, fontWeight: '600', color: '#666' },
  shippingTypeTextActive: { color: '#fff' },
  autoInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  autoInfoText: { fontSize: 13, color: '#1976D2', flex: 1 },
  manualContainer: { flex: 1, maxHeight: 300 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eef0f3',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a2332',
    marginLeft: 8,
  },
  loadingPartnersContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingPartnersText: { marginTop: 12, color: '#666' },
  emptyPartnersContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyPartnersText: { fontSize: 16, color: '#666', marginTop: 12 },
  partnersList: { paddingBottom: 20 },
  partnerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef0f3',
  },
  partnerCardSelected: {
    borderColor: '#FF6F00',
    backgroundColor: '#FFF8E1',
  },
  partnerCardExcluded: {
    backgroundColor: '#F5F5F5',
    borderColor: '#FFCDD2',
    opacity: 0.7,
  },
  partnerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerName: { fontSize: 14, fontWeight: '600', color: '#1a2332' },
  partnerNameExcluded: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  partnerVehicle: { fontSize: 12, color: '#666' },
  partnerVehicleExcluded: { color: '#ccc' },
  partnerDistance: { fontSize: 11, color: '#999' },
  partnerDistanceExcluded: { color: '#ccc' },
  partnerCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  unavailableDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f44336',
  },
  partnerStatus: { fontSize: 11, fontWeight: '500' },
  availableText: { color: '#4CAF50' },
  unavailableText: { color: '#f44336' },
  excludedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  excludedBadgeText: {
    fontSize: 9,
    color: '#f44336',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f7fa',
    borderWidth: 1,
    borderColor: '#eef0f3',
  },
  cancelButtonText: { fontSize: 14, fontWeight: '600', color: '#666' },
  confirmButton: {
    backgroundColor: '#FF6F00',
  },
  confirmButtonDisabled: {
    backgroundColor: '#FFB74D',
  },
  confirmButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default ScannedOrdersScreen;
