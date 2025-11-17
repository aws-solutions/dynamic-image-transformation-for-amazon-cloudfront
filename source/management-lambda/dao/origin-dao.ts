// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { Origin } from "../../data-models";
import { BadRequestError, ErrorCodes } from "../common";
import { DBEntityType, DBOrigin, validateOriginItem } from "../interfaces";
import { BaseDAO } from "./base-dao";

export class OriginDAO extends BaseDAO<DBOrigin, Origin> {
  constructor(tableName?: string, ddbDocClient?: DynamoDBDocumentClient) {
    super(tableName, ddbDocClient);
    this.entityType = DBEntityType.ORIGIN;
  }

  // override base class delete, make sure Origin is not referenced in any Mapping before delete
  async delete(id: string): Promise<void> {
    if (await this.mappingExists(id))
      throw new BadRequestError(
        "Origin is referenced in a mapping and cannot be deleted",
        ErrorCodes.INVALID_FIELD_VALUE
      );
    return super.delete(id);
  }

  convertToDB(origin: Origin): DBOrigin {
    return {
      PK: origin.originId,
      Data: {
        originName: origin.originName,
        originDomain: origin.originDomain,
        originPath: origin.originPath,
        originHeaders: origin.originHeaders,
      },
      GSI1PK: DBEntityType.ORIGIN,
      GSI1SK: origin.originName,
      CreatedAt: origin.createdAt,
      UpdatedAt: origin.updatedAt,
    };
  }

  convertFromDB(dbOrigin: DBOrigin): Origin {
    return {
      originId: dbOrigin.PK,
      originName: dbOrigin.Data.originName,
      originDomain: dbOrigin.Data.originDomain,
      originPath: dbOrigin.Data.originPath,
      originHeaders: dbOrigin.Data.originHeaders,
      createdAt: dbOrigin.CreatedAt,
      updatedAt: dbOrigin.UpdatedAt,
    };
  }

  protected validateItem(item: any): z.ZodSafeParseResult<DBOrigin> {
    return validateOriginItem(item);
  }

  private async mappingExists(id: string): Promise<boolean> {
    const data = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :gsi2pk",
        ExpressionAttributeValues: {
          ":gsi2pk": `ORIGIN#${id}`,
        },
      })
    );
    return !!(data.Count && data.Count > 0);
  }
}
