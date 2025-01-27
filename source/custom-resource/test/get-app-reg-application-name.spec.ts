// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockCloudFormation, mockServiceCatalogAppRegistry, mockContext } from "./mock";
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
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Should return default application name when application name could not be retrieved", async () => {
    mockCloudFormation.describeStackResources.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          StackResources: [
            {
              LogicalResourceId: "SourceBucketA",
              PhysicalResourceId: "bucket-a",
            },
          ],
        });
      },
    }));

    mockServiceCatalogAppRegistry.getApplication.mockImplementation(() => ({
      promise() {
        return Promise.resolve({});
      },
    }));

    const result = await handler(event, mockContext);
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: { ApplicationName: defaultApplicationName },
    });
  });

  it("Should return default application name when application does not yet exist in the stack", async () => {
    mockCloudFormation.describeStackResources.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          StackResources: [],
        });
      },
    }));

    mockServiceCatalogAppRegistry.getApplication.mockImplementation(() => ({
      promise() {
        return Promise.resolve({});
      },
    }));

    const result = await handler(event, mockContext);
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: { ApplicationName: defaultApplicationName },
    });
  });

  it("Should return application name when available", async () => {
    const applicationName = "SIHApplication";
    mockCloudFormation.describeStackResources.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          StackResources: [
            {
              LogicalResourceId: "SourceBucketA",
              PhysicalResourceId: "bucket-a",
            },
          ],
        });
      },
    }));

    mockServiceCatalogAppRegistry.getApplication.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          name: applicationName,
        });
      },
    }));

    const result = await handler(event, mockContext);
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: { ApplicationName: applicationName },
    });
  });
});
