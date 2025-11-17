// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Origin, OriginCreate, OriginUpdate, PaginatedOriginResponse } from '@data-models';
import { apiClient, ApiResponse } from '../utils/apiClient';

interface OriginQueryParams {
  nextToken?: string;
}

export class OriginService {
  static async getOrigins(params?: OriginQueryParams): Promise<ApiResponse<OriginResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.nextToken) searchParams.set('nextToken', params.nextToken);
    
    const endpoint = `/origins${searchParams.toString() ? `?${searchParams}` : ''}`;
    const result = await apiClient.request<{ items: Origin[]; nextToken?: string }>(endpoint);
    
    if (!result.success) {
      return result as ApiResponse<OriginResponse>;
    }
    
    // Transform backend response format to frontend expected format
    return {
      success: true,
      data: {
        origins: result.data?.items || [],
        nextToken: result.data?.nextToken
      }
    };
  }

  static async getAllOrigins(): Promise<ApiResponse<Origin[]>> {
    try {
      const allOrigins: Origin[] = [];
      let nextToken: string | undefined;

      do {
        const result = await this.getOrigins({ nextToken });
        if (!result.success || !result.data) {
          return { success: false, error: result.error || 'Failed to fetch origins' };
        }

        allOrigins.push(...result.data.origins);
        nextToken = result.data.nextToken;
      } while (nextToken);

      return { success: true, data: allOrigins };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch all origins';
      return { success: false, error: message };
    }
  }

  static createOrigin(data: OriginCreate): Promise<ApiResponse<Origin>> {
    return apiClient.request<Origin>('/origins', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static updateOrigin(id: string, data: OriginUpdate): Promise<ApiResponse<Origin>> {
    return apiClient.request<Origin>(`/origins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static getOrigin(id: string): Promise<ApiResponse<Origin>> {
    return apiClient.request<Origin>(`/origins/${id}`);
  }

  static testOrigin(id: string): Promise<ApiResponse<any>> {
    return apiClient.request<any>(`/origins/${id}/test`, {
      method: 'POST'
    });
  }

  static deleteOrigin(id: string): Promise<ApiResponse<void>> {
    return apiClient.request<void>(`/origins/${id}`, {
      method: 'DELETE'
    });
  }
}