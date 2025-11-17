// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetMetricDataCommand,
  GetMetricDataCommandInput,
  GetMetricDataCommandOutput,
  MetricDataQuery,
} from "@aws-sdk/client-cloudwatch";
import { SendMessageCommand, SendMessageCommandOutput } from "@aws-sdk/client-sqs";
import {
  DescribeQueryDefinitionsCommand,
  DescribeQueryDefinitionsCommandInput,
  GetQueryResultsCommand,
  GetQueryResultsCommandOutput,
  ResultField,
  StartQueryCommand,
  StartQueryCommandInput,
  QueryDefinition,
} from "@aws-sdk/client-cloudwatch-logs";
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import {
  EventBridgeQueryEvent,
  MetricPayload,
  MetricData,
  QueryProps,
  SQSEventBody,
  ExecutionDay,
  MetricDataProps,
} from "./types";

import { SQSEvent } from "aws-lambda";
import { ClientHelper } from "./client-helper";
import axios, { RawAxiosRequestConfig } from "axios";

const METRICS_ENDPOINT = "https://metrics.awssolutionsbuilder.com/generic";
const RETRY_LIMIT = 3;
const { EXECUTION_DAY } = process.env;

export class MetricsHelper {
  private clientHelper: ClientHelper;
  private dynamoDbClient?: DynamoDBClient;

  constructor() {
    this.clientHelper = new ClientHelper();
  }

  getDynamoDbClient(): DynamoDBClient {
    if (!this.dynamoDbClient) {
      this.dynamoDbClient = new DynamoDBClient({});
    }
    return this.dynamoDbClient;
  }

  async scanConfigTable(): Promise<MetricData> {
    const { CONFIG_TABLE_ARN } = process.env;
    if (!CONFIG_TABLE_ARN) return {};

    const tableName = CONFIG_TABLE_ARN.split('/')[1];
    const command = new ScanCommand({ TableName: tableName });
    const response = await this.getDynamoDbClient().send(command);

    const policies: any[] = [];
    const analysisOutput: MetricData = {};
    let originMappingCount = 0;

    response.Items?.forEach((item) => {
      const gsi1pk = item.GSI1PK?.S || '';
      if (gsi1pk === 'POLICY') {
        policies.push(item);
      }
      if (gsi1pk === 'ORIGIN') originMappingCount++;
    });

    analysisOutput['DynamoDB/TransformationPolicyCount'] = policies.length;
    analysisOutput['DynamoDB/OriginMappingCount'] = originMappingCount;

    this.analyzePolicies(policies, analysisOutput);

    return analysisOutput;
  }

  private analyzePolicies(policies: any[], output: MetricData): void {
    let qualityStatic = 0, qualityAuto = 0, qualityDisabled = 0;
    let formatStatic = 0, formatAuto = 0, formatDisabled = 0;
    let autosizeEnabled = 0, autosizeDisabled = 0;

    policies.forEach((policy) => {
      const policyJSON = JSON.parse(policy.Data?.M?.policyJSON?.S || '{}');
      const outputs = policyJSON.outputs || [];

      const quality = outputs.find((o: any) => o.type === 'quality');
      const format = outputs.find((o: any) => o.type === 'format');
      const autosize = outputs.find((o: any) => o.type === 'autosize');

      if (quality) {
        Array.isArray(quality.value) && quality.value.length === 1 ? qualityStatic++ : qualityAuto++;
      } else {
        qualityDisabled++;
      }

      if (format) {
        format.value === 'auto' ? formatAuto++ : formatStatic++;
      } else {
        formatDisabled++;
      }

      autosize ? autosizeEnabled++ : autosizeDisabled++;
    });

    output['DynamoDB/QualityStatic'] = qualityStatic;
    output['DynamoDB/QualityAuto'] = qualityAuto;
    output['DynamoDB/QualityDisabled'] = qualityDisabled;
    output['DynamoDB/FormatStatic'] = formatStatic;
    output['DynamoDB/FormatAuto'] = formatAuto;
    output['DynamoDB/FormatDisabled'] = formatDisabled;
    output['DynamoDB/AutosizeEnabled'] = autosizeEnabled;
    output['DynamoDB/AutosizeDisabled'] = autosizeDisabled;
  }

