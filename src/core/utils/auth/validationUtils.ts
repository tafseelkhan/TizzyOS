// utils/validationUtils.ts

interface ValidationErrors {
  name?: string;
  emailOrPhone?: string;
}

export const validateEmailOrPhone = (value: string): boolean => {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isPhone = /^\d{10,}$/.test(value); // Basic phone validation
  return isEmail || isPhone;
};

export const validateName = (name: string): boolean => {
  return name.trim().length >= 2;
};

export const validateSignupForm = (
  name: string,
  emailOrPhone: string,
): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!name || name.trim().length === 0) {
    errors.name = 'Please enter your name';
  } else if (name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!emailOrPhone || emailOrPhone.trim().length === 0) {
    errors.emailOrPhone = 'Please enter your email or phone';
  } else if (!validateEmailOrPhone(emailOrPhone)) {
    errors.emailOrPhone = 'Please enter a valid email or phone number';
  }

  return errors;
};

export const isPhoneNumber = (value: string): boolean => {
  return /^\d+$/.test(value);
};

export const isEmail = (value: string): boolean => {
  return value.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const formatIdentifier = (identifier: string): string => {
  if (isEmail(identifier)) {
    return identifier.toLowerCase().trim();
  }
  return identifier.trim();
};

export const validateOTP = (otp: string): boolean => {
  return /^\d{6}$/.test(otp);
};
