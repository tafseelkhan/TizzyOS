/**
 * Copyright (c) 2026-present, TizzyGo, Inc. and its affiliates.
 * All rights reserved.
 */

export const API_ENDPOINTS = {
  // Authentication endpoints
  VERIFY_USER_ROUTE: '/api/v0/auth/check',
  SIGNUP: '/api/v0/auth/signup',
  VERIFY_SIGNUP: '/api/v0/auth/verify-signup',
  LOGIN: '/api/v0/auth/login',
  VERIFY_LOGIN: '/api/v0/auth/verify-login',
  RESEND_OTP: '/api/v0/auth/resend-otp',

  // Account switching endpoints
  SWITCH_ACCOUNT: '/api/v0/auth/switch-account',
  ADD_LINKED_ACCOUNT: '/api/v0/auth/add-linked-account',
  GET_LINKED_ACCOUNTS: '/api/v0/auth/linked-accounts',
  REMOVE_LINKED_ACCOUNT: '/api/v0/auth/remove-linked-account',

  // Profile endpoints
  GET_PROFILE: '/api/v0/profile/me',
  UPDATE_PROFILE: '/api/v0/profile/update',
  DELETE_PROFILE_IMAGE: '/api/v0/profile/delete-image',

  // Fws Warehouse enpoints
  GET_WAREHOUSE_BY_ID: '/api/v0/fws/warehouse/user',
  GET_CHECK_WAREHOUSE: '/api/v0/fws/warehouse/check',
  CREATE_WAREHOUSE: '/api/v0/fws/warehouse/create',

  // Employee enpoints
  CREATE_EMPLOYEE: '/api/v0/fws/employee/create',
  CHECK_EMPLOYEE_STATUS: '/api/v0/fws/employee/check-status',
  GET_EMPLOYEE_BY_NAME_ROLE: '/api/v0/fws/employee',
  GET_ALL_EMPLOYEES: '/api/v0/fws/employee/all',

  // FWS verifyfordispatch api's endpoints
  GET_TRACKING_HISTORY: '/api/v0/tracking/history/status',
  VERIFY_QR_AND_MARK_READY_FOR_DISPATCH:
    '/api/v0/delivery/tracking/shipping/fws/verify-qr',
  FWS_ASSIGN_ORDER: '/api/v0/delivery/tracking/shipping/fws/assign',
  GET_FWS_ORDER: '/api/v0/delivery/tracking/shipping/fws/orders',
  GET_ORDER_BY_ID: '/api/v0/delivery/tracking/shipping/order',

  // Cab driver endpoints
  REGISTER_DRIVER: '/api/v0/cab/driver/register',
  GET_DRIVER_STATUS: '/api/v0/cab/driver',
  GET_VEHICLE_CATEGORIES: '/api/v0/driver/vehicle-categories',
  GET_RIDE_TYPES: '/api/v0/ride-types',

  // Driver online/offline status endpoints
  UPDATE_DRIVER_ONLINE_STATUS: '/api/v0/available/driver/online-status',
  GET_DRIVER_AVAILABLE_STATUS: '/api/v0/available/driver/status',
  TOGGLE_DRIVER_STATUS: '/api/v0/available/driver/toggle-status',
  UPDATE_DRIVER_LOCATION: '/api/v0/update/driver/locations',
};

/**
 * @API_ENDPOINTS contains the API endpoint paths used in the application.
 */

/**
 */
