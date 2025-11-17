// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { Mapping } from "../../data-models";
import {BadRequestError, ErrorCodes, logger, NotFoundError} from "../common";
import { DBEntityType, DBMapping, validateMappingItem } from "../interfaces";
import { BaseDAO } from "./base-dao";

export class MappingDAO extends BaseDAO<DBMapping, Mapping> {
  constructor(tableName?: string, ddbDocClient?: DynamoDBDocumentClient) {
    super(tableName, ddbDocClient);
  }

  // overriding base class getAll to fetch both mapping types with pagination using composite token
  async getAll(nextToken?: string): Promise<{ items: DBMapping[]; nextToken?: string }> {
    let pathNextToken: string | undefined;
    let hostHeaderNextToken: string | undefined;

    // Parse composite token if provided
    if (nextToken) {
      try {
        const tokenData = JSON.parse(Buffer.from(nextToken, "base64").toString("utf-8"));
        pathNextToken = tokenData.pathNextToken;
        hostHeaderNextToken = tokenData.hostHeaderNextToken;
      } catch (error) {
        logger.warn("Invalid pagination token provided, starting fresh:", { error });
        [nextToken, pathNextToken, hostHeaderNextToken] = [undefined, undefined, undefined];
      }
    }

    let pathMappings: { items: DBMapping[]; nextToken?: string } = { items: [] };
    let hostHeaderMappings: { items: DBMapping[]; nextToken?: string } = { items: [] };

    // If no nextToken provided, get both (first page)
    // If pathNextToken provided, only get path mappings
    // If hostHeaderNextToken provided, only get host header mappings
    if (!nextToken || pathNextToken) {
      this.entityType = DBEntityType.PATH_MAPPING;
      pathMappings = await super.getAll(pathNextToken);
    }

    if (!nextToken || hostHeaderNextToken) {
      this.entityType = DBEntityType.HOST_HEADER_MAPPING;
      hostHeaderMappings = await super.getAll(hostHeaderNextToken);
    }

    const allItems = [...pathMappings.items, ...hostHeaderMappings.items];

    // Create composite token if either query has more results
    let compositeToken: string | undefined;
    if (pathMappings.nextToken || hostHeaderMappings.nextToken) {
      const tokenData = {
        pathNextToken: pathMappings.nextToken,
        hostHeaderNextToken: hostHeaderMappings.nextToken,
      };
      compositeToken = Buffer.from(JSON.stringify(tokenData), "utf-8").toString("base64");
    }

    return {
      items: allItems,
      nextToken: compositeToken,
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
    // Prevent changing mapping type - if both patterns exist, it's an invalid update
    if (mapping.pathPattern && mapping.hostHeaderPattern) {
      throw new BadRequestError("Cannot change mapping type from path to host header or vice versa");
    }

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
      GSI3PK: `${DBEntityType.POLICY}#${mapping.policyId}`,
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
