// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { getOptions } from '../../utils/get-options';
import { DDBDriver } from './ddb-driver.interface';
import { PathMapping } from '../cache/domain/path-mapping-cache';
import { HeaderMapping } from '../cache/domain/header-mapping-cache';
import { OriginConfiguration } from '../cache/domain/origin-cache';
import { TransformationPolicyRecord } from './types';

/**
 * DynamoDB Driver Implementation
 * Pure Data Access Layer for DIT entities
 */
export class DDBDriverImpl implements DDBDriver {
  private dynamoClient: DynamoDBClient;
  private readonly tableName: string;

  constructor(tableName: string, dynamoClient?: DynamoDBClient) {
    this.tableName = tableName;
    this.dynamoClient = dynamoClient ?? new DynamoDBClient(getOptions({
      // Use local endpoint if specified in environment
      ...(process.env.AWS_ENDPOINT_URL_DYNAMODB && {
        endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB
      })
    }));
  }

  async getAllPathMappings(): Promise<PathMapping[]> {
    const allItems = [];
    let lastEvaluatedKey = undefined;

    do {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :entityType',
        ExpressionAttributeValues: {
          ':entityType': { S: 'PATH_MAPPING' }
        },
        ExclusiveStartKey: lastEvaluatedKey
      });

      const response = await this.dynamoClient.send(command);
      
      if (response.Items) {
        allItems.push(...response.Items);
      }
      
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems.map(item => {
      const unmarshalled = unmarshall(item);
      return {
        pathPattern: unmarshalled.GSI1SK,
        originId: unmarshalled.Data.originId,
        policyId: unmarshalled.Data.policyId
      };
    });
  }

  async getAllHeaderMappings(): Promise<HeaderMapping[]> {
    const allItems = [];
    let lastEvaluatedKey = undefined;

    do {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :entityType',
        ExpressionAttributeValues: {
          ':entityType': { S: 'HOST_HEADER_MAPPING' }
        },
        ExclusiveStartKey: lastEvaluatedKey
      });

      const response = await this.dynamoClient.send(command);

      if (response.Items) {
        allItems.push(...response.Items);
      }
      
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems.map(item => {
      const unmarshalled = unmarshall(item);
      return {
        hostPattern: unmarshalled.GSI1SK,
        originId: unmarshalled.Data.originId,
        policyId: unmarshalled.Data.policyId
      };
    });
  }

  async getAllOrigins(): Promise<OriginConfiguration[]> {
    const allItems = [];
    let lastEvaluatedKey = undefined;

    do {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :entityType',
        ExpressionAttributeValues: {
          ':entityType': { S: 'ORIGIN' }
        },
        ExclusiveStartKey: lastEvaluatedKey
      });

      const response = await this.dynamoClient.send(command);
      
      if (response.Items) {
        allItems.push(...response.Items);
      }
      
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems.map(item => {
      const unmarshalled = unmarshall(item);
      return {
        originId: unmarshalled.PK,
        originName: unmarshalled.GSI1SK,
        originDomain: unmarshalled.Data.originDomain,
        originPath: unmarshalled.Data.originPath,
        originHeaders: unmarshalled.Data.originHeaders
      };
    });
  }

  async getAllPolicies(): Promise<TransformationPolicyRecord[]> {
    const allItems = [];
    let lastEvaluatedKey = undefined;

    do {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :entityType',
        ExpressionAttributeValues: {
          ':entityType': { S: 'POLICY' }
        },
        ExclusiveStartKey: lastEvaluatedKey
      });

      const response = await this.dynamoClient.send(command);

      if (response.Items) {
        allItems.push(...response.Items);
      }
      
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems.map(item => {
      const unmarshalled = unmarshall(item);
      return {
        policyId: unmarshalled.PK,
        policyName: unmarshalled.GSI1SK,
        description: unmarshalled.Data.description,
        policyJSON: unmarshalled.Data.policyJSON,
        isDefault: unmarshalled.Data.isDefault || false
      };
    });
  }
}