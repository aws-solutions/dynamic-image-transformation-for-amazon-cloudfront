// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockCloudFront, mockContext } from "./mock";
import { CustomResourceActions, CustomResourceRequestTypes, CustomResourceRequest } from "../lib";
import { handler } from "../index";

describe("VALIDATE_EXISTING_DISTRIBUTION", () => {
  // Mock event data
  const distributionId = "E1234ABCDEF";
  const event: CustomResourceRequest = {
    RequestType: CustomResourceRequestTypes.CREATE,
    ResponseURL: "/cfn-response",
    PhysicalResourceId: "mock-physical-id",
    StackId: "mock-stack-id",
    ServiceToken: "mock-service-token",
    RequestId: "mock-request-id",
    LogicalResourceId: "mock-logical-resource-id",
    ResourceType: "mock-resource-type",
    ResourceProperties: {
      CustomAction: CustomResourceActions.VALIDATE_EXISTING_DISTRIBUTION,
      ExistingDistributionID: distributionId,
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Should return success when distribution exists and is valid", async () => {
    // Mock CloudFront getDistribution response
    mockCloudFront.getDistribution.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          Distribution: {
            DomainName: `${distributionId}.cloudfront.net`,
            Status: "Deployed",
            DistributionConfig: {
              Enabled: true,
              Origins: {
                Items: [
                  {
                    DomainName: "example-bucket.s3.amazonaws.com",
                    Id: "S3Origin",
                  },
                ],
                Quantity: 1,
              },
            },
          },
        });
      },
    }));

    const result = await handler(event, mockContext);
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: {
        DistributionDomainName: `${distributionId}.cloudfront.net`,
      },
    });
  });

  it("Should return failure when distribution does not exist", async () => {
    // Mock CloudFront getDistribution to throw error
    mockCloudFront.getDistribution.mockImplementation(() => ({
      promise() {
        return Promise.reject(new Error("NoSuchDistribution"));
      },
    }));

    const result = await handler(event, mockContext);
    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "CustomResourceError",
          Message: "NoSuchDistribution",
        },
      },
    });
  });

  it("Should return failure on unexpected error", async () => {
    mockCloudFront.getDistribution.mockImplementation(() => ({
      promise() {
        return Promise.reject(new Error("Unexpected error"));
      },
    }));

    const result = await handler(event, mockContext);
    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "CustomResourceError",
          Message: "Unexpected error",
        },
      },
    });
  });
});
