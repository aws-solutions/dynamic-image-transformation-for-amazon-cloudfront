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

  describe("resolveQuery / resolveQueries", () => {
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

    it("should resolve a query against an explicit region", async () => {
      const mockQueryId = "queryId";
      const mockResult = { field: "testField", value: "testValue" };
      const mockResponse: GetQueryResultsCommandOutput = {
        status: "Complete",
        results: [[mockResult]],
        $metadata: {},
      };
      const mockSend = jest.fn().mockResolvedValue(mockResponse);
      clientHelperMock.getCwLogsClient.mockReturnValue({ send: mockSend } as any);

      await metricsHelper.resolveQuery(mockQueryId, "us-east-1");

      expect(clientHelperMock.getCwLogsClient).toHaveBeenCalledWith("us-east-1");
    });

    it("should resolve a query with no region using the default client", async () => {
      const mockResponse: GetQueryResultsCommandOutput = {
        status: "Complete",
        results: [[{ field: "f", value: "1" }]],
        $metadata: {},
      };
      clientHelperMock.getCwLogsClient.mockReturnValue({ send: jest.fn().mockResolvedValue(mockResponse) } as any);

      await metricsHelper.resolveQuery("queryId");

      expect(clientHelperMock.getCwLogsClient).toHaveBeenCalledWith(undefined);
    });

    it("should route cross-region query IDs to the correct region in resolveQueries", async () => {
      const mockEvent: SQSEvent = {
        Records: [{
          body: JSON.stringify({
            queryIds: ["qid-ecs", "qid-cf"],
            crossRegionQueryIds: { "us-east-1": ["qid-cf"] },
          }),
        }],
      } as SQSEvent;
      const mockResponse: GetQueryResultsCommandOutput = {
        status: "Complete",
        results: [[{ field: "f", value: "1" }]],
        $metadata: {},
      };
      clientHelperMock.getCwLogsClient.mockReturnValue({ send: jest.fn().mockResolvedValue(mockResponse) } as any);

      await metricsHelper.resolveQueries(mockEvent);

      expect(clientHelperMock.getCwLogsClient).toHaveBeenCalledWith(undefined);   // qid-ecs
      expect(clientHelperMock.getCwLogsClient).toHaveBeenCalledWith("us-east-1"); // qid-cf
    });
  });

  describe("scanConfigTable", () => {
    const mockSend = jest.fn();

    beforeEach(() => {
      process.env.CONFIG_TABLE_ARN = "arn:aws:dynamodb:us-east-1:123456789012:table/ConfigTable";
      jest.spyOn(metricsHelper, "getDynamoDbClient").mockReturnValue({ send: mockSend } as any);
    });

    afterEach(() => {
      delete process.env.CONFIG_TABLE_ARN;
    });

    const makePolicyItem = (policyJSON: object) => ({
      GSI1PK: { S: "POLICY" },
      Data: { M: { policyJSON: { S: JSON.stringify(policyJSON) } } },
    });

    it("should return empty object when CONFIG_TABLE_ARN is not set", async () => {
      delete process.env.CONFIG_TABLE_ARN;
      const result = await metricsHelper.scanConfigTable();
      expect(result).toEqual({});
    });

    it("should count smart crop enabled with boolean true", async () => {
      mockSend.mockResolvedValue({
        Items: [makePolicyItem({ outputs: [], transformations: [{ transformation: "smartCrop", value: true }] })],
      });
      const result = await metricsHelper.scanConfigTable();
      expect(result["DynamoDB/SmartCropEnabled"]).toBe(1);
      expect(result["DynamoDB/SmartCropFaces"]).toBe(1);
    });

    it("should count smart crop faces with legacy object (index)", async () => {
      mockSend.mockResolvedValue({
        Items: [makePolicyItem({ outputs: [], transformations: [{ transformation: "smartCrop", value: { index: 0, padding: 10 } }] })],
      });
      const result = await metricsHelper.scanConfigTable();
      expect(result["DynamoDB/SmartCropEnabled"]).toBe(1);
      expect(result["DynamoDB/SmartCropFaces"]).toBe(1);
    });

    it("should count smart crop faces with expanded object (faces: true)", async () => {
      mockSend.mockResolvedValue({
        Items: [makePolicyItem({ outputs: [], transformations: [{ transformation: "smartCrop", value: { faces: true } }] })],
      });
      const result = await metricsHelper.scanConfigTable();
      expect(result["DynamoDB/SmartCropEnabled"]).toBe(1);
      expect(result["DynamoDB/SmartCropFaces"]).toBe(1);
    });

    it("should count smart crop faces with faceIndex", async () => {
      mockSend.mockResolvedValue({
        Items: [makePolicyItem({ outputs: [], transformations: [{ transformation: "smartCrop", value: { faceIndex: 0 } }] })],
      });
      const result = await metricsHelper.scanConfigTable();
      expect(result["DynamoDB/SmartCropFaces"]).toBe(1);
    });

    it("should count smart crop labels", async () => {
      mockSend.mockResolvedValue({
        Items: [makePolicyItem({ outputs: [], transformations: [{ transformation: "smartCrop", value: { labels: ["Cat", "Dog"] } }] })],
      });
      const result = await metricsHelper.scanConfigTable();
      expect(result["DynamoDB/SmartCropEnabled"]).toBe(1);
      expect(result["DynamoDB/SmartCropLabels"]).toBe(1);
      expect(result["DynamoDB/SmartCropFaces"]).toBe(0);
    });

    it("should count smart crop custom labels", async () => {
      mockSend.mockResolvedValue({
        Items: [
          makePolicyItem({
            outputs: [],
            transformations: [{ transformation: "smartCrop", value: { customModelArn: "arn:aws:rekognition:us-east-1:123:project/my-model/version/1" } }],
          }),
        ],
      });
      const result = await metricsHelper.scanConfigTable();
      expect(result["DynamoDB/SmartCropCustomLabels"]).toBe(1);
    });

    it("should count smart crop retainText and retainLogo", async () => {
      mockSend.mockResolvedValue({
        Items: [
          makePolicyItem({
            outputs: [],
            transformations: [{ transformation: "smartCrop", value: { retainText: true, retainLogo: true } }],
          }),
        ],
      });
      const result = await metricsHelper.scanConfigTable();
      expect(result["DynamoDB/SmartCropRetainText"]).toBe(1);
      expect(result["DynamoDB/SmartCropRetainLogo"]).toBe(1);
    });

    it("should report zero smart crop counters when no smartCrop transformation exists", async () => {
      mockSend.mockResolvedValue({
        Items: [makePolicyItem({ outputs: [{ type: "quality", value: [80] }], transformations: [{ transformation: "resize", value: { width: 200 } }] })],
      });
      const result = await metricsHelper.scanConfigTable();
      expect(result["DynamoDB/SmartCropEnabled"]).toBe(0);
      expect(result["DynamoDB/SmartCropFaces"]).toBe(0);
      expect(result["DynamoDB/SmartCropLabels"]).toBe(0);
      expect(result["DynamoDB/SmartCropCustomLabels"]).toBe(0);
      expect(result["DynamoDB/SmartCropRetainText"]).toBe(0);
      expect(result["DynamoDB/SmartCropRetainLogo"]).toBe(0);
    });

    it("should accumulate counters across multiple policies", async () => {
      mockSend.mockResolvedValue({
        Items: [
          makePolicyItem({ outputs: [], transformations: [{ transformation: "smartCrop", value: true }] }),
          makePolicyItem({ outputs: [], transformations: [{ transformation: "smartCrop", value: { labels: ["Cat"] } }] }),
          makePolicyItem({ outputs: [], transformations: [{ transformation: "smartCrop", value: { retainText: true, retainLogo: true } }] }),
        ],
      });
      const result = await metricsHelper.scanConfigTable();
      expect(result["DynamoDB/SmartCropEnabled"]).toBe(3);
      expect(result["DynamoDB/SmartCropFaces"]).toBe(1);
      expect(result["DynamoDB/SmartCropLabels"]).toBe(1);
      expect(result["DynamoDB/SmartCropRetainText"]).toBe(1);
      expect(result["DynamoDB/SmartCropRetainLogo"]).toBe(1);
    });
  });

  it("should properly populate anonymous metric data", async () => {
    // Arrange
    const metricData: MetricData = {
      metric1: [1, 2, 3],
      metric2: [4, 5, 6],
    };
    const startTime = new Date(Date.UTC(2020, 8, 10, 4));
    const endTime = new Date(2020, 8, 17, 4);

    // Mock fetch
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    // Act
    const result = await metricsHelper.sendAnonymousMetric(metricData, startTime, endTime);
    // Assert
    expect(result.Message).toEqual("Anonymous data was sent successfully.");

    // Assert payload Data DataStartTime sent with fetch is in expected format
    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(`"DataStartTime":"2020-09-10 04:00:00.000"`),
      })
    );
  });

  describe("processQueryResults — crossRegionQueryIds pruning", () => {
    const makeSQSBody = (overrides = {}) => ({
      queryIds: ["qid-ecs", "qid-cf"],
      endTime: Date.now(),
      crossRegionQueryIds: { "us-east-1": ["qid-cf"] },
      ...overrides,
    });

    it("should prune crossRegionQueryIds to only still-failing IDs on retry", () => {
      const body = makeSQSBody();
      // qid-ecs resolved, qid-cf still running
      metricsHelper.processQueryResults([{ field: "Requests_TotalImages", value: "9823" }, undefined], body);

      expect(body.crossRegionQueryIds).toEqual({ "us-east-1": ["qid-cf"] });
      expect(body.queryIds).toEqual(["qid-cf"]);
    });

    it("should set crossRegionQueryIds to undefined when no cross-region IDs remain after pruning", () => {
      const body = makeSQSBody({
        queryIds: ["qid-ecs", "qid-cf"],
        crossRegionQueryIds: { "us-east-1": ["qid-cf"] },
      });
      // qid-cf resolved, qid-ecs still running → crossRegionQueryIds should become undefined
      metricsHelper.processQueryResults([undefined, { field: "Tier1_ClientHintsWidth", value: "42" }], body);
      
      expect(body.queryIds).toEqual(["qid-ecs"]);
      expect(body.crossRegionQueryIds).toBeUndefined();
    });
  });
});
