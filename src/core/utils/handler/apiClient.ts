import {
  clearAuthTokens,
  getSessionToken,
  getToken,
  setToken,
} from '../../../api/connections/token/tokenSlice';

import { API_ENDPOINTS } from '../../../api/connections/snippet/apiEndpoints';
import { TIZZYGO_API_BASE_URL } from '../../../api/connections/snippet/apiBaseUrl';

// ============================================================
// API REQUEST OPTIONS
// ============================================================

type ApiRequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;

  /** Set false for public endpoints such as login and signup. */
  auth?: boolean;

  /** Set false to disable automatic refresh and retry. */
  retryOnUnauthorized?: boolean;
};

// ============================================================
// API ERROR
// ============================================================

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ============================================================
// REFRESH STATE
// ============================================================

let refreshInFlight: Promise<string> | null = null;

// ============================================================
// BUILD API URL — INTERNAL ONLY
//
// TIZZYGO_API_BASE_URL is imported here for internal use only.
// It is intentionally NOT exported from this file, so service
// modules cannot depend on it via apiClient.
//
// - Relative paths are joined with the base URL.
// - Absolute URLs (http/https) are returned unchanged.
// ============================================================

const buildUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!TIZZYGO_API_BASE_URL) {
    throw new Error('TIZZYGO_API_BASE_URL is not configured.');
  }

  return `${TIZZYGO_API_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};

// ============================================================
// PARSE RESPONSE
// ============================================================

const parseResponse = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

// ============================================================
// ERROR MESSAGE
//
// Looks for `message` / `error` at the top level, and also inside
// `data` (backend sometimes wraps errors as { data: { message } }).
// ============================================================

const getErrorMessage = (data: unknown, fallback: string): string => {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;

    if (typeof record.message === 'string') {
      return record.message;
    }

    if (typeof record.error === 'string') {
      return record.error;
    }

    if (record.data && typeof record.data === 'object') {
      const nested = record.data as Record<string, unknown>;

      if (typeof nested.message === 'string') {
        return nested.message;
      }

      if (typeof nested.error === 'string') {
        return nested.error;
      }
    }
  }

  return fallback;
};

// ============================================================
// RAW REFRESH — INTERNAL ONLY
//
// Calls the refresh endpoint directly with fetch to avoid
// recursive refresh attempts through apiRequest.
// ============================================================

const rawRefresh = async (): Promise<string> => {
  const sessionToken = await getSessionToken();

  if (!sessionToken) {
    throw new Error(
      'No session token is available. Please sign in again.',
    );
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(API_ENDPOINTS.REFRESH), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
      },
    });
  } catch (error) {
    throw new ApiError(
      'Network error while refreshing the access token.',
      0,
      error,
    );
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(
        data,
        'Could not refresh the access token. Please sign in again.',
      ),
      response.status,
      data,
    );
  }

  const record =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : undefined;

  const nestedData =
    record?.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : undefined;

  const accessToken = record?.accessToken ?? nestedData?.accessToken;

  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('Refresh response did not include accessToken.');
  }

  // Save the new access token; retain the session token.
  await setToken(accessToken);

  return accessToken;
};

// ============================================================
// SHARED REFRESH FOR CONCURRENT REQUESTS
//
// Concurrent 401 requests share the same refresh operation.
// ============================================================

const getFreshAccessToken = (): Promise<string> => {
  if (!refreshInFlight) {
    refreshInFlight = rawRefresh().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
};

// ============================================================
// MAIN API CLIENT
//
// Sends an API request using TIZZYGO_API_BASE_URL.
//
// On an authenticated 401:
// 1. Refresh the access token through TizzyGo.
// 2. Save the new access token.
// 3. Retry the original request once.
// 4. Clear local auth tokens if refreshing fails.
// ============================================================

export const apiRequest = async <T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const {
    headers: suppliedHeaders = {},
    auth = true,
    retryOnUnauthorized = true,
    ...requestInit
  } = options;

  const url = buildUrl(path);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...suppliedHeaders,
  };

  if (
    requestInit.body &&
    typeof FormData !== 'undefined' &&
    !(requestInit.body instanceof FormData) &&
    !headers['Content-Type'] &&
    !headers['content-type']
  ) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = await getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const send = async (requestHeaders: Record<string, string>) => {
    let response: Response;

    try {
      response = await fetch(url, {
        ...requestInit,
        headers: requestHeaders,
      });
    } catch (error) {
      throw new ApiError('Network request failed.', 0, error);
    }

    const data = await parseResponse(response);

    return { response, data };
  };

  let { response, data } = await send(headers);

  // Refresh and retry only once for authenticated requests.
  if (response.status === 401 && auth && retryOnUnauthorized) {
    let newAccessToken: string;

    try {
      newAccessToken = await getFreshAccessToken();
    } catch (error) {
      await clearAuthTokens();
      throw error;
    }

    const retryHeaders: Record<string, string> = {
      ...headers,
      Authorization: `Bearer ${newAccessToken}`,
    };

    ({ response, data } = await send(retryHeaders));
  }

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(
        data,
        `Request failed with status ${response.status}`,
      ),
      response.status,
      data,
    );
  }

  return data as T;
};

// ============================================================
// CLEAR LOCAL AUTH
// ============================================================

export const clearLocalAuth = clearAuthTokens;