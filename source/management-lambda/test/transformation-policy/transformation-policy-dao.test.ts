// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TransformationPolicyDAO } from "../../dao";
import { mockTransformationPolicy, mockTransformationPolicyDDB } from "../mocks";

describe("TransformationPolicyDAO", () => {
  let policyDAO: TransformationPolicyDAO;
  const tableName = "test-table";
  const ddbDocClient = {} as any;

  beforeEach(() => {
    policyDAO = new TransformationPolicyDAO(tableName, ddbDocClient);
  });

  describe("convertToDB", () => {
    it("should convert TransformationPolicy to DBTransformationPolicy", () => {
      const result = policyDAO.convertToDB(mockTransformationPolicy);

      expect(result).toEqual(mockTransformationPolicyDDB);
    });
  });

  describe("convertFromDB", () => {
    it("should convert DBTransformationPolicy to TransformationPolicy", () => {
      const result = policyDAO.convertFromDB(mockTransformationPolicyDDB);

      expect(result).toEqual(mockTransformationPolicy);
    });
  });
});
