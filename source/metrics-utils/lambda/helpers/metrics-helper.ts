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
import { getOptions } from "../../../solution-utils/get-options";
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
import { logger } from "./logger";

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
      this.dynamoDbClient = new DynamoDBClient(getOptions());
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
    let smartCropEnabled = 0, smartCropFaces = 0, smartCropLabels = 0;
    let smartCropCustomLabels = 0, smartCropRetainText = 0, smartCropRetainLogo = 0;
    let contentModerationEnabled = 0;

    policies.forEach((policy) => {
      const policyJSON = JSON.parse(policy.Data?.M?.policyJSON?.S || '{}');
      const outputs = policyJSON.outputs || [];
      const transformations = policyJSON.transformations || [];

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

      const sc = transformations.find((t: any) => t.transformation === 'smartCrop');
      if (sc) {
        smartCropEnabled++;
        const v = sc.value;
        if (v === true || v?.faces || v?.faceIndex !== undefined || v?.index !== undefined) smartCropFaces++;
        if (v?.labels?.length > 0) smartCropLabels++;
        if (v?.customModelArn) smartCropCustomLabels++;
        if (v?.retainText) smartCropRetainText++;
        if (v?.retainLogo) smartCropRetainLogo++;
      }

      if (transformations.find((t: any) => t.transformation === 'contentModeration')) contentModerationEnabled++;
    });

    output['DynamoDB/QualityStatic'] = qualityStatic;
    output['DynamoDB/QualityAuto'] = qualityAuto;
    output['DynamoDB/QualityDisabled'] = qualityDisabled;
    output['DynamoDB/FormatStatic'] = formatStatic;
    output['DynamoDB/FormatAuto'] = formatAuto;
    output['DynamoDB/FormatDisabled'] = formatDisabled;
    output['DynamoDB/AutosizeEnabled'] = autosizeEnabled;
    output['DynamoDB/AutosizeDisabled'] = autosizeDisabled;
    output['DynamoDB/SmartCropEnabled'] = smartCropEnabled;
    output['DynamoDB/SmartCropFaces'] = smartCropFaces;
    output['DynamoDB/SmartCropLabels'] = smartCropLabels;
    output['DynamoDB/SmartCropCustomLabels'] = smartCropCustomLabels;
    output['DynamoDB/SmartCropRetainText'] = smartCropRetainText;
    output['DynamoDB/SmartCropRetainLogo'] = smartCropRetainLogo;
    output['DynamoDB/ContentModerationEnabled'] = contentModerationEnabled;
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
    logger.debug("Query data: ", JSON.stringify(metricsData, null, 2));

    if (failedQueries.length > 0) {
      const { retry = 0 } = body;
      if (retry < RETRY_LIMIT) {
        body.retry = retry + 1;
        body.queryIds = failedQueries;
        // Prune crossRegionQueryIds to only the still-failing IDs so retries
        // route each query ID to the correct region (e.g. us-east-1 for CF Function logs).
        if (body.crossRegionQueryIds) {
          const prunedCrossRegion: { [region: string]: string[] } = {};
          for (const [region, ids] of Object.entries(body.crossRegionQueryIds)) {
            const stillFailing = ids.filter((id) => failedQueries.includes(id));
            if (stillFailing.length > 0) prunedCrossRegion[region] = stillFailing;
          }
          const hasRemainingCrossRegion = Object.keys(prunedCrossRegion).length > 0;
          body.crossRegionQueryIds = hasRemainingCrossRegion ? prunedCrossRegion : undefined;
        }
        logger.debug(`Retrying query resolver. Retry #${retry + 1}`);
        this.sendSQS(body);
      } else {
        logger.debug("Retries exceeded. Aborting");
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
    const crossRegionQueryIds: { [region: string]: string[] } = {};
    // All query IDs — both default-region and cross-region (e.g. CF Function logs in us-east-1) — are
    // collected into a single queryIds array. crossRegionQueryIds is a region-routing index only;
    // it records which region to use when resolving a given ID, not a separate set of IDs to start.
    const queryIds = await Promise.all(
      queryDefinitions?.map(async (queryDefinition) => {
        const isCfFunction = (queryDefinition.logGroupNames ?? []).some((lg) =>
          lg.includes("/aws/cloudfront/function/")
        );
        const region = isCfFunction ? "us-east-1" : undefined;
        const queryId = await this.startQuery(queryDefinition as QueryProps, endTime, region);
        if (isCfFunction && queryId) {
          crossRegionQueryIds["us-east-1"] = [...(crossRegionQueryIds["us-east-1"] ?? []), queryId];
        }
        return queryId;
      })
    );
    const sqsBody: SQSEventBody = { queryIds, endTime: endTime.getTime() };
    if (Object.keys(crossRegionQueryIds).length > 0) sqsBody.crossRegionQueryIds = crossRegionQueryIds;
    return await this.sendSQS(sqsBody);
  }

  async sendSQS(sqsBody: SQSEventBody): Promise<SendMessageCommandOutput> {
    const command = new SendMessageCommand({
      MessageBody: JSON.stringify(sqsBody),
      QueueUrl: process.env.SQS_QUEUE_URL,
    });
    return await this.clientHelper.getSqsClient().send(command);
  }

  async startQuery(queryProp: QueryProps, endTime: Date, region?: string): Promise<string> {
    const input: StartQueryCommandInput = {
      startTime: endTime.getTime() - (EXECUTION_DAY === ExecutionDay.DAILY ? 1 : 7) * 86400 * 1000,
      endTime: endTime.getTime(),
      ...queryProp,
    };

    logger.debug(`Starting CloudWatch Logs Insights query: ${input.queryString}`);
    logger.debug(`Query details: ${JSON.stringify({ logGroupNames: input.logGroupNames, startTime: new Date(input.startTime!), endTime: new Date(input.endTime!) })}`);

    const command = new StartQueryCommand(input);
    const response = await this.clientHelper.getCwLogsClient(region).send(command);
    if (response.queryId) {
      return response.queryId;
    }
    return "";
  }

  async resolveQuery(queryId: string, region?: string): Promise<ResultField[] | undefined> {
    const command = new GetQueryResultsCommand({ queryId });
    const response: GetQueryResultsCommandOutput = await this.clientHelper.getCwLogsClient(region).send(command);
    logger.debug(`Query response: ${JSON.stringify(response)}`);
    if (response.status === "Running") {
      logger.debug(`Query is still running. QueryID: ${queryId}`);
      return undefined;
    }
    return (
      response.results?.[0] ||
      (() => {
        logger.debug(`Query contains no results. QueryID: ${queryId}`);
        return [];
      })()
    );
  }

  async resolveQueries(event: SQSEvent): Promise<(ResultField | undefined)[]> {
    const requestBody: SQSEventBody = JSON.parse(event.Records[0].body);
    const { queryIds, crossRegionQueryIds } = requestBody;
    if (Object.keys(queryIds).length <= 0) return [];
    return (
      await Promise.all(
        queryIds.map((queryId: string) => {
          // crossRegionQueryIds maps region → queryIds for queries started in a non-default region.
          // If this queryId appears in the map, resolve it against that region (e.g. us-east-1 for CF Function logs);
          // otherwise region is undefined and the default stack region is used.
          const matchingEntry = Object.entries(crossRegionQueryIds ?? {})
            .find(([, ids]) => ids.includes(queryId));
          const region: string | undefined = matchingEntry?.[0];
          return this.resolveQuery(queryId, region);
        })
      )
    ).flat();
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

      console.info("Sending anonymous metric", payloadStr);
      await fetch(METRICS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payloadStr.length),
        },
        body: payloadStr,
      });

      result.Message = "Anonymous data was sent successfully.";
    } catch (err) {
      console.error("Error sending anonymous metric.");
      console.error(err);

      result.Message = "Anonymous data sending failed.";
    }

    return result;
  }
}
