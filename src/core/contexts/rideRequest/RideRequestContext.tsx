// src/core/contexts/rideRequest/RideRequestContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { rideRequestHandler } from '../../utils/socket/rideRequestHandler';
import { notificationService } from '../../services/notification/NotificationService';
import { ringtoneService } from '../../services/audio/RingtoneService';
import { RideRequest } from '../../types/RideTypes';
import { useRideActions } from '../../hooks/cab/useRideActions';

let globalNavigation: any = null;

export const setGlobalNavigation = (nav: any) => {
  globalNavigation = nav;
};

interface RideRequestContextType {
  rideRequests: RideRequest[];
  requestCount: number;
  isProcessing: boolean;
  isForeground: boolean;
  acceptRide: (requestId: string) => Promise<void>;
  rejectRide: (requestId: string) => Promise<void>;
  dismissRequest: (requestId: string) => Promise<void>;
  clearAllRequests: () => void;
}

const RideRequestContext = createContext<RideRequestContextType | undefined>(
  undefined,
);

export const useRideRequestContext = (): RideRequestContextType => {
  const context = useContext(RideRequestContext);
  if (!context) {
    throw new Error(
      'useRideRequestContext must be used within RideRequestProvider',
    );
  }
  return context;
};

interface RideRequestProviderProps {
  children: React.ReactNode;
}

