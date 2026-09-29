// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";
import fc from "fast-check";
import { BaseDAO } from "../dao/base-dao";
import { DBEntityType } from "../interfaces";
import { mockDynamoDBCommands, mockSecretsManagerCommands } from "./mocks";

// Minimal concrete test implementation of BaseDAO
class TestDAO extends BaseDAO<any, any> {
  constructor() {
    super();
    this.entityType = DBEntityType.ORIGIN;
  }

  protected validateItem(item: any): z.ZodSafeParseResult<any> {
    return { success: true, data: item } as z.ZodSafeParseSuccess<any>;
  }

  convertToDB(entity: any): any {
    return entity;
  }

  convertFromDB(entity: any): any {
    return entity;
  }
}

describe("Feature: secure-pagination-tokens, simple Cursor round-trip preservation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CONFIG_TABLE_NAME = "test-table";
    process.env.ACCOUNT_ID = "123456789012";
    process.env.PAGINATION_TOKEN_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should preserve cursor data through token generation and validation", async () => {
    // Mock secret phrase used in key generation
    mockSecretsManagerCommands.get.mockResolvedValue({
      SecretString: "test-secret-key-for-pagination-tokens",
    });

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          PK: fc.string({ minLength: 1 }),
          SK: fc.string({ minLength: 1 }),
          GSI1PK: fc.string({ minLength: 1 }),
          GSI1SK: fc.string({ minLength: 1 }),
        }),
        async (lastEvaluatedKey) => {
          // Clear mocks before each iteration
          mockDynamoDBCommands.query.mockClear();

          const dao = new TestDAO();

          // First call: Generate token with LastEvaluatedKey
          mockDynamoDBCommands.query.mockResolvedValueOnce({
            Items: [{ PK: "test-item", SK: "test-sk" }],
            LastEvaluatedKey: lastEvaluatedKey,
          });

          const firstResult = await dao.getAll();
          expect(firstResult.nextToken).toBeDefined();

          // Second call: Use token to extract cursor
          mockDynamoDBCommands.query.mockResolvedValueOnce({
            Items: [{ PK: "test-item-2", SK: "test-sk-2" }],
            LastEvaluatedKey: undefined,
          });

          await dao.getAll(firstResult.nextToken);

          // Verify the ExclusiveStartKey passed to DynamoDB matches original LastEvaluatedKey
          const secondCallParams = mockDynamoDBCommands.query.mock.calls[1][0];
          expect(secondCallParams.ExclusiveStartKey).toEqual(lastEvaluatedKey);
        }
      ),
      { numRuns: 100 }
    );
  });
});
