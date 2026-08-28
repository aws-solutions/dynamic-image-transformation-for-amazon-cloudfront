// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BadRequestError, NotFoundError } from "../../common";
import { OriginService } from "../../services";
import {
  mockDynamoDBCommands,
  mockOrigin,
  mockOriginCreateRequest,
  mockOriginDDB,
  mockOriginRedacted,
  mockOriginUpdateRequest,
  mockUUIDV4,
} from "../mocks";

const TABLE_NAME = "test-table";
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const INVALID_DOMAIN_REQUEST = { originDomain: "invalid-domain" };

describe("OriginService", () => {
  let originService: OriginService;

  beforeEach(() => {
    jest.clearAllMocks();
    originService = new OriginService(TABLE_NAME);
  });

  describe("list", () => {
    it("should return list of origins", async () => {
      mockDynamoDBCommands.query.mockResolvedValue({ Items: [mockOriginDDB] });

      const result = await originService.list();

      expect(result).toEqual({ items: [mockOriginRedacted] });
    });

    it("should return empty array when no origins exist", async () => {
      mockDynamoDBCommands.query.mockResolvedValue({ Items: undefined });

      const result = await originService.list();

      expect(result).toEqual({ items: [] });
    });
  });

  describe("get", () => {
    it("should return origin when valid id provided", async () => {
      mockDynamoDBCommands.get.mockResolvedValue({ Item: mockOriginDDB });

      const result = await originService.get(mockUUIDV4);

      expect(result).toEqual(mockOriginRedacted);
    });

    it("should throw BadRequestError for invalid id", async () => {
      await expect(originService.get(null)).rejects.toThrow(BadRequestError);
      await expect(originService.get(123)).rejects.toThrow(BadRequestError);
      await expect(originService.get("")).rejects.toThrow(BadRequestError);
    });

    it("should throw BadRequestError when origin not found", async () => {
      mockDynamoDBCommands.get.mockResolvedValue({ Item: undefined });

      await expect(originService.get(mockUUIDV4)).rejects.toThrow(NotFoundError);
    });
  });

  describe("create", () => {
    it("should create origin successfully", async () => {
      mockDynamoDBCommands.put.mockResolvedValue({});
      const mockedUUID = "my-mocked-uuid-1234";
      jest.spyOn(require("../../common"), "generateId").mockReturnValue(mockedUUID);

      const result = await originService.create(mockOriginCreateRequest);

      expect(mockDynamoDBCommands.put).toHaveBeenCalledWith({
        TableName: TABLE_NAME,
        Item: expect.objectContaining({
          PK: mockedUUID,
          GSI1PK: "ORIGIN",
          GSI1SK: mockOriginCreateRequest.originName,
          CreatedAt: expect.stringMatching(ISO_DATETIME_REGEX),
          Data: mockOriginCreateRequest,
        }),
        ConditionExpression: "attribute_not_exists(PK)",
      });
      expect(result).toMatchObject({
        ...mockOriginCreateRequest,
        originHeaders: { "x-api-key": "***REDACTED***" },
        originId: mockedUUID,
        createdAt: expect.stringMatching(ISO_DATETIME_REGEX),
      });
    });

    it("should throw BadRequestError for invalid create request", async () => {
      const invalidRequest = { originName: "test", ...INVALID_DOMAIN_REQUEST };

      await expect(originService.create(invalidRequest)).rejects.toThrow(BadRequestError);
    });
  });

  describe("update", () => {
    it("should update origin successfully", async () => {
      mockDynamoDBCommands.get.mockResolvedValue({ Item: mockOriginDDB });
      mockDynamoDBCommands.put.mockResolvedValue({});

      const result = await originService.update(mockUUIDV4, mockOriginUpdateRequest);

      expect(mockDynamoDBCommands.put).toHaveBeenCalledWith({
        TableName: TABLE_NAME,
        Item: expect.objectContaining({
          PK: mockOriginDDB.PK,
          UpdatedAt: expect.stringMatching(ISO_DATETIME_REGEX),
          Data: expect.objectContaining(mockOriginUpdateRequest),
        }),
        ConditionExpression: "attribute_exists(PK)",
      });
      expect(result).toMatchObject({
        ...mockOriginRedacted,
        ...mockOriginUpdateRequest,
        updatedAt: expect.stringMatching(ISO_DATETIME_REGEX),
      });
    });

    it("should throw BadRequestError for invalid id", async () => {
      await expect(originService.update(null, mockOriginUpdateRequest)).rejects.toThrow(BadRequestError);
      await expect(originService.update(123, mockOriginUpdateRequest)).rejects.toThrow(BadRequestError);
      await expect(originService.update("", mockOriginUpdateRequest)).rejects.toThrow(BadRequestError);
    });

    it("should throw BadRequestError for invalid update request", async () => {
      await expect(originService.update("origin-123", INVALID_DOMAIN_REQUEST)).rejects.toThrow(BadRequestError);
    });
  });

  // originHeaders is the designated store for upstream authentication credentials. It is write-only:
  // accepted on create/update, never returned. These tests guard both halves — that callers never
  // receive the values, and that withholding them from responses cannot destroy the stored value.
  describe("originHeaders are write-only", () => {
    const REDACTED = "***REDACTED***";
    const STORED_HEADERS = { "x-api-key": "test-key" };

    it("never returns real header values from any read or write method", async () => {
      mockDynamoDBCommands.query.mockResolvedValue({ Items: [mockOriginDDB] });
      mockDynamoDBCommands.get.mockResolvedValue({ Item: mockOriginDDB });
      mockDynamoDBCommands.put.mockResolvedValue({});

      const results = [
        (await originService.list()).items[0],
        await originService.get(mockUUIDV4),
        await originService.create(mockOriginCreateRequest),
        await originService.update(mockUUIDV4, mockOriginUpdateRequest),
      ];

      for (const result of results) {
        expect(result.originHeaders).toEqual({ "x-api-key": REDACTED });
        expect(JSON.stringify(result)).not.toContain("test-key");
      }
    });

    // The regression that matters most: the admin UI hydrates its edit form from the API response,
    // so if an update that omits originHeaders were to persist what the caller last saw, editing an
    // origin's name would overwrite the real credential with the redaction placeholder.
    it("preserves the stored credential when an update omits originHeaders", async () => {
      mockDynamoDBCommands.get.mockResolvedValue({ Item: mockOriginDDB });
      mockDynamoDBCommands.put.mockResolvedValue({});

      await originService.update(mockUUIDV4, { originName: "renamed-origin" });

      const written = mockDynamoDBCommands.put.mock.calls[0][0];
      expect(written.Item.Data.originHeaders).toEqual(STORED_HEADERS);
      expect(written.Item.Data.originName).toBe("renamed-origin");
      expect(JSON.stringify(written)).not.toContain(REDACTED);
    });

    it("writes real values when an update explicitly replaces originHeaders", async () => {
      mockDynamoDBCommands.get.mockResolvedValue({ Item: mockOriginDDB });
      mockDynamoDBCommands.put.mockResolvedValue({});

      const result = await originService.update(mockUUIDV4, { originHeaders: { "x-api-key": "rotated-key" } });

      const written = mockDynamoDBCommands.put.mock.calls[0][0];
      expect(written.Item.Data.originHeaders).toEqual({ "x-api-key": "rotated-key" });
      // ...but the response still redacts it
      expect(result.originHeaders).toEqual({ "x-api-key": REDACTED });
    });

    it("writes real values on create and redacts only the response", async () => {
      mockDynamoDBCommands.put.mockResolvedValue({});

      const result = await originService.create(mockOriginCreateRequest);

      const written = mockDynamoDBCommands.put.mock.calls[0][0];
      expect(written.Item.Data.originHeaders).toEqual(STORED_HEADERS);
      expect(result.originHeaders).toEqual({ "x-api-key": REDACTED });
    });

    it("honors an explicit null to clear originHeaders", async () => {
      mockDynamoDBCommands.get.mockResolvedValue({ Item: mockOriginDDB });
      mockDynamoDBCommands.put.mockResolvedValue({});

      const result = await originService.update(mockUUIDV4, { originHeaders: null });

      const written = mockDynamoDBCommands.put.mock.calls[0][0];
      expect(written.Item.Data.originHeaders).toBeUndefined();
      expect(result.originHeaders).toBeUndefined();
    });

    it("leaves an origin with no headers untouched", async () => {
      const noHeaders = { ...mockOriginDDB, Data: { ...mockOriginDDB.Data, originHeaders: undefined } };
      mockDynamoDBCommands.get.mockResolvedValue({ Item: noHeaders });

      const result = await originService.get(mockUUIDV4);

      expect(result.originHeaders).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should delete origin successfully", async () => {
      mockDynamoDBCommands.delete.mockResolvedValue({});

      await originService.delete(mockUUIDV4);

      expect(mockDynamoDBCommands.delete).toHaveBeenCalledWith({
        TableName: TABLE_NAME,
        Key: { PK: mockUUIDV4 },
        ConditionExpression: "attribute_exists(PK)",
      });
    });

    it("should throw BadRequestError for invalid id", async () => {
      await expect(originService.delete(null)).rejects.toThrow(BadRequestError);
      await expect(originService.delete(123)).rejects.toThrow(BadRequestError);
      await expect(originService.delete("")).rejects.toThrow(BadRequestError);
    });
  });
});
