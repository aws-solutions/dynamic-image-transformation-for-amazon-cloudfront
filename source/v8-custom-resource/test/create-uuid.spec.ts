// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { mockContext, mockAxios } from "./mock";
import { CustomResourceActions, CustomResourceRequestTypes, CustomResourceRequest } from "../lib";
import { handler } from "../index";

describe("CREATE_UUID", () => {
  const event: CustomResourceRequest = {
    RequestType: CustomResourceRequestTypes.CREATE,
    ResponseURL: "/cfn-response",
    PhysicalResourceId: "mock-physical-id",
    StackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/guid",
    ServiceToken: "mock-service-token",
    RequestId: "mock-request-id",
    LogicalResourceId: "mock-logical-resource-id",
    ResourceType: "mock-resource-type",
    ResourceProperties: {
      CustomAction: CustomResourceActions.CREATE_UUID,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should create a UUID on CREATE", async () => {
    mockAxios.put.mockResolvedValue({ status: 200 });

    const response = await handler(event, mockContext);

    expect(response.Status).toBe("SUCCESS");
    expect(response.Data.UUID).toBeDefined();
    expect(typeof response.Data.UUID).toBe("string");
  });

  it("Should not create a UUID on UPDATE", async () => {
    mockAxios.put.mockResolvedValue({ status: 200 });
    const updateEvent = { ...event, RequestType: CustomResourceRequestTypes.UPDATE };

    const response = await handler(updateEvent, mockContext);

    expect(response).toEqual({
      Status: "SUCCESS",
      Data: {},
    });
  });

  it("Should not create a UUID on DELETE", async () => {
    mockAxios.put.mockResolvedValue({ status: 200 });
    const deleteEvent = { ...event, RequestType: CustomResourceRequestTypes.DELETE };

    const response = await handler(deleteEvent, mockContext);

    expect(response).toEqual({
      Status: "SUCCESS",
      Data: {},
    });
  });
});
