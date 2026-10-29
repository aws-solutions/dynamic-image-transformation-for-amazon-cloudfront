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
import { BadRequestError, normalizeHostPattern, normalizeName, normalizePathPattern } from "../common";
import { MappingDAO } from "../dao";
import { DBEntityType, DBMapping, KeyRecord } from "../interfaces";
import { BaseService, UniqueKey } from "./base-service";

export class MappingService extends BaseService<DBMapping, Mapping> {
  constructor(tableName?: string, ddbDocClient?: DynamoDBDocumentClient) {
    super(new MappingDAO(tableName, ddbDocClient));
  }

  async update(id: unknown, updateRequest: unknown): Promise<Mapping> {
    const validatedId = this.validateId(id);
    const validatedRequest = this.validateUpdateRequest(updateRequest);

    const { entity, existing } = await this.buildUpdatedEntity(validatedId, validatedRequest);

    const result = validateMapping(entity);
    if (!result.success) {
      throw new BadRequestError(result.error.issues[0].message);
    }

    await this.assertUnique(entity, existing);
    await this.saveEntity(entity);
    return entity;
  }

  protected getUniqueKeys(mapping: Mapping): UniqueKey[] {
    const patternIn = (type: DBEntityType) => (record: KeyRecord) => record.GSI1PK === type ? record.GSI1SK : undefined;
    return [
      {
        field: "mappingName",
        value: mapping.mappingName,
        normalize: normalizeName,
        storedValue: (record) => record.mappingName,
        label: "A mapping named",
      },
      {
        field: "pathPattern",
        value: mapping.pathPattern,
        normalize: normalizePathPattern,
        storedValue: patternIn(DBEntityType.PATH_MAPPING),
        label: "A path mapping with pattern",
      },
      {
        field: "hostHeaderPattern",
        value: mapping.hostHeaderPattern,
        normalize: normalizeHostPattern,
        storedValue: patternIn(DBEntityType.HOST_HEADER_MAPPING),
        label: "A host header mapping with pattern",
      },
    ];
  }

  protected validateUpdateRequest(updateRequest: unknown): MappingUpdate {
    return this.validateRequest<MappingUpdate>(validateMappingUpdate, updateRequest);
  }

  protected validateCreateRequest(createRequest: unknown): MappingCreate {
    return this.validateRequest<MappingCreate>(validateMappingCreate, createRequest);
  }
}
