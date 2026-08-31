// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  DynamoDBClient as DDBClient,
  ScanCommand,
  BatchWriteItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

export class DynamoDBClient {
  private readonly ddbClient: DDBClient;

  constructor(
    region: string,
    private readonly tableName: string
  ) {
    this.ddbClient = new DDBClient({ region, credentials: fromNodeProviderChain() });
    this.tableName = tableName;
  }

  /**
   * Reads the stored originHeaders for an origin straight from DynamoDB, as raw attribute values.
   *
   * Lets a test assert what is actually persisted rather than what the API chose to return —
   * necessary because originHeaders values are write-only and never appear in a response.
   *
   * Reads consistently: callers write through the API and read back immediately, so an eventually
   * consistent read could return the pre-write image. That would fail the exact-equality assertions
   * outright, and worse, silently pass the "update omits originHeaders" case — where the stale image
   * carries the same header value the test is checking for.
   *
   * @returns header name → stored string value, or undefined if the item has no headers
   */
  async getStoredOriginHeaders(originId: string): Promise<Record<string, string> | undefined> {
    const result = await this.ddbClient.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: { PK: { S: originId } },
        ConsistentRead: true,
      })
    );

    const headers = result.Item?.Data?.M?.originHeaders?.M;
    if (!headers) return undefined;

    return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, value.S ?? ""]));
  }

  async deleteAllItems() {
    let itemsDeleted = 0;
    let lastEvaluatedKey;

    do {
      const scanResult: ScanCommandOutput = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          ProjectionExpression: "PK",
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      if (scanResult.Items && scanResult.Items.length > 0) {
        const deleteRequests = scanResult.Items.map((item) => ({
          DeleteRequest: { Key: { PK: item.PK } },
        }));

        // BatchWriteItem supports max 25 items per request
        for (let i = 0; i < deleteRequests.length; i += 25) {
          const batch = deleteRequests.slice(i, i + 25);
          await this.ddbClient.send(
            new BatchWriteItemCommand({
              RequestItems: { [this.tableName]: batch },
            })
          );
          itemsDeleted += batch.length;
        }
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }

  async clearTable() {
    const maxRetries = 10;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      await this.deleteAllItems();

      const scanResult = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          Select: "COUNT",
        })
      );

      if (!scanResult.Count || scanResult.Count === 0) {
        return;
      }

      if (attempt < maxRetries) {
        console.log(` 🔁 Table still contains ${scanResult.Count} items, retrying (${attempt}/${maxRetries})...`);
      } else {
        throw new Error(`Table still contains ${scanResult.Count} items after ${maxRetries} attempts`);
      }
    }
  }
}
