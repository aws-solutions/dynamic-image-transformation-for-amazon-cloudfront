// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TransformationPolicy, TransformationPolicyCreate, TransformationPolicyUpdate } from '@data-models';
import { apiClient, ApiResponse } from '../utils/apiClient';

interface TransformationPolicyQueryParams {
  nextToken?: string;
}

export class TransformationPolicyService {
  static async list(params?: TransformationPolicyQueryParams): Promise<ApiResponse<{ items: TransformationPolicy[]; nextToken?: string }>> {
    const searchParams = new URLSearchParams();
    if (params?.nextToken) searchParams.set('nextToken', params.nextToken);
    
    const endpoint = `/policies${searchParams.toString() ? `?${searchParams}` : ''}`;
    return apiClient.request<{ items: TransformationPolicy[]; nextToken?: string }>(endpoint);
  }

  static async get(id: string): Promise<ApiResponse<TransformationPolicy>> {
    return apiClient.request<TransformationPolicy>(`/policies/${id}`);
  }

  static async create(policy: TransformationPolicyCreate): Promise<ApiResponse<TransformationPolicy>> {
    const result = await apiClient.request<TransformationPolicy>('/policies', {
      method: 'POST',
      body: JSON.stringify(policy)
    });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result;
  }

  static async update(id: string, policy: TransformationPolicyUpdate): Promise<ApiResponse<TransformationPolicy>> {
    return apiClient.request<TransformationPolicy>(`/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(policy)
    });
  }

  static async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.request<void>(`/policies/${id}`, {
      method: 'DELETE'
    });
  }
}

export const transformationPolicyService = new TransformationPolicyService();