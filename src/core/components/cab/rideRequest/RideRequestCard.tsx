// src/core/components/cab/rideRequest/RideRequestCard.tsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
  Dimensions,
  Easing,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { RideRequest } from '../../../types/RideTypes';
import { useRideActions } from '../../../hooks/cab/useRideActions';

const { width } = Dimensions.get('window');

const MAX_TIME = 20;
const URGENT_THRESHOLD = 5;

const COLORS = {
  ink: '#2563eb',
  signal: '#0d9488',
  signalSoft: '#ccfbf1',
  signalDeep: '#0f766e',
  paper: '#ffffff',
  paperSoft: '#f6f8f7',
  border: '#e3e7e4',
  danger: '#e5484d',
  dangerSoft: '#fdecec',
  muted: '#6b7280',
  mutedSoft: '#9aa39d',
};

const getTimerColor = (timeLeft: number) => {
  if (timeLeft > 15) return '#3b82f6';
  if (timeLeft > 10) return '#22c55e';
  if (timeLeft > 5) return '#f59e0b';
  if (timeLeft > 1) return '#eab308';
  return '#ef4444';
};

interface RideRequestCardProps {
  request: RideRequest;
  onAccept?: () => void;
  onReject?: () => void;
  onTimeout: () => void;
  index: number;
}

