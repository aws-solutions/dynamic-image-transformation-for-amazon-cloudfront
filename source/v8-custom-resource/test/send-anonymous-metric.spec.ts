// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { mockAxios, mockContext, consoleInfoSpy, mockISOTimeStamp, consoleErrorSpy } from "./mock";
import {
  CustomResourceActions,
  CustomResourceRequestTypes,
  CustomResourceRequest,
  SendMetricsRequestProperties,
} from "../lib";
import { handler } from "../index";

describe("SEND_ANONYMOUS_METRIC", () => {
  const event = {
    RequestType: CustomResourceRequestTypes.CREATE,
    ResponseURL: "/cfn-response",
    PhysicalResourceId: "mock-physical-id",
    StackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/guid",
    ServiceToken: "mock-service-token",
    RequestId: "mock-request-id",
    LogicalResourceId: "mock-logical-resource-id",
    ResourceType: "mock-resource-type",
    ResourceProperties: {
      AnonymousData: "Yes",
      CustomAction: CustomResourceActions.SEND_METRIC,
      UUID: "mock-uuid",
      Region: "us-east-1",
      UseExistingCloudFrontDistribution: "No",
      DeploymentSize: "Small",
    } as SendMetricsRequestProperties,
  } as CustomResourceRequest;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should return success when sending anonymous metric succeeds", async () => {
    mockAxios.post.mockResolvedValue({ status: 200, statusText: "OK" });

    const result = await handler(event, mockContext);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Sending anonymous metric",
      expect.stringContaining('"Solution":"SO0023"')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Sending anonymous metric",
      expect.stringContaining('"UUID":"mock-uuid"')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith("Sending anonymous metric", expect.stringContaining('"TimeStamp":'));
    expect(consoleInfoSpy).toHaveBeenCalledWith("Anonymous metric response: OK (200)");
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: {
        Message: "Anonymous data was sent successfully.",
        Data: {
          Solution: "SO0023",
          TimeStamp: mockISOTimeStamp,
          UUID: "mock-uuid",
          Version: "v8.0.0",
          AccountId: "123456789012",
          StackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/guid",
          Data: {
            Region: "us-east-1",
            Type: "Create",
            UseExistingCloudFrontDistribution: "No",
            DeploymentSize: "Small",
          },
        },
      },
    });
  });

  it("Should return success when sending anonymous usage fails", async () => {
    mockAxios.post.mockResolvedValue({ status: 500, statusText: "FAILS" });

    const result = await handler(event, mockContext);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Sending anonymous metric",
      expect.stringContaining('"Solution":"SO0023"')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Sending anonymous metric",
      expect.stringContaining('"UUID":"mock-uuid"')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith("Sending anonymous metric", expect.stringContaining('"TimeStamp":'));
    expect(consoleInfoSpy).toHaveBeenCalledWith("Anonymous metric response: FAILS (500)");
    expect(result).toEqual({
      Status: "SUCCESS",
      Data: {
        Message: "Anonymous data was sent successfully.",
        Data: {
          Solution: "SO0023",
          TimeStamp: mockISOTimeStamp,
          UUID: "mock-uuid",
          Version: "v8.0.0",
          AccountId: "123456789012",
          StackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/guid",
          Data: {
            Region: "us-east-1",
            Type: "Create",
            UseExistingCloudFrontDistribution: "No",
            DeploymentSize: "Small",
          },
        },
      },
    });
  });

  it("Should return success when unable to send anonymous usage", async () => {
    mockAxios.post.mockRejectedValue({ status: 500, statusText: "FAILS" });

    const result = await handler(event, mockContext);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Sending anonymous metric",
      expect.stringContaining('"Solution":"SO0023"')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Sending anonymous metric",
      expect.stringContaining('"UUID":"mock-uuid"')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith("Sending anonymous metric", expect.stringContaining('"TimeStamp":'));
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error sending anonymous metric", expect.anything());
    expect(result).toMatchObject({
      Status: "SUCCESS",
      Data: { Message: "Anonymous data was sent failed." },
    });
  });

  it('Should not send anonymous metric when anonymousData is "No"', async () => {
    (event.ResourceProperties as SendMetricsRequestProperties).AnonymousData = "No";

    const result = await handler(event, mockContext);

    expect(result).toEqual({
      Status: "SUCCESS",
      Data: {},
    });
  });

  it("Should handle UPDATE request type", async () => {
    mockAxios.post.mockResolvedValue({ status: 200, statusText: "OK" });
    const updateEvent = {
      ...event,
      RequestType: CustomResourceRequestTypes.UPDATE,
      ResourceProperties: {
        ...event.ResourceProperties,
        AnonymousData: "Yes",
      } as SendMetricsRequestProperties,
    };

    const result = await handler(updateEvent, mockContext);

    expect(result.Status).toBe("SUCCESS");
    expect((result.Data.Data as any).Data.Type).toBe("Update");
  });

  it("Should handle DELETE request type", async () => {
    mockAxios.post.mockResolvedValue({ status: 200, statusText: "OK" });
    const deleteEvent = {
      ...event,
      RequestType: CustomResourceRequestTypes.DELETE,
      ResourceProperties: {
        ...event.ResourceProperties,
        AnonymousData: "Yes",
      } as SendMetricsRequestProperties,
    };

    const result = await handler(deleteEvent, mockContext);

    expect(result.Status).toBe("SUCCESS");
    expect((result.Data.Data as any).Data.Type).toBe("Delete");
  });
});
