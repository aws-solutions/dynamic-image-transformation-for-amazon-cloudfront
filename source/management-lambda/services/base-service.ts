// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { z, ZodSafeParseResult } from "zod";
import { BadRequestError, ErrorCodes, generateId, NotFoundError, logger } from "../common";
import {
  type AllowedDataModelEntities,
  type AllowedDBEntities,
  type AllowedRequestTypes,
  DAO,
  Service,
} from "../interfaces";

/**
 * Abstract base service class that implements the service interface
 * Provides common structure and validation abstract methods for concrete service implementations
 * @template T - DynamoDB Entity type that extends AllowedDBEntities
 * @template K - Data Model Entity type that extends AllowedDataModelEntities
 */
export abstract class BaseService<T extends AllowedDBEntities, K extends AllowedDataModelEntities>
  implements Service<K>
{
  protected constructor(protected readonly dao: DAO<T, K>) {}

  async list(nextToken?: string): Promise<{ items: K[]; nextToken?: string }> {
    const result = await this.dao.getAll(nextToken);
    return {
      items: result.items.map((item) => this.dao.convertFromDB(item)),
      nextToken: result.nextToken,
    };
  }

  async get(id: unknown): Promise<K> {
    const validatedId = this.validateId(id);
    const item = await this.dao.get(validatedId);
    if (!item) throw new NotFoundError("Item not found");
    return this.dao.convertFromDB(item);
  }

  async delete(id: unknown): Promise<void> {
    const validatedId = this.validateId(id);
    try {
      await this.dao.delete(validatedId);
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new NotFoundError("Item not found");
      }
      throw err;
    }
  }

  async create(createRequest: unknown): Promise<K> {
    const validatedRequest = this.validateCreateRequest(createRequest);

    const id = generateId();
    const createdAt = new Date().toISOString();
    let item: any = {
      ...validatedRequest,
      createdAt,
    };

    // Identifying the request type based on fields
    if ("originId" in validatedRequest) {
      item = { ...item, mappingId: id };
    } else if ("originName" in validatedRequest) {
      item = { ...item, originId: id };
    } else if ("policyName" in validatedRequest) {
      item = { ...item, policyId: id };
    }
    logger.debug("Creating entity", { item });
    const dbItem = this.dao.convertToDB(item as K);
    try {
      await this.dao.create(dbItem);
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new BadRequestError("Duplicate item found");
      }
      throw err;
    }
    return item as K;
  }

  async update(id: unknown, updateRequest: unknown): Promise<K> {
    this.validateId(id);
    const validatedRequest = this.validateUpdateRequest(updateRequest);

    const oldData = await this.get(id);
    const updatedAt = new Date().toISOString();
    const entity: K = {
      ...oldData,
      ...validatedRequest,
      updatedAt,
    };
    logger.debug("Updating entity", { entity });
    const item: T = this.dao.convertToDB(entity);
    try {
      await this.dao.update(item);
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new NotFoundError("Item not found");
      }
      throw err;
    }
    return entity;
  }

  /**
   * Validate create request
   * Must be implemented by concrete classes to validate entity-specific create requests
   * @param {unknown} createRequest - Create request
   */
  protected abstract validateCreateRequest(createRequest: unknown): AllowedRequestTypes;

  /**
   * Validate update request
   * Must be implemented by concrete classes to validate entity-specific update requests
   * @param {unknown} updateRequest - Update request
   */
  protected abstract validateUpdateRequest(updateRequest: unknown): AllowedRequestTypes;

  /**
   * Validate id parameter for Get, Delete requests
   * @param {unknown} id - ID to validate
   */
  protected validateId(id: unknown): string {
    const result = z.uuid({ version: "v4" }).safeParse(id);
    if (!result.success) {
      throw new BadRequestError("Invalid id", ErrorCodes.INVALID_FIELD_VALUE);
    }
    return result.data;
  }

  /**
   * Validate request with zod schemas
   * @param validationFn - validation function to run on the request
   * @param {unknown} request - request to validate
   */
  protected validateRequest<K>(validationFn: (request: unknown) => ZodSafeParseResult<K>, request: unknown): K {
    const result = validationFn(request);
    if (!result.success) {
      logger.error("Request validation failed", { error: JSON.parse(result.error.message) });
      throw new BadRequestError("Invalid request");
    }
    return result.data;
  }
}
