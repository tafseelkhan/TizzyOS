// components/EmployeeScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { EmployeeService } from '../../../../services/fws/employeeServices';
import EmployeeForm from './employeeForm';
// ✅ EmployeeStatusCard import hata diya
import Icon from 'react-native-vector-icons/MaterialIcons';

interface EmployeeScreenProps {
  navigation: any;
  route?: any;
}

const EmployeeScreen: React.FC<EmployeeScreenProps> = ({
  navigation,
  route,
}) => {
  const [loading, setLoading] = useState(true);
  const [fwsCode, setFwsCode] = useState<string>('');
  const [employeeData, setEmployeeData] = useState<any>(null);

  useEffect(() => {
    checkEmployeeStatus();
  }, []);

  const checkEmployeeStatus = async () => {
    try {
      setLoading(true);
      console.log('🔍 [Screen] Checking employee status...');

      const result = await EmployeeService.checkFormStatus();

      console.log('📊 [Screen] Employee Status Result:', result);

      // ✅ Sirf employee data aur fwsCode lo
      if (result.employeeData) {
        setEmployeeData(result.employeeData);
      }
      if (result.warehouseData && result.warehouseData.fwsCode) {
        setFwsCode(result.warehouseData.fwsCode);
      }
    } catch (error: any) {
      console.error('❌ [Screen] Error checking status:', error);
      Alert.alert('Error', error.message || 'Failed to check employee status');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      setLoading(true);
      console.log('📝 [Screen] Submitting employee form...');

      const response = await EmployeeService.createEmployee(formData);

      if (response.success) {
        Alert.alert(
          'Success',
          'Employee application submitted successfully!\n\nWaiting for admin approval.',
          [
            {
              text: 'OK',
              onPress: () => {
                // ✅ Status check karo (data update ke liye)
                checkEmployeeStatus();
              },
            },
          ],
        );
      } else {
        Alert.alert(
          'Error',
          response.message || 'Failed to submit application',
        );
      }
    } catch (error: any) {
      console.error('❌ [Screen] Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // ✅ Sirf Form Show Karo
  return (
    <SafeAreaView style={styles.container}>
      <EmployeeForm
        fwsCode={fwsCode}
        onSubmit={handleFormSubmit}
        onCancel={() => navigation.goBack()}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#475569',
  },
});

export default EmployeeScreen;
