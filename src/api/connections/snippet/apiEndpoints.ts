/**
 * Copyright (c) 2026-present, TizzyGo, Inc. and its affiliates.
 * All rights reserved.
 */

export const API_ENDPOINTS = {
  // Authentication endpoints
  ME: '/api/v0/auth/me',
  SIGNUP: '/api/v0/auth/signup',
  VERIFY_PHONE: '/api/v0/auth/verify-phone',
  LOGIN: '/api/v0/auth/login',
  LOGIN_VERIFY_OTP: '/api/v0/auth/login/verify-otp',
  FORGOT_PASSWORD: '/api/v0/auth/forgot-password',
  FORGOT_PASSWORD_VERIFY_OTP: '/api/v0/auth/forgot-password/verify-otp',
  FORGOT_PASSWORD_RESET: '/api/v0/auth/forgot-password/reset',
  RESEND_OTP: '/api/v0/auth/resend-otp',
  REFRESH: '/api/v0/auth/refresh',
  LOGOUT: '/api/v0/auth/logout',

  // ✅ NEW — User theme
  USER_THEME: '/api/v0/user/theme',
  GET_SELLER_PRODUCTS: '/api/v0/seller/forms/categories/user',
  DELETE_SELLER_PRODUCT: '/api/v0/delete/product',

  // ✅ NEW — AirX Pay seller onboarding
  CREATE_AIRX_SELLER_ACCOUNT: '/api/payout-portal/wallet/seller/create',
  GET_AIRX_ONBOARDING_LINK: '/api/seller', // appended with /:sellerId/onboarding-link
  CHECK_AIRX_ACCOUNT_STATUS: '/api/seller', // appended with /:sellerId/status

  // ✅ NEW — Seller orders + tracking
  GET_SELLER_ORDERS: '/api/v0/seller/orders',
  GET_ORDER_QR: '/api/v0/delivery/tracking', // + /:orderId/qr
  SELLER_ACCEPT_ORDER: '/api/v0/delivery/tracking/shipping/seller/accept-order',
  SELLER_ASSIGN_SHIPPING:
    '/api/v0/delivery/tracking/shipping/seller/assign/auto-manual',
  SELLER_DELIVER_TO_FWS:
    '/api/v0/delivery/tracking/shipping/seller/deliver-to-fws',

  // ✅ NEW — Profile management (Quton Connect)
  UPDATE_BASIC_PROFILE: '/api/v0/auth/profile',
  UPDATE_APP_ROLE: '/api/v0/auth/profile/app-role',
  REQUEST_RECOVERY_CONNECT_UPDATE: '/api/v0/auth/profile/recovery-connect',
  VERIFY_RECOVERY_CONNECT_UPDATE:
    '/api/v0/auth/profile/recovery-connect/verify-otp',
  REQUEST_PHONE_CHANGE_OTP: '/api/v0/auth/profile/change-phone/request-otp',
  VERIFY_PHONE_CHANGE_OTP: '/api/v0/auth/profile/change-phone/verify-otp',

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
  GET_SHIPPING_BY_ID: '/api/v0/shipping',

    // ✅ NEW — Pending orders / delivery partner
  GET_MY_ASSIGNED_ORDERS: '/api/v0/delivery/tracking/shipping/my-orders',
  ACCEPT_ASSIGNMENT:
    '/api/v0/delivery/tracking/shipping/accept-assignment',
  HANDOVER_VIA_QR_DELIVERY:
    '/api/v0/delivery/tracking/shipping/handover/via/qr',
  INITIATE_DELIVERY: '/api/v0/buyer/order/initiate-delivery',
  VERIFY_DELIVERY_OTP: '/api/v0/buyer/order/deliver-with-otp',
  REQUEST_DELIVERY_OTP: '/api/v0/buyer/order/request-otp',
  GET_TRACKING_STATUS: '/api/v0/tracking/history/status',

    // ✅ NEW — Product form
  CALCULATE_PRODUCT_PRICING: '/api/v0/seller/product/price-calculation',
  GET_PRODUCT_CATEGORIES: '/api/v0/categories',
  GET_UPLOAD_URL: '/api/v0/upload/get-upload-url',
  CREATE_PRODUCT: '/api/v0/seller/forms/categories/products',

  // Employee enpoints
  CREATE_EMPLOYEE: '/api/v0/fws/employee/create',
  CHECK_EMPLOYEE_STATUS: '/api/v0/fws/employee/check-status',
  GET_EMPLOYEE_BY_NAME_ROLE: '/api/v0/fws/employee',
  GET_ALL_EMPLOYEES: '/api/v0/fws/employee/all',

    // ✅ NEW — Rider registration + online
  CHECK_SHIPPING_FORM: '/api/v0/shipping/form/check',
  UPDATE_SHIPPER_ONLINE_STATUS: '/api/v0/shipper/online-status',
  START_RIDER_LOCATION: '/api/v0/track/rider/location',
  REGISTER_RIDER: '/api/v0/shipping/register',

  // FWS verifyfordispatch api's endpoints
  GET_TRACKING_HISTORY: '/api/v0/tracking/history/status',
  GET_AVAILABLE_SHIPPING: '/api/v0/shipping/available-shipping',
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
  GET_DRIVER_PROFILE: '/api/v0/driver/profile',

  // Driver online/offline status endpoints
  UPDATE_DRIVER_ONLINE_STATUS: '/api/v0/available/driver/online-status',
  GET_DRIVER_AVAILABLE_STATUS: '/api/v0/available/driver/status',
  TOGGLE_DRIVER_STATUS: '/api/v0/available/driver/toggle-status',
  UPDATE_DRIVER_LOCATION: '/api/v0/update/driver/locations',

  HANDOVER_VIA_QR: '/api/v0/delivery/tracking/shipping/handover/via/qr',
  GET_FWS_PROFILE: '/api/v0/fws',
  UPDATE_RIDER_LOCATION: '/api/v0/track/rider/location',
  // ✅ NEW — Seller endpoints
  GET_SELLER_STATUS: '/api/v0/seller/status',
  CHECK_SELLER_FORM_STATUS: '/api/v0/seller/check-form-status',
  SUBMIT_SELLER_APPLICATION: '/api/v0/seller/submit-application', // ✅ NEW
};

/**
 * @API_ENDPOINTS contains the API endpoint paths used in the application.
 */

/**
 */
