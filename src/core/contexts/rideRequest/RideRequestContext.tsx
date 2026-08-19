// src/core/contexts/rideRequest/RideRequestContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
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

const RideRequestContext = createContext<RideRequestContextType | undefined>(undefined);

export const useRideRequestContext = (): RideRequestContextType => {
  const context = useContext(RideRequestContext);
  if (!context) {
    throw new Error('useRideRequestContext must be used within RideRequestProvider');
  }
  return context;
};

interface RideRequestProviderProps {
  children: React.ReactNode;
}

export const RideRequestProvider: React.FC<RideRequestProviderProps> = ({ children }) => {
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const [isForeground, setIsForeground] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const requestIdSet = useRef<Set<string>>(new Set());
  const isRingtonePlaying = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const ringtoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { acceptRide: acceptRideAction, rejectRide: rejectRideAction, isProcessing } = useRideActions();

  // ✅ FIX: Ringtone management with debounce
  const manageRingtone = useCallback((count: number, foreground: boolean) => {
    console.log(`[RideRequestProvider] 📊 manageRingtone: count=${count}, foreground=${foreground}, playing=${isRingtonePlaying.current}`);

    // Clear any pending ringtone timeout
    if (ringtoneTimeoutRef.current) {
      clearTimeout(ringtoneTimeoutRef.current);
      ringtoneTimeoutRef.current = null;
    }

    if (count > 0 && foreground) {
      if (!isRingtonePlaying.current) {
        console.log('[RideRequestProvider] 🔊 Starting ringtone');
        ringtoneService.playRideRequestRingtone();
        isRingtonePlaying.current = true;
      }
    } else if (count === 0 || !foreground) {
      if (isRingtonePlaying.current) {
        console.log('[RideRequestProvider] 🔕 Stopping ringtone');
        ringtoneService.stopRingtone();
        isRingtonePlaying.current = false;
      }
    }
  }, []);

  // Track foreground/background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const foreground = nextAppState === 'active';
      setIsForeground(foreground);
      console.log(`[RideRequestProvider] App state: ${foreground ? 'FOREGROUND' : 'BACKGROUND'}`);

      manageRingtone(rideRequests.length, foreground);

      if (foreground) {
        console.log('[RideRequestProvider] 📱 App came foreground, dismissing notifications');
        notificationService.dismissAllRequests();
      }
    });

    return () => subscription.remove();
  }, [rideRequests.length, manageRingtone]);

  // ✅ FIX: Ringtone management on queue change
  useEffect(() => {
    manageRingtone(rideRequests.length, isForeground);
  }, [rideRequests.length, isForeground, manageRingtone]);

  // Subscribe to ride requests
  useEffect(() => {
    isMountedRef.current = true;
    console.log('[RideRequestProvider] 🔥 Setting up subscription');

    const unsubscribe = rideRequestHandler.subscribe((request: RideRequest) => {
      if (!isMountedRef.current) return;

      console.log('[RideRequestProvider] 📦 New ride request received:', request.requestId);

      if (requestIdSet.current.has(request.requestId)) {
        console.log('[RideRequestProvider] ⚠️ Duplicate request ignored:', request.requestId);
        return;
      }

      requestIdSet.current.add(request.requestId);
      setRideRequests(prev => [...prev, request]);

      const currentState = AppState.currentState;
      const isAppForeground = currentState === 'active';

      if (isAppForeground) {
        console.log('[RideRequestProvider] 📱 Foreground: Popup will handle UI');
      } else {
        console.log('[RideRequestProvider] 📱 Background: Showing system notification');
        notificationService.showRideRequestNotification(request);
      }
    });

    unsubscribeRef.current = unsubscribe;

    const existingRequest = rideRequestHandler.getCurrentRequest();
    if (existingRequest && isMountedRef.current) {
      if (!requestIdSet.current.has(existingRequest.requestId)) {
        requestIdSet.current.add(existingRequest.requestId);
        setRideRequests(prev => [...prev, existingRequest]);
      }
    }

    return () => {
      isMountedRef.current = false;
      console.log('[RideRequestProvider] 🧹 Cleaning up subscription');
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      requestIdSet.current.clear();
      setRideRequests([]);
      // ✅ FIX: Stop ringtone on cleanup
      ringtoneService.stopRingtone();
      isRingtonePlaying.current = false;
      if (ringtoneTimeoutRef.current) {
        clearTimeout(ringtoneTimeoutRef.current);
        ringtoneTimeoutRef.current = null;
      }
    };
  }, []);

  /**
   * ✅ FIX: Accept - Stop ringtone immediately
   */
  const acceptRide = useCallback(
    async (requestId: string): Promise<void> => {
      console.log('[RideRequestProvider] ✅ Accepting ride:', requestId);

      if (isProcessingRef.current) {
        console.log('[RideRequestProvider] ⚠️ Already processing, ignoring');
        return;
      }

      const request = rideRequests.find(r => r.requestId === requestId);
      if (!request) {
        console.log('[RideRequestProvider] ⚠️ Request not found:', requestId);
        return;
      }

      // ✅ FIX: Stop ringtone immediately
      ringtoneService.stopRingtone();
      isRingtonePlaying.current = false;

      isProcessingRef.current = true;

      try {
        const bookingId = request.booking?.bookingId;
        await acceptRideAction(requestId, bookingId || '');

        requestIdSet.current.delete(requestId);
        setRideRequests(prev => prev.filter(r => r.requestId !== requestId));
        rideRequestHandler.clearCurrentRequest();

        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1000);

      } catch (error) {
        console.error('[RideRequestProvider] Error accepting ride:', error);
        isProcessingRef.current = false;
      }
    },
    [rideRequests, acceptRideAction],
  );

  /**
   * ✅ FIX: Reject - Stop ringtone immediately
   */
  const rejectRide = useCallback(
    async (requestId: string): Promise<void> => {
      console.log('[RideRequestProvider] ❌ Rejecting ride:', requestId);

      if (isProcessingRef.current) {
        console.log('[RideRequestProvider] ⚠️ Already processing, ignoring');
        return;
      }

      const request = rideRequests.find(r => r.requestId === requestId);
      if (!request) {
        console.log('[RideRequestProvider] ⚠️ Request not found:', requestId);
        return;
      }

      // ✅ FIX: Stop ringtone immediately
      ringtoneService.stopRingtone();
      isRingtonePlaying.current = false;

      isProcessingRef.current = true;

      try {
        await rejectRideAction(requestId);

        requestIdSet.current.delete(requestId);
        setRideRequests(prev => prev.filter(r => r.requestId !== requestId));
        rideRequestHandler.clearCurrentRequest();

        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1000);

      } catch (error) {
        console.error('[RideRequestProvider] Error rejecting ride:', error);
        isProcessingRef.current = false;
      }
    },
    [rideRequests, rejectRideAction],
  );

  const dismissRequest = useCallback(
    async (requestId: string): Promise<void> => {
      console.log('[RideRequestProvider] ⏰ Dismissing ride request:', requestId);
      try {
        requestIdSet.current.delete(requestId);
        setRideRequests(prev => prev.filter(r => r.requestId !== requestId));
        rideRequestHandler.clearCurrentRequest();
        await notificationService.dismissRideRequest(requestId);
      } catch (error) {
        console.error('[RideRequestProvider] Error dismissing request:', error);
        requestIdSet.current.delete(requestId);
        setRideRequests(prev => prev.filter(r => r.requestId !== requestId));
      }
    },
    [],
  );

  const clearAllRequests = useCallback((): void => {
    console.log('[RideRequestProvider] 🧹 Clearing all requests');
    requestIdSet.current.clear();
    setRideRequests([]);
    rideRequestHandler.clearCurrentRequest();
    ringtoneService.stopRingtone();
    isRingtonePlaying.current = false;
    notificationService.dismissAllRequests();
  }, []);

  const value: RideRequestContextType = {
    rideRequests,
    requestCount: rideRequests.length,
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