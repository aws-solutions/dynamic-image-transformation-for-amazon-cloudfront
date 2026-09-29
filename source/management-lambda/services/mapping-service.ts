// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  type Mapping,
  MappingCreate,
  MappingUpdate,
  validateMapping,
  validateMappingCreate,
  validateMappingUpdate,
} from "../../data-models";
import { MappingDAO } from "../dao";
import { DBMapping } from "../interfaces";
import { BaseService } from "./base-service";
import { BadRequestError } from "../common";

export class MappingService extends BaseService<DBMapping, Mapping> {
  constructor(tableName?: string, ddbDocClient?: DynamoDBDocumentClient) {
    super(new MappingDAO(tableName, ddbDocClient));
  }

  async update(id: unknown, updateRequest: unknown): Promise<Mapping> {
    const validatedId = this.validateId(id);
    const validatedRequest = this.validateUpdateRequest(updateRequest);

    const entity = await this.buildUpdatedEntity(validatedId, validatedRequest);

    const result = validateMapping(entity);
    if (!result.success) {
      throw new BadRequestError(result.error.issues[0].message);
    }

    await this.saveEntity(entity);
    return entity;
  }

  protected validateUpdateRequest(updateRequest: unknown): MappingUpdate {
    return this.validateRequest<MappingUpdate>(validateMappingUpdate, updateRequest);
  }

  protected validateCreateRequest(createRequest: unknown): MappingCreate {
    return this.validateRequest<MappingCreate>(validateMappingCreate, createRequest);
  }
}
