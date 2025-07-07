// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockCloudFormationCommands, mockServiceCatalogAppRegistryCommands, mockContext } from "./mock";
import { CustomResourceActions, CustomResourceRequestTypes, CustomResourceRequest } from "../lib";
import { handler } from "../index";

describe("GET_APP_REG_APPLICATION_NAME", () => {
  // Mock event data
  const defaultApplicationName = "ServerlessImageHandlerDefaultApplicationName";
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
      CustomAction: CustomResourceActions.GET_APP_REG_APPLICATION_NAME,
      DefaultName: defaultApplicationName,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should return default application name when application name could not be retrieved", async () => {
    mockCloudFormationCommands.describeStackResources.mockResolvedValue({
      StackResources: [
        {
          LogicalResourceId: "SourceBucketA",
          PhysicalResourceId: "bucket-a",
        },
      ],
    });
    mockServiceCatalogAppRegistryCommands.getApplication.mockResolvedValue({});

    const result = await handler(event, mockContext);
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: { ApplicationName: defaultApplicationName },
    });
  });

  it("Should return default application name when application does not yet exist in the stack", async () => {
    mockCloudFormationCommands.describeStackResources.mockResolvedValue({
      StackResources: [],
    });
    mockServiceCatalogAppRegistryCommands.getApplication.mockResolvedValue({});

    const result = await handler(event, mockContext);
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: { ApplicationName: defaultApplicationName },
    });
  });

  it("Should return application name when available", async () => {
    const applicationName = "SIHApplication";
    mockCloudFormationCommands.describeStackResources.mockResolvedValue({
      StackResources: [
        {
          LogicalResourceId: "SourceBucketA",
          PhysicalResourceId: "bucket-a",
        },
      ],
    });

    mockServiceCatalogAppRegistryCommands.getApplication.mockResolvedValue({
      name: applicationName,
    });
    const result = await handler(event, mockContext);
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: { ApplicationName: applicationName },
    });
  });
});
