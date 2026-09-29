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
import { redactOriginHeaders } from "../common";
import { OriginDAO } from "../dao";
import { DBOrigin } from "../interfaces";
import { BaseService } from "./base-service";

/**
 * Origin CRUD service.
 *
 * originHeaders values are write-only: accepted on create and update, never returned. They are the
 * designated store for upstream authentication credentials, so every method that returns an Origin
 * to a caller redacts the values while preserving the header names.
 *
 * Redaction happens here rather than in OriginDAO.convertFromDB on purpose — see
 * {@link redactOriginHeaders}. The inherited update path reads the existing entity through the DAO
 * and merges the patch over it, so the DAO must keep returning real values or an update that omits
 * originHeaders would persist the placeholder over the stored credential.
 */
export class OriginService extends BaseService<DBOrigin, Origin> {
  constructor(tableName?: string, ddbDocClient?: DynamoDBDocumentClient) {
    super(new OriginDAO(tableName, ddbDocClient));
  }

  async list(nextToken?: string): Promise<{ items: Origin[]; nextToken?: string }> {
    const result = await super.list(nextToken);
    return { ...result, items: result.items.map((item) => redactOriginHeaders(item)) };
  }

  async get(id: unknown): Promise<Origin> {
    return redactOriginHeaders(await super.get(id));
  }

  async create(createRequest: unknown): Promise<Origin> {
    return redactOriginHeaders(await super.create(createRequest));
  }

  async update(id: unknown, updateRequest: unknown): Promise<Origin> {
    return redactOriginHeaders(await super.update(id, updateRequest));
  }

  protected validateUpdateRequest(updateRequest: unknown): OriginUpdate {
    return this.validateRequest<OriginUpdate>(validateOriginUpdate, updateRequest);
  }

  protected validateCreateRequest(createRequest: unknown): OriginCreate {
    return this.validateRequest<OriginCreate>(validateOriginCreate, createRequest);
  }
}
