// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Runs the handler through the CDK provider framework's own onEvent, because the physical ID
// CloudFormation receives is decided by the framework's merge, not by the handler alone.

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-cloudfront", () => ({
  CloudFrontClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  GetDistributionConfigCommand: jest.fn(),
  UpdateDistributionCommand: jest.fn(),
}));

const mockSubmitted: Array<Record<string, unknown>> = [];

jest.mock("../../../../node_modules/aws-cdk-lib/custom-resources/lib/provider-framework/runtime/outbound", () => ({
  httpRequest: jest.fn(async (_options: unknown, body: string) => {
    mockSubmitted.push(JSON.parse(body));
  }),
  invokeFunction: jest.fn(async (req: { Payload?: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { handler } = require("../../constructs/frontend/csp-updater-handler");
    try {
      const result = await handler(JSON.parse(req.Payload ?? "{}"), {});
      return { Payload: Buffer.from(JSON.stringify(result ?? {})) };
    } catch (error) {
      return {
        FunctionError: "Unhandled",
        Payload: Buffer.from(JSON.stringify({ errorMessage: (error as Error).message })),
      };
    }
  }),
  startExecution: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const framework = require("../../../../node_modules/aws-cdk-lib/custom-resources/lib/provider-framework/runtime/framework");

describe("csp-updater-handler through the CDK provider framework", () => {
  const generatedId = "Stack-CSPUpdaterCSPUpdaterCustomResource91C60D66-L5HSSCI0UKBU";
  const baseEvent = {
    ServiceToken: "arn:aws:lambda:us-east-1:123456789012:function:framework-onEvent",
    ResponseURL: "https://cloudformation-custom-resource-response-useast1.s3.amazonaws.com/response",
    StackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/Stack/00000000-0000-0000-0000-000000000000",
    RequestId: "11111111-1111-1111-1111-111111111111",
    LogicalResourceId: "CSPUpdaterCSPUpdaterCustomResource91C60D66",
    ResourceType: "AWS::CloudFormation::CustomResource",
    ResourceProperties: {
      ServiceToken: "arn:aws:lambda:us-east-1:123456789012:function:framework-onEvent",
      DistributionId: "test-dist-id",
      ResponseHeadersPolicyId: "test-policy-id",
    },
  };

  beforeAll(() => {
    process.env.USER_ON_EVENT_FUNCTION_ARN = "arn:aws:lambda:us-east-1:123456789012:function:csp-updater";
    delete process.env.USER_IS_COMPLETE_FUNCTION_ARN;
  });

  beforeEach(() => {
    mockSubmitted.length = 0;
    mockSend.mockReset();
    mockSend.mockImplementation(async () => ({
      DistributionConfig: { DefaultCacheBehavior: { ResponseHeadersPolicyId: "test-policy-id" } },
      ETag: "test-etag",
    }));
  });

  it.each([
    ["a CloudFormation-generated physical ID", generatedId],
    ["the csp-updater ID of a normally created stack", "csp-updater"],
  ])("Delete reports SUCCESS to CloudFormation with %s unchanged", async (_label, physicalResourceId) => {
    await framework.onEvent({ ...baseEvent, RequestType: "Delete", PhysicalResourceId: physicalResourceId });

    expect(mockSubmitted).toHaveLength(1);
    expect(mockSubmitted[0]).toEqual(
      expect.objectContaining({ Status: "SUCCESS", PhysicalResourceId: physicalResourceId })
    );
  });

  it("Delete reports SUCCESS with the ID unchanged when the distribution is already gone", async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error("NoSuchDistribution"), { name: "NoSuchDistribution" }));

    await framework.onEvent({ ...baseEvent, RequestType: "Delete", PhysicalResourceId: generatedId });

    expect(mockSubmitted).toHaveLength(1);
    expect(mockSubmitted[0]).toEqual(expect.objectContaining({ Status: "SUCCESS", PhysicalResourceId: generatedId }));
  });

  it("Create reports csp-updater as the physical ID", async () => {
    await framework.onEvent({ ...baseEvent, RequestType: "Create" });

    expect(mockSubmitted).toHaveLength(1);
    expect(mockSubmitted[0]).toEqual(expect.objectContaining({ Status: "SUCCESS", PhysicalResourceId: "csp-updater" }));
  });

  it("Update keeps csp-updater as the physical ID, so CloudFormation does not replace the resource", async () => {
    await framework.onEvent({
      ...baseEvent,
      RequestType: "Update",
      PhysicalResourceId: "csp-updater",
      OldResourceProperties: baseEvent.ResourceProperties,
    });

    expect(mockSubmitted).toHaveLength(1);
    expect(mockSubmitted[0]).toEqual(expect.objectContaining({ Status: "SUCCESS", PhysicalResourceId: "csp-updater" }));
  });
});
