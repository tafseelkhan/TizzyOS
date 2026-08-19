// src/core/components/cab/rideRequest/GlobalRideRequestPopup.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  PanResponder,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRideRequestContext } from '../../../contexts/rideRequest/RideRequestContext';
import { ringtoneService } from '../../../services/audio/RingtoneService';
import RideRequestCard from './RideRequestCard';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MINI_HEIGHT = 64;
const MAX_HEIGHT = SCREEN_HEIGHT * 0.9;
const BOTTOM_SAFE = Platform.OS === 'ios' ? 34 : 0;
const TOP_SAFE = Platform.OS === 'ios' ? 47 : 0;
const MINI_WIDTH = 200;

const GlobalRideRequestPopup: React.FC = () => {
  const {
    rideRequests,
    requestCount,
    acceptRide,
    rejectRide,
    dismissRequest,
    isForeground,
  } = useRideRequestContext();

  const isRingtonePlaying = useRef<boolean>(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tooltipFade = useRef(new Animated.Value(1)).current;

  // ✅ FIX: Use ref for position to avoid stale state in PanResponder
  const miniPositionRef = useRef({
    x: SCREEN_WIDTH / 2 - MINI_WIDTH / 2,
    y: SCREEN_HEIGHT - MINI_HEIGHT - BOTTOM_SAFE - 30,
  });
  const [miniPosition, setMiniPosition] = useState(miniPositionRef.current);

  // ✅ FIX: Store initial touch position
  const startTouchRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });

  // Double click detection
  const lastTapRef = useRef<number>(0);
  const dragActiveRef = useRef<boolean>(false);

  // ✅ Pulse Animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // ✅ Tooltip - 8 minutes (480 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(tooltipFade, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => setShowTooltip(false));
    }, 480000); // 8 minutes
    return () => clearTimeout(timer);
  }, []);

  // ✅ PanResponder for mini bar drag - FIXED
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        setIsDragging(true);
        dragActiveRef.current = true;
        // ✅ Store initial touch and position
        const touch = evt.nativeEvent;
        startTouchRef.current = { x: touch.pageX, y: touch.pageY };
        startPosRef.current = {
          x: miniPositionRef.current.x,
          y: miniPositionRef.current.y,
        };
      },
      onPanResponderMove: evt => {
        const touch = evt.nativeEvent;
        // ✅ Calculate delta from initial touch
        const deltaX = touch.pageX - startTouchRef.current.x;
        const deltaY = touch.pageY - startTouchRef.current.y;

        const maxX = SCREEN_WIDTH - MINI_WIDTH - 10;
        const minY = TOP_SAFE + 10;
        const maxY = SCREEN_HEIGHT - MINI_HEIGHT - BOTTOM_SAFE - 10;

        let newX = startPosRef.current.x + deltaX;
        let newY = startPosRef.current.y + deltaY;

        newX = Math.max(10, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));

        miniPositionRef.current = { x: newX, y: newY };
        setMiniPosition({ x: newX, y: newY });
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        dragActiveRef.current = false;
        // Snap to nearest edge
        const snapX =
          miniPositionRef.current.x < SCREEN_WIDTH / 2
            ? 10
            : SCREEN_WIDTH - MINI_WIDTH - 10;
        miniPositionRef.current.x = snapX;
        setMiniPosition(prev => ({ ...prev, x: snapX }));
      },
    }),
  ).current;

  // ✅ Handle tap with double-click detection
  const handleMiniBarPress = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300) {
      // Double tap detected - toggle expand
      setIsExpanded(!isExpanded);
      lastTapRef.current = 0;
    } else {
      // Single tap - just update last tap time
      lastTapRef.current = now;
    }
  };

  useEffect(() => {
    const hasRequests = rideRequests.length > 0 && isForeground;

    if (hasRequests) {
      if (!isRingtonePlaying.current) {
        console.log('[GlobalPopup] 🔊 Playing ringtone for popup');
        ringtoneService.playRideRequestRingtone();
        isRingtonePlaying.current = true;
      }
    } else {
      if (isRingtonePlaying.current) {
        console.log('[GlobalPopup] 🔕 Stopping ringtone');
        ringtoneService.stopRingtone();
        isRingtonePlaying.current = false;
      }
    }
  }, [rideRequests.length, isForeground]);

  useEffect(() => {
    return () => {
      if (isRingtonePlaying.current) {
        ringtoneService.stopRingtone();
        isRingtonePlaying.current = false;
      }
    };
  }, []);

  if (!isForeground || rideRequests.length === 0) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
      {isExpanded ? (
        // ✅ Full Expanded View
        <View
          style={[
            styles.container,
            {
              bottom: 0,
              left: 0,
              width: '100%',
              height: MAX_HEIGHT + BOTTOM_SAFE,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.dragHandle}
            onPress={() => setIsExpanded(false)}
            activeOpacity={0.8}
          >
            <View style={styles.dragBar} />
            <View style={styles.miniContent}>
              <Icon name="expand-less" size={20} color="#6b7280" />
              <Text style={styles.collapseText}>Collapse</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.popupContent}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Icon name="car-rental" size={24} color="#10b981" />
                <Text style={styles.headerTitle}>New Ride Requests</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{requestCount}</Text>
              </View>
            </View>

            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.scrollContent}
              bounces={true}
            >
              {rideRequests.map((request, index) => (
                <RideRequestCard
                  key={request.requestId || `ride-${index}`}
                  request={request}
                  index={index}
                  onAccept={() => acceptRide(request.requestId)}
                  onReject={() => rejectRide(request.requestId)}
                  onTimeout={() => dismissRequest(request.requestId)}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      ) : (
        // ✅ Mini Bar - with animation and tooltip
        <Animated.View
          style={[
            styles.miniContainer,
            {
              left: miniPosition.x,
              top: miniPosition.y,
              transform: [{ scale: pulseAnim }],
              opacity: isDragging ? 0.85 : 1,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            style={styles.miniDragHandle}
            onPress={handleMiniBarPress}
            activeOpacity={0.7}
          >
            <View style={styles.miniDragBar} />
            <View style={styles.miniContent}>
              <Icon name="car-rental" size={20} color="#10b981" />
              <Text style={styles.miniText}>
                {requestCount} Ride{requestCount > 1 ? 's' : ''}
              </Text>
              <Icon name="expand-more" size={20} color="#6b7280" />
            </View>

            {/* ✅ Tooltip - 8 minutes */}
            {showTooltip && (
              <Animated.View style={[styles.tooltip, { opacity: tooltipFade }]}>
                <Text style={styles.tooltipText}>
                  Drag to move · Double tap to open
                </Text>
              </Animated.View>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
    zIndex: 9999,
  },
  container: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
    zIndex: 9999,
  },
  miniContainer: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 9999,
    width: MINI_WIDTH,
    minHeight: MINI_HEIGHT,
    borderWidth: 1,
    borderColor: '#e8ecf0',
  },
  dragHandle: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 60,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  miniDragHandle: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    minHeight: MINI_HEIGHT,
    justifyContent: 'center',
    position: 'relative',
  },
  dragBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
    marginBottom: 8,
  },
  miniDragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginBottom: 6,
  },
  miniContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  miniText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  collapseText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  popupContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  countBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 22,
    minWidth: 32,
    alignItems: 'center',
  },
  countText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 8,
  },
  tooltip: {
    position: 'absolute',
    top: -28,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'center',
  },
  tooltipText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

export default GlobalRideRequestPopup;
