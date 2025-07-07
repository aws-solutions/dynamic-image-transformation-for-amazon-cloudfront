// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockAxios, mockContext, consoleInfoSpy, mockISOTimeStamp, consoleErrorSpy } from "./mock";
import {
  CustomResourceActions,
  CustomResourceRequestTypes,
  CustomResourceRequest,
  SendMetricsRequestProperties,
} from "../lib";
import { handler } from "../index";

describe("SEND_ANONYMOUS_METRIC", () => {
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
      AnonymousData: "Yes",
      CustomAction: CustomResourceActions.SEND_ANONYMOUS_METRIC,
      UUID: "mock-uuid",
      AutoWebP: "Yes",
      CorsEnabled: "Yes",
      DeployDemoUi: "Yes",
      EnableDefaultFallbackImage: "Yes",
      EnableSignature: "Yes",
      LogRetentionPeriod: 5,
      SourceBuckets: "bucket-1, bucket-2, bucket-3",
      EnableS3ObjectLambda: "Yes",
      OriginShieldRegion: "Disabled",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should return success when sending anonymous metric succeeds", async () => {
    mockAxios.post.mockResolvedValue({ status: 200, statusText: "OK" });

    const result = await handler(event, mockContext);

    expect.assertions(5);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Sending anonymous metric",
      expect.stringContaining('"Solution":"solution-id"')
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
          Solution: "solution-id",
          TimeStamp: mockISOTimeStamp,
          UUID: "mock-uuid",
          Version: "solution-version",
          Data: {
            Region: "mock-region-1",
            Type: "Create",
            AutoWebP: "Yes",
            CorsEnabled: "Yes",
            DeployDemoUi: "Yes",
            EnableDefaultFallbackImage: "Yes",
            EnableSignature: "Yes",
            LogRetentionPeriod: 5,
            NumberOfSourceBuckets: 3,
            EnableS3ObjectLambda: "Yes",
            OriginShieldRegion: "Disabled",
          },
        },
      },
    });
  });

  it("Should return success when sending anonymous usage fails", async () => {
    mockAxios.post.mockResolvedValue({ status: 500, statusText: "FAILS" });

    const result = await handler(event, mockContext);

    expect.assertions(5);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Sending anonymous metric",
      expect.stringContaining('"Solution":"solution-id"')
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
          Solution: "solution-id",
          TimeStamp: mockISOTimeStamp,
          UUID: "mock-uuid",
          Version: "solution-version",
          Data: {
            Region: "mock-region-1",
            Type: "Create",
            AutoWebP: "Yes",
            CorsEnabled: "Yes",
            DeployDemoUi: "Yes",
            EnableDefaultFallbackImage: "Yes",
            EnableSignature: "Yes",
            LogRetentionPeriod: 5,
            NumberOfSourceBuckets: 3,
            EnableS3ObjectLambda: "Yes",
            OriginShieldRegion: "Disabled",
          },
        },
      },
    });
  });

  it("Should return success when unable to send anonymous usage", async () => {
    mockAxios.post.mockRejectedValue({ status: 500, statusText: "FAILS" });

    const result = await handler(event, mockContext);

    expect.assertions(5);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Sending anonymous metric",
      expect.stringContaining('"Solution":"solution-id"')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Sending anonymous metric",
      expect.stringContaining('"UUID":"mock-uuid"')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith("Sending anonymous metric", expect.stringContaining('"TimeStamp":'));
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error sending anonymous metric");

    expect(result).toMatchObject({
      Status: "SUCCESS",
      Data: { Message: "Anonymous data was sent failed." },
    });
  });

  it("Should return success when sending anonymous metric without source buckets", async () => {
    mockAxios.post.mockResolvedValue({ status: 200, statusText: "OK" });
    const eventWithoutBuckets = { ...event };
    (<SendMetricsRequestProperties>eventWithoutBuckets.ResourceProperties).SourceBuckets = null;

    const result = await handler(eventWithoutBuckets, mockContext);

    expect.assertions(2);

    expect(consoleInfoSpy).toHaveBeenCalledWith("Anonymous metric response: OK (200)");
    expect(result).toMatchObject({
      Status: "SUCCESS",
      Data: {
        Message: "Anonymous data was sent successfully.",
        Data: { Data: { NumberOfSourceBuckets: 0 } },
      },
    });
  });

  it('Should not send antonymous metric when anonymousData is "No"', async () => {
    (event.ResourceProperties as SendMetricsRequestProperties).AnonymousData = "No";

    const result = await handler(event, mockContext);

    expect.assertions(1);

    expect(result).toEqual({
      Status: "SUCCESS",
      Data: {},
    });
  });
});