  async getMetricsData(event: EventBridgeQueryEvent): Promise<MetricData> {
    const metricsDataProps: MetricDataProps[] = event["metrics-data-query"];
    const endTime = new Date(event.time);
    const regionedMetricProps: Record<string, MetricDataQuery[]> = {};
    for (const metric of metricsDataProps) {
      const metricQuery: MetricDataQuery = {
        MetricStat: metric.MetricStat,
        Expression: metric.Expression,
        Label: metric.Label,
        ReturnData: metric.ReturnData,
        Period: metric.Period,
        Id: metric.Id ? metric.Id : undefined,
      };
      const region = metric.region ?? "default";
      if (!regionedMetricProps[region]) regionedMetricProps[region] = [];
      regionedMetricProps[region].push(metricQuery);
    }
    let results: MetricData = {};
    for (const region in regionedMetricProps) {
      const metricProps = regionedMetricProps[region];
      const cloudFrontInput: GetMetricDataCommandInput = {
        MetricDataQueries: metricProps,
        StartTime: new Date(endTime.getTime() - (EXECUTION_DAY === ExecutionDay.DAILY ? 1 : 7) * 86400 * 1000), // 7 or 1 day(s) previous
        EndTime: endTime,
      };
      results = { ...results, ...(await this.fetchMetricsData(cloudFrontInput, region)) };
    }

    this.calculateCloudFrontCacheMetrics(results);

    return results;
  }

  private calculateCloudFrontCacheMetrics(results: MetricData): void {
    const totalRequests = this.sumMetricValues(results['CloudFront/Requests']);
    const cacheHitRate = this.averageMetricValues(results['CloudFront/CacheHitRate']);

    if (totalRequests > 0 && cacheHitRate !== null) {
      results['CloudFront/CacheHits'] = Math.round(totalRequests * (cacheHitRate / 100));
      results['CloudFront/CacheMisses'] = Math.round(totalRequests * (1 - cacheHitRate / 100));
    }
  }

  private sumMetricValues(value: string | number | number[] | undefined): number {
    if (!value || typeof value === 'string') return 0;
    return Array.isArray(value) ? value.reduce((sum, val) => sum + val, 0) : value;
  }

  private averageMetricValues(value: string | number | number[] | undefined): number | null {
    if (!value || typeof value === 'string') return null;
    if (!Array.isArray(value)) return value;
    return value.length > 0 ? value.reduce((sum, val) => sum + val, 0) / value.length : null;
  }

  private async fetchMetricsData(input: GetMetricDataCommandInput, region: string): Promise<MetricData> {
    let command = new GetMetricDataCommand(input);
    let response: GetMetricDataCommandOutput;
    const results: MetricData = {};
    do {
      response = await this.clientHelper.getCwClient(region).send(command);

      response.MetricDataResults?.forEach((result) => {
        // Let key be equal to the item id without the id_ prefix and replacing all underscores with slashes
        const key = result.Id?.replace("id_", "").replace(/_/g, "/");
        if (!key) {
          console.error(`Non existent ID returned: ${result}`);
          throw new Error("Non existent ID returned");
        }
        const value: number[] = result.Values || [];
        results[key] = ((results[key] as number[]) || []).concat(...value);
      });

      command = new GetMetricDataCommand({ ...input, NextToken: response.NextToken });
    } while (response.NextToken);

    return results;
  }

  processQueryResults(resolvedQueries: (ResultField | undefined)[], body: SQSEventBody): MetricData {
    const failedQueries: string[] = [];
    const metricsData: MetricData = {};
    resolvedQueries.forEach((data, index) => {
      if (data === undefined) {
        failedQueries.push(body.queryIds[index]);
        return;
      }
      if (data.field && data.value) {
        metricsData[data.field] = parseInt(data.value, 10);
      }
    });
    console.debug("Query data: ", JSON.stringify(metricsData, null, 2));

    if (failedQueries.length > 0) {
      const { retry = 0 } = body;
      if (retry < RETRY_LIMIT) {
        body.retry = retry + 1;
        body.queryIds = failedQueries;
        console.debug(`Retrying query resolver. Retry #${retry + 1}`);
        this.sendSQS(body);
      } else {
        console.debug("Retries exceeded. Aborting");
      }
    }
    return metricsData;
  }

