// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ILogGroup, QueryString } from "aws-cdk-lib/aws-logs";
import { SolutionsMetrics } from "./solutions-metrics";

export function addLambdaInvocationCount(this: SolutionsMetrics, functionName: string, period: number = 604800) {
  this.addMetricDataQuery({
    MetricStat: {
      Metric: {
        Namespace: "AWS/Lambda",
        Dimensions: [
          {
            Name: "FunctionName",
            Value: functionName,
          },
        ],
        MetricName: "Invocations",
      },
      Stat: "Sum",
      Period: period,
    },
    Id: undefined,
  });
}

export function addCloudFrontMetric(
  this: SolutionsMetrics,
  distributionId: string,
  metricName: string,
  period: number = 604800
) {
  this.addMetricDataQuery({
    MetricStat: {
      Metric: {
        Namespace: "AWS/CloudFront",
        Dimensions: [
          {
            Name: "DistributionId",
            Value: distributionId,
          },
          {
            Name: "Region",
            Value: "Global",
          },
        ],
        MetricName: metricName,
      },
      Stat: "Sum",
      Period: period,
    },
    region: "us-east-1",
    Id: undefined,
  });
}

export function addLambdaBilledDurationMemorySize(
  this: SolutionsMetrics,
  logGroups: ILogGroup[],
  queryDefinitionName: string,
  limit: number | undefined = undefined
) {
  this.addQueryDefinition({
    logGroups,
    queryString: new QueryString({
      stats: "sum(@billedDuration) as AWSLambdaBilledDuration, max(@memorySize) as AWSLambdaMemorySize",
      limit,
    }),
    queryDefinitionName,
  });
}
