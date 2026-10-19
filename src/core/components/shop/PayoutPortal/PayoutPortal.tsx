import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../contexts/auth/UserContext';
import { getToken } from '../../../../api/connections/token/tokenSlice';
import { TIZZYOS_API_BASE_URL } from '../../../../api/connections/snippet/apiBaseUrl';

// ======================================================
// TIZZYOS LOGO ASSET
// ======================================================
const TIZZYOS_LOGO = require('../../../../assets/images/tizzy-logo.jpg');

// ======================================================
// TYPES
// ======================================================
type ContactStatus = 'created' | 'active' | 'suspended' | 'rejected' | string;
type FundAccountType = 'bank_account' | 'vpa' | 'wallet';
type FundAccountStatus = 'active' | 'inactive' | 'pending' | string;

interface FundAccount {
  fundAccountId: string;
  accountType: FundAccountType;
  status: FundAccountStatus;
  isDefault?: boolean;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  vpaAddress?: string;
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
}

type Step = 1 | 2 | 3 | 4;

type FormData = {
  name: string;
  email: string;
  phone: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  vpaAddress: string;
  walletProvider: string;
  walletPhone: string;
  walletEmail: string;
  walletName: string;
};

// ======================================================
// 🎨 BLUE THEME
// ======================================================
const COLORS = {
  gradientStart: '#1E40AF',
  gradientMid: '#2563EB',
  gradientEnd: '#3B82F6',
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  primarySoft: '#EFF6FF',
  primaryBorder: '#BFDBFE',
  accent: '#3B82F6',
  background: '#FFFFFF',
  white: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderDark: '#CBD5E1',
  success: '#059669',
  successSoft: '#ECFDF5',
  successBorder: '#A7F3D0',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  shimmerDark: '#0F1E3D',
  shimmerBlue: '#1E40AF',
};

// ======================================================
// HELPERS
// ======================================================
const getApiErrorMessage = (data: any, fallback: string): string => {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  return (
    data?.message ||
    data?.error?.description ||
    data?.error?.message ||
    data?.details?.message ||
    data?.error ||
    fallback
  );
};

const normalizeStatusKey = (value?: string | null): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const maskBankAccount = (value?: string): string => {
  if (!value) return '••••';
  const t = String(value).trim();
  if (t.length <= 4) return `••••${t}`;
  return `••••${t.slice(-4)}`;
};

const getUserIdFromToken = (token?: string | null): string | null => {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
    let decoded = '';
    const atobFn = (
      globalThis as typeof globalThis & { atob?: (value: string) => string }
    ).atob;
    if (typeof atobFn === 'function') {
      decoded = atobFn(base64);
    } else {
      return null;
    }
    const payload = JSON.parse(decoded);
    const userId =
      payload?.userId || payload?.id || payload?._id || payload?.sub;
    if (!userId) return null;
    return String(userId);
  } catch (error) {
    console.error('❌ Unable to decode userId from token:', error);
    return null;
  }
};

// ======================================================
// ICON RENDERER
// ======================================================
type IconProps = {
  name: string;
  size?: number;
  color?: string;
  family?: 'ionicons' | 'material';
};

function AppIcon({
  name,
  size = 18,
  color = COLORS.primary,
  family = 'ionicons',
}: IconProps) {
  if (family === 'material') {
    return <MaterialCommunityIcons name={name} size={size} color={color} />;
  }
  return <Ionicons name={name} size={size} color={color} />;
}

// ======================================================
// ✨ SHIMMER OVERLAY
// ======================================================
const ButtonShimmerOverlay = () => {
  const shimmerValue = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerValue]);

  const translateX = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-250, 250],
  });

  return (
    <Animated.View
      style={[styles.shimmerOverlay, { transform: [{ translateX }] }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.25)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.shimmerGradient}
      />
    </Animated.View>
  );
};

