// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient as AWSDynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { TEST_POLICY_ID, TEST_THUMBNAIL_POLICY_ID, TEST_ORIGIN_ID, TEST_MAPPING_ID, TEST_EXTERNAL_ORIGIN_ID, TEST_EXTERNAL_MAPPING_ID } from './test-constants';

export class DynamoDBClient {
  private docClient: DynamoDBDocumentClient;
  private testRunId = `e2e-${Date.now()}`;
  private createdIds: string[] = [];

  constructor(private region: string, private tableName: string) {
    const ddbClient = new AWSDynamoDBClient({ region });
    this.docClient = DynamoDBDocumentClient.from(ddbClient);
  }

  async seedTestData(): Promise<{ policyId: string; originId: string; mappingId: string }> {
    console.log('Seeding DynamoDB test data...');
    const policyId = await this.seedDefaultPolicy();
    await this.seedThumbnailPolicy();
    const originId = await this.seedOrigins();
    const mappingId = await this.seedMappings(originId, policyId);
    console.log(`✓ Test data seeded: policy=${policyId}, origin=${originId}, mapping=${mappingId}`);
    return { policyId, originId, mappingId };
  }

  async seedExternalOrigin(externalOriginUrl: string): Promise<{ originId: string; mappingId: string }> {
    console.log(`Seeding external origin: ${externalOriginUrl}`);
    const originId = TEST_EXTERNAL_ORIGIN_ID;
    const mappingId = TEST_EXTERNAL_MAPPING_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(originId, mappingId);
    
    const url = new URL(externalOriginUrl);
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: originId,
        GSI1PK: 'ORIGIN',
        GSI1SK: originId,
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          originName: originId,
          originDomain: url.hostname,
          originPath: url.pathname || '/'
        }
      }
    }));

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: mappingId,
        GSI1PK: 'PATH_MAPPING',
        GSI1SK: '/external/*',
        GSI2PK: `ORIGIN#${originId}`,
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          originId
        }
      }
    }));
    
    console.log(`✓ External origin seeded: origin=${originId}, mapping=${mappingId}`);
    return { originId, mappingId };
  }

  private async seedDefaultPolicy(): Promise<string> {
    const policyId = TEST_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating default policy: ${policyId}`);
    
    const policyJSON = JSON.stringify({
      transformations: [
        { transformation: 'resize', value: { width: 200, height: 200, fit: 'cover' } }
      ]
    });
    
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: `test-policy-${policyId}`,
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          policyName: `test-policy-${policyId}`,
          policyJSON,
          isDefault: true
        }
      }
    }));
    
    console.log(`  ✓ Default policy created`);
    return policyId;
  }

  private async seedThumbnailPolicy(): Promise<string> {
    const policyId = TEST_THUMBNAIL_POLICY_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(policyId);
    console.log(`  Creating thumbnail policy: ${policyId}`);
    
    const policyJSON = JSON.stringify({
      transformations: [
        { transformation: 'resize', value: { width: 100, height: 100, fit: 'cover' } }
      ]
    });
    
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: policyId,
        GSI1PK: 'POLICY',
        GSI1SK: 'thumbnail',
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          policyName: 'thumbnail',
          policyJSON,
          isDefault: false
        }
      }
    }));
    
    console.log(`  ✓ Thumbnail policy created`);
    return policyId;
  }

  private async seedOrigins(): Promise<string> {
    const originId = TEST_ORIGIN_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(originId);
    console.log(`  Creating origin: ${originId}`);
    
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: originId,
        GSI1PK: 'ORIGIN',
        GSI1SK: originId,
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        Data: {
          originName: originId,
          originDomain: `${process.env.TEST_BUCKET}.s3.${this.region}.amazonaws.com`,
          originPath: '/'
        }
      }
    }));
    
    console.log(`  ✓ Origin created`);
    return originId;
  }

  private async seedMappings(originId: string, policyId?: string): Promise<string> {
    const mappingId = TEST_MAPPING_ID;
    const timestamp = new Date().toISOString();
    this.createdIds.push(mappingId);
    console.log(`  Creating mapping: ${mappingId}`);
    
    const item: Record<string, any> = {
      PK: mappingId,
      GSI1PK: 'PATH_MAPPING',
      GSI1SK: '/*',
      GSI2PK: `ORIGIN#${originId}`,
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
      Data: {
        originId
      }
    };
    
    if (policyId) {
      item.GSI3PK = `POLICY#${policyId}`;
      item.Data.policyId = policyId;
    }
    
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: item
    }));
    
    console.log(`  ✓ Mapping created`);
    return mappingId;
  }

  async clearTestData(): Promise<void> {
    if (this.createdIds.length < 1) return;
    
    console.log(`Cleaning up DynamoDB test data (${this.createdIds.length} items)...`);
    for (const id of this.createdIds) {
      await this.docClient.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: id }
      }));
      console.log(` Deleted: ${id}`)
    }
    console.log(`✓ DynamoDB test data cleared`);
  }

  getTestRunId(): string {
    return this.testRunId;
  }
}
