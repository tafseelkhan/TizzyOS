// src/core/utils/handler/fetchHandler.ts

// ✅ FIX: Redact Authorization header in logs
export const fetchHandler = async (url: string, options: RequestInit) => {
  try {
    // ✅ Redact Authorization header before logging
    const redactedHeaders = { ...options?.headers } as Record<string, string>;
    if (redactedHeaders.Authorization) {
      redactedHeaders.Authorization = 'Bearer ***REDACTED***';
    }
    
    console.log('📡 [fetchHandler] ====================');
    console.log('📡 [fetchHandler] URL:', url);
    console.log('📡 [fetchHandler] Method:', options?.method || 'GET');
    console.log('📡 [fetchHandler] Headers:', JSON.stringify(redactedHeaders, null, 2));
    if (options?.body) {
      console.log('📡 [fetchHandler] Body:', options.body);
    }
    console.log('📡 [fetchHandler] Sending request...');

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json();

    console.log('✅ [fetchHandler] Response Status:', response.status);
    console.log('✅ [fetchHandler] Response Data:', JSON.stringify(data, null, 2));
    console.log('📡 [fetchHandler] ====================');

    if (!response.ok) {
      console.error('❌ [fetchHandler] Response Error Status:', response.status);
      console.error('❌ [fetchHandler] Response Error Data:', data);
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error: any) {
    console.error('❌ [fetchHandler] Error:', error);
    if (error.response) {
      console.error('❌ [fetchHandler] Response Error Status:', error.response.status);
      console.error('❌ [fetchHandler] Response Error Data:', error.response.data);
    }
    throw error;
  }
};