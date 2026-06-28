export interface WarehouseFormData {
  name: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  managerName: string;
  managerPhone: string;
  fwsType: 'LOCAL' | 'REGIONAL' | 'NATIONAL';
  coverageKm: number;
  maxDailyOrders: number;
}

export interface WarehouseResponse {
  success: boolean;
  message: string;
  data?: any;
  hasSubmitted?: boolean;
  hasWarehouse?: boolean;
}

export interface WarehouseStatus {
  hasSubmitted: boolean;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  warehouseData?: any;
  rejectionReason?: string;
}