  async getQueryDefinitions(queryPrefix: string): Promise<QueryDefinition[]> {
    const input: DescribeQueryDefinitionsCommandInput = {
      queryDefinitionNamePrefix: queryPrefix,
    };
    const command = new DescribeQueryDefinitionsCommand(input);
    const response = await this.clientHelper.getCwLogsClient().send(command);

    if (!response.queryDefinitions) {
      return [];
    }
    return response.queryDefinitions;
  }

  async startQueries(event: EventBridgeQueryEvent): Promise<SendMessageCommandOutput> {
    const queryDefinitions = await this.getQueryDefinitions(process.env.QUERY_PREFIX as string);
    const endTime = new Date(event.time);
    const queryIds = await Promise.all(
      queryDefinitions?.map((queryDefinition) => this.startQuery(queryDefinition as QueryProps, endTime))
    );
    return await this.sendSQS({ queryIds, endTime: endTime.getTime() });
  }

  async sendSQS(sqsBody: SQSEventBody): Promise<SendMessageCommandOutput> {
    const command = new SendMessageCommand({
      MessageBody: JSON.stringify(sqsBody),
      QueueUrl: process.env.SQS_QUEUE_URL,
    });
    return await this.clientHelper.getSqsClient().send(command);
  }

  async startQuery(queryProp: QueryProps, endTime: Date): Promise<string> {
    const input: StartQueryCommandInput = {
      startTime: endTime.getTime() - (EXECUTION_DAY === ExecutionDay.DAILY ? 1 : 7) * 86400 * 1000,
      endTime: endTime.getTime(),
      ...queryProp,
    };

    console.debug(`Starting CloudWatch Logs Insights query: ${input.queryString}`);
    console.debug(`Query details: ${JSON.stringify({ logGroupNames: input.logGroupNames, startTime: new Date(input.startTime!), endTime: new Date(input.endTime!) })}`);

    const command = new StartQueryCommand(input);
    const response = await this.clientHelper.getCwLogsClient().send(command);
    if (response.queryId) {
      return response.queryId;
    }
    return "";
  }

  async resolveQuery(queryId: string): Promise<ResultField[] | undefined> {
    const command = new GetQueryResultsCommand({ queryId });
    const response: GetQueryResultsCommandOutput = await this.clientHelper.getCwLogsClient().send(command);
    console.debug(`Query response: ${JSON.stringify(response)}`);
    if (response.status === "Running") {
      console.debug(`Query is still running. QueryID: ${queryId}`);
      return undefined;
    }
    return (
      response.results?.[0] ||
      (() => {
        console.debug(`Query contains no results. QueryID: ${queryId}`);
        return [];
      })()
    );
  }

  async resolveQueries(event: SQSEvent): Promise<(ResultField | undefined)[]> {
    const requestBody = JSON.parse(event.Records[0].body);
    const queryIds = requestBody.queryIds;
    if (Object.keys(queryIds).length <= 0) return [];
    return (await Promise.all(queryIds.map((queryId: string) => this.resolveQuery(queryId)))).flat();
  }

  async sendAnonymousMetric(
    results: MetricData,
    startTime: Date,
    endTime: Date
  ): Promise<{ Message: string; Data?: MetricPayload }> {
    const result: { Message: string; Data?: MetricPayload } = {
      Message: "",
    };

    try {
      const { SOLUTION_ID, SOLUTION_VERSION, UUID, AWS_ACCOUNT_ID, AWS_STACK_ID } = process.env;
      const payload: MetricPayload = {
        Solution: SOLUTION_ID as string,
        Version: SOLUTION_VERSION as string,
        UUID: UUID as string,
        TimeStamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
        AccountId: AWS_ACCOUNT_ID as string,
        StackId: AWS_STACK_ID as string,
        Data: {
          DataStartTime: startTime.toISOString().replace("T", " ").replace("Z", ""),
          DataEndTime: endTime.toISOString().replace("T", " ").replace("Z", ""),
          ...results,
        },
      };

      result.Data = payload;

      const payloadStr = JSON.stringify(payload);

      const config: RawAxiosRequestConfig = {
        headers: {
          "content-type": "application/json",
          "content-length": payloadStr.length,
        },
      };

      console.info("Sending anonymous metric", payloadStr);
      await axios.post(METRICS_ENDPOINT, payloadStr, config);

      result.Message = "Anonymous data was sent successfully.";
    } catch (err) {
      console.error("Error sending anonymous metric.");
      console.error(err);

      result.Message = "Anonymous data sending failed.";
    }

    return result;
  }
}
