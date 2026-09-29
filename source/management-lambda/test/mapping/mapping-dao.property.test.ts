// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fc from "fast-check";
import { MappingDAO } from "../../dao/mapping-dao";
import {
  mockDynamoDBCommands,
  mockSecretsManagerCommands,
  mockPathMappingDDB,
  mockHostHeaderMappingDDB,
} from "../mocks";

/**
 * Property-based tests for MappingDAO composite cursor handling
 */
describe("Secure-pagination-tokens, composite cursor round trip", () => {
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

  /**
   *
   * Property: For any pair of valid DynamoDB LastEvaluatedKey objects (one for path mappings,
   * one for host header mappings), when MappingDAO generates a composite token and then validates
   * and extracts the cursors, the extracted cursors should match the original cursors and allow
   * pagination to continue correctly for both entity types.
   */
  it("should preserve composite cursors through token generation and validation", async () => {
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
        fc.record({
          PK: fc.string({ minLength: 1 }),
          SK: fc.string({ minLength: 1 }),
          GSI1PK: fc.string({ minLength: 1 }),
          GSI1SK: fc.string({ minLength: 1 }),
        }),
        async (pathCursor, hostHeaderCursor) => {
          // Clear mocks before each iteration
          mockDynamoDBCommands.query.mockClear();

          const dao = new MappingDAO();

          // First call: Generate composite token with both cursors
          // Mock path mapping query
          mockDynamoDBCommands.query.mockResolvedValueOnce({
            Items: [mockPathMappingDDB],
            LastEvaluatedKey: pathCursor,
          });

          // Mock host header mapping query
          mockDynamoDBCommands.query.mockResolvedValueOnce({
            Items: [mockHostHeaderMappingDDB],
            LastEvaluatedKey: hostHeaderCursor,
          });

          const firstResult = await dao.getAll();
          expect(firstResult.nextToken).toBeDefined();

          // Verify items returned from first call
          expect(firstResult.items).toHaveLength(2);
          expect(firstResult.items[0]).toEqual(mockPathMappingDDB);
          expect(firstResult.items[1]).toEqual(mockHostHeaderMappingDDB);

          // Second call: Use composite token to extract cursors
          // Mock path mapping query with extracted cursor
          const pathItem2 = {
            ...mockPathMappingDDB,
            PK: "path-item-2",
            CreatedAt: "2024-01-02T00:00:00.000Z",
          };
          mockDynamoDBCommands.query.mockResolvedValueOnce({
            Items: [pathItem2],
            LastEvaluatedKey: undefined,
          });

          // Mock host header mapping query with extracted cursor
          const hostItem2 = {
            ...mockHostHeaderMappingDDB,
            PK: "host-item-2",
            CreatedAt: "2024-01-02T00:00:00.000Z",
          };
          mockDynamoDBCommands.query.mockResolvedValueOnce({
            Items: [hostItem2],
            LastEvaluatedKey: undefined,
          });

          const secondResult = await dao.getAll(firstResult.nextToken);

          // Verify items returned from second call
          expect(secondResult.items).toHaveLength(2);
          expect(secondResult.items[0]).toEqual(pathItem2);
          expect(secondResult.items[1]).toEqual(hostItem2);

          // Verify the ExclusiveStartKey passed to DynamoDB for path mappings matches original cursor
          const pathQueryParams = mockDynamoDBCommands.query.mock.calls[2][0];
          expect(pathQueryParams.ExclusiveStartKey).toEqual(pathCursor);

          // Verify the ExclusiveStartKey passed to DynamoDB for host header mappings matches original cursor
          const hostHeaderQueryParams = mockDynamoDBCommands.query.mock.calls[3][0];
          expect(hostHeaderQueryParams.ExclusiveStartKey).toEqual(hostHeaderCursor);
        }
      ),
      { numRuns: 100 }
    );
  });
});
