// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockS3Commands, mockContext, consoleInfoSpy } from "./mock";
import {
  CustomResourceActions,
  CustomResourceRequestTypes,
  CustomResourceRequest,
  PutConfigRequestProperties,
  ErrorCodes,
  CustomResourceError,
} from "../lib";
import { handler } from "../index";

describe("PUT_CONFIG_FILE", () => {
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
      CustomAction: CustomResourceActions.PUT_CONFIG_FILE,
      ConfigItem: {
        Key: "Value",
      },
      DestS3Bucket: "destination-bucket",
      DestS3key: "demo-ui-config.js",
    },
  };

  const mockConfig = `'use strict';

const appVariables = {
Key: 'Value'
};`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should return success to put config file", async () => {
    mockS3Commands.putObject.mockResolvedValueOnce({});

    const result = await handler(event, mockContext);
    const resourceProperties = event.ResourceProperties as PutConfigRequestProperties;

    expect.assertions(2);

    // The command is now checked in the mock.ts file, so we just verify the mock was called
    expect(mockS3Commands.putObject).toHaveBeenCalledWith({
      Bucket: resourceProperties.DestS3Bucket,
      Body: mockConfig,
      Key: resourceProperties.DestS3key,
      ContentType: "application/javascript",
    });
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: {
        Message: "Config file uploaded.",
        Content: mockConfig,
      },
    });
  });

  it("Should return failed when PutObject fails", async () => {
    mockS3Commands.putObject.mockRejectedValueOnce(new CustomResourceError(null, "PutObject failed"));

    const result = await handler(event, mockContext);
    const resourceProperties = event.ResourceProperties as PutConfigRequestProperties;

    expect.assertions(3);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      `Attempting to save content blob destination location: ${resourceProperties.DestS3Bucket}/${resourceProperties.DestS3key}`
    );
    expect(mockS3Commands.putObject).toHaveBeenCalledWith({
      Bucket: resourceProperties.DestS3Bucket,
      Body: mockConfig,
      Key: resourceProperties.DestS3key,
      ContentType: "application/javascript",
    });
    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "ConfigFileCreationFailure",
          Message: `Saving config file to ${resourceProperties.DestS3Bucket}/${resourceProperties.DestS3key} failed.`,
        },
      },
    });
  });

  it("Should retry and return success when IAM policy is not so S3 API returns AccessDenied", async () => {
    mockS3Commands.putObject
      .mockRejectedValueOnce(new CustomResourceError(ErrorCodes.ACCESS_DENIED, null))
      .mockResolvedValueOnce({});

    const result = await handler(event, mockContext);
    const resourceProperties = event.ResourceProperties as PutConfigRequestProperties;

    expect.assertions(4);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      `Attempting to save content blob destination location: ${resourceProperties.DestS3Bucket}/${resourceProperties.DestS3key}`
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith("Waiting for retry...");
    expect(mockS3Commands.putObject).toHaveBeenCalledWith({
      Bucket: resourceProperties.DestS3Bucket,
      Body: mockConfig,
      Key: resourceProperties.DestS3key,
      ContentType: "application/javascript",
    });
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: {
        Message: "Config file uploaded.",
        Content: mockConfig,
      },
    });
  });
});
