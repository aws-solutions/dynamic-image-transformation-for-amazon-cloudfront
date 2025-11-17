// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * DynamoDB record interfaces for raw data storage
 */

export interface TransformationPolicyRecord {
  policyId: string;
  policyName: string;
  description?: string;
  policyJSON: string;  // Raw JSON from DDB
  isDefault: boolean;
}