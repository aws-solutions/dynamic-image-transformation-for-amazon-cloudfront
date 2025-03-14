// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetMetricDataCommandOutput } from "@aws-sdk/client-cloudwatch";
import { SendMessageCommandOutput } from "@aws-sdk/client-sqs";
import { QueryDefinition, GetQueryResultsCommandOutput } from "@aws-sdk/client-cloudwatch-logs";
import { SQSEvent } from "aws-lambda";
import { MetricsHelper } from "../../../lambda/helpers/metrics-helper";
import { ClientHelper } from "../../../lambda/helpers/client-helper";
import { EventBridgeQueryEvent, MetricData } from "../../../lambda/helpers/types";

// Mock AWS SDK clients
jest.mock("@aws-sdk/client-cloudwatch");
jest.mock("@aws-sdk/client-sqs");
jest.mock("@aws-sdk/client-cloudwatch-logs");

const mockClientHelper = {
  getSqsClient: jest.fn(),
  getCwClient: jest.fn(),
  getCwLogsClient: jest.fn(),
};

jest.mock("../../../lambda/helpers/client-helper", () => {
  return {
    ClientHelper: jest.fn().mockImplementation(() => {
      return { ...mockClientHelper };
    }),
  };
});

describe("MetricsHelper", () => {
  let metricsHelper: MetricsHelper;
  let clientHelperMock: jest.Mocked<ClientHelper>;

  beforeEach(() => {
    clientHelperMock = new ClientHelper() as jest.Mocked<ClientHelper>;
    metricsHelper = new MetricsHelper();
    metricsHelper["clientHelper"] = clientHelperMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch metrics data", async () => {
    const mockEvent: EventBridgeQueryEvent = {
      "detail-type": "Scheduled Event",
      time: new Date().toISOString(),
      "metrics-data-query": [
        {
          Id: "id_AWS_Lambda_Invocations_Identifier",
          MetricStat: {
            Metric: {
              Namespace: "SomeNamespace",
              MetricName: "SomeMetricName",
            },
            Period: 86400,
            Stat: "Maximum",
          },
        },
      ],
    };
    const mockMetricDataResults: GetMetricDataCommandOutput = {
      MetricDataResults: [{ Values: [9999], Id: "id_AWS_Lambda_Invocations_Identifier" }],
      $metadata: {},
    };
    clientHelperMock.getCwClient.mockReturnValue({
      send: jest.fn().mockResolvedValue(mockMetricDataResults),
    } as any);

    const result = await metricsHelper.getMetricsData(mockEvent);

    expect(clientHelperMock.getCwClient().send).toHaveBeenCalled();
    expect(result).toEqual({ "AWS/Lambda/Invocations/Identifier": [9999] });
  });

  it("should get query definitions", async () => {
    const mockQueryDefinitions: QueryDefinition[] = [{ queryDefinitionId: "SomeID" }];
    const mockResponse = { queryDefinitions: mockQueryDefinitions };
    clientHelperMock.getCwLogsClient.mockReturnValue({
      send: jest.fn().mockResolvedValue(mockResponse),
    } as any);

    const result = await metricsHelper.getQueryDefinitions("test-prefix");

    expect(clientHelperMock.getCwLogsClient().send).toHaveBeenCalled();
    expect(result).toEqual(mockQueryDefinitions);
  });

  it("should start queries and send SQS message", async () => {
    const mockEvent: EventBridgeQueryEvent = {
      "detail-type": "Scheduled Event",
      time: new Date().toISOString(),
      "metrics-data-query": [],
    };
    const mockQueryDefinitions: QueryDefinition[] = [{ queryDefinitionId: "id1", name: "query1" } as QueryDefinition];
    const mockSQSResponse: SendMessageCommandOutput = {
      MessageId: "123",
      $metadata: {},
    };
    const mockQueryId = "queryId";

    clientHelperMock.getCwLogsClient.mockReturnValue({
      send: jest
        .fn()
        .mockResolvedValueOnce({ queryDefinitions: mockQueryDefinitions })
        .mockResolvedValueOnce({ queryId: mockQueryId }),
    } as any);

    clientHelperMock.getSqsClient.mockReturnValue({
      send: jest.fn().mockResolvedValue(mockSQSResponse),
    } as any);

    process.env.QUERY_PREFIX = "test-prefix";
    process.env.SQS_QUEUE_URL = "test-queue-url";

    const result = await metricsHelper.startQueries(mockEvent);

    expect(clientHelperMock.getCwLogsClient().send).toHaveBeenCalledTimes(2);
    expect(clientHelperMock.getSqsClient().send).toHaveBeenCalled();
    expect(result).toEqual(mockSQSResponse);
  });

  it("should resolve a query", async () => {
    const mockQueryId = "queryId";
    const mockResult = { field: "testField", value: "testValue" };
    const mockResponse: GetQueryResultsCommandOutput = {
      status: "Complete",
      results: [[mockResult]],
      $metadata: {},
    };
    clientHelperMock.getCwLogsClient.mockReturnValue({
      send: jest.fn().mockResolvedValue(mockResponse),
    } as any);

    const result = await metricsHelper.resolveQuery(mockQueryId);

    expect(clientHelperMock.getCwLogsClient().send).toHaveBeenCalled();
    expect(result).toEqual([mockResult]);
  });

  it("should resolve multiple queries from SQS event", async () => {
    const mockEvent: SQSEvent = {
      Records: [{ body: JSON.stringify({ queryIds: ["queryId1", "queryId2"] }) }],
    } as SQSEvent;
    const mockResult = { field: "testField", value: "testValue" };
    const mockResponse: GetQueryResultsCommandOutput = {
      status: "Complete",
      results: [[mockResult]],
      $metadata: {},
    };
    clientHelperMock.getCwLogsClient.mockReturnValue({
      send: jest.fn().mockResolvedValue(mockResponse),
    } as any);

    const result = await metricsHelper.resolveQueries(mockEvent);

    expect(clientHelperMock.getCwLogsClient().send).toHaveBeenCalledTimes(2);
    expect(result).toEqual([mockResult, mockResult]);
  });

  it("should properly populate anonymous metric data", async () => {
    // Arrange
    const metricData: MetricData = {
      metric1: [1, 2, 3],
      metric2: [4, 5, 6],
    };
    const startTime = new Date(Date.UTC(2020, 8, 10, 4));
    const endTime = new Date(2020, 8, 17, 4);

    //Mock axios
    const axios = require("axios");
    axios.post = jest.fn().mockResolvedValue({ statusText: "OK", status: 200 });

    // Act
    const result = await metricsHelper.sendAnonymousMetric(metricData, startTime, endTime);
    // Assert
    expect(result.Message).toEqual("Anonymous data was sent successfully.");

    // Assert payload Data DataStartTime sent with axios is in expected format
    expect(axios.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(`"DataStartTime":"2020-09-10 04:00:00.000"`),
      expect.anything()
    );
  });
});
