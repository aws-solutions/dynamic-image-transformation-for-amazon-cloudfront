// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'crypto';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getOptions } from '../../utils/get-options';
import { DetectionResult, RekognitionApiName } from './types';

const DEFAULT_TTL_SECONDS = 86400;

export class RekognitionCacheDao {
  private client: DynamoDBClient;
  private readonly tableName: string;
  private readonly ttlSeconds: number;

  constructor(client?: DynamoDBClient) {
    this.client = client ?? new DynamoDBClient(getOptions());
    this.tableName = process.env.REKOGNITION_CACHE_TABLE!;
    this.ttlSeconds = parseInt(process.env.REKOGNITION_CACHE_TTL ?? '', 10) || DEFAULT_TTL_SECONDS;
  }

  async get(imageBytes: Buffer, apiName: RekognitionApiName, customModelArn?: string): Promise<DetectionResult | null> {
    const pk = this.buildPartitionKey(imageBytes);
    const sk = this.buildSortKey(apiName, customModelArn);
    const response = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ pk, sk }),
    }));
    if (!response.Item) return null;
    const raw = unmarshall(response.Item);
    if (raw.ttl <= Math.floor(Date.now() / 1000)) return null;
    return raw.result as DetectionResult;
  }

  async put(imageBytes: Buffer, apiName: RekognitionApiName, result: DetectionResult, customModelArn?: string): Promise<void> {
    const pk = this.buildPartitionKey(imageBytes);
    const sk = this.buildSortKey(apiName, customModelArn);
    const ttl = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const cachedAt = new Date().toISOString();
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({ pk, sk, result, ttl, cachedAt }, { removeUndefinedValues: true }),
    }));
  }

  private buildPartitionKey(imageBytes: Buffer): string {
    return createHash('sha256').update(imageBytes).digest('hex');
  }

  private buildSortKey(apiName: RekognitionApiName, customModelArn?: string): string {
    if (apiName === 'DetectCustomLabels' && customModelArn) {
      return `${apiName}#${customModelArn}`;
    }
    return apiName;
  }
}
