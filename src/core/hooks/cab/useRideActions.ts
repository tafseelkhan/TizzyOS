// src/hooks/cab/useRideActions.ts

import { useCallback, useState, useRef } from 'react';
import { socketService } from '../../../core/utils/socket/socketUtils';
import { rideRequestSocketHandler } from '../../../api/connections/handlers/sockets/rideRequestSocketHandler';
import { rideStatusSocketHandler } from '../../../api/connections/handlers/sockets/rideStatusSocketHandler';
import { driverRideApi } from '../../../api/features/private/driverRidePrivateSlice';
import { NavigationService } from '../../services/navigation/NavigationService';
import { getToken } from '../../../api/connections/token/tokenSlice';

// ✅ Helper to extract userId from token
const extractUserIdFromToken = (token: string): string | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.userId || payload.sub || null;
  } catch {
    return null;
  }
};

interface UseRideActionsReturn {
  acceptRide: (requestId: string, bookingId: string) => Promise<void>;
  rejectRide: (requestId: string, bookingId?: string) => Promise<void>;
  isProcessing: boolean;
  error: string | null;
  clearError: () => void;
}

export const useRideActions = (): UseRideActionsReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRejecting = useRef<boolean>(false);
  const isAccepting = useRef<boolean>(false);
  const hasNavigatedRef = useRef<boolean>(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const processedRequests = useRef<Set<string>>(new Set());
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const cleanupListeners = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
  }, []);

  const navigateToRideTracking = useCallback(
    (trackingId: string, bookingId?: string) => {
      if (hasNavigatedRef.current) {
        console.log('[useRideActions] ⚠️ Already navigated, skipping');
        return;
      }

      if (!trackingId) {
        console.error('[useRideActions] ❌ Cannot navigate: No trackingId');
        return;
      }

      hasNavigatedRef.current = true;
      cleanupListeners();

      console.log(
        '[useRideActions] 🧭 Navigating to RideTracking with trackingId:',
        trackingId,
      );

      NavigationService.navigate('RideTracking', {
        trackingId,
        bookingId,
      });
    },
    [cleanupListeners],
  );

  // ============================================================
  // ACCEPT RIDE - Using Handlers
  // ============================================================
  const acceptRide = useCallback(
    async (requestId: string, bookingId: string): Promise<void> => {
      const key = `${requestId}-accept`;

      if (processedRequests.current.has(key)) {
        console.warn('[useRideActions] ⚠️ Already processed this request');
        return;
      }

      if (isAccepting.current) {
        console.log('[useRideActions] ⚠️ Already accepting, ignoring');
        return;
      }

      if (isProcessing) {
        console.log('[useRideActions] ⚠️ Already processing, ignoring');
        return;
      }

      console.log('[useRideActions] ✅ Accepting ride:', requestId);

      isAccepting.current = true;
      setIsProcessing(true);
      setError(null);
      hasNavigatedRef.current = false;
      processedRequests.current.add(key);
      cleanupListeners();

      try {
        const token = await getToken();
        let driverId = '';
        if (token) {
          driverId = extractUserIdFromToken(token) || '';
        }
        console.log('[useRideActions] 👤 Driver ID:', driverId);

        const isSocketConnected = socketService.isSocketConnected();
        console.log('[useRideActions] 📊 Socket connected:', isSocketConnected);

        if (isSocketConnected) {
          let trackingReceived = false;
          let navigationDone = false;

          // ============================================================
          // ✅ HANDLER 1: RIDE ACCEPTED - Using rideRequestSocketHandler
          // ============================================================
          const rideAcceptedHandler = (data: any) => {
            console.log('[useRideActions] ✅ RIDE_ACCEPTED handler triggered!');
            console.log(
              '[useRideActions] 📦 Data:',
              JSON.stringify(data, null, 2),
            );

            const tid =
              data?.trackingId || data?.tracking_id || data?.id || data?._id;
            const bid = data?.bookingId || data?.booking_id || bookingId;

            console.log('[useRideActions] 🔍 Extracted trackingId:', tid);

            if (tid && !trackingReceived && !navigationDone) {
              trackingReceived = true;
              navigationDone = true;
              console.log(
                '[useRideActions] ✅ Navigating with trackingId from accept:',
                tid,
              );
              navigateToRideTracking(tid, bid);
            }
          };

          // ============================================================
          // ✅ HANDLER 2: RIDE STATUS CHANGE - Using rideStatusSocketHandler
          // ============================================================
          const statusChangeHandler = (data: any) => {
            console.log(
              '[useRideActions] ✅ RIDE_STATUS_CHANGE handler triggered!',
            );
            console.log(
              '[useRideActions] 📦 Data:',
              JSON.stringify(data, null, 2),
            );

            const tid =
              data?.trackingId || data?.tracking_id || data?.id || data?._id;
            const bid = data?.bookingId || data?.booking_id || bookingId;

            console.log('[useRideActions] 🔍 Status change - trackingId:', tid);

            if (
              data?.status === 'accepted' &&
              tid &&
              !trackingReceived &&
              !navigationDone
            ) {
              trackingReceived = true;
              navigationDone = true;
              console.log(
                '[useRideActions] ✅ Navigating with trackingId from ride-status-change:',
                tid,
              );
              navigateToRideTracking(tid, bid);
            }
          };

          // ============================================================
          // ✅ REGISTER LISTENERS (USING HANDLERS - NOT DIRECT socketService)
          // ============================================================
          console.log(
            '[useRideActions] 📡 Registering listeners via handlers...',
          );

          // ✅ Use rideRequestSocketHandler for 'accept' event
          rideRequestSocketHandler.on('accept', rideAcceptedHandler);

          // ✅ Use rideStatusSocketHandler for 'ride-status-change' event
          rideStatusSocketHandler.on('ride-status-change', statusChangeHandler);

          cleanupRef.current = () => {
            console.log('[useRideActions] 🧹 Cleaning up socket listeners');
            rideRequestSocketHandler.off('accept', rideAcceptedHandler);
            rideStatusSocketHandler.off(
              'ride-status-change',
              statusChangeHandler,
            );
          };

          // ============================================================
          // ✅ EMIT DRIVER RESPONSE - Using rideRequestSocketHandler
          // ============================================================
          rideRequestSocketHandler.emitDriverResponse(
            requestId,
            'accepted',
            driverId,
          );

          // ============================================================
          // ✅ TIMEOUT FALLBACK
          // ============================================================
          navigationTimeoutRef.current = setTimeout(async () => {
            if (!trackingReceived && !navigationDone) {
              console.warn(
                '[useRideActions] ⚠️ No trackingId from socket, trying REST fallback...',
              );
              try {
                const result = await driverRideApi.acceptRideRequest(requestId);
                if (result?.trackingId) {
                  console.log(
                    '[useRideActions] ✅ Got trackingId from REST fallback:',
                    result.trackingId,
                  );
                  navigateToRideTracking(result.trackingId, bookingId);
                }
              } catch (err) {
                console.error('[useRideActions] ❌ REST fallback failed:', err);
              }
            }
          }, 8000);
        } else {
          console.log('[useRideActions] ⚠️ Socket not connected, using REST');
          const result = await driverRideApi.acceptRideRequest(requestId);
          console.log('[useRideActions] 📦 REST Response:', result);

          if (result?.trackingId) {
            navigateToRideTracking(result.trackingId, bookingId);
          } else {
            throw new Error('No trackingId in REST response');
          }
        }

        // ✅ Remove rideRequestHandler.acceptRide() - it doesn't exist
      } catch (err: any) {
        console.error('[useRideActions] ❌ Error accepting ride:', err);
        setError(err.message || 'Failed to accept ride');
        cleanupListeners();
        throw err;
      } finally {
        setIsProcessing(false);
        setTimeout(() => {
          isAccepting.current = false;
          processedRequests.current.delete(key);
        }, 2000);
      }
    },
    [isProcessing, cleanupListeners, navigateToRideTracking],
  );

  // ============================================================
  // REJECT RIDE - Using Handlers
  // ============================================================
  const rejectRide = useCallback(
    async (requestId: string, bookingId?: string): Promise<void> => {
      const key = `${requestId}-reject`;

      if (processedRequests.current.has(key)) {
        console.warn('[useRideActions] ⚠️ Already processed this request');
        return;
      }

      if (isRejecting.current) {
        console.log('[useRideActions] ⚠️ Already rejecting, ignoring');
        return;
      }

      if (isProcessing) {
        console.log('[useRideActions] ⚠️ Already processing, ignoring');
        return;
      }

      console.log('[useRideActions] ❌ Rejecting ride:', requestId);

      isRejecting.current = true;
      setIsProcessing(true);
      setError(null);
      processedRequests.current.add(key);

      try {
        const token = await getToken();
        let driverId = '';
        if (token) {
          driverId = extractUserIdFromToken(token) || '';
        }

        const isSocketConnected = socketService.isSocketConnected();
        console.log('[useRideActions] 📊 Socket connected:', isSocketConnected);

        if (isSocketConnected) {
          // ✅ Use rideRequestSocketHandler for reject
          rideRequestSocketHandler.emitDriverResponse(
            requestId,
            'rejected',
            driverId,
          );
        } else {
          console.log('[useRideActions] ⚠️ Socket not connected, using REST');
          await driverRideApi.rejectRideRequest(requestId);
        }

        // ✅ Remove rideRequestHandler.rejectRide() - it doesn't exist
      } catch (err: any) {
        console.error('[useRideActions] ❌ Error rejecting ride:', err);
        setError(err.message || 'Failed to reject ride');
        throw err;
      } finally {
        setIsProcessing(false);
        setTimeout(() => {
          isRejecting.current = false;
          processedRequests.current.delete(key);
        }, 2000);
      }
    },
    [isProcessing],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    acceptRide,
    rejectRide,
    isProcessing,
    error,
    clearError,
  };
};

// Decode base64url encoded strings
function atob(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  );
  if (typeof (globalThis as any).atob === 'function') {
    const binary = (globalThis as any).atob(padded);
    try {
      const percentEncoded = Array.prototype.map
        .call(
          binary,
          (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
        )
        .join('');
      return decodeURIComponent(percentEncoded);
    } catch (e) {
      return binary;
    }
  }
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = padded.replace(/=+$/, '');
  let output = '';
  for (
    let bc = 0, bs: number = 0, buffer: any = 0, idx = 0;
    (buffer = chars.indexOf(str.charAt(idx++)));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {}
  try {
    const percentEncoded = Array.prototype.map
      .call(
        output,
        (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
      )
      .join('');
    return decodeURIComponent(percentEncoded);
  } catch (e) {
    return output;
  }
}
