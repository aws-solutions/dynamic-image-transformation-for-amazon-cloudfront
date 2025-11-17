// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BadRequestError, NotFoundError } from "../../common";
import { OriginService } from "../../services";
import {
  mockDynamoDBCommands,
  mockOrigin,
  mockOriginCreateRequest,
  mockOriginDDB,
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

      expect(result).toEqual({ items: [mockOrigin] });
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

      expect(result).toEqual(mockOrigin);
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
        ...mockOrigin,
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
