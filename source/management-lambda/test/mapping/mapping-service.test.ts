// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BadRequestError } from "../../common";
import { DBEntityType } from "../../interfaces";
import { MappingService } from "../../services/mapping-service";
import {
  mockDynamoDBCommands,
  mockGSI1Partitions,
  mockHostHeaderMappingCreateRequest,
  mockHostHeaderMappingDDB,
  mockOtherMappingDDB,
  mockPathMappingCreateRequest,
  mockPathMappingDDB,
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
    // create/update now read both mapping partitions for the uniqueness check; default to an empty table
    mockDynamoDBCommands.query.mockResolvedValue({ Items: [] });
    mappingService = new MappingService(TABLE_NAME);
  });

  describe("update — pre-write invariant", () => {
    it("should reject update that removes the only existing pattern", async () => {
      // Existing mapping has pathPattern only (no hostHeaderPattern)
      mockDynamoDBCommands.get.mockResolvedValueOnce({ Item: mockPathMappingDDB });

      // Attempt to remove pathPattern (the only pattern)
      await expect(mappingService.update(mockUUIDV4, { pathPattern: null })).rejects.toThrow(BadRequestError);

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
      await expect(mappingService.update(mockUUIDV4, { hostHeaderPattern: "*.example.com" })).rejects.toThrow(
        BadRequestError
      );

      // Verify nothing was written to DynamoDB
      expect(mockDynamoDBCommands.put).not.toHaveBeenCalled();
    });
  });
  describe("uniqueness", () => {
    const PATH = DBEntityType.PATH_MAPPING as const;
    const HOST = DBEntityType.HOST_HEADER_MAPPING as const;

    // origin then policy existence checks, consumed only when the write proceeds
    const mockReferencesExist = () =>
      mockDynamoDBCommands.get
        .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.ORIGIN } })
        .mockResolvedValueOnce({ Item: { PK: mockUUIDV4, GSI1PK: DBEntityType.POLICY } });

    beforeEach(() => {
      mockDynamoDBCommands.get.mockReset();
      mockDynamoDBCommands.put.mockReset();
      mockDynamoDBCommands.put.mockResolvedValue({});
    });

    describe("create", () => {
      it.each([
        ["/images/*", "/images/*"],
        ["/images/*", "/Images/*"],
        ["/images", "/images/"],
        ["/images/", "/IMAGES"],
      ])("rejects path pattern %s when %s exists", async (stored, requested) => {
        mockGSI1Partitions({ [PATH]: [mockOtherMappingDDB(PATH, stored, "existing")] });

        const create = mappingService.create({ ...mockPathMappingCreateRequest, pathPattern: requested });

        await expect(create).rejects.toThrow(BadRequestError);
        await expect(create).rejects.toThrow(`A path mapping with pattern "${requested}" already exists`);
        expect(mockDynamoDBCommands.put).not.toHaveBeenCalled();
      });

      it.each(["*.example.com", "*.EXAMPLE.com"])(
        "rejects host pattern %s when *.example.com exists",
        async (requested) => {
          mockGSI1Partitions({ [HOST]: [mockOtherMappingDDB(HOST, "*.example.com", "existing")] });

          await expect(
            mappingService.create({ ...mockHostHeaderMappingCreateRequest, hostHeaderPattern: requested })
          ).rejects.toThrow(`A host header mapping with pattern "${requested}" already exists`);
          expect(mockDynamoDBCommands.put).not.toHaveBeenCalled();
        }
      );

      it.each<[string, object, typeof PATH | typeof HOST, string]>([
        ["a path mapping", mockPathMappingCreateRequest, HOST, "*.other.com"],
        ["a host mapping", mockHostHeaderMappingCreateRequest, PATH, "/other/*"],
      ])(
        "rejects %s whose name is used by the other mapping type",
        async (_label, request, storedType, storedPattern) => {
          mockGSI1Partitions({ [storedType]: [mockOtherMappingDDB(storedType, storedPattern, "Shared NAME")] });

          await expect(mappingService.create({ ...request, mappingName: "shared name" })).rejects.toThrow(
            'A mapping named "shared name" already exists'
          );
          expect(mockDynamoDBCommands.put).not.toHaveBeenCalled();
        }
      );

      it("does not compare path patterns against host patterns", async () => {
        mockGSI1Partitions({ [HOST]: [mockOtherMappingDDB(HOST, "example.com", "host one")] });
        mockReferencesExist();

        await mappingService.create({ ...mockPathMappingCreateRequest, pathPattern: "/example.com" });

        expect(mockDynamoDBCommands.put).toHaveBeenCalled();
      });

      it("accepts a mapping whose name and pattern are both unused", async () => {
        mockGSI1Partitions({
          [PATH]: [mockOtherMappingDDB(PATH, "/images/*", "existing path")],
          [HOST]: [mockOtherMappingDDB(HOST, "*.example.com", "existing host")],
        });
        mockReferencesExist();

        await mappingService.create({ ...mockPathMappingCreateRequest, pathPattern: "/thumbs/*" });

        expect(mockDynamoDBCommands.put).toHaveBeenCalled();
      });
    });

    describe("update", () => {
      it.each([
        [{ pathPattern: "/Taken/*" }, 'A path mapping with pattern "/Taken/*" already exists'],
        [{ mappingName: "TAKEN NAME" }, 'A mapping named "TAKEN NAME" already exists'],
      ])("rejects renaming into a taken key: %o", async (patch, message) => {
        mockGSI1Partitions({ [PATH]: [mockPathMappingDDB, mockOtherMappingDDB(PATH, "/taken/*", "taken name")] });
        mockDynamoDBCommands.get.mockResolvedValueOnce({ Item: mockPathMappingDDB });

        await expect(mappingService.update(mockUUIDV4, patch)).rejects.toThrow(message);
        expect(mockDynamoDBCommands.put).not.toHaveBeenCalled();
      });

      it("rejects renaming a host pattern into a taken one", async () => {
        mockGSI1Partitions({ [HOST]: [mockHostHeaderMappingDDB, mockOtherMappingDDB(HOST, "cdn.example.com", "cdn")] });
        mockDynamoDBCommands.get.mockResolvedValueOnce({ Item: mockHostHeaderMappingDDB });

        await expect(mappingService.update(mockUUIDV4, { hostHeaderPattern: "CDN.example.com" })).rejects.toThrow(
          'A host header mapping with pattern "CDN.example.com" already exists'
        );
      });

      it("checks a path-to-host switch against host patterns", async () => {
        mockGSI1Partitions({
          [PATH]: [mockPathMappingDDB],
          [HOST]: [mockOtherMappingDDB(HOST, "*.example.com", "host one")],
        });
        mockDynamoDBCommands.get.mockResolvedValueOnce({ Item: mockPathMappingDDB });

        await expect(
          mappingService.update(mockUUIDV4, { pathPattern: null, hostHeaderPattern: "*.example.com" })
        ).rejects.toThrow('A host header mapping with pattern "*.example.com" already exists');
      });

      it("lets an existing duplicate be edited when its keys are unchanged", async () => {
        mockGSI1Partitions({
          [PATH]: [mockPathMappingDDB, mockOtherMappingDDB(PATH, "/api/images/*", "API Images Mapping")],
        });
        mockEntityLookups(mockPathMappingDDB);

        await mappingService.update(mockUUIDV4, { description: "still a duplicate" });

        expect(mockDynamoDBCommands.put).toHaveBeenCalled();
      });

      it("lets a mapping change the casing of its own name and pattern", async () => {
        mockGSI1Partitions({ [PATH]: [mockPathMappingDDB] });
        mockEntityLookups(mockPathMappingDDB);

        await mappingService.update(mockUUIDV4, { mappingName: "api images mapping", pathPattern: "/API/images/*" });

        expect(mockDynamoDBCommands.put).toHaveBeenCalled();
      });
    });
  });
});
