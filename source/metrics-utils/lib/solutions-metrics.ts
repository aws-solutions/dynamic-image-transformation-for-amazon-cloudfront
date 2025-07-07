// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as path from "path";
import { Duration, CfnResource, Aws } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Schedule } from "aws-cdk-lib/aws-events";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { EventbridgeToLambda } from "@aws-solutions-constructs/aws-eventbridge-lambda";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

import { LambdaToSqsToLambda } from "@aws-solutions-constructs/aws-lambda-sqs-lambda";
import { MetricDataQuery } from "@aws-sdk/client-cloudwatch";
import { ILogGroup, QueryDefinition, QueryDefinitionProps, QueryString } from "aws-cdk-lib/aws-logs";
import { ExecutionDay, MetricDataProps, SolutionsMetricProps } from "../lambda/helpers/types";
import {
  addLambdaBilledDurationMemorySize,
  addCloudFrontMetric,
  addLambdaInvocationCount,
  addECSAverageCPUUtilization,
  addECSAverageMemoryUtilization,
  addDynamoDBConsumedWriteCapacityUnits,
  addDynamoDBConsumedReadCapacityUnits,
} from "./query-builders";

export class SolutionsMetrics extends Construct {
  private metricDataQueries: MetricDataQuery[];
  private eventBridgeRule: CfnResource;
  private metricsLambdaFunction: NodejsFunction;
  private existingMetricIdentifiers: Set<string>;
  private queryDefinitionNames: Set<string>;

  constructor(scope: Construct, id: string, props: SolutionsMetricProps) {
    super(scope, id);
    const { VERSION } = process.env;
    this.metricsLambdaFunction = new NodejsFunction(this, "MetricsLambda", {
      description: "Metrics util",
      entry: path.join(__dirname, "../lambda/index.ts"),
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(60),
      memorySize: 128,
      environment: {
        QUERY_PREFIX: `${Aws.STACK_NAME}-`,
        SOLUTION_ID: scope.node.tryGetContext("solutionId"),
        SOLUTION_NAME: scope.node.tryGetContext("solutionName"),
        SOLUTION_VERSION: VERSION ?? scope.node.tryGetContext("solutionVersion"),
        UUID: props.uuid ?? "",
        EXECUTION_DAY: props.executionDay ? props.executionDay : ExecutionDay.MONDAY,
      },
    });

    (this.metricsLambdaFunction.node.defaultChild as CfnResource).addMetadata("cfn_nag", {
      rules_to_suppress: [
        {
          id: "W89",
          reason: "Not in vpc",
        },
        {
          id: "W92",
          reason: "No need for ReservedConcurrentExecutions, does not support any application functional logic",
        },
      ],
    });

    const ruleToLambda = new EventbridgeToLambda(this, "EventbridgeRuleToLambda", {
      eventRuleProps: {
        schedule: Schedule.cron({
          minute: "0",
          hour: "23",
          weekDay: props.executionDay ? props.executionDay : ExecutionDay.MONDAY,
        }),
      },
      existingLambdaObj: this.metricsLambdaFunction,
    });

    props.queryProps?.map(this.addQueryDefinition.bind(this));

    this.metricDataQueries = [];
    this.eventBridgeRule = ruleToLambda.eventsRule.node.defaultChild as CfnResource;
    props.metricDataProps?.map(this.addMetricDataQuery.bind(this));

    // eslint-disable-next-line no-new
    new LambdaToSqsToLambda(this, "LambdaToSqsToLambda", {
      existingConsumerLambdaObj: ruleToLambda.lambdaFunction,
      existingProducerLambdaObj: ruleToLambda.lambdaFunction,
      queueProps: {
        deliveryDelay: Duration.minutes(15),
        visibilityTimeout: Duration.minutes(17),
        receiveMessageWaitTime: Duration.seconds(20),
        retentionPeriod: Duration.days(1),
        maxMessageSizeBytes: 1024,
      },
      deployDeadLetterQueue: false,
    });

    this.existingMetricIdentifiers = new Set<string>();
    this.queryDefinitionNames = new Set<string>();
  }

