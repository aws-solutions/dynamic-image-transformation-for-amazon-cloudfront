// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockS3Commands, mockContext } from "./mock";
import {
  CheckFallbackImageRequestProperties,
  CustomResourceActions,
  CustomResourceError,
  CustomResourceRequest,
  CustomResourceRequestTypes,
  ErrorCodes,
} from "../lib";
import { handler } from "../index";

describe("CHECK_FALLBACK_IMAGE", () => {
  // Mock event data
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
      CustomAction: CustomResourceActions.CHECK_FALLBACK_IMAGE,
      FallbackImageS3Bucket: "fallback-image-bucket",
      FallbackImageS3Key: "fallback-image.jpg",
    },
  };
  const head = {
    AcceptRanges: "bytes",
    LastModified: "2020-01-23T18:52:47.000Z",
    ContentLength: 200237,
    ContentType: "image/jpeg",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should return success when the default fallback image exists", async () => {
    mockS3Commands.headObject.mockResolvedValue(head);

    const result = await handler(event, mockContext);

    expect.assertions(2);

    expect(mockS3Commands.headObject).toHaveBeenCalledWith({
      Bucket: "fallback-image-bucket",
      Key: "fallback-image.jpg",
    });
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: {
        Message: "The default fallback image validated.",
        Data: head,
      },
    });
  });

  it("Should return failed when fallbackImageS3Bucket is not provided", async () => {
    (event.ResourceProperties as CheckFallbackImageRequestProperties).FallbackImageS3Bucket = "";

    const result = await handler(event, mockContext);

    expect.assertions(1);

    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "S3BucketNotProvided",
          Message: "You need to provide the default fallback image bucket.",
        },
      },
    });
  });

  it("Should return failed when fallbackImageS3Key is not provided", async () => {
    const resourceProperties = event.ResourceProperties as CheckFallbackImageRequestProperties;
    resourceProperties.FallbackImageS3Bucket = "fallback-image-bucket";
    resourceProperties.FallbackImageS3Key = "";

    const result = await handler(event, mockContext);

    expect.assertions(1);

    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "S3KeyNotProvided",
          Message: "You need to provide the default fallback image object key.",
        },
      },
    });
  });

  it("Should return failed when the default fallback image does not exist", async () => {
    mockS3Commands.headObject.mockRejectedValue(new CustomResourceError("NotFound", null));
    (event.ResourceProperties as CheckFallbackImageRequestProperties).FallbackImageS3Key = "fallback-image.jpg";

    const result = await handler(event, mockContext);

    expect.assertions(2);

    expect(mockS3Commands.headObject).toHaveBeenCalledWith({
      Bucket: "fallback-image-bucket",
      Key: "fallback-image.jpg",
    });
    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "FallbackImageError",
          Message: `Either the object does not exist or you don't have permission to access the object: fallback-image-bucket/fallback-image.jpg`,
        },
      },
    });
  });

  it("Should retry and return success when IAM policy is not ready so S3 API returns AccessDenied or Forbidden", async () => {
    mockS3Commands.headObject.mockRejectedValue(new CustomResourceError(ErrorCodes.ACCESS_DENIED, null));
    mockS3Commands.headObject.mockRejectedValue(new CustomResourceError(ErrorCodes.FORBIDDEN, null));
    mockS3Commands.headObject.mockResolvedValue(head);

    const result = await handler(event, mockContext);

    expect.assertions(2);

    expect(mockS3Commands.headObject).toHaveBeenCalledWith({
      Bucket: "fallback-image-bucket",
      Key: "fallback-image.jpg",
    });
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: {
        Message: "The default fallback image validated.",
        Data: head,
      },
    });
  });
});
