// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { consoleErrorSpy, consoleInfoSpy, mockS3Commands, mockContext } from "./mock";
import { CustomResourceActions, CustomResourceRequestTypes, CustomResourceRequest, CustomResourceError } from "../lib";
import { handler } from "../index";

describe("CHECK_SOURCE_BUCKETS", () => {
  // Mock event data
  const buckets = "bucket-a,bucket-b,bucket-c";
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
      CustomAction: CustomResourceActions.CHECK_SOURCE_BUCKETS,
      SourceBuckets: buckets,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should return success to check source buckets", async () => {
    mockS3Commands.headBucket.mockResolvedValue({});

    const result = await handler(event, mockContext);

    expect.assertions(2);

    expect(consoleInfoSpy).toHaveBeenCalledWith(`Attempting to check if the following buckets exist: ${buckets}`);
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: { Message: "Buckets validated." },
    });
  });

  it("should return failed when any buckets do not exist", async () => {
    mockS3Commands.headBucket.mockRejectedValue(new CustomResourceError(null, "HeadObject failed."));

    const result = await handler(event, mockContext);

    expect(consoleErrorSpy).toHaveBeenCalledWith("Could not find bucket: bucket-a");
    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "BucketNotFound",
          Message: `Could not find the following source bucket(s) in your account: ${buckets}. Please specify at least one source bucket that exists within your account and try again. If specifying multiple source buckets, please ensure that they are comma-separated.`,
        },
      },
    });
  });
});