// ======================================================
// SCREEN
// ======================================================
export default function PayoutSetupScreen() {
  const { user, loading: authLoading } = useAuth();

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);

  const [payoutAccount, setPayoutAccount] = useState<PayoutAccountData | null>(
    null,
  );
  const [payoutAccountExists, setPayoutAccountExists] = useState(false);

  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    vpaAddress: '',
    walletProvider: 'amazonpay',
    walletPhone: '',
    walletEmail: '',
    walletName: '',
  });

  const createInFlightRef = useRef(false);

  // ====================================================
  // LOAD TOKEN + RESOLVE USER ID
  // ====================================================
  useEffect(() => {
    let mounted = true;
    const loadToken = async () => {
      try {
        const token = await getToken();
        if (!mounted) return;
        setAuthToken(token);
        const uid = getUserIdFromToken(token);
        setResolvedUserId(uid);
      } catch {
        if (mounted) {
          setAuthToken(null);
          setResolvedUserId(null);
        }
      } finally {
        if (mounted) setTokenLoading(false);
      }
    };
    loadToken();
    return () => {
      mounted = false;
    };
  }, []);

  // ====================================================
  // PREFILL FORM
  // ====================================================
  useEffect(() => {
    if (!user) return;
    setForm(prev => ({
      ...prev,
      name: prev.name || user.name || '',
      email: prev.email || user.email || '',
      phone: prev.phone || (user as unknown as { phone?: string }).phone || '',
    }));
  }, [user]);

  const buildHeaders = useMemo(() => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      h.Authorization = `Bearer ${authToken}`;
    }
    return h;
  }, [authToken]);

  const ensureAuthenticated = () => {
    if (!resolvedUserId) {
      Alert.alert(
        'Authentication Required',
        'Unable to identify the current user. Please login again.',
      );
      return false;
    }
    if (!authToken) {
      Alert.alert(
        'Authentication Required',
        'Your login session could not be found. Please login again.',
      );
      return false;
    }
    return true;
  };

  // ====================================================
  // FETCH PAYOUT ACCOUNT
  // ====================================================
  const fetchPayoutAccount = async () => {
    if (!resolvedUserId || !authToken) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setAuthFailed(false);

      const response = await fetch(
        `${TIZZYOS_API_BASE_URL}/api/v0/payout-portal/payout-account/${resolvedUserId}`,
        { method: 'GET', headers: buildHeaders },
      );

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.status === 404) {
        setPayoutAccountExists(false);
        setPayoutAccount(null);
        setStep(1);
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setAuthFailed(true);
        setPayoutAccountExists(false);
        setPayoutAccount(null);
        setStep(1);
        return;
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(data, 'Unable to fetch payout account.'),
        );
      }

      const account: PayoutAccountData | null = data?.data || null;

      if (!account || !account.contactId) {
        setPayoutAccountExists(false);
        setPayoutAccount(null);
        setStep(1);
        return;
      }

      setPayoutAccountExists(true);
      setPayoutAccount(account);

      const status = normalizeStatusKey(account.status);
      if (status === 'active' && (account.fundAccounts?.length || 0) > 0) {
        setStep(4);
      } else {
        setStep(2);
      }
    } catch (error: any) {
      console.error('❌ Payout account fetch error:', error?.message || error);
      Alert.alert(
        'Unable to Load',
        error?.message || 'Unable to fetch payout account.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (tokenLoading) return;
    if (!resolvedUserId || !authToken) {
      setLoading(false);
      return;
    }
    fetchPayoutAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, tokenLoading, resolvedUserId, authToken]);

  const updateField = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // ====================================================
  // LIVE VALIDATION
  // ====================================================
  const validation = useMemo(() => {
    const nameValid = form.name.trim().length >= 3;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    const phoneValid = /^[0-9]{10}$/.test(form.phone.trim());

    const bankAccountNameValid = form.bankAccountName.trim().length >= 3;
    const bankAccountNumberValid = /^[0-9]{9,18}$/.test(
      form.bankAccountNumber.trim(),
    );
    const bankIfscValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(
      form.bankIfsc.trim().toUpperCase(),
    );

    const vpaValid = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(
      form.vpaAddress.trim(),
    );

    const walletProviderValid = form.walletProvider.trim().length > 0;
    const walletPhoneValid = /^[0-9]{10}$/.test(form.walletPhone.trim());
    const walletEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      form.walletEmail.trim(),
    );
    const walletNameValid = form.walletName.trim().length >= 3;

    return {
      step1: nameValid && emailValid && phoneValid,
      bankValid:
        bankAccountNameValid && bankAccountNumberValid && bankIfscValid,
      vpaValid,
      walletValid:
        walletProviderValid &&
        walletPhoneValid &&
        walletEmailValid &&
        walletNameValid,
      nameValid,
      emailValid,
      phoneValid,
      bankAccountNameValid,
      bankAccountNumberValid,
      bankIfscValid,
      walletProviderValid,
      walletPhoneValid,
      walletEmailValid,
      walletNameValid,
    };
  }, [form]);

  // ====================================================
  // STRICT VALIDATION ON SUBMIT
  // ====================================================
  const validateStep1 = () => {
    if (!validation.nameValid) {
      Alert.alert('Invalid Name', 'Please enter your full legal name.');
      return false;
    }
    if (!validation.emailValid) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }
    if (!validation.phoneValid) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit number.');
      return false;
    }
    return true;
  };

  const validateBank = () => {
    if (!validation.bankAccountNameValid) {
      Alert.alert('Invalid Name', 'Enter the account holder name.');
      return false;
    }
    if (!validation.bankAccountNumberValid) {
      Alert.alert('Invalid Account', 'Enter a valid account number.');
      return false;
    }
    if (!validation.bankIfscValid) {
      Alert.alert('Invalid IFSC', 'Enter a valid IFSC code.');
      return false;
    }
    return true;
  };

  const validateVpa = () => {
    if (!validation.vpaValid) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID.');
      return false;
    }
    return true;
  };

  const validateWallet = () => {
    if (!validation.walletProviderValid) {
      Alert.alert('Invalid Provider', 'Please select a wallet provider.');
      return false;
    }
    if (!validation.walletPhoneValid) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit number.');
      return false;
    }
    if (!validation.walletEmailValid) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }
    if (!validation.walletNameValid) {
      Alert.alert('Invalid Name', 'Please enter the account holder name.');
      return false;
    }
    return true;
  };

  // ====================================================
  // CREATE CONTACT (RazorpayX)
  // ====================================================
  const createPayoutAccount = async () => {
    if (!ensureAuthenticated()) return;
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;
    try {
      setSubmitting(true);

      const payload = {
        userId: resolvedUserId,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      };

      const response = await fetch(
        `${TIZZYOS_API_BASE_URL}/api/v0/payout-portal/payout-account`,
        {
          method: 'POST',
          headers: buildHeaders,
          body: JSON.stringify(payload),
        },
      );

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.status === 401 || response.status === 403) {
        setAuthFailed(true);
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(data, 'Unable to create payout account.'),
        );
      }

      setPayoutAccountExists(true);
      setPayoutAccount(data?.data || null);

      Alert.alert(
        'Payout Account Created',
        'Now add a bank account, UPI, or wallet to receive payouts.',
        [{ text: 'Continue', onPress: () => setStep(2) }],
      );
    } catch (error: any) {
      Alert.alert(
        'Setup Failed',
        error?.message || 'Unable to create payout account.',
      );
    } finally {
      setSubmitting(false);
      createInFlightRef.current = false;
    }
  };

  // ====================================================
  // ADD FUND ACCOUNT
  // ====================================================
  const addFundAccount = async (type: FundAccountType) => {
    if (!ensureAuthenticated()) return;
    try {
      setSubmitting(true);

      let url = '';
      let payload: Record<string, any> = { userId: resolvedUserId };

      if (type === 'bank_account') {
        url = `${TIZZYOS_API_BASE_URL}/api/v0/payout-portal/payout-account/bank`;
        payload = {
          ...payload,
          name: form.bankAccountName.trim(),
          accountNumber: form.bankAccountNumber.trim(),
          ifsc: form.bankIfsc.trim().toUpperCase(),
        };
      } else if (type === 'vpa') {
        url = `${TIZZYOS_API_BASE_URL}/api/v0/payout-portal/payout-account/vpa`;
        payload = {
          ...payload,
          vpa: form.vpaAddress.trim(),
        };
      } else {
        url = `${TIZZYOS_API_BASE_URL}/api/v0/payout-portal/payout-account/wallet`;
        payload = {
          ...payload,
          provider: form.walletProvider.trim(),
          phone: form.walletPhone.trim(),
          email: form.walletEmail.trim().toLowerCase(),
          name: form.walletName.trim(),
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders,
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.status === 401 || response.status === 403) {
        setAuthFailed(true);
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(data, 'Unable to add fund account.'),
        );
      }

      Alert.alert(
        'Account Added',
        'Your payout account has been added. Verification may take some time.',
      );

      await fetchPayoutAccount();
    } catch (error: any) {
      Alert.alert('Failed', error?.message || 'Unable to add fund account.');
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================
  // HANDLERS
  // ====================================================
  const handleNext = async () => {
    if (submitting) return;

    if (step === 1) {
      if (!validateStep1()) return;
      if (!payoutAccountExists) {
        await createPayoutAccount();
      } else {
        setStep(2);
      }
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }
  };

  const handleBack = () => {
    if (submitting) return;
    if (step > 1) setStep(prev => (prev - 1) as Step);
  };

  // ====================================================
  // STATUS INFO
  // ====================================================
  const getStatusInfo = () => {
    const status = normalizeStatusKey(payoutAccount?.status);
    switch (status) {
      case 'active':
        return {
          title: 'Payout account active',
          description:
            'You can now receive payouts to your linked fund accounts.',
          label: 'ACTIVE',
          color: COLORS.success,
          background: COLORS.successSoft,
          border: COLORS.successBorder,
          iconName: 'checkmark-circle',
        };
      case 'suspended':
      case 'rejected':
        return {
          title: 'Payout account suspended',
          description: 'Please contact support for more information.',
          label: 'SUSPENDED',
          color: COLORS.danger,
          background: COLORS.dangerSoft,
          border: COLORS.dangerBorder,
          iconName: 'close-circle',
        };
      case 'created':
      default:
        return {
          title: 'Payout account created',
          description: 'Add a fund account and wait for verification.',
          label: 'PENDING',
          color: COLORS.primary,
          background: COLORS.primarySoft,
          border: COLORS.primaryBorder,
          iconName: 'time',
        };
    }
  };

  // ====================================================
  // LOADING / AUTH STATES
  // ====================================================
  if (authLoading || tokenLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingTitle}>Loading account</Text>
        <Text style={styles.loadingText}>Please wait a moment.</Text>
      </View>
    );
  }

  if (!resolvedUserId || !authToken || authFailed) {
    return (
      <View style={styles.center}>
        <View style={styles.errorMark}>
          <AppIcon name="alert" size={22} color={COLORS.danger} />
        </View>
        <Text style={styles.errorTitle}>Login required</Text>
        <Text style={styles.errorDescription}>
          {authFailed
            ? 'Your session has expired. Please login again to continue.'
            : 'We could not verify your TizzyOS account. Please login again.'}
        </Text>
        <Pressable
          style={styles.retryButton}
          onPress={async () => {
            setTokenLoading(true);
            setAuthFailed(false);
            try {
              const t = await getToken();
              setAuthToken(t);
              setResolvedUserId(getUserIdFromToken(t));
            } catch {
              setAuthToken(null);
              setResolvedUserId(null);
            } finally {
              setTokenLoading(false);
            }
          }}
        >
          <AppIcon name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingTitle}>Checking payout account</Text>
        <Text style={styles.loadingText}>
          Securely checking your payout account status.
        </Text>
      </View>
    );
  }

  // ====================================================
  // STATUS SCREEN (Step 4)
  // ====================================================
  if (step === 4 && payoutAccount) {
    const status = getStatusInfo();
    const fundAccounts = payoutAccount.fundAccounts || [];
    const activeFunds = fundAccounts.filter(
      f => normalizeStatusKey(f.status) === 'active',
    );

    return (
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.statusContainer}
        >
          <StatusPanel status={status} />

          <SectionTitle sub="Your RazorpayX Contact and linked fund accounts.">
            Payout account
          </SectionTitle>

          <View style={styles.identityCard}>
            <IdentityRow
              label="Contact ID"
              value={payoutAccount.contactId || '—'}
              iconName="person-circle-outline"
              accent
              mono
            />
            <IdentityRow
              label="Contact Type"
              value={payoutAccount.contactType || '—'}
              iconName="git-network-outline"
            />
            <IdentityRow
              label="Status"
              value={payoutAccount.status || '—'}
              iconName="pulse-outline"
            />
            <IdentityRow
              label="Name"
              value={payoutAccount.name || '—'}
              iconName="person-outline"
            />
            <IdentityRow
              label="Email"
              value={payoutAccount.email || '—'}
              iconName="mail-outline"
            />
            <IdentityRow
              label="Phone"
              value={payoutAccount.contact || '—'}
              iconName="call-outline"
              last
            />
          </View>

          <SectionTitle sub="Fund accounts linked to receive payouts.">
            Fund accounts ({activeFunds.length} active / {fundAccounts.length}{' '}
            total)
          </SectionTitle>

          {fundAccounts.length === 0 ? (
            <View style={styles.emptyBox}>
              <AppIcon
                name="wallet-outline"
                size={28}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyBoxTitle}>No fund accounts yet</Text>
              <Text style={styles.emptyBoxText}>
                Add a bank account, UPI, or wallet to receive payouts.
              </Text>
            </View>
          ) : (
            <View style={styles.identityCard}>
              {fundAccounts.map((fa, idx) => (
                <FundAccountRow
                  key={fa.fundAccountId || idx}
                  fa={fa}
                  last={idx === fundAccounts.length - 1}
                />
              ))}
            </View>
          )}

          <Pressable
            style={styles.secondaryButton}
            onPress={() => setStep(2)}
            disabled={submitting}
          >
            <AppIcon
              name="add-circle-outline"
              size={16}
              color={COLORS.primary}
            />
            <Text style={[styles.secondaryButtonText, { marginLeft: 8 }]}>
              Add fund account
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={fetchPayoutAccount}
            disabled={submitting}
          >
            <AppIcon name="refresh" size={16} color={COLORS.primary} />
            <Text style={[styles.secondaryButtonText, { marginLeft: 8 }]}>
              Refresh status
            </Text>
          </Pressable>

          <SecurityFooter />
        </ScrollView>
      </View>
    );
  }

  // ====================================================
  // ✅ STEP 1 - CREATE RAZORPAYX CONTACT (नया block)
  // ====================================================
  if (step === 1) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.formContainer}
        >
          <BrandRow />

          <Text style={styles.eyebrow}>PAYOUT ACCOUNT</Text>
          <Text style={styles.title}>Set up payout account</Text>
          <Text style={styles.subtitle}>
            Enter your details to create a RazorpayX payout account. This is
            required to receive seller payouts.
          </Text>

          <SectionTitle sub="Your identity for payout verification.">
            Contact details
          </SectionTitle>

          <KycInput
            label="Full legal name"
            iconName="person-outline"
            required
            value={form.name}
            onChangeText={v => updateField('name', v)}
            placeholder="Enter your full name"
            isValid={validation.nameValid}
            showValidation={form.name.length > 0}
          />
          <KycInput
            label="Email address"
            iconName="mail-outline"
            required
            value={form.email}
            onChangeText={v => updateField('email', v)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            isValid={validation.emailValid}
            showValidation={form.email.length > 0}
          />
          <KycInput
            label="Mobile number"
            iconName="call-outline"
            required
            value={form.phone}
            onChangeText={v => updateField('phone', v.replace(/[^0-9]/g, ''))}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            isValid={validation.phoneValid}
            showValidation={form.phone.length > 0}
            last
          />

          <Pressable
            style={[styles.shimmerButtonWrapper, { marginTop: 16 }]}
            disabled={submitting || !validation.step1}
            onPress={async () => {
              if (!validateStep1()) return;
              if (!payoutAccountExists) {
                await createPayoutAccount();
              } else {
                setStep(2);
              }
            }}
          >
            <View
              style={[
                styles.shimmerButton,
                (submitting || !validation.step1) && { opacity: 0.6 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.shimmerButtonInner}>
                  <Text style={styles.shimmerButtonText}>
                    {payoutAccountExists ? 'Continue' : 'Create payout account'}
                  </Text>
                  <AppIcon name="arrow-forward" size={15} color="#FFFFFF" />
                </View>
              )}
              {!submitting && validation.step1 ? (
                <ButtonShimmerOverlay />
              ) : null}
            </View>
          </Pressable>

          <SecurityFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ====================================================
  // STEP 2 - CHOOSE FUND ACCOUNT TYPE
  // ====================================================
  if (step === 2) {
    return (
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.formContainer}
        >
          <BrandRow />
          <Text style={styles.eyebrow}>FUND ACCOUNT</Text>
          <Text style={styles.title}>Add payout destination</Text>
          <Text style={styles.subtitle}>
            Choose how you want to receive payouts. You can add multiple
            accounts.
          </Text>

          <Pressable
            style={[styles.typeCard, styles.typeCardPrimary]}
            disabled={submitting}
            onPress={() => setStep(3)}
          >
            <View style={styles.typeIconWrap}>
              <AppIcon
                name="business-outline"
                size={22}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.typeTitle}>Bank Account</Text>
              <Text style={styles.typeSubtitle}>
                IMPS / NEFT / RTGS transfer
              </Text>
            </View>
            <AppIcon
              name="chevron-forward"
              size={18}
              color={COLORS.textMuted}
            />
          </Pressable>

          <Pressable
            style={styles.typeCard}
            disabled={submitting}
            onPress={() => setStep(3)}
          >
            <View style={styles.typeIconWrap}>
              <AppIcon name="at-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.typeTitle}>UPI ID (VPA)</Text>
              <Text style={styles.typeSubtitle}>Instant transfer to UPI</Text>
            </View>
            <AppIcon
              name="chevron-forward"
              size={18}
              color={COLORS.textMuted}
            />
          </Pressable>

          <Pressable
            style={styles.typeCard}
            disabled={submitting}
            onPress={() => setStep(3)}
          >
            <View style={styles.typeIconWrap}>
              <AppIcon name="wallet-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.typeTitle}>External Wallet</Text>
              <Text style={styles.typeSubtitle}>
                Amazon Pay and other supported wallets
              </Text>
            </View>
            <AppIcon
              name="chevron-forward"
              size={18}
              color={COLORS.textMuted}
            />
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              if (payoutAccountExists) setStep(4);
              else setStep(1);
            }}
            disabled={submitting}
          >
            <AppIcon name="arrow-back" size={16} color={COLORS.primary} />
            <Text style={[styles.secondaryButtonText, { marginLeft: 8 }]}>
              Back
            </Text>
          </Pressable>

          <SecurityFooter />
        </ScrollView>
      </View>
    );
  }

  // ====================================================
  // STEP 3 - FUND ACCOUNT FORMS
  // ====================================================
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.formContainer}
      >
        <BrandRow />

        <Text style={styles.eyebrow}>FUND ACCOUNT</Text>
        <Text style={styles.title}>Add payout account</Text>
        <Text style={styles.subtitle}>
          Enter details of the destination account where you want to receive
          payouts.
        </Text>

        <SectionTitle sub="Bank account details">Bank account</SectionTitle>

        <KycInput
          label="Account holder name"
          iconName="person-outline"
          required
          value={form.bankAccountName}
          onChangeText={v => updateField('bankAccountName', v)}
          placeholder="Name as per bank"
          isValid={validation.bankAccountNameValid}
          showValidation={form.bankAccountName.length > 0}
        />
        <KycInput
          label="Account number"
          iconName="card-outline"
          required
          value={form.bankAccountNumber}
          onChangeText={v =>
            updateField('bankAccountNumber', v.replace(/[^0-9]/g, ''))
          }
          placeholder="9-18 digit account number"
          keyboardType="number-pad"
          secureTextEntry
          isValid={validation.bankAccountNumberValid}
          showValidation={form.bankAccountNumber.length > 0}
        />
        <KycInput
          label="IFSC code"
          iconName="library-outline"
          required
          value={form.bankIfsc}
          onChangeText={v =>
            updateField('bankIfsc', v.toUpperCase().replace(/[^A-Z0-9]/g, ''))
          }
          placeholder="HDFC0001234"
          autoCapitalize="characters"
          maxLength={11}
          isValid={validation.bankIfscValid}
          showValidation={form.bankIfsc.length > 0}
          last
        />

        <Pressable
          style={[styles.shimmerButtonWrapper, { marginTop: 12 }]}
          disabled={submitting || !validation.bankValid}
          onPress={async () => {
            if (!validateBank()) return;
            await addFundAccount('bank_account');
          }}
        >
          <View
            style={[
              styles.shimmerButton,
              (submitting || !validation.bankValid) && { opacity: 0.6 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.shimmerButtonInner}>
                <AppIcon name="checkmark" size={16} color="#FFFFFF" />
                <Text style={[styles.shimmerButtonText, { marginLeft: 8 }]}>
                  Add bank account
                </Text>
              </View>
            )}
            {!submitting && validation.bankValid ? (
              <ButtonShimmerOverlay />
            ) : null}
          </View>
        </Pressable>

        <SectionTitle sub="UPI ID (Virtual Payment Address)">UPI</SectionTitle>

        <KycInput
          label="UPI ID"
          iconName="at-outline"
          required
          value={form.vpaAddress}
          onChangeText={v => updateField('vpaAddress', v.trim())}
          placeholder="name@upi"
          autoCapitalize="none"
          isValid={validation.vpaValid}
          showValidation={form.vpaAddress.length > 0}
          last
        />

        <Pressable
          style={[styles.secondaryButton, { marginTop: 12 }]}
          disabled={submitting || !validation.vpaValid}
          onPress={async () => {
            if (!validateVpa()) return;
            await addFundAccount('vpa');
          }}
        >
          <AppIcon name="add-circle-outline" size={16} color={COLORS.primary} />
          <Text style={[styles.secondaryButtonText, { marginLeft: 8 }]}>
            Add UPI account
          </Text>
        </Pressable>

        <SectionTitle sub="External wallet (e.g., Amazon Pay)">
          Wallet
        </SectionTitle>

        <KycInput
          label="Provider"
          iconName="wallet-outline"
          required
          value={form.walletProvider}
          onChangeText={v => updateField('walletProvider', v)}
          placeholder="amazonpay"
          autoCapitalize="none"
          isValid={validation.walletProviderValid}
          showValidation={form.walletProvider.length > 0}
        />
        <KycInput
          label="Wallet phone"
          iconName="call-outline"
          required
          value={form.walletPhone}
          onChangeText={v =>
            updateField('walletPhone', v.replace(/[^0-9]/g, ''))
          }
          placeholder="10-digit mobile"
          keyboardType="phone-pad"
          maxLength={10}
          isValid={validation.walletPhoneValid}
          showValidation={form.walletPhone.length > 0}
        />
        <KycInput
          label="Wallet email"
          iconName="mail-outline"
          required
          value={form.walletEmail}
          onChangeText={v => updateField('walletEmail', v)}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          isValid={validation.walletEmailValid}
          showValidation={form.walletEmail.length > 0}
        />
        <KycInput
          label="Wallet holder name"
          iconName="person-outline"
          required
          value={form.walletName}
          onChangeText={v => updateField('walletName', v)}
          placeholder="Name as per wallet"
          isValid={validation.walletNameValid}
          showValidation={form.walletName.length > 0}
          last
        />

        <Pressable
          style={[styles.secondaryButton, { marginTop: 12 }]}
          disabled={submitting || !validation.walletValid}
          onPress={async () => {
            if (!validateWallet()) return;
            await addFundAccount('wallet');
          }}
        >
          <AppIcon name="add-circle-outline" size={16} color={COLORS.primary} />
          <Text style={[styles.secondaryButtonText, { marginLeft: 8 }]}>
            Add wallet account
          </Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, { marginTop: 16 }]}
          onPress={handleBack}
          disabled={submitting}
        >
          <AppIcon name="arrow-back" size={16} color={COLORS.primary} />
          <Text style={[styles.secondaryButtonText, { marginLeft: 8 }]}>
            Back
          </Text>
        </Pressable>

        <SecurityFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ======================================================
