// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { z } from "zod";
import { TransformationPolicy } from "../../data-models";
import { BadRequestError, ErrorCodes } from "../common";
import { DBEntityType, DBTransformationPolicy, validatePolicyItem } from "../interfaces";
import { BaseDAO } from "./base-dao";

export class TransformationPolicyDAO extends BaseDAO<DBTransformationPolicy, TransformationPolicy> {
  private static readonly CONTROL_ITEM_PK = "GSI2PK#DEFAULT_POLICY";

  constructor(tableName?: string, ddbDocClient?: DynamoDBDocumentClient) {
    super(tableName, ddbDocClient);
    this.entityType = DBEntityType.POLICY;
  }

  async create(item: DBTransformationPolicy) {
    if (item.Data.isDefault) {
      return this.createDefaultPolicy(item);
    }
    return super.create(item);
  }

  async update(item: DBTransformationPolicy) {
    const currentPolicy = await this.get(item.PK);
    if (!currentPolicy) {
      throw new BadRequestError("Policy not found", ErrorCodes.POLICY_NOT_FOUND);
    }

    const wasDefault = currentPolicy.Data.isDefault;
    const willBeDefault = item.Data.isDefault;

    if (!wasDefault && willBeDefault) {
      return this.updateToDefaultPolicy(item);
    } else if (wasDefault && !willBeDefault) {
      return this.updateFromDefaultPolicy(item);
    }

    return super.update(item);
  }

  async delete(id: string) {
    if (await this.mappingExists(id))
      throw new BadRequestError(
        "Policy is referenced in a mapping and cannot be deleted",
        ErrorCodes.INVALID_FIELD_VALUE
      );

    const policy = await this.get(id);
    if (policy && policy.Data.isDefault) {
      return this.deleteDefaultPolicy(id);
    }

    return super.delete(id);
  }

  convertToDB(policy: TransformationPolicy): DBTransformationPolicy {
    return {
      PK: policy.policyId,
      Data: {
        policyName: policy.policyName,
        description: policy.description,
        policyJSON: JSON.stringify(policy.policyJSON),
        isDefault: policy.isDefault,
      },
      GSI1PK: DBEntityType.POLICY,
      GSI1SK: policy.policyName,
      GSI2PK: policy.isDefault ? "DEFAULT_POLICY" : undefined,
      CreatedAt: policy.createdAt,
      UpdatedAt: policy.updatedAt,
    };
  }

  convertFromDB(dbPolicy: DBTransformationPolicy): TransformationPolicy {
    return {
      policyId: dbPolicy.PK,
      policyName: dbPolicy.Data.policyName,
      description: dbPolicy.Data.description,
      isDefault: dbPolicy.Data.isDefault,
      createdAt: dbPolicy.CreatedAt,
      updatedAt: dbPolicy.UpdatedAt,
      policyJSON: JSON.parse(dbPolicy.Data.policyJSON as string),
    };
  }

  protected validateItem(item: any): z.ZodSafeParseResult<DBTransformationPolicy> {
    return validatePolicyItem(item);
  }

  // implements transaction write with control item
  // helps avoid race condition when concurrent requests try to create/update default policy
  private async createDefaultPolicy(item: DBTransformationPolicy): Promise<DBTransformationPolicy> {
    try {
      const command = new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: item,
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: { PK: TransformationPolicyDAO.CONTROL_ITEM_PK, EntityID: item.PK },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      });

      await this.ddbDocClient.send(command);
      return item;
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        throw new BadRequestError("A default policy already exists", ErrorCodes.INVALID_FIELD_VALUE);
      }
      throw error;
    }
  }

  private async updateToDefaultPolicy(item: DBTransformationPolicy): Promise<DBTransformationPolicy> {
    try {
      const command = new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: item,
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: { PK: TransformationPolicyDAO.CONTROL_ITEM_PK, EntityID: item.PK },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      });

      await this.ddbDocClient.send(command);
      return item;
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        throw new BadRequestError("A default policy already exists", ErrorCodes.INVALID_FIELD_VALUE);
      }
      throw error;
    }
  }

  private async updateFromDefaultPolicy(item: DBTransformationPolicy): Promise<DBTransformationPolicy> {
    const command = new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: this.tableName,
            Item: item,
            ConditionExpression: "attribute_exists(PK)",
          },
        },
        {
          Delete: {
            TableName: this.tableName,
            Key: { PK: TransformationPolicyDAO.CONTROL_ITEM_PK },
            ConditionExpression: "attribute_exists(PK)",
          },
        },
      ],
    });

    await this.ddbDocClient.send(command);
    return item;
  }

  private async deleteDefaultPolicy(id: string): Promise<void> {
    const command = new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: this.tableName,
            Key: { PK: id },
            ConditionExpression: "attribute_exists(PK)",
          },
        },
        {
          Delete: {
            TableName: this.tableName,
            Key: { PK: TransformationPolicyDAO.CONTROL_ITEM_PK },
            ConditionExpression: "attribute_exists(PK)",
          },
        },
      ],
    });
    await this.ddbDocClient.send(command);
  }

  private async mappingExists(id: string): Promise<boolean> {
    const data = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI3",
        KeyConditionExpression: "GSI3PK = :gsi3pk",
        ExpressionAttributeValues: {
          ":gsi3pk": `POLICY#${id}`,
        },
      })
    );
    return !!(data.Count && data.Count > 0);
  }
}
