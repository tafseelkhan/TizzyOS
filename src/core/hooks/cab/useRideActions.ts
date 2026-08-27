// src/hooks/cab/useRideActions.ts

import { useCallback, useState, useRef } from 'react';
import { socketService } from '../../../core/utils/socket/socketUtils';
import { rideRequestSocketHandler } from '../../../api/connections/handlers/sockets/rideRequestSocketHandler';
import { rideStatusSocketHandler } from '../../../api/connections/handlers/sockets/rideStatusSocketHandler';
import { driverRideApi } from '../../../api/features/private/driverRidePrivateSlice';
import { NavigationService } from '../../services/navigation/NavigationService';
import { getToken } from '../../../api/connections/token/tokenSlice';

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

// Global deduplication cache for status events
const processedStatusEvents = new Map<string, number>();
const DEDUPLICATION_MS = 5000;

// Track if accept is already in progress globally
let acceptInProgress = false;

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

  // ✅ HOOK-LEVEL SYNCHRONOUS LOCK - Extra protection layer
  const acceptLockRef = useRef<Record<string, boolean>>({});
  const rejectLockRef = useRef<Record<string, boolean>>({});

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

  // ✅ FIX: navigateToRideTracking now requires quoteId and validates it
  const navigateToRideTracking = useCallback(
    (trackingId: string, bookingId?: string, quoteId?: string) => {
      if (hasNavigatedRef.current) {
        console.log('[useRideActions] ⚠️ Already navigated, skipping');
        return;
      }

      if (!trackingId) {
        console.error('[useRideActions] ❌ Cannot navigate: No trackingId');
        return;
      }

      // ✅ CRITICAL FIX: Validate quoteId - if missing, log error and return
      if (!quoteId) {
        console.error(
          '[useRideActions] ❌ Cannot navigate: No quoteId received from backend',
        );
        console.error('[useRideActions] 📦 trackingId:', trackingId);
        console.error('[useRideActions] 📦 bookingId:', bookingId);
        return;
      }

      hasNavigatedRef.current = true;
      cleanupListeners();

      console.log(
        '[useRideActions] 🧭 Navigating to RideTracking with trackingId:',
        trackingId,
      );
      console.log('[useRideActions] 🔑 quoteId:', quoteId);
      console.log('[useRideActions] 📦 bookingId:', bookingId);

      NavigationService.navigate('RideTracking', {
        trackingId,
        bookingId,
        quoteId, // ✅ quoteId is now required and validated
      });
    },
    [cleanupListeners],
  );

  const acceptRide = useCallback(
    async (requestId: string, bookingId: string): Promise<void> => {
      const key = `${requestId}-accept`;

      // ✅ GLOBAL DEDUPLICATION - Prevent duplicate accepts across instances
      if (acceptInProgress) {
        console.log(
          '[useRideActions] ⏳ Accept already in progress, ignoring duplicate',
        );
        return;
      }

      // ✅ HOOK-LEVEL SYNCHRONOUS LOCK - Extra protection
      if (acceptLockRef.current[requestId]) {
        console.log(
          '[useRideActions] ⛔ This ride is already being accepted at hook level',
        );
        return;
      }

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

      // ✅ SET ALL LOCKS IMMEDIATELY
      acceptInProgress = true;
      isAccepting.current = true;
      acceptLockRef.current[requestId] = true;
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

          // ✅ FIX: rideAcceptedHandler - extract quoteId properly
          const rideAcceptedHandler = (data: any) => {
            console.log('[useRideActions] ✅ RIDE_ACCEPTED handler triggered!');
            console.log(
              '[useRideActions] 📦 Data:',
              JSON.stringify(data, null, 2),
            );

            const tid =
              data?.trackingId || data?.tracking_id || data?.id || data?._id;
            const bid = data?.bookingId || data?.booking_id || bookingId;
            const qid = data?.quoteId || data?.quote_id; // ✅ Extract quoteId

            console.log('[useRideActions] 🔍 Extracted trackingId:', tid);
            console.log('[useRideActions] 🔍 Extracted quoteId:', qid);

            // ✅ FIX: Validate quoteId before navigation
            if (tid && qid && !trackingReceived && !navigationDone) {
              trackingReceived = true;
              navigationDone = true;
              console.log(
                '[useRideActions] ✅ Navigating with trackingId from accept:',
                tid,
              );
              console.log('[useRideActions] 🔑 quoteId from accept:', qid);
              navigateToRideTracking(tid, bid, qid);
            } else if (tid && !qid) {
              console.error(
                '[useRideActions] ❌ RIDE_ACCEPTED missing quoteId, cannot navigate',
              );
            }
          };

          // ✅ FIX: statusChangeHandler - extract quoteId properly
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
            const qid = data?.quoteId || data?.quote_id; // ✅ Extract quoteId
            const bid = data?.bookingId || data?.booking_id || bookingId;
            const status = data?.status || '';

            console.log('[useRideActions] 🔍 Status change - trackingId:', tid);
            console.log('[useRideActions] 🔍 Status change - quoteId:', qid);

            if (status === 'accepted' && tid) {
              const eventKey = `${bid}:${tid}:${status}`;
              const now = Date.now();
              const lastProcessed = processedStatusEvents.get(eventKey);

              if (lastProcessed && now - lastProcessed < DEDUPLICATION_MS) {
                console.log(
                  '[useRideActions] ⏭️ STATUS_EVENT_DEDUPLICATED:',
                  eventKey,
                  'ms ago:',
                  now - lastProcessed,
                );
                return;
              }

              processedStatusEvents.set(eventKey, now);
              console.log(
                '[useRideActions] ✅ STATUS_EVENT_PROCESSED:',
                eventKey,
              );

              // ✅ FIX: Validate quoteId before navigation
              if (tid && qid && !trackingReceived && !navigationDone) {
                trackingReceived = true;
                navigationDone = true;
                console.log(
                  '[useRideActions] ✅ Navigating with trackingId from ride-status-change:',
                  tid,
                );
                console.log(
                  '[useRideActions] 🔑 quoteId from status change:',
                  qid,
                );
                navigateToRideTracking(tid, bid, qid);
              } else if (tid && !qid) {
                console.error(
                  '[useRideActions] ❌ RIDE_STATUS_CHANGE missing quoteId, cannot navigate',
                );
              }
            }
          };

          console.log(
            '[useRideActions] 📡 Registering listeners via handlers...',
          );

          rideRequestSocketHandler.on('accept', rideAcceptedHandler);
          rideStatusSocketHandler.on('ride-status-change', statusChangeHandler);

          cleanupRef.current = () => {
            console.log('[useRideActions] 🧹 Cleaning up socket listeners');
            rideRequestSocketHandler.off('accept', rideAcceptedHandler);
            rideStatusSocketHandler.off(
              'ride-status-change',
              statusChangeHandler,
            );
          };

          rideRequestSocketHandler.emitDriverResponse(
            requestId,
            'accepted',
            driverId,
          );

          // ✅ FIX: Navigation timeout handler with hasNavigatedRef check
          navigationTimeoutRef.current = setTimeout(async () => {
            // ✅ CRITICAL FIX: Agar navigation already ho gayi toh skip karo
            if (hasNavigatedRef.current) {
              console.log(
                '[useRideActions] ℹ️ Navigation already done, skipping REST fallback',
              );
              return;
            }

            if (!trackingReceived && !navigationDone) {
              const isAuth = socketService.isAuthenticatedFlag();

              if (!isAuth) {
                console.log(
                  '[useRideActions] ⏳ Socket not authenticated yet, waiting 5s more...',
                );
                setTimeout(async () => {
                  // ✅ CRITICAL FIX: Yahan bhi check karo
                  if (hasNavigatedRef.current) {
                    console.log(
                      '[useRideActions] ℹ️ Navigation already done, skipping REST fallback',
                    );
                    return;
                  }

                  if (!trackingReceived && !navigationDone) {
                    const isAuthNow = socketService.isAuthenticatedFlag();
                    if (!isAuthNow) {
                      console.warn(
                        '[useRideActions] ⚠️ Socket still not authenticated, trying REST fallback...',
                      );
                      try {
                        const result =
                          await driverRideApi.acceptRideRequest(requestId);
                        // ✅ FIX: REST fallback - preserve quoteId
                        if (result?.trackingId) {
                          console.log(
                            '[useRideActions] ✅ Got trackingId from REST fallback:',
                            result.trackingId,
                          );
                          console.log(
                            '[useRideActions] 🔑 quoteId from REST fallback:',
                            result.quoteId,
                          );
                          navigateToRideTracking(
                            result.trackingId,
                            result.bookingId || bookingId,
                            result.quoteId, // ✅ Pass quoteId from response
                          );
                        }
                      } catch (err) {
                        console.error(
                          '[useRideActions] ❌ REST fallback failed:',
                          err,
                        );
                      }
                    }
                  }
                }, 5000);
                return;
              }

              console.warn(
                '[useRideActions] ⚠️ No trackingId from socket, trying REST fallback...',
              );
              try {
                const result = await driverRideApi.acceptRideRequest(requestId);
                // ✅ FIX: REST fallback - preserve quoteId
                if (result?.trackingId) {
                  console.log(
                    '[useRideActions] ✅ Got trackingId from REST fallback:',
                    result.trackingId,
                  );
                  console.log(
                    '[useRideActions] 🔑 quoteId from REST fallback:',
                    result.quoteId,
                  );
                  navigateToRideTracking(
                    result.trackingId,
                    result.bookingId || bookingId,
                    result.quoteId, // ✅ Pass quoteId from response
                  );
                }
              } catch (err) {
                console.error('[useRideActions] ❌ REST fallback failed:', err);
              }
            }
          }, 15000);
        } else {
          console.log('[useRideActions] ⚠️ Socket not connected, using REST');
          const result = await driverRideApi.acceptRideRequest(requestId);
          console.log('[useRideActions] 📦 REST Response:', result);

          // ✅ FIX: REST fallback - preserve all 3 IDs
          if (result?.trackingId) {
            console.log(
              '[useRideActions] 🔑 quoteId from REST:',
              result.quoteId,
            );
            navigateToRideTracking(
              result.trackingId,
              result.bookingId || bookingId,
              result.quoteId, // ✅ Pass quoteId from response
            );
          } else {
            throw new Error('No trackingId in REST response');
          }
        }
      } catch (err: any) {
        console.error('[useRideActions] ❌ Error accepting ride:', err);
        setError(err.message || 'Failed to accept ride');
        cleanupListeners();
        throw err;
      } finally {
        setIsProcessing(false);
        // ✅ Only release global locks on failure or completion
        // Success path keeps locks to prevent duplicate accepts
        acceptInProgress = false;
        setTimeout(() => {
          isAccepting.current = false;
          // ✅ Remove request-specific lock after processing
          delete acceptLockRef.current[requestId];
          processedRequests.current.delete(key);
        }, 2000);
      }
    },
    [isProcessing, cleanupListeners, navigateToRideTracking],
  );

  const rejectRide = useCallback(
    async (requestId: string, bookingId?: string): Promise<void> => {
      const key = `${requestId}-reject`;

      // ✅ HOOK-LEVEL REJECT LOCK
      if (rejectLockRef.current[requestId]) {
        console.log(
          '[useRideActions] ⛔ This ride is already being rejected at hook level',
        );
        return;
      }

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

      // ✅ SET REJECT LOCK
      isRejecting.current = true;
      rejectLockRef.current[requestId] = true;
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
          rideRequestSocketHandler.emitDriverResponse(
            requestId,
            'rejected',
            driverId,
          );
        } else {
          console.log('[useRideActions] ⚠️ Socket not connected, using REST');
          await driverRideApi.rejectRideRequest(requestId);
        }
      } catch (err: any) {
        console.error('[useRideActions] ❌ Error rejecting ride:', err);
        setError(err.message || 'Failed to reject ride');
        throw err;
      } finally {
        setIsProcessing(false);
        setTimeout(() => {
          isRejecting.current = false;
          delete rejectLockRef.current[requestId];
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
