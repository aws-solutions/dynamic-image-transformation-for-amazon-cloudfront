// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  type TransformationPolicy,
  type TransformationPolicyCreate,
  type TransformationPolicyUpdate,
  validateTransformationPolicyCreate,
  validateTransformationPolicyUpdate,
} from "../../data-models";
import { TransformationPolicyDAO } from "../dao";
import { DBTransformationPolicy } from "../interfaces";
import { BaseService } from "./base-service";

export class TransformationPolicyService extends BaseService<DBTransformationPolicy, TransformationPolicy> {
  constructor(tableName?: string, ddbDocClient?: DynamoDBDocumentClient) {
    super(new TransformationPolicyDAO(tableName, ddbDocClient));
  }

  protected validateUpdateRequest(updateRequest: unknown): TransformationPolicyUpdate {
    return this.validateRequest<TransformationPolicyUpdate>(validateTransformationPolicyUpdate, updateRequest);
  }

  protected validateCreateRequest(createRequest: unknown): TransformationPolicyCreate {
    return this.validateRequest<TransformationPolicyCreate>(validateTransformationPolicyCreate, createRequest);
  }
}
