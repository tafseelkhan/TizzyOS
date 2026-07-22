// core/types/CabTypes.ts

export interface RideType {
  name: string;
  code: string;
  description: string;
  vehicleClasses: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface Model {
  name: string;
  code: string;
  vehicleType: string;
  vehicleClass: string;
  baseFare: number;
  classFare: number;
  maxPassengers: number;
  hasAC: boolean;
  luggageCapacity: number;
  handBagCapacity: number;
  seatCapacity: number;
  passengerCapacity: number;
}

export interface Company {
  name: string;
  code: string;
  models: Model[];
}

export interface VehicleCategory {
  category: string;
  code: string;
  companies: Company[];
}

export interface RegisterDriverRequest {
  rideTypeCode: string;
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
    driverCode: string;
    status: string;
    rideType?: string;
    vehicle?: {
      name: string;
      type: string;
      class: string;
    };
  };
  errors?: Array<{ field: string; message: string }>;
}

export interface RideDriver {
  _id: string;
  userId: string;
  driverCode: string;
  rideTypeCode: string;
  status: DriverStatus;
  licenceNumber: string;
  licenceExpiryDate: string;
  licenceFront: string;
  licenceBack: string;
  vehicle: {
    categoryCode: string;
    companyCode: string;
    modelCode: string;
    vehicleNumber: string;
    vehicleColor: string;
    manufacturingYear: number;
    vehicleType: string;
    vehicleClass: string;
    baseFare: number;
    classFare: number;
    maxPassengers: number;
    hasAC: boolean;
    luggageCapacity: number;
    handBagCapacity: number;
    seatCapacity: number;
    passengerCapacity: number;
  };
  documents: {
    rcFront: string;
    rcBack: string;
    insurance: string;
    pollutionCertificate: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GetDriverResponse {
  success: boolean;
  message: string;
  data: RideDriver;
}

export interface VehicleCategoryResponse {
  success: boolean;
  message: string;
  data: VehicleCategory[];
}

export interface FilteredVehicleCategoriesResponse {
  success: boolean;
  message: string;
  data: {
    rideType: RideType;
    categories: VehicleCategory[];
  };
}

export interface RideTypesResponse {
  success: boolean;
  message: string;
  data: RideType[];
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

export type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

// ✅ Status Labels
export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  pending: 'Pending Verification',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};
