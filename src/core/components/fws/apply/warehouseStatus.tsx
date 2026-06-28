import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { WarehouseStatus as IWarehouseStatus } from '../../../types/WarehouseTypes';

interface Props {
  status: IWarehouseStatus | null;
  warehouseData: any;
}

const WarehouseStatus: React.FC<Props> = ({ status, warehouseData }) => {
  const getStatusIcon = () => {
    switch (status?.approvalStatus) {
      case 'APPROVED':
        return <Icon name="check-circle" size={60} color="#4CAF50" />;
      case 'REJECTED':
        return <Icon name="cancel" size={60} color="#f44336" />;
      default:
        return <Icon name="pending" size={60} color="#FF9800" />;
    }
  };

  const getStatusColor = () => {
    switch (status?.approvalStatus) {
      case 'APPROVED':
        return '#4CAF50';
      case 'REJECTED':
        return '#f44336';
      default:
        return '#FF9800';
    }
  };

  const getStatusText = () => {
    switch (status?.approvalStatus) {
      case 'APPROVED':
        return 'Application Approved';
      case 'REJECTED':
        return 'Application Rejected';
      default:
        return 'Application Pending';
    }
  };

  if (!warehouseData) {
    return (
      <View style={styles.container}>
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>{getStatusIcon()}</View>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
          <Text style={styles.statusMessage}>Loading warehouse details...</Text>
        </View>
      </View>
    );
  }

  // ✅ Helper function to get value from formData or root
  const getValue = (rootKey: string, formDataKey?: string) => {
    const value = warehouseData[rootKey];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
    if (warehouseData.formData) {
      const formValue = warehouseData.formData[formDataKey || rootKey];
      if (formValue !== undefined && formValue !== null && formValue !== '') {
        return formValue;
      }
    }
    return 'N/A';
  };

  return (
    <ScrollView style={styles.container}>
      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusIcon}>{getStatusIcon()}</View>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
        {status?.approvalStatus === 'PENDING' && (
          <Text style={styles.statusMessage}>
            Your warehouse application is under review. We'll notify you once
            it's approved.
          </Text>
        )}
        {status?.approvalStatus === 'REJECTED' && status.rejectionReason && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionTitle}>Rejection Reason:</Text>
            <Text style={styles.rejectionText}>{status.rejectionReason}</Text>
          </View>
        )}
        {status?.approvalStatus === 'APPROVED' && (
          <Text style={styles.statusMessage}>
            Congratulations! Your warehouse has been approved and is now active.
          </Text>
        )}
      </View>

      {/* Warehouse Details */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Warehouse Details</Text>

        {/* ✅ FWS Code - Root level */}
        <View style={styles.detailItem}>
          <Icon name="store" size={20} color="#666" />
          <Text style={styles.detailLabel}>FWS Code:</Text>
          <Text style={styles.detailValue}>
            {warehouseData.fwsCode || 'N/A'}
          </Text>
        </View>

        {/* ✅ Name - Root level */}
        <View style={styles.detailItem}>
          <Icon name="business" size={20} color="#666" />
          <Text style={styles.detailLabel}>Name:</Text>
          <Text style={styles.detailValue}>{warehouseData.name || 'N/A'}</Text>
        </View>

        {/* ✅ Location - Root level city/state, formData pincode */}
        <View style={styles.detailItem}>
          <Icon name="location-on" size={20} color="#666" />
          <Text style={styles.detailLabel}>Location:</Text>
          <Text style={styles.detailValue}>
            {warehouseData.city || 'N/A'}, {warehouseData.state || 'N/A'} -{' '}
            {getValue('pincode')}
          </Text>
        </View>

        {/* ✅ Address - formData */}
        <View style={styles.detailItem}>
          <Icon name="home" size={20} color="#666" />
          <Text style={styles.detailLabel}>Address:</Text>
          <Text style={styles.detailValue}>{getValue('address')}</Text>
        </View>

        {/* ✅ Phone - formData */}
        <View style={styles.detailItem}>
          <Icon name="phone" size={20} color="#666" />
          <Text style={styles.detailLabel}>Phone:</Text>
          <Text style={styles.detailValue}>{getValue('phone')}</Text>
        </View>

        {/* ✅ Email - formData */}
        <View style={styles.detailItem}>
          <Icon name="email" size={20} color="#666" />
          <Text style={styles.detailLabel}>Email:</Text>
          <Text style={styles.detailValue}>{getValue('email')}</Text>
        </View>

        {/* ✅ Manager Name - formData */}
        <View style={styles.detailItem}>
          <Icon name="person" size={20} color="#666" />
          <Text style={styles.detailLabel}>Manager:</Text>
          <Text style={styles.detailValue}>{getValue('managerName')}</Text>
        </View>

        {/* ✅ Manager Phone - formData */}
        <View style={styles.detailItem}>
          <Icon name="phone-android" size={20} color="#666" />
          <Text style={styles.detailLabel}>Manager Phone:</Text>
          <Text style={styles.detailValue}>{getValue('managerPhone')}</Text>
        </View>

        {/* ✅ FWS Type - formData */}
        <View style={styles.detailItem}>
          <Icon name="category" size={20} color="#666" />
          <Text style={styles.detailLabel}>Type:</Text>
          <Text style={styles.detailValue}>{getValue('fwsType')}</Text>
        </View>

        {/* ✅ Coverage - Root level */}
        <View style={styles.detailItem}>
          <Icon name="near-me" size={20} color="#666" />
          <Text style={styles.detailLabel}>Coverage:</Text>
          <Text style={styles.detailValue}>
            {warehouseData.coverageKm || '0'} km
          </Text>
        </View>

        {/* ✅ Status - Root level */}
        <View style={styles.detailItem}>
          <Icon name="info" size={20} color="#666" />
          <Text style={styles.detailLabel}>Status:</Text>
          <Text style={[styles.detailValue, { color: getStatusColor() }]}>
            {warehouseData.status || 'N/A'}
          </Text>
        </View>

        {/* ✅ Created At - Root level */}
        <View style={styles.detailItem}>
          <Icon name="event" size={20} color="#666" />
          <Text style={styles.detailLabel}>Created:</Text>
          <Text style={styles.detailValue}>
            {warehouseData.createdAt
              ? new Date(warehouseData.createdAt).toLocaleDateString()
              : 'N/A'}
          </Text>
        </View>

        {/* ✅ Approved At - Root level */}
        {warehouseData.approvedAt && (
          <View style={styles.detailItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.detailLabel}>Approved On:</Text>
            <Text style={styles.detailValue}>
              {new Date(warehouseData.approvedAt).toLocaleDateString()}
            </Text>
          </View>
        )}

        {/* ✅ User Info - Root level user object */}
        {warehouseData.user && (
          <>
            <View style={styles.sectionDivider} />
            <Text style={styles.subTitle}>User Information</Text>

            <View style={styles.detailItem}>
              <Icon name="person" size={20} color="#666" />
              <Text style={styles.detailLabel}>Name:</Text>
              <Text style={styles.detailValue}>
                {warehouseData.user.name || 'N/A'}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Icon name="email" size={20} color="#666" />
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>
                {warehouseData.user.email || 'N/A'}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Icon name="phone" size={20} color="#666" />
              <Text style={styles.detailLabel}>Phone:</Text>
              <Text style={styles.detailValue}>
                {warehouseData.user.phone || 'N/A'}
              </Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusIcon: {
    marginBottom: 15,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  statusMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  rejectionBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#ffebee',
    borderRadius: 10,
    width: '100%',
  },
  rejectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 5,
  },
  rejectionText: {
    fontSize: 14,
    color: '#d32f2f',
  },
  detailsCard: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    paddingLeft: 10,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 5,
    marginBottom: 10,
    paddingLeft: 5,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginLeft: 10,
    width: 105,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 5,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
});

export default WarehouseStatus;