export const RideRequestProvider: React.FC<RideRequestProviderProps> = ({
  children,
}) => {
  // ✅ State
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const [isForeground, setIsForeground] = useState(true);

  // ✅ Hooks
  const {
    acceptRide: acceptRideAction,
    rejectRide: rejectRideAction,
    isProcessing,
  } = useRideActions();

  // ✅ Refs for lifecycle management
  const isMountedRef = useRef<boolean>(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const requestIdSet = useRef<Set<string>>(new Set());
  const processedRequestIdsRef = useRef<Set<string>>(new Set());
  const handlingRequestIdsRef = useRef<Set<string>>(new Set());
  const isRingtonePlaying = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const ringtoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');
  const subscriptionActiveRef = useRef<boolean>(false);
  const requestQueueRef = useRef<RideRequest[]>([]);

  // ✅ Request count
  const requestCount = useMemo(() => rideRequests.length, [rideRequests]);

  // ✅ Cleanup function for a single request
  const cleanupRequest = useCallback((requestId: string) => {
    // Remove from handling set
    handlingRequestIdsRef.current.delete(requestId);
    processedRequestIdsRef.current.add(requestId);
    requestIdSet.current.delete(requestId);

    // Dismiss notification
    try {
      notificationService.dismissRideRequest(requestId);
    } catch (error) {
      // Ignore notification errors
      console.log(
        '[RideRequestContext] Notification dismiss error (ignored):',
        error,
      );
    }
  }, []);

  // ✅ Remove request from state - SAFE: Uses functional update, no render-time state updates
  const removeRequestFromState = useCallback((requestId: string) => {
    setRideRequests(prev => {
      const filtered = prev.filter(req => req.requestId !== requestId);
      return filtered;
    });
  }, []);

  // ✅ Ringtone management with debounce
  const manageRingtone = useCallback((count: number, foreground: boolean) => {
    console.log(
      `[RideRequestContext] 📊 manageRingtone: count=${count}, foreground=${foreground}, playing=${isRingtonePlaying.current}`,
    );

    // Clear any pending ringtone timeout
    if (ringtoneTimeoutRef.current) {
      clearTimeout(ringtoneTimeoutRef.current);
      ringtoneTimeoutRef.current = null;
    }

    if (count > 0 && foreground) {
      if (!isRingtonePlaying.current) {
        console.log('[RideRequestContext] 🔊 Starting ringtone');
        ringtoneService.playRideRequestRingtone();
        isRingtonePlaying.current = true;
      }
    } else if (count === 0 || !foreground) {
      if (isRingtonePlaying.current) {
        console.log('[RideRequestContext] 🔕 Stopping ringtone');
        ringtoneService.stopRingtone();
        isRingtonePlaying.current = false;
      }
    }
  }, []);

  // ✅ Dismiss request - Primary cleanup function with lifecycle guard
  const dismissRequest = useCallback(
    async (requestId: string): Promise<void> => {
      // ✅ Check if request is already being handled
      if (handlingRequestIdsRef.current.has(requestId)) {
        console.log(
          '[RideRequestContext] ⛔ Request already being handled:',
          requestId,
        );
        return;
      }

      // ✅ Check if request already processed
      if (processedRequestIdsRef.current.has(requestId)) {
        console.log(
          '[RideRequestContext] ⛔ Request already processed:',
          requestId,
        );
        return;
      }

      // ✅ Check if request exists
      const exists = rideRequests.some(req => req.requestId === requestId);
      if (!exists) {
        console.log('[RideRequestContext] ⚠️ Request not found:', requestId);
        return;
      }

      // ✅ Mark as handling
      handlingRequestIdsRef.current.add(requestId);

      console.log(
        '[RideRequestContext] ⏰ Dismissing ride request:',
        requestId,
      );

      try {
        // ✅ Clear current request from handler
        rideRequestHandler.clearCurrentRequest();

        // ✅ Cleanup
        cleanupRequest(requestId);

        // ✅ Remove from state
        removeRequestFromState(requestId);
      } catch (error) {
        console.error('[RideRequestContext] Error dismissing request:', error);

        // ✅ Release lock on error
        handlingRequestIdsRef.current.delete(requestId);

        // ✅ Still try to remove from state
        requestIdSet.current.delete(requestId);
        removeRequestFromState(requestId);
      }
    },
    [rideRequests, cleanupRequest, removeRequestFromState],
  );

  // ✅ Accept ride - With lifecycle guard
  const acceptRide = useCallback(
    async (requestId: string): Promise<void> => {
      // ✅ Check if request is already being handled
      if (handlingRequestIdsRef.current.has(requestId)) {
        console.log(
          '[RideRequestContext] ⛔ Request already being handled:',
          requestId,
        );
        return;
      }

      // ✅ Check if request already processed
      if (processedRequestIdsRef.current.has(requestId)) {
        console.log(
          '[RideRequestContext] ⛔ Request already processed:',
          requestId,
        );
        return;
      }

      // ✅ Check if already processing
      if (isProcessingRef.current) {
        console.log('[RideRequestContext] ⚠️ Already processing, ignoring');
        return;
      }

      // ✅ Find request
      const request = rideRequests.find(r => r.requestId === requestId);
      if (!request) {
        console.log(
          '[RideRequestContext] ⚠️ Request not found for accept:',
          requestId,
        );
        return;
      }

      // ✅ Mark as handling
      handlingRequestIdsRef.current.add(requestId);
      isProcessingRef.current = true;

      console.log('[RideRequestContext] ✅ Accepting ride:', requestId);

      // ✅ Stop ringtone immediately
      ringtoneService.stopRingtone();
      isRingtonePlaying.current = false;

      try {
        const bookingId = request.booking?.bookingId || '';
        await acceptRideAction(requestId, bookingId);

        // ✅ Success - Cleanup and remove
        cleanupRequest(requestId);
        removeRequestFromState(requestId);

        // ✅ Clear handler
        rideRequestHandler.clearCurrentRequest();
      } catch (error) {
        console.error('[RideRequestContext] ❌ Accept failed:', error);

        // ✅ Release lock on error so user can retry
        handlingRequestIdsRef.current.delete(requestId);
        // Do NOT mark as processed on error
      } finally {
        isProcessingRef.current = false;
      }
    },
    [rideRequests, acceptRideAction, cleanupRequest, removeRequestFromState],
  );

  // ✅ Reject ride - With lifecycle guard
  const rejectRide = useCallback(
    async (requestId: string): Promise<void> => {
      // ✅ Check if request is already being handled
      if (handlingRequestIdsRef.current.has(requestId)) {
        console.log(
          '[RideRequestContext] ⛔ Request already being handled:',
          requestId,
        );
        return;
      }

      // ✅ Check if request already processed
      if (processedRequestIdsRef.current.has(requestId)) {
        console.log(
          '[RideRequestContext] ⛔ Request already processed:',
          requestId,
        );
        return;
      }

      // ✅ Check if already processing
      if (isProcessingRef.current) {
        console.log('[RideRequestContext] ⚠️ Already processing, ignoring');
        return;
      }

      // ✅ Find request
      const request = rideRequests.find(r => r.requestId === requestId);
      if (!request) {
        console.log(
          '[RideRequestContext] ⚠️ Request not found for reject:',
          requestId,
        );
        return;
      }

      // ✅ Mark as handling
      handlingRequestIdsRef.current.add(requestId);
      isProcessingRef.current = true;

      console.log('[RideRequestContext] ❌ Rejecting ride:', requestId);

      // ✅ Stop ringtone immediately
      ringtoneService.stopRingtone();
      isRingtonePlaying.current = false;

      try {
        await rejectRideAction(requestId);

        // ✅ Success - Cleanup and remove
        cleanupRequest(requestId);
        removeRequestFromState(requestId);

        // ✅ Clear handler
        rideRequestHandler.clearCurrentRequest();
      } catch (error) {
        console.error('[RideRequestContext] ❌ Reject failed:', error);

        // ✅ Release lock on error so user can retry
        handlingRequestIdsRef.current.delete(requestId);
        // Do NOT mark as processed on error
      } finally {
        isProcessingRef.current = false;
      }
    },
    [rideRequests, rejectRideAction, cleanupRequest, removeRequestFromState],
  );

  // ✅ Clear all requests
  const clearAllRequests = useCallback((): void => {
    console.log('[RideRequestContext] 🧹 Clearing all requests');

    // ✅ Clear all tracking sets
    handlingRequestIdsRef.current.clear();
    processedRequestIdsRef.current.clear();
    requestIdSet.current.clear();

    // ✅ Dismiss all notifications
    rideRequests.forEach(req => {
      try {
        notificationService.dismissRideRequest(req.requestId);
      } catch (error) {
        // Ignore
      }
    });

    // ✅ Clear handler
    try {
      rideRequestHandler.clearCurrentRequest();
    } catch (error) {
      // Ignore
    }

    // ✅ Stop ringtone
    ringtoneService.stopRingtone();
    isRingtonePlaying.current = false;

    // ✅ Clear state
    setRideRequests([]);
  }, [rideRequests]);

  // ✅ Handle new ride request - SAFE: Uses batched state update
  const handleNewRideRequest = useCallback((request: RideRequest) => {
    if (!isMountedRef.current) return;

    // ✅ Check for duplicate request
    if (requestIdSet.current.has(request.requestId)) {
      console.log(
        '[RideRequestContext] ⚠️ Duplicate request ignored:',
        request.requestId,
      );
      return;
    }

    // ✅ Check if already processed
    if (processedRequestIdsRef.current.has(request.requestId)) {
      console.log(
        '[RideRequestContext] ⚠️ Already processed, ignoring:',
        request.requestId,
      );
      return;
    }

    console.log('[RideRequestContext] 📥 New ride request:', request.requestId);

    // ✅ Add to tracking set
    requestIdSet.current.add(request.requestId);

    // ✅ Add to state using functional update - SAFE
    setRideRequests(prev => {
      // ✅ Double-check duplicate in state
      const exists = prev.some(r => r.requestId === request.requestId);
      if (exists) {
        console.log('[RideRequestContext] ⚠️ Duplicate in state, skipping');
        return prev;
      }
      return [...prev, request];
    });

    // ✅ Show notification if in background
    const currentState = AppState.currentState;
    const isAppForeground = currentState === 'active';

    if (!isAppForeground) {
      console.log(
        '[RideRequestContext] 📱 Background: Showing system notification',
      );
      try {
        notificationService.showRideRequestNotification(request);
      } catch (error) {
        console.log(
          '[RideRequestContext] Notification error (ignored):',
          error,
        );
      }
    }
  }, []);

  // ✅ Subscribe to ride requests - FIXED: Prevents duplicate subscriptions
  useEffect(() => {
    isMountedRef.current = true;
    console.log('[RideRequestContext] 🔥 Setting up subscription');

    // ✅ Prevent duplicate subscription
    if (subscriptionActiveRef.current) {
      console.log(
        '[RideRequestContext] ⚠️ Subscription already active, skipping',
      );
      return;
    }

    // ✅ Subscribe
    const unsubscribe = rideRequestHandler.subscribe(handleNewRideRequest);
    unsubscribeRef.current = unsubscribe;
    subscriptionActiveRef.current = true;

    // ✅ Check for existing request - but only if not already added
    const existingRequest = rideRequestHandler.getCurrentRequest();
    if (existingRequest && isMountedRef.current) {
      if (
        !requestIdSet.current.has(existingRequest.requestId) &&
        !processedRequestIdsRef.current.has(existingRequest.requestId)
      ) {
        requestIdSet.current.add(existingRequest.requestId);
        setRideRequests(prev => {
          const exists = prev.some(
            r => r.requestId === existingRequest.requestId,
          );
          if (exists) return prev;
          return [...prev, existingRequest];
        });
      }
    }

    // ✅ App state listener
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      appStateRef.current = nextAppState;
      const foreground = nextAppState === 'active';
      setIsForeground(foreground);

      console.log(
        `[RideRequestContext] App state: ${foreground ? 'FOREGROUND' : 'BACKGROUND'}`,
      );

      // ✅ Manage ringtone based on state
      manageRingtone(rideRequests.length, foreground);

      // ✅ Dismiss notifications when app comes foreground
      if (foreground) {
        console.log(
          '[RideRequestContext] 📱 App came foreground, dismissing notifications',
        );
        try {
          notificationService.dismissAllRequests();
        } catch (error) {
          // Ignore
        }
      }
    };

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    // ✅ Cleanup
    return () => {
      console.log('[RideRequestContext] 🧹 Cleaning up subscription');

      isMountedRef.current = false;
      subscriptionActiveRef.current = false;

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      appStateSubscription.remove();

      // ✅ Stop ringtone
      ringtoneService.stopRingtone();
      isRingtonePlaying.current = false;

      // ✅ Clear timeouts
      if (ringtoneTimeoutRef.current) {
        clearTimeout(ringtoneTimeoutRef.current);
        ringtoneTimeoutRef.current = null;
      }

      // ✅ Clear tracking sets
      handlingRequestIdsRef.current.clear();
      processedRequestIdsRef.current.clear();
      requestIdSet.current.clear();
    };
  }, [handleNewRideRequest, manageRingtone, rideRequests.length]);

  // ✅ Ringtone management on requests/foreground change
  useEffect(() => {
    manageRingtone(rideRequests.length, isForeground);
  }, [rideRequests.length, isForeground, manageRingtone]);

  // ✅ Cleanup processed requests periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (processedRequestIdsRef.current.size > 100) {
        const entries = Array.from(processedRequestIdsRef.current);
        const toRemove = entries.slice(0, entries.length - 50);
        toRemove.forEach(id => processedRequestIdsRef.current.delete(id));
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // ✅ Context value
  const value: RideRequestContextType = {
    rideRequests,
    requestCount,
    isProcessing,
    isForeground,
    acceptRide,
    rejectRide,
    dismissRequest,
    clearAllRequests,
  };

  return (
    <RideRequestContext.Provider value={value}>
      {children}
    </RideRequestContext.Provider>
  );
};

export default RideRequestProvider;
