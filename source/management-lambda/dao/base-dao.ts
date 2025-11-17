// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { logger } from "../common";
import { AllowedDataModelEntities, AllowedDBEntities, DAO, DBEntityType } from "../interfaces";

/**
 * Base DAO class that provides common DynamoDB operations
 * Data validation is performed when reading or writing to DDB with zod schemas
 * @template T - DynamoDB Entity types
 * @template K - Data Model Entity types
 */
export abstract class BaseDAO<T extends AllowedDBEntities, K extends AllowedDataModelEntities> implements DAO<T, K> {
  protected readonly tableName: string;
  protected readonly ddbDocClient: DynamoDBDocumentClient;
  protected entityType: DBEntityType;
  protected constructor(
    tableName?: string, // concrete DAOs can pass the table for the DOA instance to work with
    ddbDocClient?: DynamoDBDocumentClient // concrete DAOs can pass previously instantiated DynamoDBDocumentClient
  ) {
    this.tableName = tableName ?? process.env.CONFIG_TABLE_NAME ?? "";
    if (!this.tableName) {
      throw new Error("CONFIG_TABLE_NAME environment variable is required");
    }

    this.ddbDocClient = ddbDocClient || DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async getAll(nextToken?: string): Promise<{ items: T[]; nextToken?: string }> {
    const items: T[] = [];

    const queryParams: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": this.entityType,
      },
    };

    if (nextToken) {
      try {
        // Decodes a Base64 string token back into the LastEvaluatedKey object format
        queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString("utf-8"));
      } catch (error) {
        logger.warn("Invalid pagination token provided, starting fresh", { error });
      }
    }

    const data = await this.ddbDocClient.send(new QueryCommand(queryParams));

    if (!data.Items) {
      return { items: [] };
    }

    data.Items.forEach((item) => {
      const validatedItem = this.validateItem(item);
      if (validatedItem.success) items.push(validatedItem.data);
      else logger.warn("Item validation failed during getAll", { error: JSON.parse(validatedItem.error.message) });
    });

    const result: { items: T[]; nextToken?: string } = { items };

    if (data.LastEvaluatedKey) {
      // Encodes the LastEvaluatedKey object into a URL-safe Base64 string
      result.nextToken = Buffer.from(JSON.stringify(data.LastEvaluatedKey), "utf-8").toString("base64");
    }

    return result;
  }

  async get(id: string): Promise<T | null> {
    const item = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: id, // PK = Primary Key
        },
      })
    );

    const validatedItem = this.validateItem(item.Item);
    if (validatedItem.success) return validatedItem.data;
    else {
      logger.warn("Item validation failed during get", { error: JSON.parse(validatedItem.error.message) });
      return null;
    }
  }

  async create(item: T): Promise<T> {
    const validatedItem = this.validateItem(item);
    if (!validatedItem.success) {
      logger.error("Item validation failed during create", { error: JSON.parse(validatedItem.error.message) });
      throw validatedItem.error;
    }

    // Set CreatedAt timestamp if not already set
    const itemToCreate = {
      ...item,
      CreatedAt: item.CreatedAt || new Date().toISOString(),
    } as T;

    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: itemToCreate,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
    return item;
  }

  async update(item: T): Promise<T> {
    const validatedItem = this.validateItem(item);
    if (!validatedItem.success) {
      logger.error("Item validation failed during update", { error: JSON.parse(validatedItem.error.message) });
      throw validatedItem.error;
    }

    // Set UpdatedAt timestamp if not already set
    const itemToUpdate = {
      ...validatedItem.data,
      UpdatedAt: validatedItem.data.UpdatedAt || new Date().toISOString(),
    } as T;

    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: itemToUpdate,
        ConditionExpression: "attribute_exists(PK)", // Ensure item exists
      })
    );
    return item;
  }

  async delete(id: string): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: id, // PK = Primary Key
        },
        ConditionExpression: "attribute_exists(PK)", // Ensure item exists
      })
    );
  }

  /**
   * Abstract method to validate DDB item
   * Each concrete DAO must implement this with their specific validation logic using zod schemas
   * @param {any} item - Item to validate
   * @returns {z.ZodSafeParseResult<T>} Validation result
   */
  protected abstract validateItem(item: any): z.ZodSafeParseResult<T>;

  /**
   * Convert Data Model entity to DDB entity
   * Each concrete DAO must implement this with their specific conversion logic
   * @param {K} entity - Data Model entity to convert
   * @returns {T} DB entity
   */
  abstract convertToDB(entity: K): T;

  /**
   * Convert DDB entity to Data Model entity
   * Each concrete DAO must implement this with their specific conversion logic
   * @param {T} entity - DB entity
   * @returns {K} Data Model entity
   */
  abstract convertFromDB(entity: T): K;
}
