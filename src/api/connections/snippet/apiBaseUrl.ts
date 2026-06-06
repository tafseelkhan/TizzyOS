/**
 *
 * @file apiBaseUrl.ts
 *
 * @author TafseelKhan
 *
 * @date 2024-06-01
 *
 * @description This file defines the base URL for API requests in the application. It imports the configuration from 'react-native-config' and exports a constant `API_BASE_URL` that can be used throughout the app to make API calls. This allows for easy management of the API endpoint, especially when switching between different environments (e.g., development, staging, production).
 */

import { Config } from 'react-native-config';

/**
 * @constant {string} API_BASE_URL - The base URL for API requests.
 *
 * @description This constant holds the base URL for all API requests made in the application. It is set to the value of `API_AXIOS_BASE_URL` from the configuration, allowing for flexibility in changing the API endpoint without modifying the codebase. This is particularly useful when deploying the application across different environments, as it enables developers to easily switch between different API endpoints by simply changing the configuration.
 *
 * @example
 *
 * *Example usage of API_BASE_URL in an API call*
 *
 * import axios from 'axios';
 */

export const API_BASE_URL = Config.API_AXIOS_BASE_URL;

/**
 * @description The `API_BASE_URL` constant is set to the value of `API_AXIOS_BASE_URL` from the configuration. This allows for flexibility in changing the API endpoint without modifying the codebase, as the value can be set in environment variables or configuration files. It is essential for ensuring that API requests are directed to the correct server, especially when deploying the application across different environments.
 *
 * @example
 *
 * *Example usage of API_BASE_URL in an API call*
 *
 * import axios from 'axios';
 *
 * const response = await axios.get(`${API_BASE_URL}/stories`);
 *
 * *In this example, the `API_BASE_URL` is used to construct the full URL for the API request to fetch stories. This approach promotes maintainability and scalability in the codebase, as any changes to the base URL can be made in one place without affecting the rest of the code that relies on it.*
 */
