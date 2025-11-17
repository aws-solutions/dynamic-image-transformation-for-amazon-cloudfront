// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// create this client for dynamodb
// take region and table name as constructor arguments
// only add one method to delete all items for now
import {
  BillingMode,
  CreateTableCommand,
  DynamoDBClient as DDBClient,
  DeleteTableCommand,
  KeyType,
  ProjectionType,
  ResourceInUseException,
  ResourceNotFoundException,
  ScalarAttributeType,
  StreamViewType,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from "@aws-sdk/client-dynamodb";

export class DynamoDBClient {
  private readonly ddbClient: DDBClient;

  constructor(region: string, private readonly tableName: string) {
    this.ddbClient = new DDBClient({ region });
    this.tableName = tableName;
  }

  async deleteTable() {
    try {
      await this.ddbClient.send(new DeleteTableCommand({ TableName: this.tableName }));
      console.log(`Table ${this.tableName} deletion initiated`);

      // Wait for table to be deleted
      await waitUntilTableNotExists({ client: this.ddbClient, maxWaitTime: 300 }, { TableName: this.tableName });
      console.log(`Table ${this.tableName} deleted successfully`);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        console.log(`Table ${this.tableName} does not exist`);
      } else if (error instanceof ResourceInUseException) {
        console.log(`Table ${this.tableName} is being deleted,`);
        await waitUntilTableNotExists({ client: this.ddbClient, maxWaitTime: 300 }, { TableName: this.tableName });
      } else {
        throw error;
      }
    }
  }

  async recreateTable() {
    await this.deleteTable();

    // Create table with configuration matching CDK definition
    const createParams = {
      TableName: this.tableName,
      KeySchema: [{ AttributeName: "PK", KeyType: KeyType.HASH }],
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: ScalarAttributeType.S },
        { AttributeName: "GSI1PK", AttributeType: ScalarAttributeType.S },
        { AttributeName: "GSI1SK", AttributeType: ScalarAttributeType.S },
        { AttributeName: "GSI2PK", AttributeType: ScalarAttributeType.S },
        { AttributeName: "GSI3PK", AttributeType: ScalarAttributeType.S },
      ],
      BillingMode: BillingMode.PAY_PER_REQUEST,
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: StreamViewType.NEW_AND_OLD_IMAGES,
      },
      SSESpecification: {
        Enabled: true,
      },
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSI1",
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: KeyType.HASH },
            { AttributeName: "GSI1SK", KeyType: KeyType.RANGE },
          ],
          Projection: { ProjectionType: ProjectionType.ALL },
        },
        {
          IndexName: "GSI2",
          KeySchema: [{ AttributeName: "GSI2PK", KeyType: KeyType.HASH }],
          Projection: { ProjectionType: ProjectionType.ALL },
        },
        {
          IndexName: "GSI3",
          KeySchema: [{ AttributeName: "GSI3PK", KeyType: KeyType.HASH }],
          Projection: { ProjectionType: ProjectionType.ALL },
        },
      ],
    };
    try {
      await this.ddbClient.send(new CreateTableCommand(createParams));
      console.log(`Table ${this.tableName} recreation initiated`);
    } catch (error) {
      if (error instanceof ResourceInUseException) {
        console.log(`Table ${this.tableName} already exists`);
      } else {
        console.log(`Table ${this.tableName} recreation failed`, error);
        throw error;
      }
    }

    await waitUntilTableExists({ client: this.ddbClient, maxWaitTime: 300 }, { TableName: this.tableName });
    console.log(`Table ${this.tableName} recreated successfully`);
  }
}
