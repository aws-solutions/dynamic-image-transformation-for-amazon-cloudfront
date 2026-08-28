// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Context, SQSEvent } from "aws-lambda";
import { CloudWatchLogsClient, GetQueryResultsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { handler } from "../../lambda";

jest.mock("@aws-sdk/client-cloudwatch-logs");
jest.mock("@aws-sdk/client-sqs");

const MockedCwLogsClient = CloudWatchLogsClient as jest.MockedClass<typeof CloudWatchLogsClient>;
const MockedSqsClient = SQSClient as jest.MockedClass<typeof SQSClient>;
const MockedSendMessageCommand = SendMessageCommand as jest.MockedClass<typeof SendMessageCommand>;

const BASE_CONTEXT: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test",
  functionVersion: "1",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:test",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "test",
  logStreamName: "test",
  getRemainingTimeInMillis: () => 1000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

const makeSQSEvent = (body: object): SQSEvent => ({
  Records: [{
    messageId: "1",
    receiptHandle: "abc",
    body: JSON.stringify(body),
    attributes: {
      ApproximateReceiveCount: "1",
      SentTimestamp: "0",
      ApproximateFirstReceiveTimestamp: "0",
      MessageDeduplicationId: "",
      MessageGroupId: "",
      SenderId: "",
    },
    messageAttributes: {},
    md5OfBody: "",
    eventSource: "aws:sqs",
    eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:metrics-queue",
    awsRegion: "us-east-1",
  }],
});

describe("Lambda Handler — SQS flow (SDK boundary mocks)", () => {
  let mockCwLogsSend: jest.Mock;
  let mockSqsSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCwLogsSend = jest.fn();
    mockSqsSend = jest.fn().mockResolvedValue({ MessageId: "msg-1", $metadata: {} });
    MockedCwLogsClient.mockImplementation(() => ({ send: mockCwLogsSend } as any));
    MockedSqsClient.mockImplementation(() => ({ send: mockSqsSend } as any));
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    process.env.SQS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123456789012/metrics-queue";
  });

  it("should resolve all queries and send metrics when all complete", async () => {
    const endTime = Date.now();
    const event = makeSQSEvent({
      queryIds: ["qid-ecs", "qid-cf"],
      endTime,
      crossRegionQueryIds: { "us-east-1": ["qid-cf"] },
    });

    // qid-ecs (default region) resolves first, qid-cf (us-east-1) resolves second
    mockCwLogsSend
      .mockResolvedValueOnce({ status: "Complete", results: [[{ field: "Requests_TotalImages", value: "9823" }]], $metadata: {} })
      .mockResolvedValueOnce({ status: "Complete", results: [[{ field: "Tier1_ClientHintsWidth", value: "42" }]], $metadata: {} });

    const response = await handler(event, BASE_CONTEXT);

    // CF query client must be created with us-east-1 to prove cross-region routing
    expect(MockedCwLogsClient).toHaveBeenCalledWith(expect.objectContaining({ region: "us-east-1" }));

    // Both results sent to the metrics endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("metrics.awssolutionsbuilder.com"),
      expect.objectContaining({
        body: expect.stringContaining("Requests_TotalImages"),
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("Tier1_ClientHintsWidth"),
      })
    );

    expect(response).toEqual({ statusCode: 200, body: JSON.stringify({ message: "Successfully processed event." }) });
  });

  it("should re-queue with pruned crossRegionQueryIds when CF query is still running", async () => {
    const endTime = Date.now();
    const event = makeSQSEvent({
      queryIds: ["qid-ecs", "qid-cf"],
      endTime,
      crossRegionQueryIds: { "us-east-1": ["qid-cf"] },
    });

    // qid-ecs resolves, qid-cf still running
    mockCwLogsSend
      .mockResolvedValueOnce({ status: "Complete", results: [[{ field: "Requests_TotalImages", value: "9823" }]], $metadata: {} })
      .mockResolvedValueOnce({ status: "Running", $metadata: {} });

    await handler(event, BASE_CONTEXT);

    // SQS re-queue must contain only qid-cf with crossRegionQueryIds preserved and retry incremented
    expect(MockedSendMessageCommand).toHaveBeenCalled();
    const sqsCallArg = MockedSendMessageCommand.mock.calls[0][0];
    const requeued = JSON.parse(sqsCallArg.MessageBody!);
    expect(requeued.queryIds).toEqual(["qid-cf"]);
    expect(requeued.crossRegionQueryIds).toEqual({ "us-east-1": ["qid-cf"] });
    expect(requeued.retry).toBe(1);

    // Partial results (qid-ecs) still sent to metrics endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("metrics.awssolutionsbuilder.com"),
      expect.objectContaining({ body: expect.stringContaining("Requests_TotalImages") })
    );
  });

  it("should not send metrics when all queries are still running", async () => {
    const endTime = Date.now();
    const event = makeSQSEvent({
      queryIds: ["qid-cf"],
      endTime,
      crossRegionQueryIds: { "us-east-1": ["qid-cf"] },
    });

    mockCwLogsSend.mockResolvedValueOnce({ status: "Running", $metadata: {} });

    await handler(event, BASE_CONTEXT);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