// SUB-COMPONENTS
// ======================================================

function BrandRow() {
  return (
    <View style={styles.brandRow}>
      <Image
        source={TIZZYOS_LOGO}
        style={styles.brandLogo}
        resizeMode="contain"
      />
      <View style={styles.brandTextWrap}>
        <Text style={styles.brandName}>TizzyOS</Text>
        <Text style={styles.brandTag}>Payout Account Setup</Text>
      </View>
    </View>
  );
}

function SectionTitle({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <View style={styles.sectionTitleWrapper}>
      <Text style={styles.sectionTitleText}>{children}</Text>
      {sub ? <Text style={styles.sectionTitleSub}>{sub}</Text> : null}
    </View>
  );
}

function KycInput({
  label,
  iconName,
  required,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  secureTextEntry,
  autoCapitalize,
  editable = true,
  maxLength,
  last,
  isValid,
  showValidation,
}: {
  label: string;
  iconName?: string;
  required?: boolean;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: any;
  editable?: boolean;
  maxLength?: number;
  last?: boolean;
  isValid?: boolean;
  showValidation?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const showError = showValidation && value.length > 0 && isValid === false;
  const showSuccess = showValidation && value.length > 0 && isValid === true;

  return (
    <View style={[styles.inputGroup, last && styles.inputGroupLast]}>
      <Text style={styles.inputLabel}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>

      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          !editable && styles.inputWrapperDisabled,
          multiline && styles.inputWrapperMultiline,
          showError && styles.inputWrapperError,
          showSuccess && styles.inputWrapperSuccess,
        ]}
      >
        {iconName ? (
          <View style={styles.inputIconBox}>
            <AppIcon
              name={iconName as any}
              size={16}
              color={
                showError
                  ? COLORS.danger
                  : showSuccess
                    ? COLORS.success
                    : focused
                      ? COLORS.primary
                      : COLORS.textMuted
              }
            />
          </View>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize || 'sentences'}
          editable={editable}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            !editable && styles.disabledInput,
          ]}
        />
        {showSuccess ? (
          <AppIcon name="checkmark-circle" size={18} color={COLORS.success} />
        ) : null}
        {showError ? (
          <AppIcon name="alert-circle" size={18} color={COLORS.danger} />
        ) : null}
      </View>
    </View>
  );
}

