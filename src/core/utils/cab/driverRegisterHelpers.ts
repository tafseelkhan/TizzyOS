// src/utils/helpers.ts
import { Platform } from 'react-native';
import moment from 'moment';

/**
 * Format date to YYYY-MM-DD
 */
export const formatDate = (date: Date | string): string => {
  return moment(date).format('YYYY-MM-DD');
};

/**
 * Format date for display
 */
export const formatDisplayDate = (date: Date | string): string => {
  return moment(date).format('DD MMM YYYY');
};

/**
 * Get current date in YYYY-MM-DD
 */
export const getTodayDate = (): string => {
  return moment().format('YYYY-MM-DD');
};

/**
 * Check if date is valid
 */
export const isValidDate = (date: string): boolean => {
  return moment(date, 'YYYY-MM-DD', true).isValid();
};

/**
 * Get file extension from base64
 */
export const getFileExtensionFromBase64 = (base64: string): string => {
  const match = base64.match(/^data:image\/(\w+);base64,/);
  return match ? match[1] : 'jpg';
};

/**
 * Generate random string
 */
export const generateRandomString = (length: number = 8): string => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Capitalize first letter
 */
export const capitalizeFirstLetter = (text: string): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Format currency
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};
