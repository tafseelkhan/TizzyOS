// services/fws/employeeServices.ts

// ================================
// IMPORTS
// ================================
import employeeAPI from '../../../api/features/private/employeeRegisterPrivateSlice';
import type {
  EmployeeResponse as APIEmployeeResponse,
  EmployeeFormData,
  CheckEmployeeStatusResponse,
} from '../../../api/features/private/employeeRegisterPrivateSlice';

// ================================
// INTERFACES / TYPES
// ================================

export type EmployeeRole =
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'SCANNER'
  | 'PACKER'
  | 'DISPATCHER';

export interface CreateEmployeeData {
  name: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  fwsCode: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  warehouseId?: string;
}

export type EmployeeResponse = APIEmployeeResponse;

export interface EmployeeFormStatus {
  isFormFilled: boolean;
  status:
    | 'NOT_FILLED'
    | 'ACTIVE'
    | 'INACTIVE'
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'SUSPENDED';
  approvalStatus?: string;
  message: string;
  employeeData?: any;
  warehouseData?: any;
  userData?: any;
}

// ================================
// EMPLOYEE SERVICE CLASS
// ================================

export class EmployeeService {
  /**
   * Create new employee - userId backend token se lega
   */
  static async createEmployee(
    data: CreateEmployeeData,
  ): Promise<EmployeeResponse> {
    console.log('📝 [Service] createEmployee ====================');
    console.log('📝 [Service] createEmployee called');
    console.log('📝 [Service] Data:', JSON.stringify(data, null, 2));

    try {
      if (
        !data.name ||
        !data.email ||
        !data.phone ||
        !data.role ||
        !data.fwsCode
      ) {
        console.log('❌ [Service] Missing required fields');
        throw new Error('Missing required fields');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        console.log('❌ [Service] Invalid email format:', data.email);
        throw new Error('Invalid email format');
      }

      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(data.phone)) {
        console.log('❌ [Service] Invalid phone number:', data.phone);
        throw new Error('Phone number must be 10 digits');
      }

      const validRoles: EmployeeRole[] = [
        'MANAGER',
        'SUPERVISOR',
        'SCANNER',
        'PACKER',
        'DISPATCHER',
      ];
      if (!validRoles.includes(data.role)) {
        console.log('❌ [Service] Invalid role:', data.role);
        throw new Error('Invalid role selected');
      }

      const formData: EmployeeFormData = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        fwsCode: data.fwsCode,
        address: data.address,
      };

      console.log('📤 [Service] Calling employeeAPI.createEmployee');
      console.log('📤 [Service] FormData:', JSON.stringify(formData, null, 2));

      const response = await employeeAPI.createEmployee(formData);

      console.log(
        '✅ [Service] Create employee response:',
        JSON.stringify(response, null, 2),
      );
      console.log('📝 [Service] createEmployee ====================');

      return response;
    } catch (error: any) {
      console.error('❌ [Service] Error - createEmployee:', error);
      console.log('📝 [Service] createEmployee ====================');
      throw {
        success: false,
        message: error.message || 'Failed to create employee',
      };
    }
  }

  /**
   * Check employee form status - No parameter needed
   */
  static async checkFormStatus(): Promise<EmployeeFormStatus> {
    console.log('🔍 [Service] checkFormStatus ====================');
    console.log('🔍 [Service] checkFormStatus called');

    try {
      console.log('📤 [Service] Calling employeeAPI.checkEmployeeStatus');

      const response = await employeeAPI.checkEmployeeStatus();

      console.log(
        '📊 [Service] Check status response:',
        JSON.stringify(response, null, 2),
      );

      const responseData = response as any;

      const result = {
        isFormFilled:
          responseData.isFormFilled || responseData.data?.isFormFilled || false,
        status:
          responseData.status || responseData.data?.status || 'NOT_FILLED',
        approvalStatus:
          responseData.approvalStatus || responseData.data?.approvalStatus,
        message:
          responseData.message ||
          responseData.data?.message ||
          'Status checked successfully',
        employeeData: responseData.employeeData || responseData.data?.employee,
        warehouseData:
          responseData.warehouseData || responseData.data?.warehouse,
        userData: responseData.userData || responseData.data?.user,
      };

      console.log(
        '✅ [Service] checkFormStatus result:',
        JSON.stringify(result, null, 2),
      );
      console.log('🔍 [Service] checkFormStatus ====================');

      return result;
    } catch (error: any) {
      console.error('❌ [Service] Error - checkFormStatus:', error);
      console.log('🔍 [Service] checkFormStatus ====================');
      return {
        isFormFilled: false,
        status: 'NOT_FILLED',
        approvalStatus: 'PENDING',
        message: error.message || 'Failed to check form status',
      };
    }
  }

  /**
   * ✅ GET ALL EMPLOYEES - Token se userId lega
   */
  static async getAllEmployees(): Promise<EmployeeResponse> {
    console.log('📦 [Service] getAllEmployees ====================');
    console.log('📦 [Service] getAllEmployees called');

    try {
      const response = await employeeAPI.getAllEmployees();
      console.log(
        '✅ [Service] getAllEmployees response:',
        JSON.stringify(response, null, 2),
      );
      console.log('📦 [Service] getAllEmployees ====================');
      return response;
    } catch (error: any) {
      console.error('❌ [Service] getAllEmployees error:', error);
      console.log('📦 [Service] getAllEmployees ====================');
      throw {
        success: false,
        message: error.message || 'Failed to get all employees',
      };
    }
  }

  /**
   * ✅ GET EMPLOYEE BY NAME AND ROLE
   */
  static async getEmployeeByNameAndRole(
    name: string,
    role: string,
  ): Promise<EmployeeResponse> {
    console.log('🔍 [Service] getEmployeeByNameAndRole ====================');
    console.log('🔍 [Service] getEmployeeByNameAndRole called');
    console.log('🔍 [Service] Name:', name);
    console.log('🔍 [Service] Role:', role);

    try {
      const response = await employeeAPI.getEmployeeByNameAndRole(name, role);
      console.log(
        '✅ [Service] getEmployeeByNameAndRole response:',
        JSON.stringify(response, null, 2),
      );
      console.log('🔍 [Service] getEmployeeByNameAndRole ====================');
      return response;
    } catch (error: any) {
      console.error('❌ [Service] getEmployeeByNameAndRole error:', error);
      console.log('🔍 [Service] getEmployeeByNameAndRole ====================');
      throw {
        success: false,
        message: error.message || 'Failed to get employee by name and role',
      };
    }
  }

  static canPerformAction(status: string): boolean {
    return status === 'ACTIVE' || status === 'APPROVED';
  }

  static getStatusDisplayText(status: string): string {
    const statusMap: Record<string, string> = {
      NOT_FILLED: 'Form Not Filled',
      ACTIVE: 'Active',
      INACTIVE: 'Inactive',
      PENDING: 'Pending Approval',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      SUSPENDED: 'Suspended',
    };
    return statusMap[status] || status;
  }

  static getStatusColor(status: string): string {
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
  }

  static getStatusBgColor(status: string): string {
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
  }

  static getStatusIcon(status: string): string {
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
  }
}

export default EmployeeService;
