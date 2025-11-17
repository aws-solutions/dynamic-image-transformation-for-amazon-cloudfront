// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient, CreateTableCommand, DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ALL_TEST_DATA } from './test-data';

export class DynamoDBTestSetup {
  private static ddbClient: DynamoDBClient;
  private static docClient: DynamoDBDocumentClient;

  static initialize() {
    this.ddbClient = new DynamoDBClient({
      endpoint: 'http://localhost:8000',
      region: 'local-env',
      credentials: { accessKeyId: 'fakeKey', secretAccessKey: 'fakeSecret' }
    });
    this.docClient = DynamoDBDocumentClient.from(this.ddbClient);
  }

  static async createTable(tableName: string): Promise<void> {
    // Delete table if it exists
    await this.deleteTable(tableName);
    
    // Wait a moment for deletion to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const createTableCommand = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' },
        { AttributeName: 'GSI2PK', AttributeType: 'S' },
        { AttributeName: 'GSI2SK', AttributeType: 'S' },
        { AttributeName: 'GSI3PK', AttributeType: 'S' },
        { AttributeName: 'GSI3SK', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        },
        {
          IndexName: 'GSI2',
          KeySchema: [
            { AttributeName: 'GSI2PK', KeyType: 'HASH' },
            { AttributeName: 'GSI2SK', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        },
        {
          IndexName: 'GSI3',
          KeySchema: [
            { AttributeName: 'GSI3PK', KeyType: 'HASH' },
            { AttributeName: 'GSI3SK', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    });

    await this.ddbClient.send(createTableCommand);
  }

  static async deleteTable(tableName: string): Promise<void> {
    try {
      await this.ddbClient.send(new DeleteTableCommand({ TableName: tableName }));
    } catch (error) {
      // Table might not exist, ignore error
    }
  }

  static async seedTestData(tableName: string): Promise<void> {
    for (const item of ALL_TEST_DATA) {
      await this.docClient.send(new PutCommand({
        TableName: tableName,
        Item: item
      }));
    }
  }

  static async clearTable(tableName: string): Promise<void> {
    const scanResult = await this.docClient.send(new ScanCommand({
      TableName: tableName
    }));

    if (scanResult.Items) {
      for (const item of scanResult.Items) {
        await this.docClient.send(new DeleteCommand({
          TableName: tableName,
          Key: { PK: item.PK }
        }));
      }
    }
  }

  static async putItem(tableName: string, item: any): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: tableName,
      Item: item
    }));
  }
}