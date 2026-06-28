/**
 * Copyright (c) 2026-present, TizzyGo, Inc. and its affiliates.
 * All rights reserved.
 */

export const API_ENDPOINTS = {
  // Authentication endpoints
  VERIFY_USER_ROUTE: '/api/auth/check',
  SIGNUP: '/api/auth/signup',
  VERIFY_SIGNUP: '/api/auth/verify-signup',
  LOGIN: '/api/auth/login',
  VERIFY_LOGIN: '/api/auth/verify-login',
  RESEND_OTP: '/api/auth/resend-otp',

  // Account switching endpoints
  SWITCH_ACCOUNT: '/api/auth/switch-account',
  ADD_LINKED_ACCOUNT: '/api/auth/add-linked-account',
  GET_LINKED_ACCOUNTS: '/api/auth/linked-accounts',
  REMOVE_LINKED_ACCOUNT: '/api/auth/remove-linked-account',

  // Profile endpoints
  GET_PROFILE: '/api/profile/me',
  UPDATE_PROFILE: '/api/profile/update',
  DELETE_PROFILE_IMAGE: '/api/profile/delete-image',

  // Fws Warehouse enpoints
  GET_WAREHOUSE_BY_ID: '/api/fws/warehouse/user',
  GET_CHECK_WAREHOUSE: '/api/fws/warehouse/check',
  CREATE_WAREHOUSE: '/api/fws/warehouse/create',

  // Employee enpoints
  CREATE_EMPLOYEE: '/api/fws/employee/create',
  CHECK_EMPLOYEE_STATUS: '/api/fws/employee/check-status',
  GET_EMPLOYEE_BY_NAME_ROLE: '/api/fws/employee',
  GET_ALL_EMPLOYEES: '/api/fws/employee/all',

  // FWS verifyfordispatch api's endpoints
  GET_TRACKING_HISTORY: '/api/tracking/history/status',
  VERIFY_QR_AND_MARK_READY_FOR_DISPATCH:
    '/api/delivery/tracking/shipping/fws/verify-qr',
  FWS_ASSIGN_ORDER: '/api/delivery/tracking/shipping/fws/assign',
  GET_FWS_ORDER: '/api/delivery/tracking/shipping/fws/orders',
  GET_ORDER_BY_ID: '/api/delivery/tracking/shipping/order',
};

/**
 * @API_ENDPOINTS contains the API endpoint paths used in the application.
 */

/**
 */