const RideRequestCard: React.FC<RideRequestCardProps> = ({
  request,
  onAccept,
  onReject,
  onTimeout,
  index,
}) => {
  const {
    acceptRide,
    rejectRide,
    isProcessing: isActionProcessing,
  } = useRideActions();

  const [timeLeft, setTimeLeft] = useState<number>(MAX_TIME);
  const [isProcessing, setIsProcessing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const slideAnim = useRef(new Animated.Value(60 * (index + 1))).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const gaugeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const acceptScale = useRef(new Animated.Value(1)).current;
  const rejectScale = useRef(new Animated.Value(1)).current;

  const shineAnimAccept = useRef(new Animated.Value(-width)).current;
  const shineAnimReject = useRef(new Animated.Value(-width)).current;

  const timerColor = getTimerColor(timeLeft);

  // ✅ Shine animation with cleanup
  useEffect(() => {
    const startShine = (anim: Animated.Value) => {
      anim.setValue(-width);
      Animated.loop(
        Animated.timing(anim, {
          toValue: width,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
      ).start();
    };

    startShine(shineAnimAccept);
    startShine(shineAnimReject);

    return () => {
      shineAnimAccept.stopAnimation();
      shineAnimReject.stopAnimation();
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (request.expiresAt) {
      const expiryDate = new Date(request.expiresAt);
      const now = new Date();
      const remaining = Math.max(
        0,
        Math.floor((expiryDate.getTime() - now.getTime()) / 1000),
      );
      setTimeLeft(Math.min(remaining, MAX_TIME));
    }
  }, [request.expiresAt]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 11,
        bounciness: 5,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();

    // ✅ Gauge animation 0 → 100%
    Animated.timing(gaugeAnim, {
      toValue: 1,
      duration: MAX_TIME * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // ✅ Timer with proper cleanup
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          Vibration.cancel();
          if (isMountedRef.current) {
            onTimeout();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    Vibration.vibrate([300, 200, 300], false);

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      Vibration.cancel();
      gaugeAnim.stopAnimation();
      pulseAnim.stopAnimation();
    };
  }, []);

  useEffect(() => {
    if (timeLeft <= URGENT_THRESHOLD && timeLeft > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.18,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [timeLeft]);

  const pressIn = (anim: Animated.Value) =>
    Animated.spring(anim, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 40,
    }).start();

  const pressOut = (anim: Animated.Value) =>
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
    }).start();

  // ✅ Accept handler
  const handleAccept = useCallback(async () => {
    if (isProcessing || isActionProcessing) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    Vibration.cancel();

    setIsProcessing(true);

    try {
      await acceptRide(request.requestId, request.booking?.bookingId || '');
      if (onAccept) {
        onAccept();
      }
    } catch (error) {
      console.error('[RideRequestCard] Accept error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, isActionProcessing, acceptRide, request, onAccept]);

  // ✅ Reject handler
  const handleReject = useCallback(async () => {
    if (isProcessing || isActionProcessing) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    Vibration.cancel();

    setIsProcessing(true);

    try {
      await rejectRide(request.requestId);
      if (onReject) {
        onReject();
      }
    } catch (error) {
      console.error('[RideRequestCard] Reject error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, isActionProcessing, rejectRide, request, onReject]);

  const {
    customer,
    booking,
    fare,
    pickup,
    destination,
    distance,
    isRetry,
    batchNumber,
    expiresAt,
  } = request;

  // ✅ Gauge height interpolation
  const gaugeHeight = gaugeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const getExpiryTime = () => {
    if (!expiresAt) return '';
    const date = new Date(expiresAt);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getShineStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transform: [{ translateX: anim }],
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
  });

  return (
    <Animated.View
      style={[
        styles.card,
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.topStrip}>
        <View style={styles.customerRow}>
          {customer?.profilePicture ? (
            <Image
              source={{ uri: customer.profilePicture }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="person" size={18} color={COLORS.paper} />
            </View>
          )}
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>
              {customer?.name || 'Customer'}
            </Text>
            <Text style={styles.serviceType}>
              {booking?.serviceType || 'RIDE'}
            </Text>
          </View>
        </View>
        <View style={styles.topStripRight}>
          <View style={styles.bookingIdChip}>
            <Text style={styles.bookingIdText}>
              #{booking?.bookingId?.slice(-6) || 'N/A'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.leftGrid}>
          <View style={styles.gaugeTrack}>
            <Animated.View
              style={[
                styles.gaugeFill,
                { height: gaugeHeight, backgroundColor: timerColor },
              ]}
            />
            <View style={styles.gaugeReadout}>
              <Animated.Text
                style={[
                  styles.timerNumber,
                  { color: timerColor, transform: [{ scale: pulseAnim }] },
                ]}
              >
                {timeLeft}
              </Animated.Text>
              <Text style={styles.timerUnit}>SEC</Text>
            </View>
          </View>

          <View style={styles.fareBlock}>
            <Text style={styles.fareCurrency}>₹</Text>
            <Text style={styles.fareValue}>{fare}</Text>
          </View>

          <View style={styles.metaRow}>
            <IconMC
              name="map-marker-distance"
              size={13}
              color={COLORS.mutedSoft}
            />
            <Text style={styles.metaText}>{distance} km</Text>
          </View>

          {batchNumber && (
            <View style={styles.leftInfoRow}>
              <IconMC name="tag-outline" size={12} color={COLORS.mutedSoft} />
              <Text style={styles.leftInfoText}>Batch #{batchNumber}</Text>
            </View>
          )}

          {expiresAt && (
            <View style={styles.leftInfoRow}>
              <IconMC name="clock-outline" size={12} color={COLORS.mutedSoft} />
              <Text style={styles.leftInfoText}>{getExpiryTime()}</Text>
            </View>
          )}

          {isRetry && (
            <View style={styles.retryChip}>
              <Text style={styles.retryChipText}>RETRY</Text>
            </View>
          )}
        </View>

        <View style={styles.verticalDivider} />

        <View style={styles.rightGrid}>
          <View style={styles.stopRow}>
            <View style={styles.stopMarkerCol}>
              <View style={styles.pickupDot} />
              <View style={styles.stopConnector} />
            </View>
            <View style={styles.stopContent}>
              <Text style={styles.stopLabel}>PICKUP</Text>
              <Text style={styles.stopAddress} numberOfLines={2}>
                {pickup?.address || 'Fetching address…'}
              </Text>
            </View>
          </View>

          <View style={styles.stopRow}>
            <View style={styles.stopMarkerCol}>
              <View style={styles.dropDot}>
                <View style={styles.dropDotInner} />
              </View>
            </View>
            <View style={styles.stopContent}>
              <Text style={styles.stopLabel}>DROP</Text>
              <Text style={styles.stopAddress} numberOfLines={2}>
                {destination?.address || 'Fetching address…'}
              </Text>
            </View>
          </View>

          <View style={styles.bookingDetailsContainer}>
            {booking?.bookingId && (
              <View style={styles.bookingDetailRow}>
                <Text style={styles.bookingDetailLabel}>Booking ID</Text>
                <Text style={styles.bookingDetailValue}>
                  {booking.bookingId}
                </Text>
              </View>
            )}
            {booking?.rideCode && (
              <View style={styles.bookingDetailRow}>
                <Text style={styles.bookingDetailLabel}>Ride Code</Text>
                <Text style={styles.bookingDetailValue}>
                  {booking.rideCode}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Animated.View
          style={[styles.buttonWrap, { transform: [{ scale: rejectScale }] }]}
        >
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={handleReject}
            onPressIn={() => pressIn(rejectScale)}
            onPressOut={() => pressOut(rejectScale)}
            activeOpacity={0.9}
            disabled={isProcessing || isActionProcessing}
          >
            <View style={styles.buttonContent}>
              <Icon name="close" size={20} color={COLORS.danger} />
              <Text style={styles.rejectText}>Decline</Text>
            </View>
            <Animated.View style={getShineStyle(shineAnimReject)} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={[
            styles.buttonWrap,
            styles.acceptWrap,
            { transform: [{ scale: acceptScale }] },
          ]}
        >
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            onPressIn={() => pressIn(acceptScale)}
            onPressOut={() => pressOut(acceptScale)}
            activeOpacity={0.92}
            disabled={isProcessing || isActionProcessing}
          >
            <View style={styles.buttonContent}>
              <IconMC name="check-bold" size={20} color={COLORS.paper} />
              <Text style={styles.acceptText}>Accept</Text>
            </View>
            <Animated.View style={getShineStyle(shineAnimAccept)} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.paper,
    borderRadius: 20,
    marginBottom: 14,
    width: width - 32,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  topStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.signal,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInfo: {
    flexDirection: 'column',
  },
  customerName: {
    color: COLORS.paper,
    fontSize: 14,
    fontWeight: '700',
  },
  serviceType: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  topStripRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingIdChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  bookingIdText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  body: {
    flexDirection: 'row',
    padding: 14,
  },
  leftGrid: {
    width: 85,
    alignItems: 'center',
  },
  gaugeTrack: {
    width: 54,
    height: 80,
    borderRadius: 14,
    backgroundColor: COLORS.paperSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  gaugeFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.2,
  },
  gaugeReadout: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerNumber: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  timerUnit: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.mutedSoft,
    letterSpacing: 1,
    marginTop: -2,
  },
  fareBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  fareCurrency: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
    marginTop: 2,
    marginRight: 1,
  },
  fareValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600',
  },
  leftInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  leftInfoText: {
    fontSize: 9,
    color: COLORS.muted,
    fontWeight: '500',
  },
  retryChip: {
    backgroundColor: COLORS.signalSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  retryChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.signalDeep,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  rightGrid: {
    flex: 1,
    justifyContent: 'center',
  },
  stopRow: {
    flexDirection: 'row',
  },
  stopMarkerCol: {
    width: 14,
    alignItems: 'center',
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.signal,
    marginTop: 3,
  },
  stopConnector: {
    width: 2,
    flex: 1,
    minHeight: 14,
    backgroundColor: COLORS.border,
    marginVertical: 3,
  },
  dropDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    marginTop: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropDotInner: {
    width: 3,
    height: 3,
    borderRadius: 1,
    backgroundColor: COLORS.danger,
  },
  stopContent: {
    flex: 1,
    marginLeft: 8,
    paddingBottom: 8,
  },
  stopLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.mutedSoft,
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  stopAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.ink,
    lineHeight: 15,
  },
  bookingDetailsContainer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bookingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  bookingDetailLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.mutedSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  bookingDetailValue: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.muted,
    textAlign: 'right',
    flex: 0.6,
  },
  expiryText: {
    color: COLORS.danger,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  buttonWrap: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
    position: 'relative',
  },
  acceptWrap: {
    flex: 1.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    width: '100%',
    height: '100%',
  },
  rejectButton: {
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: '#f3b9bb',
    borderRadius: 12,
    overflow: 'hidden',
    height: 46,
  },
  rejectText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  acceptButton: {
    backgroundColor: COLORS.ink,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    height: 46,
  },
  acceptText: {
    color: COLORS.paper,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

export default RideRequestCard;
