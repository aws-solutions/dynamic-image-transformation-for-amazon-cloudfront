// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ZodError } from "zod";
import { OriginDAO } from "../../dao";
import { mockDynamoDBCommands, mockOrigin, mockOriginDDB } from "../mocks";

const tableName = "test-table";
const invalidOriginItem = {
  ...mockOriginDDB,
  Data: { ...mockOriginDDB.Data, originDomain: "invalid-domain" },
};

describe("OriginDAO", () => {
  let originDAO: OriginDAO;

  beforeEach(() => {
    jest.clearAllMocks();
    originDAO = new OriginDAO(tableName);
  });

  describe("create", () => {
    it("should create origin successfully", async () => {
      mockDynamoDBCommands.put.mockResolvedValue({});

      const result = await originDAO.create(mockOriginDDB);

      expect(mockDynamoDBCommands.put).toHaveBeenCalledWith({
        TableName: tableName,
        Item: mockOriginDDB,
        ConditionExpression: "attribute_not_exists(PK)",
      });
      expect(result).toEqual(mockOriginDDB);
    });

    it("should throw error for invalid item", async () => {
      await expect(originDAO.create(invalidOriginItem)).rejects.toThrow(ZodError);
    });
  });

  describe("get", () => {
    it("should return origin when item exists", async () => {
      mockDynamoDBCommands.get.mockResolvedValue({ Item: mockOriginDDB });

      const result = await originDAO.get("origin-123");

      expect(mockDynamoDBCommands.get).toHaveBeenCalledWith({
        TableName: tableName,
        Key: { PK: "origin-123" },
      });
      expect(result).toEqual(mockOriginDDB);
    });

    it("should return null when item does not exist", async () => {
      mockDynamoDBCommands.get.mockResolvedValue({ Item: undefined });

      const result = await originDAO.get("nonexistent");

      expect(result).toBeNull();
    });

    it("should return null for invalid item", async () => {
      mockDynamoDBCommands.get.mockResolvedValue({ Item: invalidOriginItem });

      const result = await originDAO.get("invalid");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update origin successfully", async () => {
      mockDynamoDBCommands.put.mockResolvedValue({});

      const result = await originDAO.update(mockOriginDDB);

      expect(mockDynamoDBCommands.put).toHaveBeenCalledWith({
        TableName: tableName,
        Item: mockOriginDDB,
        ConditionExpression: "attribute_exists(PK)",
      });
      expect(result).toEqual(mockOriginDDB);
    });

    it("should throw error for invalid item", async () => {
      await expect(originDAO.update(invalidOriginItem)).rejects.toThrow(ZodError);
    });
  });

  describe("getAll", () => {
    it("should return all origins", async () => {
      mockDynamoDBCommands.query.mockResolvedValue({ Items: [mockOriginDDB] });

      const result = await originDAO.getAll();

      expect(mockDynamoDBCommands.query).toHaveBeenCalledWith({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": "ORIGIN",
        },
      });
      expect(result).toEqual({ items: [mockOriginDDB] });
    });

    it("should return empty array when no items found", async () => {
      mockDynamoDBCommands.query.mockResolvedValue({ Items: undefined });

      const result = await originDAO.getAll();

      expect(result).toEqual({ items: [] });
    });

    it("should filter out invalid items", async () => {
      mockDynamoDBCommands.query.mockResolvedValue({ Items: [mockOriginDDB, invalidOriginItem] });

      const result = await originDAO.getAll();

      expect(result).toEqual({ items: [mockOriginDDB] });
    });
  });

  describe("delete", () => {
    it("should delete origin successfully", async () => {
      mockDynamoDBCommands.delete.mockResolvedValue({});

      await originDAO.delete("origin-123");

      expect(mockDynamoDBCommands.delete).toHaveBeenCalledWith({
        TableName: tableName,
        Key: { PK: "origin-123" },
        ConditionExpression: "attribute_exists(PK)",
      });
    });
  });

  describe("DynamoDB error handling", () => {
    it("should bubble up DynamoDB errors", async () => {
      const error = new Error("DynamoDB error");

      mockDynamoDBCommands.get.mockRejectedValue(error);
      await expect(originDAO.get("test")).rejects.toThrow("DynamoDB error");

      mockDynamoDBCommands.put.mockRejectedValue(error);
      await expect(originDAO.create(mockOriginDDB)).rejects.toThrow("DynamoDB error");

      mockDynamoDBCommands.put.mockRejectedValue(error);
      await expect(originDAO.update(mockOriginDDB)).rejects.toThrow("DynamoDB error");

      mockDynamoDBCommands.delete.mockRejectedValue(error);
      await expect(originDAO.delete("test")).rejects.toThrow("DynamoDB error");
    });
  });

  describe("convertToDB", () => {
    it("should convert Origin to DBOrigin", () => {
      const result = originDAO.convertToDB(mockOrigin);

      expect(result).toEqual(mockOriginDDB);
    });
  });

  describe("convertFromDB", () => {
    it("should convert DBOrigin to Origin", () => {
      const result = originDAO.convertFromDB(mockOriginDDB);

      expect(result).toEqual(mockOrigin);
    });
  });
});
