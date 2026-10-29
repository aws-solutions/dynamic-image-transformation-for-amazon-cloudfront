// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BadRequestError } from "../../common";
import { TransformationPolicyService } from "../../services";
import {
  mockDynamoDBCommands,
  mockGSI1Partitions,
  mockOtherPolicyDDB,
  mockTransformationPolicyCreateRequest,
  mockTransformationPolicyDDB,
  mockUUIDV4,
} from "../mocks";

describe("TransformationPolicyService name uniqueness", () => {
  let policyService: TransformationPolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamoDBCommands.query.mockResolvedValue({ Items: [] });
    mockDynamoDBCommands.get.mockResolvedValue({ Item: mockTransformationPolicyDDB });
    mockDynamoDBCommands.put.mockResolvedValue({});
    policyService = new TransformationPolicyService("test-table");
  });

  it.each(["taken-policy", "TAKEN-Policy"])(
    "rejects creating a policy named %s when taken-policy exists",
    async (name) => {
      mockGSI1Partitions({ POLICY: [mockOtherPolicyDDB("taken-policy")] });

      const create = policyService.create({ ...mockTransformationPolicyCreateRequest, policyName: name });

      await expect(create).rejects.toThrow(BadRequestError);
      await expect(create).rejects.toThrow(`A policy named "${name}" already exists`);
      expect(mockDynamoDBCommands.put).not.toHaveBeenCalled();
    }
  );

  it("checks the POLICY partition", async () => {
    await policyService.create(mockTransformationPolicyCreateRequest);

    expect(mockDynamoDBCommands.query.mock.calls[0][0].ExpressionAttributeValues).toEqual({ ":gsi1pk": "POLICY" });
    expect(mockDynamoDBCommands.put).toHaveBeenCalled();
  });

  it.each(["taken-policy", "Taken-Policy"])(
    "rejects renaming a policy to %s when taken-policy exists",
    async (name) => {
      mockGSI1Partitions({ POLICY: [mockTransformationPolicyDDB, mockOtherPolicyDDB("taken-policy")] });

      await expect(policyService.update(mockUUIDV4, { policyName: name })).rejects.toThrow(
        `A policy named "${name}" already exists`
      );
      expect(mockDynamoDBCommands.put).not.toHaveBeenCalled();
    }
  );

  it("lets an existing duplicate be edited when its name is unchanged", async () => {
    mockGSI1Partitions({ POLICY: [mockTransformationPolicyDDB, mockOtherPolicyDDB("thumbnail-policy")] });

    await policyService.update(mockUUIDV4, { description: "still a duplicate" });

    expect(mockDynamoDBCommands.put).toHaveBeenCalled();
  });

  it("lets a policy change the casing of its own name", async () => {
    mockGSI1Partitions({ POLICY: [mockTransformationPolicyDDB] });

    await policyService.update(mockUUIDV4, { policyName: "Thumbnail-Policy" });

    expect(mockDynamoDBCommands.put).toHaveBeenCalled();
  });
});
