// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MappingDAO } from "../../dao";
import { NotFoundError, ErrorCodes } from "../../common";
import { DBEntityType } from "../../interfaces";
import {
  mockHostHeaderMapping,
  mockHostHeaderMappingDDB,
  mockPathMapping,
  mockPathMappingDDB,
  mockDynamoDBCommands,
  mockSecretsManagerCommands,
  mockUUIDV4,
  mockUUIDV4_2,
} from "../mocks";

describe("MappingDAO", () => {
  describe("Path Mapping", () => {
    let pathMappingDAO: MappingDAO;
    const tableName = "test-table";
    const ddbDocClient = {} as any;

    beforeEach(() => {
      pathMappingDAO = new MappingDAO(tableName, ddbDocClient);
      jest.clearAllMocks();
    });

    describe("convertToDB", () => {
      it("should convert path Mapping to DBMapping", () => {
        const result = pathMappingDAO.convertToDB(mockPathMapping);

        expect(result).toEqual(mockPathMappingDDB);
      });
    });

    describe("convertFromDB", () => {
      it("should convert DBMapping to path Mapping", () => {
        const result = pathMappingDAO.convertFromDB(mockPathMappingDDB);

        expect(result).toEqual(mockPathMapping);
      });
    });
  });

  describe("Host Header Mapping", () => {
    let hostHeaderMappingDAO: MappingDAO;
    const tableName = "test-table";
    const ddbDocClient = {} as any;

    beforeEach(() => {
      hostHeaderMappingDAO = new MappingDAO(tableName, ddbDocClient);
      jest.clearAllMocks();
    });

    describe("convertToDB", () => {
      it("should convert host header Mapping to DBMapping", () => {
        const result = hostHeaderMappingDAO.convertToDB(mockHostHeaderMapping);

        expect(result).toEqual(mockHostHeaderMappingDDB);
      });
    });

    describe("convertFromDB", () => {
      it("should convert DBMapping to host header Mapping", () => {
        const result = hostHeaderMappingDAO.convertFromDB(mockHostHeaderMappingDDB);

        expect(result).toEqual(mockHostHeaderMapping);
      });
    });
  });

  describe("Entity Validation", () => {
    let mappingDAO: MappingDAO;
    const tableName = "test-table";

    beforeEach(() => {
      mappingDAO = new MappingDAO(tableName);
      jest.clearAllMocks();
    });

    describe("create", () => {
      it("should throw NotFoundError when origin does not exist", async () => {
        mockDynamoDBCommands.get.mockResolvedValue({ Item: null });

        await expect(mappingDAO.create(mockPathMappingDDB)).rejects.toThrow(
          new NotFoundError("Origin does not exist", ErrorCodes.ORIGIN_NOT_FOUND)
        );
      });

      it("should throw NotFoundError when entity exists but is not origin", async () => {
        mockDynamoDBCommands.get.mockResolvedValue({
          Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.POLICY },
        });

        await expect(mappingDAO.create(mockPathMappingDDB)).rejects.toThrow(
          new NotFoundError("Origin does not exist", ErrorCodes.ORIGIN_NOT_FOUND)
        );
      });

      it("should throw NotFoundError when policy does not exist", async () => {
        mockDynamoDBCommands.get
          .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.ORIGIN } })
          .mockResolvedValueOnce({ Item: null });

        await expect(mappingDAO.create(mockPathMappingDDB)).rejects.toThrow(
          new NotFoundError("Policy does not exist", ErrorCodes.POLICY_NOT_FOUND)
        );
      });

      it("should throw NotFoundError when entity exists but is not policy", async () => {
        mockDynamoDBCommands.get
          .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.ORIGIN } })
          .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.ORIGIN } });

        await expect(mappingDAO.create(mockPathMappingDDB)).rejects.toThrow(
          new NotFoundError("Policy does not exist", ErrorCodes.POLICY_NOT_FOUND)
        );
      });
    });

    describe("update", () => {
      it("should throw NotFoundError when origin does not exist", async () => {
        mockDynamoDBCommands.get.mockResolvedValue({ Item: null });

        await expect(mappingDAO.update(mockPathMappingDDB)).rejects.toThrow(
          new NotFoundError("Origin does not exist", ErrorCodes.ORIGIN_NOT_FOUND)
        );
      });

      it("should throw NotFoundError when entity exists but is not origin", async () => {
        mockDynamoDBCommands.get.mockResolvedValue({
          Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.POLICY },
        });

        await expect(mappingDAO.update(mockPathMappingDDB)).rejects.toThrow(
          new NotFoundError("Origin does not exist", ErrorCodes.ORIGIN_NOT_FOUND)
        );
      });

      it("should throw NotFoundError when policy does not exist", async () => {
        mockDynamoDBCommands.get
          .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.ORIGIN } })
          .mockResolvedValueOnce({ Item: null });

        await expect(mappingDAO.update(mockPathMappingDDB)).rejects.toThrow(
          new NotFoundError("Policy does not exist", ErrorCodes.POLICY_NOT_FOUND)
        );
      });

      it("should throw NotFoundError when entity exists but is not policy", async () => {
        mockDynamoDBCommands.get
          .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.ORIGIN } })
          .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.ORIGIN } });

        await expect(mappingDAO.update(mockPathMappingDDB)).rejects.toThrow(
          new NotFoundError("Policy does not exist", ErrorCodes.POLICY_NOT_FOUND)
        );
      });
    });
  });

  describe("getAll() - Composite Token Handling", () => {
    let mappingDAO: MappingDAO;
    const originalEnv = process.env;

    beforeEach(() => {
      jest.clearAllMocks();
      process.env = { ...originalEnv };
      process.env.CONFIG_TABLE_NAME = "test-table";
      process.env.ACCOUNT_ID = "123456789012";
      process.env.PAGINATION_TOKEN_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";

      mappingDAO = new MappingDAO();

      // Mock secret for token service
      mockSecretsManagerCommands.get.mockResolvedValue({
        SecretString: "test-secret-key-for-pagination-tokens",
      });
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should gracefully degrade with invalid composite token", async () => {
      const invalidToken = "invalid-token-that-cannot-be-decrypted";

      // Mock queries to return fresh results
      mockDynamoDBCommands.query
        .mockResolvedValueOnce({
          Items: [mockPathMappingDDB],
          LastEvaluatedKey: undefined,
        })
        .mockResolvedValueOnce({
          Items: [mockHostHeaderMappingDDB],
          LastEvaluatedKey: undefined,
        });

      const result = await mappingDAO.getAll(invalidToken);

      // Should return results starting from beginning
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual(mockPathMappingDDB);
      expect(result.items[1]).toEqual(mockHostHeaderMappingDDB);
      expect(result.nextToken).toBeUndefined();

      // Verify queries were called without ExclusiveStartKey
      const pathQueryCall = mockDynamoDBCommands.query.mock.calls[0][0];
      expect(pathQueryCall.ExclusiveStartKey).toBeUndefined();

      const hostQueryCall = mockDynamoDBCommands.query.mock.calls[1][0];
      expect(hostQueryCall.ExclusiveStartKey).toBeUndefined();
    });

    it("should generate composite token when both queries have more results", async () => {
      const pathCursor = { PK: "path-1", GSI1PK: "PATH_MAPPING", GSI1SK: "/api/*" };
      const hostHeaderCursor = { PK: "host-1", GSI1PK: "HOST_HEADER_MAPPING", GSI1SK: "*.example.com" };

      mockDynamoDBCommands.query
        .mockResolvedValueOnce({
          Items: [mockPathMappingDDB],
          LastEvaluatedKey: pathCursor,
        })
        .mockResolvedValueOnce({
          Items: [mockHostHeaderMappingDDB],
          LastEvaluatedKey: hostHeaderCursor,
        });

      const result = await mappingDAO.getAll();

      expect(result.items).toHaveLength(2);
      expect(result.nextToken).toBeDefined();
      expect(typeof result.nextToken).toBe("string");

      // Verify token is encrypted (Base64url encoded)
      expect(result.nextToken).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate composite token when only path query has more results", async () => {
      const pathCursor = { PK: "path-1", GSI1PK: "PATH_MAPPING", GSI1SK: "/api/*" };

      mockDynamoDBCommands.query
        .mockResolvedValueOnce({
          Items: [mockPathMappingDDB],
          LastEvaluatedKey: pathCursor,
        })
        .mockResolvedValueOnce({
          Items: [mockHostHeaderMappingDDB],
          LastEvaluatedKey: undefined, // No more host header results
        });

      const result = await mappingDAO.getAll();

      expect(result.items).toHaveLength(2);
      expect(result.nextToken).toBeDefined();
      expect(typeof result.nextToken).toBe("string");

      // Verify token contains only path cursor
      // We can verify this by using the token in a second call
      mockDynamoDBCommands.query.mockResolvedValueOnce({
        Items: [{ ...mockPathMappingDDB, PK: mockUUIDV4_2 }],
        LastEvaluatedKey: undefined,
      });

      await mappingDAO.getAll(result.nextToken);

      // Path query should use cursor, host header query should not be called
      const pathQueryCall = mockDynamoDBCommands.query.mock.lastCall[0];
      expect(pathQueryCall.ExpressionAttributeValues[":gsi1pk"]).toEqual("PATH_MAPPING");
      expect(pathQueryCall.ExclusiveStartKey).toEqual(pathCursor);
      expect(mockDynamoDBCommands.query.mock.calls.length).toBe(3);
    });

    it("should generate composite token when only host header query has more results", async () => {
      const hostHeaderCursor = { PK: "host-1", SK: "sk-1", GSI1PK: "HOST_HEADER_MAPPING", GSI1SK: "*.example.com" };

      mockDynamoDBCommands.query
        .mockResolvedValueOnce({
          Items: [mockPathMappingDDB],
          LastEvaluatedKey: undefined, // No more path results
        })
        .mockResolvedValueOnce({
          Items: [mockHostHeaderMappingDDB],
          LastEvaluatedKey: hostHeaderCursor,
        });

      const result = await mappingDAO.getAll();

      expect(result.items).toHaveLength(2);
      expect(result.nextToken).toBeDefined();
      expect(typeof result.nextToken).toBe("string");

      // Verify token contains only host header cursor
      mockDynamoDBCommands.query.mockResolvedValueOnce({
        Items: [{ ...mockHostHeaderMappingDDB, PK: mockUUIDV4_2 }],
        LastEvaluatedKey: undefined,
      });

      await mappingDAO.getAll(result.nextToken);

      // Path query should not be called, host header query should
      const hostQueryCall = mockDynamoDBCommands.query.mock.lastCall[0];
      expect(hostQueryCall.ExpressionAttributeValues[":gsi1pk"]).toEqual("HOST_HEADER_MAPPING");
      expect(hostQueryCall.ExclusiveStartKey).toEqual(hostHeaderCursor);
      expect(mockDynamoDBCommands.query.mock.calls.length).toBe(3);
    });

    it("should return no token when neither query has more results", async () => {
      mockDynamoDBCommands.query
        .mockResolvedValueOnce({
          Items: [mockPathMappingDDB],
          LastEvaluatedKey: undefined,
        })
        .mockResolvedValueOnce({
          Items: [mockHostHeaderMappingDDB],
          LastEvaluatedKey: undefined,
        });

      const result = await mappingDAO.getAll();

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual(mockPathMappingDDB);
      expect(result.items[1]).toEqual(mockHostHeaderMappingDDB);
      expect(result.nextToken).toBeUndefined();
    });
  });
});
