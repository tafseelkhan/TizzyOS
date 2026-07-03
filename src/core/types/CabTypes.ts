// ============================================
// 🚗 VEHICLE CATEGORY TYPES
// ============================================

export interface VehicleModel {
  name: string;
  code: string;
  vehicleType: string;
  class: string;
  baseFare: number;
  classFare: number;
  maxPassengers: number;
}

export interface VehicleCompany {
  name: string;
  code: string;
  models: VehicleModel[];
}

export interface VehicleCategory {
  category: string;
  code: string;
  companies: VehicleCompany[];
}

export interface VehicleCategoryResponse {
  success: boolean;
  message: string;
  data?: VehicleCategory[];
}

// ============================================
// 🚕 DRIVER TYPES
// ============================================

export interface Vehicle {
  categoryCode: string;
  companyCode: string;
  modelCode: string;
  vehicleNumber: string;
  vehicleColor: string;
  manufacturingYear: number;
}

export interface DriverDocuments {
  rcFront: string;
  rcBack: string;
  insurance?: string;
  pollutionCertificate?: string;
}

export interface RideDriver {
  id: string;
  userId: string;
  driverCode: string;
  licenceNumber: string;
  licenceExpiryDate: string;
  licenceFront: string;
  licenceBack: string;
  vehicle: Vehicle;
  documents: DriverDocuments;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface RegisterDriverRequest {
  licenceNumber: string;
  licenceExpiryDate: string;
  licenceFront: string;
  licenceBack: string;
  vehicleCategoryCode: string;
  vehicleCompanyCode: string;
  vehicleModelCode: string;
  vehicleNumber: string;
  vehicleColor: string;
  manufacturingYear: string;
  rcFront: string;
  rcBack: string;
  insurance?: string;
  pollutionCertificate?: string;
}

export interface RegisterDriverResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    userId: string;
    driverCode: string;
    licenceNumber: string;
    vehicleNumber: string;
    status: string;
    createdAt: string;
  };
  errors?: Array<{ field: string; message: string }>;
}

export interface GetDriverResponse {
  success: boolean;
  message: string;
  data?: RideDriver;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  hint?: string;
}

export type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

// ✅ Static categories for fallback
export const VEHICLE_CATEGORIES = [
  { code: 'SEDAN', label: 'Sedan' },
  { code: 'SUV', label: 'SUV' },
  { code: 'HATCHBACK', label: 'Hatchback' },
  { code: 'MUV', label: 'MUV' },
  { code: 'COUPE', label: 'Coupe' },
  { code: 'CONVERTIBLE', label: 'Convertible' },
  { code: 'MINI', label: 'Mini' },
  { code: 'VAN', label: 'Van' },
];

export const DRIVER_STATUS_COLORS: Record<DriverStatus, string> = {
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
  suspended: '#6B7280',
};

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  pending: 'Pending Verification',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};
