import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE_URL = 'http://172.20.245.121:5000'; // Replace with your actual API URL

// Define a proper file interface for React Native
export interface FileObject {
  uri: string;
  type?: string;
  name?: string;
}

export interface SellerApplicationData {
  fullName: string;
  email: string;
  phone: string;
  fullAddress: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  shopName: string;
  gstNumber?: string;
  category: string;
  subcategories: string[];
  aadhaarFront?: FileObject;
  aadhaarBack?: FileObject;
  panFront?: FileObject;
  panBack?: FileObject;
  selfieWithDoc?: FileObject;
  businessDocument?: FileObject;
  gstCertificate?: FileObject;
}

export interface ApiResponse {
  success: boolean;
  message: string;
  status?: string;
  applicationId?: string;
  error?: any;
}

class SellerApplicationAPI {
  private async getAuthHeaders() {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    };
  }

  private async getToken(): Promise<string> {
    try {
      // AsyncStorage se token le rahe hain
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No token found');
      }
      return token;
    } catch (error) {
      console.error('Error getting token:', error);
      throw error;
    }
  }

  // Helper function to get file name from URI
  private getFileNameFromUri(uri: string): string {
    return uri.split('/').pop() || 'file.jpg';
  }

  // Helper function to get file type from URI
  private getFileTypeFromUri(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'image/jpeg';
    }
  }

  async submitApplication(
    formData: SellerApplicationData,
  ): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeaders();

      const data = new FormData();

      // Add text fields
      data.append('fullName', formData.fullName);
      data.append('email', formData.email);
      data.append('phone', formData.phone);
      data.append('fullAddress', formData.fullAddress);
      data.append('city', formData.city);
      data.append('state', formData.state);
      data.append('country', formData.country);
      data.append('pincode', formData.pincode);
      data.append('shopName', formData.shopName);
      data.append('category', formData.category);
      data.append('subcategories', JSON.stringify(formData.subcategories));

      // Optional fields
      if (formData.gstNumber) {
        data.append('gstNumber', formData.gstNumber);
      }

      // Helper function to append files - CORRECTED FOR REACT NATIVE
      const appendFile = (
        fieldName: string,
        file: FileObject | undefined,
        defaultName: string,
      ) => {
        if (file && file.uri) {
          // React Native mein yeh syntax use karo
          const fileName = file.name || defaultName;
          const fileType = file.type || this.getFileTypeFromUri(file.uri);
          const fileUri = file.uri;

          // For React Native, we need to handle file URI properly
          if (Platform.OS === 'ios') {
            // iOS: Remove 'file://' prefix if present
            const normalizedUri = fileUri.replace('file://', '');
            data.append(fieldName, {
              uri: normalizedUri,
              type: fileType,
              name: fileName,
            } as any);
          } else {
            // Android: Keep the URI as is
            data.append(fieldName, {
              uri: fileUri,
              type: fileType,
              name: fileName,
            } as any);
          }
        }
      };

      // Add files using the helper function
      appendFile('aadhaarFront', formData.aadhaarFront, 'aadhaar_front.jpg');
      appendFile('aadhaarBack', formData.aadhaarBack, 'aadhaar_back.jpg');
      appendFile('panFront', formData.panFront, 'pan_front.jpg');
      appendFile('panBack', formData.panBack, 'pan_back.jpg');
      appendFile('selfieWithDoc', formData.selfieWithDoc, 'selfie.jpg');
      appendFile(
        'businessDocument',
        formData.businessDocument,
        'business_document.pdf',
      );
      appendFile(
        'gstCertificate',
        formData.gstCertificate,
        'gst_certificate.pdf',
      );

      const response = await axios.post(
        `${API_BASE_URL}/api/v0/seller/apply`,
        data,
        {
          headers,
          // Important: Don't set Content-Type header manually for FormData
          // Let axios set it automatically with boundary
          transformRequest: (data, headers) => {
            return data;
          },
        },
      );

      return response.data;
    } catch (error: any) {
      console.error('API Error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to submit application',
        error: error.response?.data,
      };
    }
  }

  async getApplicationStatus(): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/api/v0/seller/apply`, {
        headers,
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to fetch application status',
      };
    }
  }
}

export const sellerApplicationAPI = new SellerApplicationAPI();
