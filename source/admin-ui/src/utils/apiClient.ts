// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';

export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

export const createApiClient = () => ({
  async request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const baseUrl = getAmplifyApiEndpoint();
      const url = endpoint.startsWith('http') ? endpoint : `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
      
      let authHeaders = {};
      try {
        const session = await fetchAuthSession();
        if (session.tokens?.accessToken) {
          authHeaders = { 'Authorization': `Bearer ${session.tokens.accessToken.toString()}` };
        }
      } catch (authError) {
        console.warn('No auth session available');
      }

      const response = await fetch(url, {
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        ...options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = parseErrorMessage(errorText, response.status, response.statusText);
        return { success: false, error: errorMessage };
      }

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      return { success: false, error: message };
    }
  }
});

const getAmplifyApiEndpoint = () => {
  try {
    const config = Amplify.getConfig();
    const adminApi = config.API?.REST?.AdminAPI;
    const endpoint = (typeof adminApi === 'string' ? adminApi : adminApi?.endpoint) || '/api';
    return endpoint;
  } catch (error) {
    return '/api';
  }
};

export const apiClient = createApiClient();

function parseErrorMessage(errorText: string, status: number, statusText: string): string {
  if (!errorText) return `HTTP ${status}: ${statusText}`;
  
  try {
    const errorData = JSON.parse(errorText);
    return errorData.error || errorData.message || `HTTP ${status}: ${statusText}`;
  } catch {
    return errorText || `HTTP ${status}: ${statusText}`;
  }
}
