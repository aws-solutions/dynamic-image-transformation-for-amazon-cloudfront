// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MappingService } from "../../services/mapping-service";
import { BadRequestError } from "../../common";
import { DBEntityType } from "../../interfaces";
import {
  mockPathMappingDDB,
  mockDynamoDBCommands,
  mockSecretsManagerCommands,
  mockUUIDV4,
} from "../mocks";

const TABLE_NAME = "test-table";

// Helper: mock get to return the mapping first, then origin/policy existence checks
const mockEntityLookups = (mappingDDB: any, originExists = true, policyExists = true) => {
  mockDynamoDBCommands.get
    .mockResolvedValueOnce({ Item: mappingDDB }) // get mapping by ID
    .mockResolvedValueOnce({ Item: originExists ? { PK: mockUUIDV4, GSI1PK: DBEntityType.ORIGIN } : undefined }) // entityExists(originId)
    .mockResolvedValueOnce({ Item: policyExists ? { PK: mockUUIDV4, GSI1PK: DBEntityType.POLICY } : undefined }); // entityExists(policyId)
};

describe("MappingService", () => {
  let mappingService: MappingService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONFIG_TABLE_NAME = TABLE_NAME;
    process.env.ACCOUNT_ID = "123456789012";
    process.env.PAGINATION_TOKEN_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";
    mockSecretsManagerCommands.get.mockResolvedValue({
      SecretString: "test-secret-key-for-pagination-tokens",
    });
    mappingService = new MappingService(TABLE_NAME);
  });

  describe("update — pre-write invariant", () => {
    it("should reject update that removes the only existing pattern", async () => {
      // Existing mapping has pathPattern only (no hostHeaderPattern)
      mockDynamoDBCommands.get.mockResolvedValueOnce({ Item: mockPathMappingDDB });

      // Attempt to remove pathPattern (the only pattern)
      await expect(
        mappingService.update(mockUUIDV4, { pathPattern: null })
      ).rejects.toThrow(BadRequestError);

      // Verify nothing was written to DynamoDB
      expect(mockDynamoDBCommands.put).not.toHaveBeenCalled();
    });

    it("should allow update that removes one pattern when setting the other", async () => {
      // Existing mapping has pathPattern only
      // get for mapping, then entityExists for origin, then entityExists for policy
      mockDynamoDBCommands.get
        .mockResolvedValueOnce({ Item: mockPathMappingDDB })
        .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.ORIGIN } })
        .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.POLICY } });
      mockDynamoDBCommands.put.mockResolvedValue({});

      const result = await mappingService.update(mockUUIDV4, {
        pathPattern: null,
        hostHeaderPattern: "*.example.com",
      });

      expect(result.hostHeaderPattern).toBe("*.example.com");
      expect(result.pathPattern).toBeUndefined();
      expect(mockDynamoDBCommands.put).toHaveBeenCalled();
    });

    it("should allow update that modifies non-pattern fields without affecting patterns", async () => {
      mockEntityLookups(mockPathMappingDDB);
      mockDynamoDBCommands.put.mockResolvedValue({});

      const result = await mappingService.update(mockUUIDV4, {
        mappingName: "Updated Name",
      });

      expect(result.mappingName).toBe("Updated Name");
      expect(result.pathPattern).toBe("/api/images/*");
      expect(mockDynamoDBCommands.put).toHaveBeenCalled();
    });

    it("should allow removing policyId without affecting patterns", async () => {
      // get for mapping, then entityExists for origin (policy removed = no policy check)
      mockDynamoDBCommands.get
        .mockResolvedValueOnce({ Item: mockPathMappingDDB })
        .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.ORIGIN } });
      mockDynamoDBCommands.put.mockResolvedValue({});

      const result = await mappingService.update(mockUUIDV4, {
        policyId: null,
      });

      expect(result.policyId).toBeUndefined();
      expect(result.pathPattern).toBe("/api/images/*");
      expect(mockDynamoDBCommands.put).toHaveBeenCalled();
    });

    it("should reject update that adds a second pattern to a mapping", async () => {
      // Existing mapping has pathPattern only
      mockDynamoDBCommands.get.mockResolvedValueOnce({ Item: mockPathMappingDDB });

      // Attempt to add hostHeaderPattern without removing pathPattern
      await expect(
        mappingService.update(mockUUIDV4, { hostHeaderPattern: "*.example.com" })
      ).rejects.toThrow(BadRequestError);

      // Verify nothing was written to DynamoDB
      expect(mockDynamoDBCommands.put).not.toHaveBeenCalled();
    });
  });
});
