// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  type Origin,
  type OriginCreate,
  type OriginUpdate,
  validateOriginCreate,
  validateOriginUpdate,
} from "../../data-models";
import { OriginDAO } from "../dao";
import { DBOrigin } from "../interfaces";
import { BaseService } from "./base-service";

export class OriginService extends BaseService<DBOrigin, Origin> {
  constructor(tableName?: string, ddbDocClient?: DynamoDBDocumentClient) {
    super(new OriginDAO(tableName, ddbDocClient));
  }

  protected validateUpdateRequest(updateRequest: unknown): OriginUpdate {
    return this.validateRequest<OriginUpdate>(validateOriginUpdate, updateRequest);
  }

  protected validateCreateRequest(createRequest: unknown): OriginCreate {
    return this.validateRequest<OriginCreate>(validateOriginCreate, createRequest);
  }
}
