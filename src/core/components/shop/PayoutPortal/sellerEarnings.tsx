import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

import { getToken } from '../../../../api/connections/token/tokenSlice';
import { TIZZYOS_API_BASE_URL } from '../../../../api/connections/snippet/apiBaseUrl';

// ======================================================
// TYPES — Seller Earnings
// ======================================================

type EarningStatus =
  | 'HOLDING'
  | 'PAYOUT_AVAILABLE'
  | 'WALLET_AVAILABLE'
  | 'WITHDRAWAL_PENDING'
  | 'PAID'
  | 'REFUNDED'
  | 'CANCELLED';

interface SellerEarning {
  _id: string;
  sellerId: string;
  orderId: string;
  transactionId?: string;
  orderNumber?: string;

  grossAmount: number;
  sellerEarning: number;

  status: EarningStatus;

  capturedAt?: string;
  holdUntil?: string;
  payoutAvailableAt?: string;
  walletAvailableAt?: string;

  payoutId?: string;
  razorpayPayoutId?: string;
  withdrawalId?: string;

  paidAt?: string;
  refundedAt?: string;
  cancelledAt?: string;

  createdAt?: string;
  updatedAt?: string;
}

interface SellerEarningsResponse {
  success?: boolean;
  earnings?: SellerEarning[];
  data?: SellerEarning[];
  message?: string;
  error?: string;
}

type FilterType = 'ALL' | 'HOLDING' | 'PAYOUT_AVAILABLE' | 'WALLET_AVAILABLE';

// ======================================================
// TYPES — RazorpayX Payout Account
// ======================================================

type ContactStatus = 'created' | 'active' | 'suspended' | 'rejected' | string;

type FundAccountType = 'bank_account' | 'vpa' | 'wallet';

type FundAccountStatus = 'active' | 'inactive' | 'pending' | string;

interface FundAccount {
  fundAccountId: string;
  accountType: FundAccountType;
  status: FundAccountStatus;
  isDefault?: boolean;

  // bank
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;

  // vpa
  vpaAddress?: string;

  // wallet
  walletProvider?: string;
  walletPhone?: string;
  walletEmail?: string;
  walletName?: string;
}

interface PayoutAccountData {
  contactId?: string;
  contactType?: string;
  status?: ContactStatus;

  name?: string;
  email?: string;
  contact?: string;

  fundAccounts?: FundAccount[];

  createdAt?: string;
  updatedAt?: string;
}

interface PayoutAccountResponse {
  success?: boolean;
  message?: string;
  error?: string;
  data?: PayoutAccountData | null;
}

// ======================================================
// TYPES — Seller Payout
// ======================================================

type PayoutStatus =
  | 'queued'
  | 'pending'
  | 'initiated'
  | 'processing'
  | 'processed'
  | 'rejected'
  | 'failed'
  | 'reversed'
  | 'cancelled'
  | string;

interface SellerPayoutData {
  payoutId?: string;
  id?: string;

  status?: PayoutStatus;

  amount?: number;
  amountInPaise?: number;

  fundAccountId?: string;
  contactId?: string;

  referenceId?: string;
  utr?: string;

  withdrawalId?: string;

  payoutIds?: string[];
  earningIds?: string[];
  earningCount?: number;

  createdAt?: string;
  updatedAt?: string;

  failureReason?: string;
}

interface SellerPayoutResponse {
  success?: boolean;
  message?: string;
  error?: string;

  data?: SellerPayoutData | null;

  payoutId?: string;
  withdrawalId?: string;
}

// ======================================================
// CONSTANTS
// ======================================================

const EARNINGS_API_URL = `${TIZZYOS_API_BASE_URL}/api/v0/seller-earnings`;

const PAYOUT_ACCOUNT_API_URL = (userId: string) =>
  `${TIZZYOS_API_BASE_URL}/api/v0/payout-portal/payout-account/${userId}`;

const SELLER_PAYOUT_API_URL = `${TIZZYOS_API_BASE_URL}/api/v0/payout-portal/seller-payout`;

// ======================================================
// TIZZYGO WITHDRAWAL POLICY
// ======================================================

// These are TizzyGo business rules.
// They are NOT Razorpay's general minimum/maximum requirements.

const MIN_WITHDRAWAL_AMOUNT = 100;
const MAX_WITHDRAWAL_AMOUNT = 50000;

const MAX_SELECTED_EARNINGS = 100;

// ======================================================
// HELPERS
// ======================================================

