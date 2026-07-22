import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Alert } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import {
  MerchantOnboarding,
  useZeptPaySafe,
  tokenService,
  OnboardingCompleteScreen,
  useMerchantOnboarding,
} from '@flixora/zeptpay-react-native';

type FormData = Record<string, any>;

type RootStackParamList = {
  wallet: undefined;
  Transaction: undefined;
};

export default function MerchantOnboardingScreen() {
  const zeptpay = useZeptPaySafe();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { createMerchant, loading: merchantLoading } = useMerchantOnboarding();
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fullFormData, setFullFormData] = useState<FormData>({});
  const [hasSavedToken, setHasSavedToken] = useState<boolean>(false);
  const [merchantData, setMerchantData] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);
  const [tokenInvalid, setTokenInvalid] = useState<boolean>(false);

  // Function to clear token and reset state
  const handleInvalidToken = async (): Promise<void> => {
    console.log('🔴 Token invalid, clearing from device');
    await tokenService.clearToken();
    setHasSavedToken(false);
    setMerchantData(null);
    setTokenInvalid(true);

    Alert.alert(
      'Session Expired',
      'Your session has expired. Please complete the form again.',
      [{ text: 'OK' }],
    );
  };

  // Single function to fetch merchant data with token verification
  const fetchMerchantData = async (token: string): Promise<any> => {
    console.log(
      '🔄 Starting fetchMerchantData with token:',
      token ? 'Token exists' : 'No token',
    );

    try {
      setLoadingStatus(true);
      console.log(
        '🌐 Calling status API endpoint: http://172.20.245.121:5000/api/v0/payout-portal/wallet-setup/sellers/status',
      );

      const response = await fetch(
        'http://172.20.245.121:5000/api/v0/payout-portal/wallet-setup/sellers/status',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log('📡 Status API Response Status:', response.status);

      if (
        response.status === 404 ||
        response.status === 401 ||
        response.status === 403
      ) {
        console.log(
          `⚠️ Status API returned ${response.status} - Token invalid`,
        );
        await handleInvalidToken();
        return null;
      }

      if (response.ok) {
        const data = await response.json();
        console.log('✅ SUCCESS - Merchant data fetched successfully!');
        console.log('📊 Raw API Response:', JSON.stringify(data, null, 2));

        // 🔥 FIX: Extract the actual merchant data from the nested structure
        // API returns { success: true, data: { ...merchantFields } }
        const extractedData = data.data || data;

        console.log(
          '📊 Extracted merchant data:',
          JSON.stringify(extractedData, null, 2),
        );
        console.log('📊 Extracted data keys:', Object.keys(extractedData));

        // Check if extracted data contains the expected fields
        const expectedFields = [
          'status',
          'kycStatus',
          'dob',
          'merchantDID',
          'walletId',
          'merchantName',
          'merchantEmail',
          'merchantPhone',
        ];
        console.log('🔍 Checking expected fields in extracted data:');
        expectedFields.forEach(field => {
          console.log(
            `   - ${field}:`,
            extractedData[field]
              ? `Present (${extractedData[field]})`
              : '❌ Missing',
          );
        });

        setMerchantData(extractedData);
        setHasSavedToken(true);
        console.log('💾 MerchantData state updated with extracted data');
        return extractedData;
      } else {
        console.log(
          '⚠️ Status API returned unexpected status:',
          response.status,
        );
        const errorText = await response.text();
        console.log('⚠️ Error response body:', errorText);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching merchant data:', error);
      return null;
    } finally {
      setLoadingStatus(false);
      console.log('🏁 fetchMerchantData completed, loadingStatus set to false');
    }
  };

  // SDK ready check & token verification
  useEffect(() => {
    console.log(
      '🔄 useEffect triggered, zeptpay:',
      zeptpay ? 'exists' : 'null',
    );

    if (zeptpay) {
      const checkReady = async (): Promise<void> => {
        console.log('🔍 Checking SDK readiness...');
        console.log('🔍 zeptpay.loading:', zeptpay.loading);

        let tries = 0;
        while (zeptpay.loading && tries < 20) {
          console.log(`⏳ Waiting for SDK to load... attempt ${tries + 1}/20`);
          await new Promise<void>(resolve => setTimeout(resolve, 100));
          tries++;
        }

        console.log('✅ SDK ready check complete, isReady set to true');
        setIsReady(true);

        console.log('🔑 Checking for saved token...');
        const token = await tokenService.getToken();
        console.log('🔑 Token found?', token ? 'Yes' : 'No');

        if (token) {
          console.log(
            '🔑 Token exists (first 10 chars):',
            token.substring(0, 10) + '...',
          );
          console.log('🔑 Verifying token with status API...');
          await fetchMerchantData(token);
        } else {
          console.log('🔑 No token found, showing onboarding form');
          setHasSavedToken(false);
        }
      };
      checkReady();
    }
  }, [zeptpay]);

  // Log when merchantData changes
  useEffect(() => {
    console.log('🔄 merchantData state changed:');
    console.log(
      '   Current merchantData:',
      merchantData ? JSON.stringify(merchantData, null, 2) : 'null',
    );
    console.log('   hasSavedToken:', hasSavedToken);
    console.log('   loadingStatus:', loadingStatus);
  }, [merchantData, hasSavedToken, loadingStatus]);

  // Handle logout
  const handleLogout = async (): Promise<void> => {
    console.log('🚪 Logout initiated');
    await tokenService.clearToken();
    setHasSavedToken(false);
    setMerchantData(null);
    console.log('🚪 Token cleared, state reset');
  };

  // If token is invalid, show the form instead of complete screen
  if (tokenInvalid) {
    console.log('🔄 Token invalid state, resetting after timeout');
    setTimeout(() => setTokenInvalid(false), 100);
  }

  // Loading states
  if (
    !zeptpay ||
    zeptpay.loading ||
    !isReady ||
    isSubmitting ||
    merchantLoading ||
    (hasSavedToken && loadingStatus)
  ) {
    console.log('⏳ Loading state active');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0066CC" />
      </View>
    );
  }

  // Invalid configuration state
  if (!zeptpay.isValid) {
    console.log('❌ ZeptPay configuration invalid');
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <Text style={{ color: 'red', fontSize: 16, textAlign: 'center' }}>
          ❌ Invalid ZeptPay configuration
        </Text>
        <Text style={{ marginTop: 10, color: '#666', textAlign: 'center' }}>
          Error: {zeptpay.error || 'Public key verification failed'}
        </Text>
      </View>
    );
  }

  // ✅ Show SDK's OnboardingCompleteScreen if token exists and data is loaded
  if (hasSavedToken && merchantData && !tokenInvalid) {
    console.log(
      '✅ Rendering OnboardingCompleteScreen with extracted data:',
      JSON.stringify(merchantData, null, 2),
    );

    // Verify the data structure before passing to component
    console.log('🔍 Verifying data for UI rendering:');
    console.log('   status:', merchantData.status);
    console.log('   kycStatus:', merchantData.kycStatus);
    console.log('   merchantName:', merchantData.merchantName);
    console.log('   merchantEmail:', merchantData.merchantEmail);
    console.log('   merchantPhone:', merchantData.merchantPhone);
    console.log('   dob:', merchantData.dob);
    console.log('   walletId:', merchantData.walletId);
    console.log('   merchantDID:', merchantData.merchantDID);
    console.log('   image:', merchantData.image);

    return (
      <OnboardingCompleteScreen
        developerData={merchantData}
        loading={false}
        buttons={[
          {
            label: 'wallets',
            onPress: () => navigation.navigate('wallet'),
            backgroundColor: '#0080ff',
            width: '40%',
            height: 50,
            fontSize: 15,
            gap: 8,
            fontWeight: 300,
            marginTop: -20,
            icon: 'contactless-payment',
            iconPosition: 'left',
            // left button left mein
            position: 'absolute',
            left: 20,
          },
          {
            label: 'Transactions',
            onPress: () => navigation.navigate('Transaction'),
            backgroundColor: '#ff0000',
            width: '40%',
            height: 50,
            fontSize: 15,
            gap: -8,
            fontWeight: 300,
            marginTop: -20,
            icon: 'history',
            iconPosition: 'left',
            // right button right mein
            position: 'absolute',
            right: 20,
          },
        ]}
      />
    );
  }

  // 🎯 Submit merged data to backend
  const handleSubmitToBackend = async (formData: FormData): Promise<any> => {
    console.log(
      '📤 Submitting form data to backend:',
      JSON.stringify(formData, null, 2),
    );

    try {
      setIsSubmitting(true);
      const mergedData = { ...fullFormData, ...formData };
      const finalData: FormData = {};
      Object.entries(mergedData).forEach(([k, v]) => {
        if (v !== '' && v != null) finalData[k] = v;
      });

      console.log(
        '📤 Final data to submit:',
        JSON.stringify(finalData, null, 2),
      );

      const response = await fetch(
        'http://172.20.245.121:5000/api/v0/payout-portal/wallet-setup/sellers',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seller: finalData,
            publicKey: zeptpay.publicKey,
          }),
        },
      );

      console.log('📡 Submit response status:', response.status);
      const data = await response.json();
      console.log('📡 Submit response data:', JSON.stringify(data, null, 2));

      if (!response.ok) throw new Error(data.message || 'Backend API failed');

      if (data.token) {
        console.log('🔑 Token received from backend, saving...');
        await tokenService.saveToken(data.token);
        console.log('🔑 Token saved, fetching merchant data...');
        await fetchMerchantData(data.token);
      }

      return data;
    } catch (err: any) {
      console.error('❌ Backend error:', err.message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = (data: FormData, step: number): void => {
    console.log(`➡️ Step ${step} completed with data:`, data);
    setFullFormData(prev => ({ ...prev, ...data }));
  };

  const handleBack = (step: number): void => console.log('⬅️ Back step', step);
  const handleComplete = (merchantData: any): void =>
    console.log('✅ Onboarding complete', merchantData);

  console.log('🔄 Rendering MerchantOnboarding form');
  return (
    <MerchantOnboarding
      mode={(zeptpay.mode as 'test' | 'live') || 'test'}
      isKycCompleted={false}
      isBankDetailsCompleted={false}
      kycStatus="not_submitted"
      status="pending"
      onNext={handleNext}
      onBack={handleBack}
      onComplete={handleComplete}
      onSubmitToBackend={handleSubmitToBackend}
      initialData={{
        merchantName: '',
        businessName: '',
        merchantEmail: '',
        businessType: 'individual',
        country: 'India',
        nationality: 'Indian',
      }}
    />
  );
}
