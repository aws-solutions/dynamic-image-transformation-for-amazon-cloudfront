// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  type Mapping,
  MappingCreate,
  MappingUpdate,
  validateMappingCreate,
  validateMappingUpdate,
} from "../../data-models";
import { MappingDAO } from "../dao";
import { DBMapping } from "../interfaces";
import { BaseService } from "./base-service";

export class MappingService extends BaseService<DBMapping, Mapping> {
  constructor(tableName?: string, ddbDocClient?: DynamoDBDocumentClient) {
    super(new MappingDAO(tableName, ddbDocClient));
  }

  protected validateUpdateRequest(updateRequest: unknown): MappingUpdate {
    return this.validateRequest<MappingUpdate>(validateMappingUpdate, updateRequest);
  }

  protected validateCreateRequest(createRequest: unknown): MappingCreate {
    return this.validateRequest<MappingCreate>(validateMappingCreate, createRequest);
  }
}
