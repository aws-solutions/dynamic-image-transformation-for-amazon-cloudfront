// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Mapping, MappingCreate, MappingUpdate, PaginatedMappingResponse } from '@data-models';
import { apiClient, ApiResponse } from '../utils/apiClient';

interface MappingQueryParams {
  nextToken?: string;
}

export class MappingService {
  static async getMappings(params?: MappingQueryParams): Promise<ApiResponse<MappingResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.nextToken) searchParams.set('nextToken', params.nextToken);
    
    const endpoint = `/mappings${searchParams.toString() ? `?${searchParams}` : ''}`;
    const result = await apiClient.request<{ items: Mapping[]; nextToken?: string }>(endpoint);
    
    if (!result.success) {
      return result as ApiResponse<MappingResponse>;
    }
    
    // Transform backend response format to frontend expected format
    return {
      success: true,
      data: {
        mappings: result.data?.items || [],
        nextToken: result.data?.nextToken
      }
    };
  }

  static createMapping(data: MappingCreate): Promise<ApiResponse<Mapping>> {
    return apiClient.request<Mapping>('/mappings', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static updateMapping(id: string, data: MappingUpdate): Promise<ApiResponse<Mapping>> {
    return apiClient.request<Mapping>(`/mappings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static getMapping(id: string): Promise<ApiResponse<Mapping>> {
    return apiClient.request<Mapping>(`/mappings/${id}`);
  }

  static deleteMapping(id: string): Promise<ApiResponse<void>> {
    return apiClient.request<void>(`/mappings/${id}`, {
      method: 'DELETE'
    });
  }
}