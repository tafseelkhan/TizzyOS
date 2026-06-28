// utils/fws/employeeUtils.ts

export interface EmployeeRoleOption {
  label: string;
  value: 'MANAGER' | 'SUPERVISOR' | 'SCANNER' | 'PACKER' | 'DISPATCHER';
}

export const employeeRoles: EmployeeRoleOption[] = [
  { label: 'Manager', value: 'MANAGER' },
  { label: 'Supervisor', value: 'SUPERVISOR' },
  { label: 'Scanner', value: 'SCANNER' },
  { label: 'Packer', value: 'PACKER' },
  { label: 'Dispatcher', value: 'DISPATCHER' },
];

export interface EmployeeFormData {
  name: string;
  email: string;
  phone: string;
  role: string;
  fwsCode: string;
  address?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// ✅ FIX: Validation function - Saare fields ki alag validation
export const validateEmployeeForm = (data: any): ValidationResult => {
  const errors: string[] = [];

  // 1. ✅ Name validation
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Please enter a valid full name (minimum 2 characters)');
  }

  // 2. ✅ Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email.trim())) {
    errors.push('Please enter a valid email address');
  }

  // 3. ✅ Phone validation - ALAG SE
  const phoneRegex = /^[0-9]{10}$/;
  if (!data.phone || !phoneRegex.test(data.phone.trim())) {
    errors.push('Please enter a valid 10-digit phone number');
  }

  // 4. ✅ Role validation
  const validRoles = [
    'MANAGER',
    'SUPERVISOR',
    'SCANNER',
    'PACKER',
    'DISPATCHER',
  ];
  if (!data.role || !validRoles.includes(data.role)) {
    errors.push('Please select a valid role');
  }

  // 5. ✅ FWS Code validation
  if (!data.fwsCode || data.fwsCode.trim().length < 5) {
    errors.push('Please enter a valid FWS Code (minimum 5 characters)');
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
};

// ✅ Format employee data for API
export const formatEmployeeData = (data: any) => {
  return {
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    role: data.role,
    fwsCode: data.fwsCode.trim().toUpperCase(),
    address: data.address ? data.address.trim() : '',
  };
};

// ✅ Get status display text
export const getEmployeeStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    NOT_FILLED: 'Not Filled',
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    PENDING: 'Pending Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    SUSPENDED: 'Suspended',
  };
  return statusMap[status] || status;
};

// ✅ Get status color
export const getEmployeeStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    NOT_FILLED: '#94A3B8',
    ACTIVE: '#10B981',
    INACTIVE: '#EF4444',
    PENDING: '#F59E0B',
    APPROVED: '#10B981',
    REJECTED: '#EF4444',
    SUSPENDED: '#EF4444',
  };
  return colorMap[status] || '#94A3B8';
};

// ✅ Get status background color
export const getEmployeeStatusBgColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    NOT_FILLED: '#F1F5F9',
    ACTIVE: '#D1FAE5',
    INACTIVE: '#FEE2E2',
    PENDING: '#FEF3C7',
    APPROVED: '#D1FAE5',
    REJECTED: '#FEE2E2',
    SUSPENDED: '#FEE2E2',
  };
  return colorMap[status] || '#F1F5F9';
};

// ✅ Get status icon
export const getEmployeeStatusIcon = (status: string): string => {
  const iconMap: Record<string, string> = {
    NOT_FILLED: 'file',
    ACTIVE: 'check-circle',
    INACTIVE: 'times-circle',
    PENDING: 'clock',
    APPROVED: 'check-circle',
    REJECTED: 'times-circle',
    SUSPENDED: 'exclamation-circle',
  };
  return iconMap[status] || 'file';
};

// ✅ Get employee status UI object
export const getEmployeeStatusUI = (status: string) => {
  return {
    text: getEmployeeStatusText(status),
    color: getEmployeeStatusColor(status),
    bgColor: getEmployeeStatusBgColor(status),
    icon: getEmployeeStatusIcon(status),
  };
};
