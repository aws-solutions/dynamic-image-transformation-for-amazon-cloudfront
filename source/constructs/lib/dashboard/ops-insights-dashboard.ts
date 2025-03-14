// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, CfnCondition, Duration } from "aws-cdk-lib";
import { Dashboard, PeriodOverride, TextWidget } from "aws-cdk-lib/aws-cloudwatch";
import { Size, DefaultGraphWidget, DefaultSingleValueWidget } from "./widgets";
import { SIHMetrics, SUPPORTED_CLOUDFRONT_METRICS, SUPPORTED_LAMBDA_METRICS } from "./sih-metrics";
import { Construct } from "constructs";

export interface OperationalInsightsDashboardProps {
  readonly enabled: CfnCondition;
  readonly backendLambdaFunctionName: string;
  readonly cloudFrontDistributionId: string;
  readonly namespace: string;
}
export class OperationalInsightsDashboard extends Construct {
  public readonly dashboard: Dashboard;
  constructor(scope: Construct, id: string, props: OperationalInsightsDashboardProps) {
    super(scope, id);
    this.dashboard = new Dashboard(this, id, {
      dashboardName: `${Aws.STACK_NAME}-${props.namespace}-Operational-Insights-Dashboard`,
      defaultInterval: Duration.days(7),
      periodOverride: PeriodOverride.INHERIT,
    });

    if (!props.backendLambdaFunctionName || !props.cloudFrontDistributionId) {
      throw new Error("backendLambdaFunctionName and cloudFrontDistributionId are required");
    }

    const metrics = new SIHMetrics({
      backendLambdaFunctionName: props.backendLambdaFunctionName,
      cloudFrontDistributionId: props.cloudFrontDistributionId,
    });

    this.dashboard.addWidgets(
      new TextWidget({
        markdown: "# Lambda",
        width: Size.FULL_WIDTH,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      new DefaultGraphWidget({
        width: Size.THIRD_WIDTH,
        height: Size.THIRD_WIDTH,
        title: "Lambda Errors",
        metric: metrics.createLambdaMetric(SUPPORTED_LAMBDA_METRICS.ERRORS),
        label: "Lambda Errors",
        unit: "Count",
      }),
      new DefaultGraphWidget({
        width: Size.THIRD_WIDTH,
        height: Size.THIRD_WIDTH,
        title: "Lambda Duration",
        metric: metrics.createLambdaMetric(SUPPORTED_LAMBDA_METRICS.DURATION),
        label: "Lambda Duration",
        unit: "Milliseconds",
      }),
      new DefaultGraphWidget({
        width: Size.THIRD_WIDTH,
        height: Size.THIRD_WIDTH,
        title: "Lambda Invocations",
        metric: metrics.createLambdaMetric(SUPPORTED_LAMBDA_METRICS.INVOCATIONS),
        label: "Lambda Invocations",
        unit: "Count",
      })
    );

    this.dashboard.addWidgets(
      new TextWidget({
        markdown: "# CloudFront",
        width: Size.FULL_WIDTH,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      new DefaultGraphWidget({
        title: "CloudFront Requests",
        metric: metrics.createCloudFrontMetric(SUPPORTED_CLOUDFRONT_METRICS.REQUESTS),
        label: "CloudFront Requests",
        unit: "Count",
      }),
      new DefaultGraphWidget({
        title: "CloudFront Bytes Downloaded",
        metric: metrics.createCloudFrontMetric(SUPPORTED_CLOUDFRONT_METRICS.BYTES_DOWNLOAD),
        label: "CloudFront Bytes Downloaded",
        unit: "Bytes",
      }),
      new DefaultSingleValueWidget({
        title: "Cache Hit Rate",
        metric: metrics.getCacheHitRate(),
        label: "Cache Hit Rate (%)",
      }),
      new DefaultSingleValueWidget({
        title: "Average Image Size",
        metric: metrics.getAverageImageSize(),
        label: "Average Image Size (Bytes)",
      })
    );

    this.dashboard.addWidgets(
      new TextWidget({
        markdown: "# Overall",
        width: Size.FULL_WIDTH,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      new DefaultSingleValueWidget({
        title: "Estimated Cost",
        width: Size.FULL_WIDTH,
        metric: metrics.getEstimatedCost(),
        label: "Estimated Cost($)",
        fullPrecision: true,
      })
    );
  }
}
