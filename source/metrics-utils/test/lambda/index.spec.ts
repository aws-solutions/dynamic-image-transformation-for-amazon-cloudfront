// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Context, SQSEvent } from "aws-lambda";
import { handler } from "../../lambda";
import { EventBridgeQueryEvent } from "../../lambda/helpers/types";

const mockMetricsHelper = {
  getMetricsData: jest.fn(),
  startQueries: jest.fn(),
  resolveQueries: jest.fn(),
  sendAnonymousMetric: jest.fn(),
  processQueryResults: jest.fn(),
};

const BASE_CONTEXT: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test",
  functionVersion: "1",
  invokedFunctionArn: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  memoryLimitInMB: "128",
  awsRequestId: "XXXXXXXXXX",
  logGroupName: "test",
  logStreamName: "test",
  getRemainingTimeInMillis: () => 1000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

jest.mock("../../lambda/helpers/metrics-helper", () => {
  return {
    MetricsHelper: jest.fn().mockImplementation(() => {
      return { ...mockMetricsHelper };
    }),
  };
});

describe("Lambda Handler", () => {
  beforeEach(() => {
    // Clear previous mock calls and instances
    jest.clearAllMocks();
  });

  it("should process an EventBridgeQueryEvent", async () => {
    // Arrange
    const event: EventBridgeQueryEvent = {
      "detail-type": "Scheduled Event",
      time: new Date().toISOString(),
      "metrics-data-query": [],
    };

    //Mock Response
    mockMetricsHelper.getMetricsData.mockImplementationOnce(() => {
      return [];
    });
    mockMetricsHelper.startQueries.mockImplementationOnce(() => {
      return [];
    });
    // Act
    const response = await handler(event, BASE_CONTEXT);

    // Assert
    expect(mockMetricsHelper.getMetricsData).toHaveBeenCalledWith(event);
    expect(mockMetricsHelper.startQueries).toHaveBeenCalledWith(event);
    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "Successfully processed event." }),
    });
  });

  it("should process an SQSEvent", async () => {
    // Arrange
    const event: SQSEvent = {
      Records: [
        {
          messageId: "1",
          receiptHandle: "abc",
          body: JSON.stringify({ endTime: new Date() }),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "1234567890",
            ApproximateFirstReceiveTimestamp: "1234567890",
            MessageDeduplicationId: "message-deduplication-id",
            MessageGroupId: "message-group-id",
            SenderId: "sender-id",
          },
          messageAttributes: {},
          md5OfBody: "",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:region:account-id:queue-name",
          awsRegion: "region",
        },
      ],
    };

    mockMetricsHelper.resolveQueries.mockImplementationOnce(() => {
      return [];
    });

    mockMetricsHelper.processQueryResults.mockImplementationOnce(() => {
      return [];
    });

    // Act
    const response = await handler(event, BASE_CONTEXT);

    // Assert
    expect(mockMetricsHelper.resolveQueries).toHaveBeenCalledWith(event);
    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "Successfully processed event." }),
    });
  });

  it("should throw an error for an invalid event type", async () => {
    // Arrange
    const event = {} as any;

    // Act & Assert
    await expect(handler(event, BASE_CONTEXT)).rejects.toThrow("Invalid event type.");
  });
});