const formatMoney = (amount: number | undefined | null): string => {
  const value = Number(amount || 0);

  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value?: string): string => {
  if (!value) return '--';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const maskAccountNumber = (value?: string): string => {
  if (!value) return '••••';

  const trimmed = String(value).trim();

  if (trimmed.length <= 4) {
    return `••••${trimmed}`;
  }

  return `••••${trimmed.slice(-4)}`;
};

const getStatusLabel = (status: EarningStatus): string => {
  switch (status) {
    case 'HOLDING':
      return 'Holding';

    case 'PAYOUT_AVAILABLE':
      return 'Payout Available';

    case 'WALLET_AVAILABLE':
      return 'Wallet Available';

    case 'WITHDRAWAL_PENDING':
      return 'Withdrawal Pending';

    case 'PAID':
      return 'Paid';

    case 'REFUNDED':
      return 'Refunded';

    case 'CANCELLED':
      return 'Cancelled';

    default:
      return status;
  }
};

const getStatusIcon = (status: EarningStatus): string => {
  switch (status) {
    case 'HOLDING':
      return 'lock-clock';

    case 'PAYOUT_AVAILABLE':
      return 'clock-check-outline';

    case 'WALLET_AVAILABLE':
      return 'wallet';

    case 'WITHDRAWAL_PENDING':
      return 'cash-clock';

    case 'PAID':
      return 'check-circle';

    case 'REFUNDED':
      return 'cash-refund';

    case 'CANCELLED':
      return 'close-circle';

    default:
      return 'cash';
  }
};

const getPayoutStatusLabel = (status?: PayoutStatus): string => {
  const s = String(status || '').toLowerCase();

  switch (s) {
    case 'queued':
      return 'Withdrawal queued';

    case 'pending':
      return 'Withdrawal pending';

    case 'initiated':
      return 'Withdrawal processing';

    case 'processing':
      return 'Withdrawal processing';

    case 'processed':
      return 'Withdrawal completed';

    case 'rejected':
      return 'Withdrawal rejected';

    case 'failed':
      return 'Withdrawal failed';

    case 'reversed':
      return 'Withdrawal reversed';

    case 'cancelled':
      return 'Withdrawal cancelled';

    default:
      return 'Withdrawal status unknown';
  }
};

const getPayoutStatusColor = (status?: PayoutStatus): string => {
  const s = String(status || '').toLowerCase();

  if (s === 'processed') {
    return '#166534';
  }

  if (
    s === 'rejected' ||
    s === 'failed' ||
    s === 'reversed' ||
    s === 'cancelled'
  ) {
    return '#991B1B';
  }

  return '#1D4ED8';
};

// ======================================================
// JWT USER ID HELPER
// ======================================================

const getUserIdFromToken = (token?: string | null): string | null => {
  try {
    if (!token) {
      return null;
    }

    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const base64Url = parts[1];

    const base64 = base64Url
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(base64Url.length / 4) * 4, '=');

    const atobFn = (
      globalThis as typeof globalThis & {
        atob?: (value: string) => string;
      }
    ).atob;

    if (typeof atobFn !== 'function') {
      return null;
    }

    const decoded = atobFn(base64);

    const payload = JSON.parse(decoded);

    const userId =
      payload?.userId || payload?.id || payload?._id || payload?.sub;

    if (!userId) {
      return null;
    }

    return String(userId);
  } catch (error) {
    console.error('❌ Unable to decode userId from token:', error);

    return null;
  }
};

// ======================================================
// CONTACT / FUND ACCOUNT HELPERS
// ======================================================

const isContactActive = (data?: PayoutAccountData | null): boolean => {
  if (!data) {
    return false;
  }

  const status = String(data.status || '').toLowerCase();

  return status === 'active';
};

const getActiveFundAccounts = (accounts?: FundAccount[]): FundAccount[] => {
  if (!Array.isArray(accounts)) {
    return [];
  }

  return accounts.filter(
    account => String(account?.status || '').toLowerCase() === 'active',
  );
};

const describeFundAccount = (fundAccount?: FundAccount): string => {
  if (!fundAccount) {
    return 'Unknown account';
  }

  const type = String(fundAccount.accountType || '').toLowerCase();

  if (type === 'bank_account') {
    return `${fundAccount.bankAccountName || 'Bank'} ${maskAccountNumber(
      fundAccount.bankAccountNumber,
    )}`;
  }

  if (type === 'vpa') {
    return `${fundAccount.vpaAddress || 'UPI'}`;
  }

  if (type === 'wallet') {
    return `${fundAccount.walletProvider || 'Wallet'} ${
      fundAccount.walletPhone ? '•' + fundAccount.walletPhone.slice(-4) : ''
    }`.trim();
  }

  return 'Account';
};

// ======================================================
// MONEY HELPERS
// ======================================================

const toPaise = (amount: number): number => {
  return Math.round((Number(amount) + Number.EPSILON) * 100);
};

const fromPaise = (paise: number): number => {
  return paise / 100;
};

const normalizeAmountInput = (value: string): string => {
  let cleaned = value.replace(/[^0-9.]/g, '');

  const firstDot = cleaned.indexOf('.');

  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, '');

    const decimals = cleaned.split('.')[1];

    if (decimals && decimals.length > 2) {
      cleaned = cleaned.split('.')[0] + '.' + decimals.slice(0, 2);
    }
  }

  return cleaned;
};

// ======================================================
// EXACT EARNING SELECTION
// ======================================================
//
// Backend requires payoutIds and calculates the amount
// from those exact earnings.
//
// Therefore the frontend must select complete WALLET_AVAILABLE
// earnings whose sum exactly equals the requested amount.
//
// We use a bounded dynamic-programming map in paise.
// The backend itself still remains the final authority.
// ======================================================

const findExactEarningSelection = (
  availableEarnings: SellerEarning[],
  targetAmount: number,
): SellerEarning[] | null => {
  const targetPaise = toPaise(targetAmount);

  if (targetPaise <= 0) {
    return null;
  }

  const candidates = availableEarnings
    .filter(
      earning =>
        earning.status === 'WALLET_AVAILABLE' &&
        !!earning.payoutId &&
        Number(earning.sellerEarning) > 0,
    )
    .slice(0, 1000);

  if (candidates.length === 0) {
    return null;
  }

  // Direct single earning first.
  for (const earning of candidates) {
    if (toPaise(Number(earning.sellerEarning)) === targetPaise) {
      return [earning];
    }
  }

  // Map:
  // sum in paise -> selected earning indexes
  //
  // Limit the state count to avoid excessive memory use
  // when a seller has a very large earning history.
  const states = new Map<number, number[]>();
  states.set(0, []);

  for (let index = 0; index < candidates.length; index++) {
    const earning = candidates[index];

    const earningPaise = toPaise(Number(earning.sellerEarning));

    if (earningPaise <= 0 || earningPaise > targetPaise) {
      continue;
    }

    const currentStates = Array.from(states.entries());

    for (const [sum, indexes] of currentStates) {
      const newSum = sum + earningPaise;

      if (newSum > targetPaise) {
        continue;
      }

      if (states.has(newSum)) {
        continue;
      }

      if (indexes.length + 1 > MAX_SELECTED_EARNINGS) {
        continue;
      }

      const newIndexes = [...indexes, index];

      if (newSum === targetPaise) {
        return newIndexes.map(selectedIndex => candidates[selectedIndex]);
      }

      states.set(newSum, newIndexes);

      // Safety cap.
      if (states.size > 100000) {
        break;
      }
    }

    if (states.size > 100000) {
      break;
    }
  }

  return null;
};

