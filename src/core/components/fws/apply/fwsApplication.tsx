import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { WarehouseService } from '../../../services/fws/fwsWarehouseFormServices';
import WarehouseForm from './warehouseForm';
import WarehouseStatus from './warehouseStatus';
import { WarehouseStatus as IWarehouseStatus } from '../../../types/WarehouseTypes';

const FWSApplyScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [warehouseData, setWarehouseData] = useState<any>(null);
  const [status, setStatus] = useState<IWarehouseStatus | null>(null);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    checkSubmissionStatus();
  }, []);

  const checkSubmissionStatus = async () => {
    try {
      setLoading(true);
      const currentUserId = await WarehouseService.getCurrentUserId();
      setUserId(currentUserId);

      // ✅ Step 1: checkWarehouseStatus se status check
      const submissionStatus = await WarehouseService.checkUserSubmission(
        currentUserId,
      );

      setStatus(submissionStatus);
      setHasSubmitted(submissionStatus.hasSubmitted);

      // ✅ Step 2: Agar submit kiya hai toh getWarehouseByUserId se FULL DATA lo
      if (submissionStatus.hasSubmitted) {
        const data = await WarehouseService.getWarehouseDetails(currentUserId);
        setWarehouseData(data);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkSubmissionStatus();
    setRefreshing(false);
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      setLoading(true);
      const response = await WarehouseService.submitWarehouse(userId, formData);

      if (response.success) {
        setHasSubmitted(true);
        setWarehouseData(response.data);
        setStatus({
          hasSubmitted: true,
          approvalStatus: response.data.approvalStatus,
          status: response.data.status,
          warehouseData: response.data,
        });
      }
    } catch (error: any) {
      console.error('Form submission error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {!hasSubmitted ? (
        <WarehouseForm onSubmit={handleFormSubmit} />
      ) : (
        <WarehouseStatus status={status} warehouseData={warehouseData} />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default FWSApplyScreen;
