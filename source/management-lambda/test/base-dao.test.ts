// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";
import { BaseDAO } from "../dao/base-dao";
import { DBEntityType } from "../interfaces";
import { PaginationTokenService } from "../common/pagination-token-service";
import { mockSecretsManagerCommands, mockDynamoDBCommands } from "./mocks";

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

describe("BaseDAO Initialization", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("tokenService initialization", () => {
    it("should initialize tokenService property", () => {
      process.env.CONFIG_TABLE_NAME = "test-table";
      process.env.ACCOUNT_ID = "123456789012";
      process.env.PAGINATION_TOKEN_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";

      const dao = new TestDAO();

      expect((dao as any).tokenService).toBeInstanceOf(PaginationTokenService);
    });
  });

  describe("ACCOUNT_ID environment variable", () => {
    it("should throw error when ACCOUNT_ID environment variable is not set", () => {
      process.env.CONFIG_TABLE_NAME = "test-table";
      delete process.env.ACCOUNT_ID;

      expect(() => {
        new TestDAO();
      }).toThrow("ACCOUNT_ID environment variable is required");
    });

    it("should throw error when ACCOUNT_ID is empty string", () => {
      process.env.CONFIG_TABLE_NAME = "test-table";
      process.env.ACCOUNT_ID = "";

      expect(() => {
        new TestDAO();
      }).toThrow("ACCOUNT_ID environment variable is required");
    });

    it("should initialize successfully with valid ACCOUNT_ID", () => {
      process.env.CONFIG_TABLE_NAME = "test-table";
      process.env.ACCOUNT_ID = "123456789012";

      expect(() => {
        new TestDAO();
      }).not.toThrow();
    });

    it("should have accountId property accessible and matching environment variable", () => {
      const testAccountId = "123456789012";
      process.env.CONFIG_TABLE_NAME = "test-table";
      process.env.ACCOUNT_ID = testAccountId;

      const dao = new TestDAO();

      expect((dao as any).accountId).toBe(testAccountId);
    });
  });

  describe("CONFIG_TABLE_NAME environment variable (existing behavior)", () => {
    it("should still throw error when CONFIG_TABLE_NAME is not set", () => {
      delete process.env.CONFIG_TABLE_NAME;
      process.env.ACCOUNT_ID = "123456789012";

      expect(() => {
        new TestDAO();
      }).toThrow("CONFIG_TABLE_NAME environment variable is required");
    });
  });
});

describe("BaseDAO.getAll() Token Handling", () => {
  const originalEnv = process.env;
  let dao: TestDAO;
  const testAccountId = "123456789012";

  mockSecretsManagerCommands.get.mockResolvedValue({
    SecretString: "test-secret-key-for-pagination-tokens",
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CONFIG_TABLE_NAME = "test-table";
    process.env.ACCOUNT_ID = testAccountId;
    process.env.PAGINATION_TOKEN_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Invalid token handling (graceful degradation)", () => {
    it("should gracefully degrade and start fresh with any invalid token", async () => {
      dao = new TestDAO();

      // Test with various invalid tokens - all should result in same behavior
      const invalidTokens = [
        "completely-invalid-token",
        "dGFtcGVyZWQtdG9rZW4=", // Valid base64 but invalid token
        Buffer.from("malformed").toString("base64"),
      ];

      for (const invalidToken of invalidTokens) {
        jest.clearAllMocks();

        const freshItems = [{ PK: "fresh1", SK: "sk1", data: "fresh" }];
        mockDynamoDBCommands.query.mockResolvedValueOnce({
          Items: freshItems,
          LastEvaluatedKey: undefined,
        });

        // Should not throw - graceful degradation
        const result = await dao.getAll(invalidToken);

        expect(result.items).toEqual(freshItems);
        // Verify query was made without ExclusiveStartKey (starting fresh)
        const callArgs = mockDynamoDBCommands.query.mock.calls[0][0];
        expect(callArgs.ExclusiveStartKey).toBeUndefined();
      }
    });
  });

  describe("Token generation", () => {
    it("should generate encrypted token when LastEvaluatedKey exists", async () => {
      const testItems = [{ PK: "item1", SK: "sk1", data: "test1" }];
      const lastEvaluatedKey = { PK: "item1", SK: "sk1", GSI1PK: "ORIGIN" };

      mockDynamoDBCommands.query.mockResolvedValueOnce({
        Items: testItems,
        LastEvaluatedKey: lastEvaluatedKey,
      });

      dao = new TestDAO();
      const result = await dao.getAll();

      expect(result.nextToken).toBeDefined();
      expect(typeof result.nextToken).toBe("string");

      // Token must be valid base64url (URL-safe, no padding) so it survives query-string transport.
      // generateToken() encodes with "base64url", so decode with the matching encoding.
      expect(result.nextToken).toMatch(/^[A-Za-z0-9_-]+$/);

      // Structural integrity: format is [iv_length(1)][iv][auth_tag(16)][ciphertext].
      // Verify real ciphertext exists beyond the IV + auth tag header (i.e. encryption produced output).
      const tokenBuffer = Buffer.from(result.nextToken!, "base64url");
      const ivLength = tokenBuffer[0];
      const ciphertext = tokenBuffer.subarray(1 + ivLength + 16);
      expect(ciphertext.length).toBeGreaterThan(0);

      // Not-plaintext: the token must differ from a naive base64url encoding of the raw cursor JSON.
      // This deterministically proves the payload was encrypted, not trivially encoded. Unlike scanning
      // pseudorandom AES-GCM ciphertext for field names (which can coincidentally match), this cannot
      // false-positive: encrypted output will never equal the plaintext encoding.
      const plaintextEncoded = Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64url");
      expect(result.nextToken).not.toContain(plaintextEncoded);
    });

    it("should return no token when LastEvaluatedKey is undefined", async () => {
      const testItems = [{ PK: "item1", SK: "sk1", data: "test1" }];

      mockDynamoDBCommands.query.mockResolvedValueOnce({
        Items: testItems,
        LastEvaluatedKey: undefined,
      });

      dao = new TestDAO();
      const result = await dao.getAll();

      expect(result.items).toEqual(testItems);
      expect(result.nextToken).toBeUndefined();
    });
  });
});
