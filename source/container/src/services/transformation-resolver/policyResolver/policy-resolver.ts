// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { ImageProcessingRequest } from '../../../types/image-processing-request';
import { TransformationPolicy } from '../../../types/transformation';
import { PolicyCache } from '../../cache/domain/policy-cache';
import { PolicyNotFoundError } from '../errors/policy-not-found.error';


export class PolicyResolver {
  constructor(private policyCache: PolicyCache) {}

  private logPolicyResolution(requestId: string, policySource: string, policy: TransformationPolicy | null): void {
    console.log(JSON.stringify({
      requestId,
      component: 'PolicyResolver',
      operation: 'policy_resolved',
      policySource,
      policyId: policy?.policyId || null,
      transformationCount: policy?.transformations?.length || 0,
      transformationTypes: policy?.transformations?.map(t => t.type) || []
    }));
  }

  async resolvePolicy(req: Request, imageRequest: ImageProcessingRequest): Promise<TransformationPolicy | null> {
    // 1. URL parameter (highest precedence)
    const urlPolicyId = req.query.policyId as string;
    if (urlPolicyId) {
      const policy = await this.policyCache.getPolicy(urlPolicyId);
      if (!policy) {
        throw new PolicyNotFoundError(`Policy ${urlPolicyId} not found`);
      }
      
      this.logPolicyResolution(imageRequest.requestId, 'url', policy);
      
      return policy;
    }

    // 2. Mapping-defined policy
    if (imageRequest.policy?.id) {
      const policy = await this.policyCache.getPolicy(imageRequest.policy.id);
      if (!policy) {
        throw new PolicyNotFoundError(`Policy ${imageRequest.policy.id} not found`);
      }
      
      this.logPolicyResolution(imageRequest.requestId, 'mapping', policy);
      
      return policy;
    }

    // 3. Default policy
    const defaultPolicy = await this.policyCache.getDefault();
    if (defaultPolicy) {
      this.logPolicyResolution(imageRequest.requestId, 'default', defaultPolicy);
      
      return defaultPolicy;
    }

    this.logPolicyResolution(imageRequest.requestId, 'none', null);
    
    return null;
  }
}