function StatusPanel({ status }: { status: any }) {
  return (
    <View
      style={[
        styles.statusPanel,
        { backgroundColor: status.background, borderColor: status.border },
      ]}
    >
      <View style={[styles.statusMark, { backgroundColor: status.color }]}>
        <AppIcon name={status.iconName} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.statusPanelContent}>
        <Text style={[styles.statusLabel, { color: status.color }]}>
          {status.label}
        </Text>
        <Text style={styles.statusTitle}>{status.title}</Text>
        <Text style={styles.statusDescription}>{status.description}</Text>
      </View>
    </View>
  );
}

function IdentityRow({
  label,
  value,
  iconName,
  mono,
  accent,
  last,
}: {
  label: string;
  value: string;
  iconName?: string;
  mono?: boolean;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.identityRow, !last && styles.identityRowBorder]}>
      <View style={styles.identityIconBox}>
        <AppIcon
          name={iconName || 'ellipse-outline'}
          size={15}
          color={accent ? COLORS.primary : COLORS.textSecondary}
        />
      </View>
      <View style={styles.identityTextWrap}>
        <Text style={styles.identityLabel}>{label}</Text>
        <Text
          selectable
          style={[
            styles.identityValue,
            mono && styles.identityValueMono,
            accent && styles.identityValueAccent,
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function FundAccountRow({ fa, last }: { fa: FundAccount; last?: boolean }) {
  const type = normalizeStatusKey(fa.accountType);
  const status = normalizeStatusKey(fa.status);
  const active = status === 'active';

  const iconName =
    type === 'bank_account'
      ? 'business-outline'
      : type === 'vpa'
        ? 'at-outline'
        : 'wallet-outline';

  let title = 'Account';
  let subtitle = '';

  if (type === 'bank_account') {
    title = `${fa.bankAccountName || 'Bank'} ${maskBankAccount(
      fa.bankAccountNumber,
    )}`;
    subtitle = fa.bankIfsc || '';
  } else if (type === 'vpa') {
    title = fa.vpaAddress || 'UPI';
  } else if (type === 'wallet') {
    title = `${fa.walletProvider || 'Wallet'}`;
    subtitle = fa.walletPhone || '';
  }

  return (
    <View style={[styles.identityRow, !last && styles.identityRowBorder]}>
      <View
        style={[
          styles.identityIconBox,
          { backgroundColor: active ? COLORS.successSoft : COLORS.primarySoft },
        ]}
      >
        <AppIcon
          name={iconName}
          size={15}
          color={active ? COLORS.success : COLORS.primary}
        />
      </View>
      <View style={styles.identityTextWrap}>
        <Text style={styles.identityLabel}>
          {type.replace('_', ' ').toUpperCase()}
          {fa.isDefault ? ' • DEFAULT' : ''}
        </Text>
        <Text style={styles.identityValue} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.identityValueMono} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.fundStatusPill,
          active
            ? { color: COLORS.success, backgroundColor: COLORS.successSoft }
            : { color: COLORS.warning, backgroundColor: COLORS.warningSoft },
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

function SecurityFooter() {
  return (
    <View style={styles.securityFooter}>
      <AppIcon name="lock-closed" size={13} color={COLORS.textMuted} />
      <Text style={[styles.securityFooterText, { marginLeft: 8 }]}>
        Your information is encrypted and processed securely for payout
        verification only.
      </Text>
    </View>
  );
}

// ======================================================
// STYLES
// ======================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    backgroundColor: COLORS.white,
  },
  loadingTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  loadingText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  errorTitle: {
    marginTop: 15,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  errorDescription: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    gap: 8,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 130,
  },
  statusContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 40,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  brandLogo: { width: 44, height: 44, borderRadius: 10, marginRight: 12 },
  brandTextWrap: { flex: 1 },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  brandTag: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: COLORS.primary,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  sectionTitleWrapper: { marginBottom: 14, marginTop: 10 },
  sectionTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  sectionTitleSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  inputGroup: { marginBottom: 16 },
  inputGroupLast: { marginBottom: 12 },
  inputLabel: {
    marginBottom: 7,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  requiredMark: { color: COLORS.danger },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    minHeight: 52,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  inputWrapperError: { borderColor: COLORS.danger },
  inputWrapperSuccess: { borderColor: COLORS.success },
  inputWrapperDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: COLORS.borderLight,
  },
  inputWrapperMultiline: {
    alignItems: 'flex-start',
    paddingTop: 14,
    minHeight: 96,
  },
  inputIconBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  multilineInput: { minHeight: 72, textAlignVertical: 'top', paddingTop: 0 },
  disabledInput: { color: COLORS.textSecondary },
  shimmerButtonWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: COLORS.shimmerBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shimmerButton: {
    backgroundColor: COLORS.shimmerBlue,
    borderRadius: 28,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  shimmerButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shimmerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 28,
  },
  shimmerGradient: { width: '100%', height: '100%' },
  secondaryButton: {
    flexDirection: 'row',
    height: 50,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.white,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  statusPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  statusMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPanelContent: { flex: 1, marginLeft: 12 },
  statusLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  statusTitle: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  statusDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  identityCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  identityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  identityIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    marginRight: 11,
  },
  identityTextWrap: { flex: 1 },
  identityLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  identityValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  identityValueMono: {
    fontSize: 12,
    letterSpacing: 0.6,
    color: COLORS.textSecondary,
  },
  identityValueAccent: { color: COLORS.primaryDark, fontWeight: '800' },
  fundStatusPill: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  emptyBox: {
    padding: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyBoxTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptyBoxText: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  typeCardPrimary: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primarySoft,
  },
  typeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  typeTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  typeSubtitle: { marginTop: 3, fontSize: 12, color: COLORS.textSecondary },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  securityFooterText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    color: COLORS.textMuted,
  },
});
