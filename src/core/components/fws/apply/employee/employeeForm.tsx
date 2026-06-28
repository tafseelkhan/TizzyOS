// components/EmployeeForm.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import {
  employeeRoles,
  validateEmployeeForm,
  formatEmployeeData,
} from '../../../../utils/fws/employeeUtils';

interface EmployeeFormProps {
  fwsCode: string;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  fwsCode,
  onSubmit,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'SCANNER' as any,
    fwsCode: fwsCode || '',
    address: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  console.log('📝 [EmployeeForm] Component rendered');
  console.log('📝 [EmployeeForm] fwsCode:', fwsCode);

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleSubmit = async () => {
    console.log('📝 [EmployeeForm] Submit button clicked');
    console.log('📝 [EmployeeForm] Form data:', formData);

    const validation = validateEmployeeForm(formData);

    if (!validation.isValid) {
      // ✅ FIX: Proper error mapping based on error message content
      const errorObj: { [key: string]: string } = {};

      validation.errors.forEach(error => {
        const errorLower = error.toLowerCase();

        if (errorLower.includes('name') || errorLower.includes('full name')) {
          errorObj.name = error;
        } else if (errorLower.includes('email')) {
          errorObj.email = error;
        } else if (
          errorLower.includes('phone') ||
          errorLower.includes('10-digit')
        ) {
          errorObj.phone = error;
        } else if (errorLower.includes('role')) {
          errorObj.role = error;
        } else if (errorLower.includes('fws') || errorLower.includes('code')) {
          errorObj.fwsCode = error;
        }
      });

      setErrors(errorObj);

      // Show first error in alert
      const firstError = validation.errors[0] || 'Please fix all errors';
      Alert.alert('Validation Error', firstError);
      return;
    }

    try {
      setLoading(true);
      const formattedData = formatEmployeeData(formData);

      console.log('📤 [EmployeeForm] Calling onSubmit with:', formattedData);

      if (typeof onSubmit !== 'function') {
        console.error('❌ [EmployeeForm] onSubmit is not a function!');
        Alert.alert('Error', 'Submit function is not available');
        return;
      }

      await onSubmit(formattedData);
      console.log('✅ [EmployeeForm] onSubmit completed successfully');
    } catch (error: any) {
      console.error('❌ [EmployeeForm] Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employee Registration</Text>
      </View>

      <View style={styles.form}>
        {/* ✅ Name Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Full Name <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View
            style={[styles.inputContainer, errors.name && styles.inputError]}
          >
            <Icon
              name="person"
              size={20}
              color={errors.name ? '#EF4444' : '#94A3B8'}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter full name"
              placeholderTextColor="#94A3B8"
              value={formData.name}
              onChangeText={text => handleChange('name', text)}
            />
          </View>
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* ✅ Email Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Email Address <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View
            style={[styles.inputContainer, errors.email && styles.inputError]}
          >
            <Icon
              name="email"
              size={20}
              color={errors.email ? '#EF4444' : '#94A3B8'}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={text => handleChange('email', text)}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        {/* ✅ Phone Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Phone Number <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View
            style={[styles.inputContainer, errors.phone && styles.inputError]}
          >
            <Icon
              name="phone"
              size={20}
              color={errors.phone ? '#EF4444' : '#94A3B8'}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter 10-digit phone number"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={10}
              value={formData.phone}
              onChangeText={text => handleChange('phone', text)}
            />
          </View>
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        {/* ✅ Role Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Role <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View
            style={[styles.inputContainer, errors.role && styles.inputError]}
          >
            <Icon
              name="badge"
              size={20}
              color={errors.role ? '#EF4444' : '#94A3B8'}
              style={styles.inputIcon}
            />
            <Picker
              selectedValue={formData.role}
              onValueChange={value => handleChange('role', value)}
              style={styles.picker}
              dropdownIconColor="#94A3B8"
            >
              {employeeRoles.map(role => (
                <Picker.Item
                  key={role.value}
                  label={role.label}
                  value={role.value}
                />
              ))}
            </Picker>
          </View>
          {errors.role && <Text style={styles.errorText}>{errors.role}</Text>}
        </View>

        {/* ✅ FWS Code Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            FWS Code <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View
            style={[styles.inputContainer, errors.fwsCode && styles.inputError]}
          >
            <Icon
              name="store"
              size={20}
              color={errors.fwsCode ? '#EF4444' : '#94A3B8'}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter FWS Code"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              value={formData.fwsCode}
              onChangeText={text => handleChange('fwsCode', text)}
              editable={!fwsCode}
            />
          </View>
          {errors.fwsCode && (
            <Text style={styles.errorText}>{errors.fwsCode}</Text>
          )}
        </View>

        {/* ✅ Address Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address</Text>
          <View style={styles.inputContainer}>
            <Icon
              name="home"
              size={20}
              color="#94A3B8"
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter address (optional)"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={formData.address}
              onChangeText={text => handleChange('address', text)}
            />
          </View>
        </View>

        {/* ✅ Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.submitButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Icon name="send" size={20} color="#FFF" />
                <Text style={styles.submitButtonText}>Submit</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Fields marked with <Text style={styles.requiredStar}>*</Text> are
          required
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 12,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1E293B',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  picker: {
    flex: 1,
    height: 48,
    color: '#1E293B',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    marginLeft: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
});

export default EmployeeForm;