  extractQueryFields(queryString: QueryString): string[] {
    const statsString = queryString.toString();
    if (!statsString) return [];

    const regex = /(\w+)\(([^)]+)\)\s+as\s+([^,]+?)(?:,|$)/gi;
    const matches = [...statsString.matchAll(regex)];
    return matches.map((match) => (match[3] ? match[3] : `${match[1]}_${match[2]}`));
  }

  addQueryDefinition(queryDefinitionProps: QueryDefinitionProps): void {
    const modifiedQueryDefinitionName = `${Aws.STACK_NAME}-${queryDefinitionProps.queryDefinitionName}`;
    // eslint-disable-next-line no-new
    new QueryDefinition(this, queryDefinitionProps.queryDefinitionName, {
      ...queryDefinitionProps,
      queryDefinitionName: modifiedQueryDefinitionName,
    });
    if (this.queryDefinitionNames.has(modifiedQueryDefinitionName)) {
      throw new Error(`Duplicate query definition name: ${modifiedQueryDefinitionName}.`);
    }
    this.queryDefinitionNames.add(modifiedQueryDefinitionName);

    const metricIdentifier = this.extractQueryFields(queryDefinitionProps.queryString);
    // Duplicate metric names would cause it to be impossible to determine which metric refers to which initial resource
    metricIdentifier.forEach((metricIdentifier) => {
      if (metricIdentifier && !metricIdentifier.match(/^\w*$/)) {
        throw new Error(`Identifier: ${metricIdentifier} must contain only alphanumeric characters and underscores`);
      }
      if (this.existingMetricIdentifiers.has(metricIdentifier)) {
        throw new Error(`Duplicate metric identifier: ${metricIdentifier}.`);
      }
      this.existingMetricIdentifiers.add(metricIdentifier);
    });

    queryDefinitionProps.logGroups?.map((logGroup: ILogGroup) =>
      logGroup.grant(this.metricsLambdaFunction, "logs:StartQuery", "logs:GetQueryResults")
    );
    this.metricsLambdaFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["logs:DescribeQueryDefinitions"],
        resources: ["*"],
      })
    );
  }

  addMetricDataQuery(metricDataProp: MetricDataProps): void {
    const identifierAddon = metricDataProp.identifier ? `/${metricDataProp.identifier}` : "";
    if (identifierAddon && !identifierAddon.match(/^[a-zA-Z0-9/]*$/)) {
      throw new Error(
        `Metric Identifier: ${identifierAddon} must contain only alphanumeric characters and forward slashes`
      );
    }

    const metricIdentifier = `${metricDataProp.MetricStat?.Metric?.Namespace}/${metricDataProp.MetricStat?.Metric?.MetricName}${identifierAddon}`;
    if (this.existingMetricIdentifiers.has(metricIdentifier)) {
      throw new Error(`Duplicate metric identifier: ${metricIdentifier}.`);
    }
    this.existingMetricIdentifiers.add(metricIdentifier);
    if (this.metricDataQueries.length === 0) {
      this.metricsLambdaFunction.addToRolePolicy(
        new PolicyStatement({
          actions: ["cloudwatch:GetMetricData"],
          resources: ["*"],
        })
      );
    }
    this.metricDataQueries.push({
      ...metricDataProp,
      Id: `id_${metricIdentifier.replace(/\//g, "_")}`,
    });
    this.eventBridgeRule.addOverride("Properties.Targets.0.InputTransformer", {
      InputPathsMap: {
        time: "$.time",
        "detail-type": "$.detail-type",
      },
      InputTemplate: `{"detail-type": <detail-type>, "time": <time>, "metrics-data-query": ${JSON.stringify(
        this.metricDataQueries
      )}}`,
    });
  }

  addLambdaInvocationCount: typeof addLambdaInvocationCount;
  addLambdaBilledDurationMemorySize: typeof addLambdaBilledDurationMemorySize;
  addCloudFrontMetric: typeof addCloudFrontMetric;
  addECSAverageCPUUtilization: typeof addECSAverageCPUUtilization;
  addECSAverageMemoryUtilization: typeof addECSAverageMemoryUtilization;
  addDynamoDBConsumedWriteCapacityUnits: typeof addDynamoDBConsumedWriteCapacityUnits;
  addDynamoDBConsumedReadCapacityUnits: typeof addDynamoDBConsumedReadCapacityUnits;
}

Object.assign(SolutionsMetrics.prototype, {
  addLambdaInvocationCount,
  addLambdaBilledDurationMemorySize,
  addCloudFrontMetric,
  addECSAverageCPUUtilization,
  addECSAverageMemoryUtilization,
  addDynamoDBConsumedWriteCapacityUnits,
  addDynamoDBConsumedReadCapacityUnits,
});
