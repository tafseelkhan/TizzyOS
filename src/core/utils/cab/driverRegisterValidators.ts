// src/utils/validators.ts
import { RegisterDriverRequest } from '../../types/CabTypes';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate driver registration form
 */
export const validateDriverForm = (
  data: RegisterDriverRequest,
): ValidationResult => {
  const errors: ValidationError[] = [];

  // ✅ Licence Number
  if (!data.licenceNumber || data.licenceNumber.trim().length < 8) {
    errors.push({
      field: 'licenceNumber',
      message: 'Licence number must be at least 8 characters',
    });
  }

  // ✅ Licence Expiry Date
  if (!data.licenceExpiryDate) {
    errors.push({
      field: 'licenceExpiryDate',
      message: 'Licence expiry date is required',
    });
  } else {
    const expiryDate = new Date(data.licenceExpiryDate);
    if (isNaN(expiryDate.getTime())) {
      errors.push({
        field: 'licenceExpiryDate',
        message: 'Invalid date format (use YYYY-MM-DD)',
      });
    } else if (expiryDate < new Date()) {
      errors.push({
        field: 'licenceExpiryDate',
        message: 'Licence has already expired',
      });
    }
  }

  // ✅ Documents
  if (!data.licenceFront || data.licenceFront.length < 100) {
    errors.push({
      field: 'licenceFront',
      message: 'Please upload licence front image',
    });
  }

  if (!data.licenceBack || data.licenceBack.length < 100) {
    errors.push({
      field: 'licenceBack',
      message: 'Please upload licence back image',
    });
  }

  if (!data.rcFront || data.rcFront.length < 100) {
    errors.push({
      field: 'rcFront',
      message: 'Please upload RC front image',
    });
  }

  if (!data.rcBack || data.rcBack.length < 100) {
    errors.push({
      field: 'rcBack',
      message: 'Please upload RC back image',
    });
  }

  // ✅ Vehicle Details
  if (!data.vehicleCategoryCode) {
    errors.push({
      field: 'vehicleCategoryCode',
      message: 'Please select vehicle category',
    });
  }

  if (!data.vehicleCompanyCode || data.vehicleCompanyCode.trim().length < 2) {
    errors.push({
      field: 'vehicleCompanyCode',
      message: 'Please enter vehicle company',
    });
  }

  if (!data.vehicleModelCode || data.vehicleModelCode.trim().length < 2) {
    errors.push({
      field: 'vehicleModelCode',
      message: 'Please enter vehicle model',
    });
  }

  if (!data.vehicleNumber || data.vehicleNumber.trim().length < 6) {
    errors.push({
      field: 'vehicleNumber',
      message: 'Please enter valid vehicle number',
    });
  }

  if (!data.vehicleColor || data.vehicleColor.trim().length < 2) {
    errors.push({
      field: 'vehicleColor',
      message: 'Please enter vehicle color',
    });
  }

  // ✅ Manufacturing Year
  if (!data.manufacturingYear) {
    errors.push({
      field: 'manufacturingYear',
      message: 'Manufacturing year is required',
    });
  } else {
    const year = parseInt(data.manufacturingYear, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1900 || year > currentYear) {
      errors.push({
        field: 'manufacturingYear',
        message: `Year must be between 1900 and ${currentYear}`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate email
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Validate vehicle number format
 */
export const isValidVehicleNumber = (number: string): boolean => {
  const regex = /^[A-Z0-9]{6,10}$/;
  return regex.test(number.toUpperCase());
};

/**
 * Format a date string for display
 */
export const formatDisplayDate = (dateString: string | Date): string => {
  if (!dateString) return 'N/A';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};