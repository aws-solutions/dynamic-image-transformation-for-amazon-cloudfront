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
  mockUUIDV4,
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
});