// ======================================================
// SCREEN
// ======================================================

export const SellerEarningsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [earnings, setEarnings] = useState<SellerEarning[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterType>('ALL');

  // ====================================================
  // RazorpayX payout account
  // ====================================================

  const [payoutAccount, setPayoutAccount] = useState<PayoutAccountData | null>(
    null,
  );

  const [payoutAccountLoading, setPayoutAccountLoading] = useState(false);

  const [payoutAccountError, setPayoutAccountError] = useState<string | null>(
    null,
  );

  // ====================================================
  // Cashout
  // ====================================================

  const [cashoutVisible, setCashoutVisible] = useState(false);

  const [cashoutAmount, setCashoutAmount] = useState('');

  const [selectedFundAccountId, setSelectedFundAccountId] = useState<
    string | null
  >(null);

  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  const [lastPayout, setLastPayout] = useState<SellerPayoutData | null>(null);

  // ====================================================
  // FETCH SELLER EARNINGS
  // ====================================================

  const fetchEarnings = useCallback(async () => {
    try {
      setError(null);

      const token = await getToken();

      const response = await fetch(EARNINGS_API_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
      });

      const text = await response.text();

      let data: SellerEarningsResponse;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Invalid response from seller earnings server');
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Request failed with status ${response.status}`,
        );
      }

      if (data?.success === false) {
        throw new Error(
          data?.message || data?.error || 'Failed to load seller earnings',
        );
      }

      const list = Array.isArray(data?.earnings)
        ? data.earnings
        : Array.isArray(data?.data)
          ? data.data
          : [];

      setEarnings(list);
    } catch (err: any) {
      console.error('❌ Seller earnings error:', err);

      setError(err?.message || 'Unable to load seller earnings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ====================================================
  // FETCH PAYOUT ACCOUNT
  // ====================================================

  const fetchPayoutAccount = useCallback(async () => {
    try {
      setPayoutAccountLoading(true);
      setPayoutAccountError(null);

      const token = await getToken();

      if (!token) {
        setPayoutAccount(null);
        return;
      }

      const userId = getUserIdFromToken(token);

      if (!userId) {
        setPayoutAccountError('Unable to determine current user ID');

        return;
      }

      const response = await fetch(PAYOUT_ACCOUNT_API_URL(userId), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await response.text();

      let data: PayoutAccountResponse;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Invalid response from payout account server');
      }

      if (response.status === 404) {
        setPayoutAccount(null);
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setPayoutAccountError(null);
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Payout account request failed with ${response.status}`,
        );
      }

      setPayoutAccount(data?.data || null);
    } catch (err: any) {
      console.error('❌ Payout account error:', err?.message || err);

      setPayoutAccountError(err?.message || 'Unable to fetch payout account');
    } finally {
      setPayoutAccountLoading(false);
    }
  }, []);

  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(() => {
    fetchEarnings();
    fetchPayoutAccount();
  }, [fetchEarnings, fetchPayoutAccount]);

  // ====================================================
  // PULL TO REFRESH
  // ====================================================

  const onRefresh = useCallback(() => {
    setRefreshing(true);

    fetchEarnings();
    fetchPayoutAccount();
  }, [fetchEarnings, fetchPayoutAccount]);

  // ====================================================
  // SUMMARY
  // ====================================================

  const summary = useMemo(() => {
    let holding = 0;
    let payoutAvailable = 0;
    let walletAvailable = 0;
    let total = 0;

    earnings.forEach(item => {
      const amount = Number(item.sellerEarning || 0);

      total += amount;

      if (item.status === 'HOLDING') {
        holding += amount;
      }

      if (item.status === 'PAYOUT_AVAILABLE') {
        payoutAvailable += amount;
      }

      if (item.status === 'WALLET_AVAILABLE') {
        walletAvailable += amount;
      }
    });

    return {
      total,
      holding,
      payoutAvailable,
      walletAvailable,
    };
  }, [earnings]);

  // ====================================================
  // FILTERED EARNINGS
  // ====================================================

  const filteredEarnings = useMemo(() => {
    if (filter === 'ALL') {
      return earnings;
    }

    return earnings.filter(item => item.status === filter);
  }, [earnings, filter]);

  // ====================================================
  // NAVIGATION
  // ====================================================

  const goToSetupWallet = useCallback(() => {
    navigation.navigate('SetupWallet');
  }, [navigation]);

  // ====================================================
  // PAYOUT ACCOUNT
  // ====================================================

  const activeFundAccounts = useMemo(
    () => getActiveFundAccounts(payoutAccount?.fundAccounts),
    [payoutAccount],
  );

  const contactIsActive = useMemo(
    () => isContactActive(payoutAccount),
    [payoutAccount],
  );

  const walletAvailableBalance = summary.walletAvailable;

  const canCashout =
    !!payoutAccount?.contactId &&
    contactIsActive &&
    activeFundAccounts.length > 0 &&
    walletAvailableBalance >= MIN_WITHDRAWAL_AMOUNT &&
    !isSubmittingPayout;

  // ====================================================
  // DEFAULT FUND ACCOUNT
  // ====================================================

  useEffect(() => {
    if (activeFundAccounts.length > 0) {
      const defaultAcc = activeFundAccounts.find(account => account.isDefault);

      setSelectedFundAccountId(prev => {
        if (
          prev &&
          activeFundAccounts.some(account => account.fundAccountId === prev)
        ) {
          return prev;
        }

        return (defaultAcc || activeFundAccounts[0]).fundAccountId;
      });
    } else {
      setSelectedFundAccountId(null);
    }
  }, [activeFundAccounts]);

  // ====================================================
  // CASHOUT OPEN
  // ====================================================

  const openCashout = () => {
    if (!payoutAccount?.contactId) {
      Alert.alert(
        'Payout account required',
        'Complete payout account setup first.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Setup',
            onPress: goToSetupWallet,
          },
        ],
      );

      return;
    }

    if (!contactIsActive) {
      Alert.alert(
        'Payout account inactive',
        'Your payout account is not active yet.',
      );

      return;
    }

    if (activeFundAccounts.length === 0) {
      Alert.alert(
        'No payout account',
        'Add a bank account or UPI account before cashing out.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Add account',
            onPress: goToSetupWallet,
          },
        ],
      );

      return;
    }

    if (walletAvailableBalance < MIN_WITHDRAWAL_AMOUNT) {
      Alert.alert(
        'Minimum withdrawal not reached',
        `Minimum TizzyGo withdrawal amount is ${formatMoney(
          MIN_WITHDRAWAL_AMOUNT,
        )}.`,
      );

      return;
    }

    setCashoutAmount('');
    setIsSubmittingPayout(false);
    setCashoutVisible(true);
  };

  // ====================================================
  // CLOSE CASHOUT
  // ====================================================

  const closeCashout = () => {
    if (isSubmittingPayout) {
      return;
    }

    setCashoutVisible(false);
    setCashoutAmount('');
  };

  // ====================================================
  // GET EXACT PAYOUT EARNINGS
  // ====================================================

  const getSelectedEarningsForAmount = (
    numericAmount: number,
  ): SellerEarning[] | null => {
    const exactSelection = findExactEarningSelection(earnings, numericAmount);

    return exactSelection;
  };

  // ====================================================
  // SUBMIT CASHOUT
  // ====================================================

  const submitCashout = async () => {
    if (isSubmittingPayout) {
      return;
    }

    const numericAmount = Number(cashoutAmount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid withdrawal amount.');

      return;
    }

    if (numericAmount < MIN_WITHDRAWAL_AMOUNT) {
      Alert.alert(
        'Minimum withdrawal',
        `Minimum TizzyGo withdrawal amount is ${formatMoney(
          MIN_WITHDRAWAL_AMOUNT,
        )}.`,
      );

      return;
    }

    if (numericAmount > MAX_WITHDRAWAL_AMOUNT) {
      Alert.alert(
        'Maximum withdrawal',
        `Maximum TizzyGo withdrawal amount is ${formatMoney(
          MAX_WITHDRAWAL_AMOUNT,
        )} per withdrawal.`,
      );

      return;
    }

    if (numericAmount > walletAvailableBalance) {
      Alert.alert(
        'Amount too high',
        `You can withdraw a maximum of ${formatMoney(walletAvailableBalance)}.`,
      );

      return;
    }

    if (!selectedFundAccountId) {
      Alert.alert('Select account', 'Please select a payout account.');

      return;
    }

    const selectedFundAccount = activeFundAccounts.find(
      account => account.fundAccountId === selectedFundAccountId,
    );

    if (!selectedFundAccount) {
      Alert.alert(
        'Unavailable',
        'Selected payout account is currently unavailable.',
      );

      return;
    }

    // ----------------------------------------------
    // IMPORTANT:
    // Backend requires payoutIds.
    // ----------------------------------------------

    const selectedEarnings = getSelectedEarningsForAmount(numericAmount);

    if (!selectedEarnings || selectedEarnings.length === 0) {
      Alert.alert(
        'Exact earning amount required',
        'This amount cannot be withdrawn because TizzyGo withdraws complete wallet earnings only. Please enter an amount that exactly matches one or more available seller earnings, or use Max.',
      );

      return;
    }

    if (selectedEarnings.length > MAX_SELECTED_EARNINGS) {
      Alert.alert(
        'Too many earnings',
        'This withdrawal would contain too many earning records. Please use a smaller amount or withdraw in multiple transactions.',
      );

      return;
    }

    const payoutIds = selectedEarnings
      .map(item => item.payoutId)
      .filter((payoutId): payoutId is string => !!payoutId);

    if (payoutIds.length !== selectedEarnings.length) {
      Alert.alert(
        'Earning reference missing',
        'One or more wallet earnings are missing their payout reference. Please refresh and try again.',
      );

      return;
    }

    // Backend is authoritative.
    const calculatedSelectedAmount = selectedEarnings.reduce(
      (sum, item) => sum + Number(item.sellerEarning || 0),
      0,
    );

    const calculatedAmountPaise = toPaise(calculatedSelectedAmount);

    const requestedAmountPaise = toPaise(numericAmount);

    if (calculatedAmountPaise !== requestedAmountPaise) {
      Alert.alert(
        'Amount changed',
        'The selected wallet earnings do not exactly match the requested amount. Please refresh and try again.',
      );

      return;
    }

    setIsSubmittingPayout(true);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(SELLER_PAYOUT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          // Backend requires these exact earning IDs.
          payoutIds,

          // Backend recalculates this from DB.
          // This is sent only as an additional
          // consistency check.
          amount: calculatedSelectedAmount,

          fundAccountId: selectedFundAccountId,
        }),
      });

      const text = await response.text();

      let data: SellerPayoutResponse;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Invalid response from payout server');
      }

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.message ||
            data?.error ||
            'Unable to process withdrawal right now. Please try again.',
        );
      }

      const payoutData = data?.data || {
        payoutId: data?.payoutId,
        withdrawalId: data?.withdrawalId,
      };

      setLastPayout(payoutData || null);

      setCashoutVisible(false);
      setCashoutAmount('');

      Alert.alert(
        'Withdrawal submitted',
        'Your withdrawal has been submitted. The final status will update after RazorpayX processes the payout.',
      );

      // Refresh both earnings and payout account.
      await Promise.all([fetchEarnings(), fetchPayoutAccount()]);
    } catch (err: any) {
      console.error('❌ Cashout error:', err?.message || err);

      Alert.alert(
        'Withdrawal failed',
        err?.message ||
          'Unable to process withdrawal right now. Please try again.',
      );
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  // ====================================================
  // QUICK MAX
  // ====================================================

  const setMaxWithdrawAmount = () => {
    const maxAllowed = Math.min(walletAvailableBalance, MAX_WITHDRAWAL_AMOUNT);

    const exactMaxSelection = findExactEarningSelection(earnings, maxAllowed);

    if (exactMaxSelection && exactMaxSelection.length > 0) {
      const exactTotal = exactMaxSelection.reduce(
        (sum, item) => sum + Number(item.sellerEarning || 0),
        0,
      );

      setCashoutAmount(exactTotal.toFixed(2).replace(/\.00$/, ''));

      return;
    }

    // If the complete wallet balance exceeds the
    // TizzyGo max, find a combination up to max.
    //
    // First try individual wallet earnings sorted
    // largest-first as a practical fallback.
    const candidates = earnings
      .filter(item => item.status === 'WALLET_AVAILABLE' && !!item.payoutId)
      .sort(
        (a, b) => Number(b.sellerEarning || 0) - Number(a.sellerEarning || 0),
      );

    const selected: SellerEarning[] = [];

    let total = 0;

    for (const earning of candidates) {
      if (selected.length >= MAX_SELECTED_EARNINGS) {
        break;
      }

      const amount = Number(earning.sellerEarning || 0);

      if (total + amount <= MAX_WITHDRAWAL_AMOUNT) {
        selected.push(earning);
        total += amount;
      }

      if (total >= MAX_WITHDRAWAL_AMOUNT) {
        break;
      }
    }

    if (total >= MIN_WITHDRAWAL_AMOUNT) {
      setCashoutAmount(total.toFixed(2).replace(/\.00$/, ''));

      return;
    }

    Alert.alert(
      'No exact maximum available',
      'Your available earnings cannot currently form a valid maximum withdrawal. Enter an amount matching one or more complete wallet earnings.',
    );
  };

  // ====================================================
  // QUICK HALF
  // ====================================================

  const setHalfWithdrawAmount = () => {
    const half = Math.floor(walletAvailableBalance * 50) / 100;

    if (half < MIN_WITHDRAWAL_AMOUNT) {
      Alert.alert(
        'Amount too small',
        `50% of your balance is below the ${formatMoney(
          MIN_WITHDRAWAL_AMOUNT,
        )} minimum withdrawal.`,
      );

      return;
    }

    const exactSelection = findExactEarningSelection(earnings, half);

    if (!exactSelection) {
      Alert.alert(
        'Exact amount unavailable',
        '50% of your balance does not exactly match complete wallet earnings. Please enter another amount.',
      );

      return;
    }

    setCashoutAmount(half.toFixed(2).replace(/\.00$/, ''));
  };

  // ====================================================
  // RENDER FILTER
  // ====================================================

  const renderFilter = (value: FilterType, label: string) => {
    const active = filter === value;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setFilter(value)}
        style={[styles.filterButton, active && styles.filterButtonActive]}
      >
        <Text style={[styles.filterText, active && styles.filterTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // ====================================================
  // PAYOUT BANNER
  // ====================================================

  const renderPayoutBanner = () => {
    if (payoutAccountLoading && !payoutAccount && !payoutAccountError) {
      return (
        <View style={styles.payoutBanner}>
          <ActivityIndicator size="small" color="#111827" />

          <Text style={styles.payoutBannerText}>
            Checking payout account...
          </Text>
        </View>
      );
    }

    if (!payoutAccount?.contactId) {
      return (
        <View style={[styles.payoutBanner, styles.payoutBannerWarning]}>
          <View style={styles.payoutBannerHeader}>
            <Icon name="alert-circle-outline" size={20} color="#B45309" />

            <Text style={styles.payoutBannerTitle}>Payout setup required</Text>
          </View>

          <Text style={styles.payoutBannerText}>
            Set up your payout account to receive seller payouts directly to
            your bank, UPI, or wallet.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.payoutBannerButton}
            onPress={goToSetupWallet}
          >
            <Icon name="account-check-outline" size={16} color="#FFFFFF" />

            <Text style={styles.payoutBannerButtonText}>
              Set up payout account
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!contactIsActive) {
      return (
        <View style={[styles.payoutBanner, styles.payoutBannerInfo]}>
          <View style={styles.payoutBannerHeader}>
            <Icon name="clock-outline" size={20} color="#1D4ED8" />

            <Text style={[styles.payoutBannerTitle, { color: '#1D4ED8' }]}>
              Payout account under review
            </Text>
          </View>

          <Text style={styles.payoutBannerText}>
            Your payout account is not active yet. Complete the setup to enable
            withdrawals.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.payoutBannerButton}
            onPress={goToSetupWallet}
          >
            <Icon name="pencil-outline" size={16} color="#FFFFFF" />

            <Text style={styles.payoutBannerButtonText}>Complete setup</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeFundAccounts.length === 0) {
      return (
        <View style={[styles.payoutBanner, styles.payoutBannerWarning]}>
          <View style={styles.payoutBannerHeader}>
            <Icon name="bank-off-outline" size={20} color="#B45309" />

            <Text style={styles.payoutBannerTitle}>Add payout account</Text>
          </View>

          <Text style={styles.payoutBannerText}>
            Add a bank account or UPI account before cashing out.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.payoutBannerButton}
            onPress={goToSetupWallet}
          >
            <Icon name="plus" size={16} color="#FFFFFF" />

            <Text style={styles.payoutBannerButtonText}>Add account</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.payoutBanner, styles.payoutBannerSuccess]}>
        <View style={styles.payoutBannerHeader}>
          <Icon name="check-circle-outline" size={20} color="#166534" />

          <Text style={[styles.payoutBannerTitle, { color: '#166534' }]}>
            Payout account active
          </Text>
        </View>

        <Text style={[styles.payoutBannerText, { color: '#166534' }]}>
          {activeFundAccounts.length} active payout account
          {activeFundAccounts.length > 1 ? 's' : ''} ready.
        </Text>
      </View>
    );
  };

  // ====================================================
  // LAST PAYOUT
  // ====================================================

  const renderLastPayoutStatus = () => {
    if (!lastPayout) {
      return null;
    }

    const label = getPayoutStatusLabel(lastPayout.status);

    const color = getPayoutStatusColor(lastPayout.status);

    return (
      <View
        style={[
          styles.lastPayoutBox,
          {
            borderColor: color + '55',
          },
        ]}
      >
        <Icon name="cash-clock" size={18} color={color} />

        <View
          style={{
            flex: 1,
            marginLeft: 8,
          }}
        >
          <Text style={[styles.lastPayoutTitle, { color }]}>{label}</Text>

          {lastPayout.amount ? (
            <Text style={styles.lastPayoutText}>
              Amount: {formatMoney(lastPayout.amount)}
            </Text>
          ) : null}

          {lastPayout.referenceId ? (
            <Text style={styles.lastPayoutText}>
              Ref: {lastPayout.referenceId}
            </Text>
          ) : null}

          {lastPayout.withdrawalId ? (
            <Text style={styles.lastPayoutText}>
              Withdrawal: {lastPayout.withdrawalId}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  // ====================================================
  // EARNING CARD
  // ====================================================

  const renderEarning = ({ item }: { item: SellerEarning }) => {
    return (
      <View style={styles.earningCard}>
        <View style={styles.earningTopRow}>
          <View style={styles.orderContainer}>
            <View style={styles.orderIcon}>
              <Icon name="package-variant-closed" size={21} color="#111827" />
            </View>

            <View>
              <Text style={styles.orderTitle}>
                {item.orderNumber || `Order ${item.orderId || '--'}`}
              </Text>

              <Text style={styles.orderDate}>
                Captured: {formatDate(item.capturedAt)}
              </Text>
            </View>
          </View>

          <Text style={styles.earningAmount}>
            {formatMoney(item.sellerEarning)}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statusRow}>
          <View style={styles.statusContainer}>
            <Icon name={getStatusIcon(item.status)} size={18} color="#111827" />

            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <View>
            <Text style={styles.smallLabel}>Gross Amount</Text>

            <Text style={styles.smallValue}>
              {formatMoney(item.grossAmount)}
            </Text>
          </View>

          <View style={styles.amountRight}>
            <Text style={styles.smallLabel}>Seller Earning</Text>

            <Text style={styles.smallValue}>
              {formatMoney(item.sellerEarning)}
            </Text>
          </View>
        </View>

        {item.status === 'HOLDING' && item.holdUntil && (
          <View style={styles.nextStageBox}>
            <Icon name="clock-outline" size={18} color="#111827" />

            <View style={styles.nextStageContent}>
              <Text style={styles.nextStageTitle}>Holding period</Text>

              <Text style={styles.nextStageText}>
                Payout becomes available on{' '}
                <Text style={styles.boldText}>
                  {formatDate(item.payoutAvailableAt || item.holdUntil)}
                </Text>
              </Text>
            </View>
          </View>
        )}

        {item.status === 'PAYOUT_AVAILABLE' && item.walletAvailableAt && (
          <View style={styles.nextStageBox}>
            <Icon name="wallet-clock-outline" size={18} color="#111827" />

            <View style={styles.nextStageContent}>
              <Text style={styles.nextStageTitle}>Payout available</Text>

              <Text style={styles.nextStageText}>
                Wallet balance will be available on{' '}
                <Text style={styles.boldText}>
                  {formatDate(item.walletAvailableAt)}
                </Text>
              </Text>
            </View>
          </View>
        )}

        {item.status === 'WALLET_AVAILABLE' && (
          <View style={styles.availableBox}>
            <Icon name="check-circle" size={19} color="#166534" />

            <Text style={styles.availableText}>
              This earning is now available in your wallet.
            </Text>
          </View>
        )}

        {item.status === 'WITHDRAWAL_PENDING' && (
          <View
            style={[
              styles.availableBox,
              {
                backgroundColor: '#EFF6FF',
              },
            ]}
          >
            <Icon name="cash-clock" size={19} color="#1D4ED8" />

            <Text
              style={[
                styles.availableText,
                {
                  color: '#1D4ED8',
                },
              ]}
            >
              This earning is currently being processed for withdrawal.
            </Text>
          </View>
        )}

        {item.status === 'PAID' && (
          <View
            style={[
              styles.availableBox,
              {
                backgroundColor: '#F0FDF4',
              },
            ]}
          >
            <Icon name="check-circle" size={19} color="#166534" />

            <Text style={styles.availableText}>
              This earning has been paid successfully.
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ====================================================
  // HARD ERROR
  // ====================================================

  if (error && earnings.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={54} color="#DC2626" />

          <Text style={styles.errorTitle}>Unable to load earnings</Text>

          <Text style={styles.errorMessage}>{error}</Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={fetchEarnings}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ====================================================
  // MAIN
  // ====================================================

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={filteredEarnings}
        keyExtractor={item => item._id}
        renderItem={renderEarning}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <>
            {/* HEADER */}
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>Seller Earnings</Text>

                <Text style={styles.headerSubtitle}>
                  Track your earnings and settlement status
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={goToSetupWallet}
                style={styles.kycStatusButton}
              >
                <Icon name="shield-account-outline" size={18} color="#FFFFFF" />

                <Text style={styles.kycStatusButtonText}>Payout Setup</Text>
              </TouchableOpacity>
            </View>

            {/* PAYOUT BANNER */}
            {renderPayoutBanner()}

            {payoutAccountError ? (
              <View style={styles.inlineError}>
                <Icon name="alert-outline" size={18} color="#B45309" />

                <Text style={styles.inlineErrorText}>{payoutAccountError}</Text>
              </View>
            ) : null}

            {/* LAST PAYOUT */}
            {renderLastPayoutStatus()}

            {/* TOTAL */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Seller Earnings</Text>

              <Text style={styles.totalAmount}>
                {formatMoney(summary.total)}
              </Text>

              <Text style={styles.totalDescription}>
                Across all captured orders
              </Text>
            </View>

            {/* BALANCES */}
            <View style={styles.balanceGrid}>
              <View style={styles.balanceCard}>
                <View style={styles.balanceIcon}>
                  <Icon name="lock-clock" size={22} color="#111827" />
                </View>

                <Text style={styles.balanceLabel}>Holding</Text>

                <Text style={styles.balanceAmount}>
                  {formatMoney(summary.holding)}
                </Text>
              </View>

              <View style={styles.balanceCard}>
                <View style={styles.balanceIcon}>
                  <Icon name="clock-check-outline" size={22} color="#111827" />
                </View>

                <Text style={styles.balanceLabel}>Payout Available</Text>

                <Text style={styles.balanceAmount}>
                  {formatMoney(summary.payoutAvailable)}
                </Text>
              </View>

              <View style={styles.balanceCardFull}>
                <View style={styles.balanceIcon}>
                  <Icon name="wallet" size={22} color="#111827" />
                </View>

                <View style={styles.walletTextContainer}>
                  <Text style={styles.balanceLabel}>Wallet Available</Text>

                  <Text style={styles.walletAmount}>
                    {formatMoney(summary.walletAvailable)}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!canCashout}
                  onPress={openCashout}
                  style={[
                    styles.cashoutButton,
                    !canCashout && styles.cashoutButtonDisabled,
                  ]}
                >
                  <Icon name="cash" size={16} color="#FFFFFF" />

                  <Text style={styles.cashoutButtonText}>Cashout</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Earnings History</Text>

            <View style={styles.filters}>
              {renderFilter('ALL', 'All')}

              {renderFilter('HOLDING', 'Holding')}

              {renderFilter('PAYOUT_AVAILABLE', 'Payout')}

              {renderFilter('WALLET_AVAILABLE', 'Wallet')}
            </View>

            {error && (
              <View style={styles.inlineError}>
                <Icon name="alert-outline" size={18} color="#B45309" />

                <Text style={styles.inlineErrorText}>{error}</Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="cash-remove" size={52} color="#9CA3AF" />

            <Text style={styles.emptyTitle}>No earnings found</Text>

            <Text style={styles.emptyText}>
              Seller earnings will appear here after an order payment is
              captured.
            </Text>
          </View>
        }
      />

      {/* ================================================== */}
      {/* CASHOUT MODAL */}
      {/* ================================================== */}

      <Modal
        visible={cashoutVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCashout}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cashout</Text>

              <TouchableOpacity
                onPress={closeCashout}
                disabled={isSubmittingPayout}
              >
                <Icon name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* AVAILABLE BALANCE */}
              <View style={styles.modalBalanceCard}>
                <Text style={styles.modalBalanceLabel}>Available Balance</Text>

                <Text style={styles.modalBalanceAmount}>
                  {formatMoney(walletAvailableBalance)}
                </Text>

                <Text style={styles.modalPolicyText}>
                  Minimum: {formatMoney(MIN_WITHDRAWAL_AMOUNT)} • Maximum:{' '}
                  {formatMoney(MAX_WITHDRAWAL_AMOUNT)}
                </Text>
              </View>

              {/* AMOUNT */}
              <Text style={styles.modalSectionLabel}>Withdraw Amount</Text>

              <View style={styles.modalInputWrapper}>
                <Text style={styles.modalRupee}>₹</Text>

                <TextInput
                  value={cashoutAmount}
                  onChangeText={value =>
                    setCashoutAmount(normalizeAmountInput(value))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  editable={!isSubmittingPayout}
                  style={styles.modalInput}
                />
              </View>

              {Number(cashoutAmount) > walletAvailableBalance ? (
                <Text style={styles.modalInputError}>
                  You can withdraw a maximum of{' '}
                  {formatMoney(walletAvailableBalance)}
                </Text>
              ) : null}

              {Number(cashoutAmount) > MAX_WITHDRAWAL_AMOUNT ? (
                <Text style={styles.modalInputError}>
                  Maximum TizzyGo withdrawal is{' '}
                  {formatMoney(MAX_WITHDRAWAL_AMOUNT)}
                </Text>
              ) : null}

              {Number(cashoutAmount) > 0 &&
              Number(cashoutAmount) < MIN_WITHDRAWAL_AMOUNT ? (
                <Text style={styles.modalInputError}>
                  Minimum withdrawal is {formatMoney(MIN_WITHDRAWAL_AMOUNT)}
                </Text>
              ) : null}

              {/* QUICK BUTTONS */}
              <View style={styles.modalQuickRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={isSubmittingPayout}
                  onPress={setMaxWithdrawAmount}
                  style={styles.modalQuickBtn}
                >
                  <Text style={styles.modalQuickBtnText}>Max</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={isSubmittingPayout}
                  onPress={setHalfWithdrawAmount}
                  style={styles.modalQuickBtn}
                >
                  <Text style={styles.modalQuickBtnText}>50%</Text>
                </TouchableOpacity>
              </View>

              {/* PAYOUT ACCOUNT */}
              <Text style={styles.modalSectionLabel}>Payout To</Text>

              {activeFundAccounts.length === 0 ? (
                <Text style={styles.modalEmptyText}>
                  No active payout account. Add a bank account or UPI account
                  before cashing out.
                </Text>
              ) : (
                activeFundAccounts.map(account => {
                  const selected =
                    account.fundAccountId === selectedFundAccountId;

                  return (
                    <TouchableOpacity
                      key={account.fundAccountId}
                      activeOpacity={0.85}
                      disabled={isSubmittingPayout}
                      onPress={() =>
                        setSelectedFundAccountId(account.fundAccountId)
                      }
                      style={[
                        styles.fundAccountRow,
                        selected && styles.fundAccountRowSelected,
                      ]}
                    >
                      <Icon
                        name={
                          account.accountType === 'bank_account'
                            ? 'bank'
                            : account.accountType === 'vpa'
                              ? 'qrcode'
                              : 'wallet'
                        }
                        size={20}
                        color={selected ? '#1D4ED8' : '#374151'}
                      />

                      <View
                        style={{
                          flex: 1,
                          marginLeft: 10,
                        }}
                      >
                        <Text style={styles.fundAccountTitle}>
                          {describeFundAccount(account)}
                        </Text>

                        {account.isDefault ? (
                          <Text style={styles.fundAccountBadge}>Default</Text>
                        ) : null}
                      </View>

                      {selected ? (
                        <Icon name="check-circle" size={20} color="#1D4ED8" />
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}

              {/* IMPORTANT NOTICE */}
              <View style={styles.exactEarningNotice}>
                <Icon name="information-outline" size={18} color="#1D4ED8" />

                <Text style={styles.exactEarningNoticeText}>
                  Withdrawal uses complete wallet earnings. The entered amount
                  must exactly match one or more available seller earnings.
                </Text>
              </View>

              {/* CONFIRM */}
              <TouchableOpacity
                activeOpacity={0.9}
                disabled={
                  isSubmittingPayout ||
                  !selectedFundAccountId ||
                  !cashoutAmount ||
                  Number(cashoutAmount) < MIN_WITHDRAWAL_AMOUNT ||
                  Number(cashoutAmount) > MAX_WITHDRAWAL_AMOUNT ||
                  Number(cashoutAmount) > walletAvailableBalance ||
                  activeFundAccounts.length === 0
                }
                onPress={submitCashout}
                style={[
                  styles.modalConfirmButton,
                  (isSubmittingPayout ||
                    !selectedFundAccountId ||
                    !cashoutAmount ||
                    Number(cashoutAmount) < MIN_WITHDRAWAL_AMOUNT ||
                    Number(cashoutAmount) > MAX_WITHDRAWAL_AMOUNT ||
                    Number(cashoutAmount) > walletAvailableBalance ||
                    activeFundAccounts.length === 0) &&
                    styles.modalConfirmButtonDisabled,
                ]}
              >
                {isSubmittingPayout ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="check" size={18} color="#FFFFFF" />

                    <Text style={styles.modalConfirmText}>
                      Confirm Withdrawal
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.modalFooterText}>
                Withdrawals are processed via RazorpayX. Final status is updated
                after RazorpayX reports the payout result.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  headerTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: '#111827',
  },

  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },

  kycStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#111827',
  },

  kycStatusButtonText: {
    marginLeft: 6,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  payoutBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  payoutBannerInfo: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },

  payoutBannerWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },

  payoutBannerSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },

  payoutBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  payoutBannerTitle: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  payoutBannerText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
  },

  payoutBannerButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#111827',
  },

  payoutBannerButtonText: {
    marginLeft: 6,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  lastPayoutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
  },

  lastPayoutTitle: {
    fontSize: 13,
    fontWeight: '800',
  },

  lastPayoutText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  totalCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 22,
    marginBottom: 14,
  },

  totalLabel: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },

  totalAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },

  totalDescription: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 6,
  },

  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  balanceCard: {
    width: '48.3%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  balanceCardFull: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  balanceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  walletTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  balanceLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },

  balanceAmount: {
    marginTop: 5,
    fontSize: 19,
    color: '#111827',
    fontWeight: '800',
  },

  walletAmount: {
    marginTop: 4,
    fontSize: 22,
    color: '#166534',
    fontWeight: '900',
  },

  cashoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
  },

  cashoutButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },

  cashoutButtonText: {
    marginLeft: 6,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },

  filters: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },

  filterButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  filterButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },

  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },

  filterTextActive: {
    color: '#FFFFFF',
  },

  earningCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  earningTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  orderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  orderIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  orderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    maxWidth: 180,
  },

  orderDate: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
  },

  earningAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#166534',
  },

  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },

  statusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },

  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  amountRight: {
    alignItems: 'flex-end',
  },

  smallLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  smallValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  nextStageBox: {
    flexDirection: 'row',
    marginTop: 15,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  nextStageContent: {
    flex: 1,
    marginLeft: 9,
  },

  nextStageTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },

  nextStageText: {
    marginTop: 3,
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 17,
  },

  boldText: {
    fontWeight: '800',
    color: '#111827',
  },

  availableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
  },

  availableText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  errorTitle: {
    marginTop: 15,
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },

  errorMessage: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },

  retryButton: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },

  inlineErrorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#92400E',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 55,
    paddingHorizontal: 25,
  },

  emptyTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '800',
    color: '#374151',
  },

  emptyText: {
    marginTop: 7,
    textAlign: 'center',
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
  },

  // ====================================================
  // MODAL
  // ====================================================

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },

  modalBalanceCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },

  modalBalanceLabel: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '700',
  },

  modalBalanceAmount: {
    fontSize: 28,
    color: '#166534',
    fontWeight: '900',
    marginTop: 4,
  },

  modalPolicyText: {
    marginTop: 7,
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },

  modalSectionLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    marginBottom: 8,
  },

  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },

  modalRupee: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginRight: 6,
  },

  modalInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    paddingVertical: 14,
  },

  modalInputError: {
    color: '#DC2626',
    fontSize: 12,
    marginBottom: 8,
  },

  modalQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },

  modalQuickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },

  modalQuickBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },

  modalEmptyText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
  },

  fundAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },

  fundAccountRowSelected: {
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },

  fundAccountTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },

  fundAccountBadge: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '800',
    marginTop: 2,
  },

  exactEarningNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },

  exactEarningNoticeText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 11,
    lineHeight: 17,
    color: '#1E40AF',
    fontWeight: '600',
  },

  modalConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#111827',
  },

  modalConfirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },

  modalConfirmText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  modalFooterText: {
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
});

export default SellerEarningsScreen;
