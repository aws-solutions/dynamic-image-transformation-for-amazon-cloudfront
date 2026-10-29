// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudFrontClient } from "@aws-sdk/client-cloudfront";

const mockSend = jest.fn().mockResolvedValue({
  DistributionConfig: { DefaultCacheBehavior: {} },
  ETag: "test-etag",
});

jest.mock("@aws-sdk/client-cloudfront", () => ({
  CloudFrontClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  GetDistributionConfigCommand: jest.fn(),
  UpdateDistributionCommand: jest.fn(),
  // Real class, so one test proves the handler recognizes the SDK's own error shape.
  NoSuchDistribution: jest.requireActual("@aws-sdk/client-cloudfront").NoSuchDistribution,
}));

describe("csp-updater-handler CloudFrontClient configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should instantiate CloudFrontClient with custom user agent for Create event", async () => {
    process.env.SOLUTION_ID = "SO0023";
    process.env.SOLUTION_VERSION = "v0.0.0-test";

    const { handler } = await import("../../constructs/frontend/csp-updater-handler");

    const event = {
      RequestType: "Create",
      ResourceProperties: {
        DistributionId: "test-dist-id",
        ResponseHeadersPolicyId: "test-policy-id",
      },
    };

    await handler(event as any, {} as any);

    expect(CloudFrontClient).toHaveBeenCalledTimes(1);
    expect(CloudFrontClient).toHaveBeenCalledWith(
      expect.objectContaining({
        customUserAgent: "AwsSolution/SO0023/v0.0.0-test",
      })
    );
  });

  it("should instantiate CloudFrontClient with custom user agent for Delete event", async () => {
    const { handler } = await import("../../constructs/frontend/csp-updater-handler");

    const event = {
      RequestType: "Delete",
      ResourceProperties: {
        DistributionId: "test-dist-id",
        ResponseHeadersPolicyId: "test-policy-id",
      },
    };

    await handler(event as any, {} as any);

    expect(CloudFrontClient).toHaveBeenCalledTimes(1);
    expect(CloudFrontClient).toHaveBeenCalledWith(
      expect.objectContaining({
        customUserAgent: "AwsSolution/SO0023/v0.0.0-test",
      })
    );
  });

  it("should instantiate CloudFrontClient without custom user agent when SOLUTION_ID is not set", async () => {
    delete process.env.SOLUTION_ID;
    delete process.env.SOLUTION_VERSION;

    const { handler } = await import("../../constructs/frontend/csp-updater-handler");

    const event = {
      RequestType: "Create",
      ResourceProperties: {
        DistributionId: "test-dist-id",
        ResponseHeadersPolicyId: "test-policy-id",
      },
    };

    await handler(event as any, {} as any);

    expect(CloudFrontClient).toHaveBeenCalledTimes(1);
    expect(CloudFrontClient).toHaveBeenCalledWith(
      expect.not.objectContaining({
        customUserAgent: expect.any(String),
      })
    );
  });
});

describe("csp-updater-handler physical resource ID and delete errors", () => {
  const generatedId = "Stack-CSPUpdaterCSPUpdaterCustomResource91C60D66-L5HSSCI0UKBU";
  const resourceProperties = { DistributionId: "test-dist-id", ResponseHeadersPolicyId: "test-policy-id" };
  const deleteEvent = (physicalResourceId: string) => ({
    RequestType: "Delete",
    PhysicalResourceId: physicalResourceId,
    ResourceProperties: resourceProperties,
  });
  const serviceError = (name: string) => Object.assign(new Error(name), { name });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
    mockSend.mockImplementation(async () => ({
      DistributionConfig: { DefaultCacheBehavior: { ResponseHeadersPolicyId: "test-policy-id" } },
      ETag: "test-etag",
    }));
  });

  it("returns csp-updater as the physical ID on Create", async () => {
    const { handler } = await import("../../constructs/frontend/csp-updater-handler");

    const result = await handler({ RequestType: "Create", ResourceProperties: resourceProperties } as any, {} as any);

    expect(result).toEqual(expect.objectContaining({ PhysicalResourceId: "csp-updater" }));
  });

  it("returns csp-updater as the physical ID on Update", async () => {
    const { handler } = await import("../../constructs/frontend/csp-updater-handler");

    const result = await handler(
      { RequestType: "Update", PhysicalResourceId: "csp-updater", ResourceProperties: resourceProperties } as any,
      {} as any
    );

    expect(result).toEqual(expect.objectContaining({ PhysicalResourceId: "csp-updater" }));
  });

  it.each([
    ["a CloudFormation-generated physical ID", generatedId],
    ["the csp-updater ID of a normally created stack", "csp-updater"],
  ])("Delete keeps %s and removes the policy", async (_label, physicalResourceId) => {
    const { handler } = await import("../../constructs/frontend/csp-updater-handler");
    const { UpdateDistributionCommand } = await import("@aws-sdk/client-cloudfront");

    const result = await handler(deleteEvent(physicalResourceId) as any, {} as any);

    expect(result).not.toHaveProperty("PhysicalResourceId");
    expect(UpdateDistributionCommand).toHaveBeenCalledTimes(1);
    const config = (UpdateDistributionCommand as unknown as jest.Mock).mock.calls[0][0].DistributionConfig;
    expect(config.DefaultCacheBehavior).not.toHaveProperty("ResponseHeadersPolicyId");
  });

  it("Delete succeeds when GetDistributionConfig reports the distribution is gone", async () => {
    const { handler } = await import("../../constructs/frontend/csp-updater-handler");
    const { UpdateDistributionCommand, NoSuchDistribution } = await import("@aws-sdk/client-cloudfront");
    mockSend.mockRejectedValueOnce(
      new NoSuchDistribution({ $metadata: {}, message: "The specified distribution does not exist." })
    );

    await expect(handler(deleteEvent(generatedId) as any, {} as any)).resolves.toEqual({});
    expect(UpdateDistributionCommand).not.toHaveBeenCalled();
  });

  it("Delete succeeds when UpdateDistribution reports the distribution is gone", async () => {
    const { handler } = await import("../../constructs/frontend/csp-updater-handler");
    mockSend
      .mockResolvedValueOnce({ DistributionConfig: { DefaultCacheBehavior: {} }, ETag: "test-etag" })
      .mockRejectedValueOnce(serviceError("NoSuchDistribution"));

    await expect(handler(deleteEvent(generatedId) as any, {} as any)).resolves.toEqual({});
  });

  it("Delete fails on any other GetDistributionConfig error", async () => {
    const { handler } = await import("../../constructs/frontend/csp-updater-handler");
    const { UpdateDistributionCommand } = await import("@aws-sdk/client-cloudfront");
    mockSend.mockRejectedValueOnce(serviceError("AccessDenied"));

    await expect(handler(deleteEvent(generatedId) as any, {} as any)).rejects.toThrow("AccessDenied");
    expect(UpdateDistributionCommand).not.toHaveBeenCalled();
  });

  it("Delete fails on any other UpdateDistribution error", async () => {
    const { handler } = await import("../../constructs/frontend/csp-updater-handler");
    mockSend
      .mockResolvedValueOnce({ DistributionConfig: { DefaultCacheBehavior: {} }, ETag: "test-etag" })
      .mockRejectedValueOnce(serviceError("PreconditionFailed"));

    await expect(handler(deleteEvent(generatedId) as any, {} as any)).rejects.toThrow("PreconditionFailed");
  });
});
