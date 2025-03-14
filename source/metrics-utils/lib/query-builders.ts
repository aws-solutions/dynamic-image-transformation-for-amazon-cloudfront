// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ILogGroup, QueryString } from "aws-cdk-lib/aws-logs";
import { SolutionsMetrics } from "./solutions-metrics";

const DEFAULT_PERIOD = 604800;

/**
 *
 * @param {object} props Associated metric properties.
 * @param {string} props.functionName The name of the Lambda function to retrieve the metric from.
 * @param {number} props.period The period to use for the metric, defaults to one week.
 * @param {string} props.identifier An identifier to be used for this metric to allow for uniqueness among the same metrics used for other resources.
 */
export function addLambdaInvocationCount(
  this: SolutionsMetrics,
  props: {
    functionName: string;
    period?: number;
    identifier?: string;
  }
) {
  this.addMetricDataQuery({
    MetricStat: {
      Metric: {
        Namespace: "AWS/Lambda",
        Dimensions: [
          {
            Name: "FunctionName",
            Value: props.functionName,
          },
        ],
        MetricName: "Invocations",
      },
      Stat: "Sum",
      Period: props.period || DEFAULT_PERIOD,
    },
    identifier: props.identifier,
  });
}

/**
 *
 * @param {object} props Associated metric properties.
 * @param {string} props.distributionId The id of the CloudFront distribution the metric should be associated with
 * @param {string} props.metricName The CloudFront metric name to be retrieved.
 * @param {number} props.period The period to use for the metric, defaults to one week.
 * @param {string} props.identifier An identifier to be used for this metric to allow for uniqueness among the same metrics used for other resources.
 */
export function addCloudFrontMetric(
  this: SolutionsMetrics,
  props: {
    distributionId: string;
    metricName: string;
    period?: number;
    identifier?: string;
  }
) {
  this.addMetricDataQuery({
    MetricStat: {
      Metric: {
        Namespace: "AWS/CloudFront",
        Dimensions: [
          {
            Name: "DistributionId",
            Value: props.distributionId,
          },
          {
            Name: "Region",
            Value: "Global",
          },
        ],
        MetricName: props.metricName,
      },
      Stat: "Sum",
      Period: props.period || DEFAULT_PERIOD,
    },
    identifier: props.identifier,
    region: "us-east-1",
  });
}

/**
 *
 * @param {object} props Associated metric properties.
 * @param {string} props.clusterName The name of the ECS Cluster
 * @param {string} props.taskDefinitionFamily The task definition family for the ECS Cluster
 * @param {number} props.period The period to use for the metric, defaults to one week.
 * @param {string} props.identifier An identifier to be used for this metric to allow for uniqueness among the same metrics used for other resources.
 */
export function addECSAverageCPUUtilization(
  this: SolutionsMetrics,
  props: {
    clusterName: string;
    taskDefinitionFamily: string;
    period?: number;
    identifier?: string;
  }
) {
  this.addMetricDataQuery({
    MetricStat: {
      Metric: {
        Namespace: "ECS/ContainerInsights",
        Dimensions: [
          {
            Name: "ClusterName",
            Value: props.clusterName,
          },
          {
            Name: "TaskDefinitionFamily",
            Value: props.taskDefinitionFamily,
          },
        ],
        MetricName: "CpuUtilized",
      },
      Stat: "Average",
      Period: props.period || DEFAULT_PERIOD,
    },
    identifier: props.identifier,
  });
}

/**
 *
 * @param {object} props Associated metric properties.
 * @param {string} props.clusterName The name of the ECS Cluster
 * @param {string} props.taskDefinitionFamily The task definition family for the ECS Cluster
 * @param {number} props.period The period to use for the metric, defaults to one week.
 * @param {string} props.identifier An identifier to be used for this metric to allow for uniqueness among the same metrics used for other resources.
 */
export function addECSAverageMemoryUtilization(
  this: SolutionsMetrics,
  props: {
    clusterName: string;
    taskDefinitionFamily: string;
    period?: number;
    identifier?: string;
  }
) {
  this.addMetricDataQuery({
    MetricStat: {
      Metric: {
        Namespace: "ECS/ContainerInsights",
        Dimensions: [
          {
            Name: "ClusterName",
            Value: props.clusterName,
          },
          {
            Name: "TaskDefinitionFamily",
            Value: props.taskDefinitionFamily,
          },
        ],
        MetricName: "MemoryUtilized",
      },
      Stat: "Average",
      Period: props.period || DEFAULT_PERIOD,
    },
    identifier: props.identifier,
  });
}

/**
 *
 * @param {object} props Associated metric properties.
 * @param {string} props.tableName The name of the DynamoDB table metrics are to be retrieved about
 * @param {number} props.period The period to use for the metric, defaults to one week.
 * @param {string} props.identifier An identifier to be used for this metric to allow for uniqueness among the same metrics used for other resources.
 */
export function addDynamoDBConsumedWriteCapacityUnits(
  this: SolutionsMetrics,
  props: {
    tableName: string;
    period?: number;
    identifier?: string;
  }
) {
  this.addMetricDataQuery({
    MetricStat: {
      Metric: {
        Namespace: "AWS/DynamoDB",
        Dimensions: [
          {
            Name: "TableName",
            Value: props.tableName,
          },
        ],
        MetricName: "ConsumedWriteCapacityUnits",
      },
      Stat: "Sum",
      Period: props.period || DEFAULT_PERIOD,
    },
    identifier: props.identifier,
  });
}

/**
 *
 * @param {object} props Associated metric properties.
 * @param {string} props.tableName The name of the DynamoDB table metrics are to be retrieved about
 * @param {number} props.period The period to use for the metric, defaults to one week.
 * @param {string} props.identifier An identifier to be used for this metric to allow for uniqueness among the same metrics used for other resources.
 */
export function addDynamoDBConsumedReadCapacityUnits(
  this: SolutionsMetrics,
  props: {
    tableName: string;
    period?: number;
    identifier?: string;
  }
) {
  this.addMetricDataQuery({
    MetricStat: {
      Metric: {
        Namespace: "AWS/DynamoDB",
        Dimensions: [
          {
            Name: "TableName",
            Value: props.tableName,
          },
        ],
        MetricName: "ConsumedReadCapacityUnits",
      },
      Stat: "Sum",
      Period: props.period || DEFAULT_PERIOD,
    },
    identifier: props.identifier,
  });
}

/**
 *
 * @param {object} props Associated metric properties.
 * @param {ILogGroup[]} props.logGroups The log groups that should be queried when retrieving this metric.
 * @param {string} props.queryDefinitionName The name that should be used for this query definition. The provided identifier will be appended to this value for uniqueness.
 * @param {number} props.limit The limit on log events returned by the query
 * @param {string} props.identifier An identifier to be used for this metric to allow for uniqueness among the same metrics used for other resources.
 */
export function addLambdaBilledDurationMemorySize(
  this: SolutionsMetrics,
  props: {
    logGroups: ILogGroup[];
    queryDefinitionName?: string;
    limit?: number;
    identifier?: string;
  }
) {
  this.addQueryDefinition({
    logGroups: props.logGroups,
    queryString: new QueryString({
      stats: `sum(@billedDuration) as AWSLambdaBilledDuration${
        props.identifier || ""
      }, max(@memorySize) as AWSLambdaMemorySize${props.identifier || ""}`,
      limit: props.limit,
    }),
    queryDefinitionName: `${props.queryDefinitionName || "BilledDurationMemorySizeQuery"}${props.identifier || ""}`,
  });
}
