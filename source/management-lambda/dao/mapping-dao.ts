// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBDocumentClient, GetCommand, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { Mapping } from "../../data-models";
import { ErrorCodes, logger, NotFoundError } from "../common";
import { DBEntityType, DBMapping, validateMappingItem } from "../interfaces";
import { BaseDAO } from "./base-dao";

export class MappingDAO extends BaseDAO<DBMapping, Mapping> {
  constructor(tableName?: string, ddbDocClient?: DynamoDBDocumentClient) {
    super(tableName, ddbDocClient);
  }

  // overriding base class getAll to fetch both mapping types with pagination using composite token
  async getAll(nextToken?: string): Promise<{ items: DBMapping[]; nextToken?: string }> {
    let pathCursor: Record<string, any> | undefined;
    let hostHeaderCursor: Record<string, any> | undefined;

    // Validate and extract composite cursors if token provided
    if (nextToken) {
      const validation = await this.tokenService.validateToken(nextToken, this.accountId);

      if (!validation.valid) {
        logger.warn("Token validation failed, starting fresh", {
          error: validation.error,
          errorCode: validation.errorCode,
        });
        // Start fresh - both cursors remain undefined
        [nextToken, pathCursor, hostHeaderCursor] = [undefined, undefined, undefined];
      } else {
        // Extract composite cursors
        const cursors = this.tokenService.extractCursors(validation.payload!) as Record<string, Record<string, any>>;
        pathCursor = cursors["pathMapping"];
        hostHeaderCursor = cursors["hostHeaderMapping"];
      }
    }

    let pathMappings: { items: DBMapping[]; nextToken?: Record<string, any> } = { items: [] };
    let hostHeaderMappings: { items: DBMapping[]; nextToken?: Record<string, any> } = { items: [] };

    // Query path mappings if no token or if pathCursor exists
    if (!nextToken || pathCursor) {
      pathMappings = await this.queryWithCursor(pathCursor, DBEntityType.PATH_MAPPING);
    }

    // Query host header mappings if no token or if hostHeaderCursor exists
    if (!nextToken || hostHeaderCursor) {
      hostHeaderMappings = await this.queryWithCursor(hostHeaderCursor, DBEntityType.HOST_HEADER_MAPPING);
    }

    const allItems = [...pathMappings.items, ...hostHeaderMappings.items];

    // Generate composite token if either query has more results
    let compositeToken: string | undefined;
    if (pathMappings.nextToken || hostHeaderMappings.nextToken) {
      const compositeCursors: Record<string, Record<string, any>> = {};
      if (pathMappings.nextToken) compositeCursors["pathMapping"] = pathMappings.nextToken;
      if (hostHeaderMappings.nextToken) compositeCursors["hostHeaderMapping"] = hostHeaderMappings.nextToken;

      compositeToken = await this.tokenService.generateToken({
        accountId: this.accountId,
        compositeCursors,
      });
    }
    return {
      items: allItems,
      nextToken: compositeToken,
    };
  }

  // Helper method to execute query with optional cursor
  private async queryWithCursor(
    cursor?: Record<string, any>,
    entityType?: DBEntityType
  ): Promise<{ items: DBMapping[]; nextToken?: Record<string, any> }> {
    const queryParams: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": entityType,
      },
    };

    if (cursor) {
      queryParams.ExclusiveStartKey = cursor;
    }

    const data = await this.ddbDocClient.send(new QueryCommand(queryParams));

    const items: DBMapping[] = [];
    data.Items?.forEach((item) => {
      const validatedItem = this.validateItem(item);
      if (validatedItem.success) items.push(validatedItem.data);
      else logger.warn("Item validation failed during getAll", { error: JSON.parse(validatedItem.error.message) });
    });

    return {
      items,
      nextToken: data.LastEvaluatedKey,
    };
  }

  // override base class create to validate Origin and Policy exists before creating Mapping
  async create(item: DBMapping): Promise<DBMapping> {
    if (!(await this.entityExists(item.Data.originId, DBEntityType.ORIGIN))) {
      throw new NotFoundError("Origin does not exist", ErrorCodes.ORIGIN_NOT_FOUND);
    }
    if (item.Data.policyId && !(await this.entityExists(item.Data.policyId, DBEntityType.POLICY))) {
      throw new NotFoundError("Policy does not exist", ErrorCodes.POLICY_NOT_FOUND);
    }

    return super.create(item);
  }

  // override base class update to validate Origin and Policy exists before updating Mapping
  async update(item: DBMapping): Promise<DBMapping> {
    if (!(await this.entityExists(item.Data.originId, DBEntityType.ORIGIN))) {
      throw new NotFoundError("Origin does not exist", ErrorCodes.ORIGIN_NOT_FOUND);
    }
    if (item.Data.policyId && !(await this.entityExists(item.Data.policyId, DBEntityType.POLICY))) {
      throw new NotFoundError("Policy does not exist", ErrorCodes.POLICY_NOT_FOUND);
    }

    return super.update(item);
  }

  convertToDB(mapping: Mapping): DBMapping {
    return {
      PK: mapping.mappingId,
      Data: {
        mappingName: mapping.mappingName,
        description: mapping.description,
        originId: mapping.originId,
        policyId: mapping.policyId,
      },
      CreatedAt: mapping.createdAt,
      UpdatedAt: mapping.updatedAt,
      GSI1PK: mapping.pathPattern ? DBEntityType.PATH_MAPPING : DBEntityType.HOST_HEADER_MAPPING,
      GSI1SK: (mapping.pathPattern || mapping.hostHeaderPattern) as string,
      GSI2PK: `${DBEntityType.ORIGIN}#${mapping.originId}`,
      ...(mapping.policyId !== undefined && { GSI3PK: `${DBEntityType.POLICY}#${mapping.policyId}` }),
    };
  }

  convertFromDB(dbMapping: DBMapping): Mapping {
    const item = {
      mappingId: dbMapping.PK,
      mappingName: dbMapping.Data.mappingName,
      description: dbMapping.Data.description,
      originId: dbMapping.Data.originId,
      policyId: dbMapping.Data.policyId,
      createdAt: dbMapping.CreatedAt,
      updatedAt: dbMapping.UpdatedAt,
    };
    if (dbMapping.GSI1PK === DBEntityType.PATH_MAPPING) return { ...item, pathPattern: dbMapping.GSI1SK };
    else return { ...item, hostHeaderPattern: dbMapping.GSI1SK };
  }

  protected validateItem(item: any): z.ZodSafeParseResult<DBMapping> {
    return validateMappingItem(item);
  }

  private async entityExists(id: string, entityType: DBEntityType): Promise<boolean> {
    const item = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: id, // PK = Primary Key
        },
      })
    );
    return !!item.Item && item.Item.GSI1PK === entityType;
  }
}
