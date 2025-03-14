// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MathExpression, Metric } from "aws-cdk-lib/aws-cloudwatch";

/**
  Properties for configuring metrics
 */
export interface MetricProps {
  /** The name of the backend Lambda function to monitor */
  readonly backendLambdaFunctionName: string;
  /** The CloudFront distribution ID to monitor */
  readonly cloudFrontDistributionId: string;
}

export enum SUPPORTED_LAMBDA_METRICS {
  ERRORS = "Errors",
  INVOCATIONS = "Invocations",
  DURATION = "Duration",
}

export enum SUPPORTED_CLOUDFRONT_METRICS {
  REQUESTS = "Requests",
  BYTES_DOWNLOAD = "BytesDownloaded",
}

enum Namespace {
  LAMBDA = "AWS/Lambda",
  CLOUDFRONT = "AWS/CloudFront",
}

// Relevant AWS Pricing as of Dec 2024 for us-east-1
const PRICING = {
  CLOUDFRONT_BYTES: 0.085 / 1024 / 1024 / 1024,
  CLOUDFRONT_REQUESTS: 0.0075 / 10000,
  LAMBDA_DURATION: 1.66667 / 100000 / 1000,
  LAMBDA_INVOCATIONS: 0.2 / 1000000,
};

/**
 * Helper class for defining the underlying metrics available to the solution for ingestion into dashboard widgets
 */
export class SIHMetrics {
  private readonly props;

  constructor(props: MetricProps) {
    this.props = props;
  }

  /**
   *
   * @param metric Creates a MathExpression to represent the running sum of a given metric
   * @returns {MathExpression} The running sum of the provided metric
   */
  runningSum(metric: Metric) {
    return new MathExpression({
      expression: `RUNNING_SUM(metric)`,
      usingMetrics: {
        metric,
      },
    });
  }

  /**
   * Creates a Lambda metric with standard dimensions and statistics
   * @param metricName The name of the Lambda metric to create
   * @returns {Metric} Configured Lambda metric
   */
  createLambdaMetric(metricName: SUPPORTED_LAMBDA_METRICS) {
    return new Metric({
      namespace: Namespace.LAMBDA,
      metricName,
      dimensionsMap: {
        FunctionName: this.props.backendLambdaFunctionName,
      },
      statistic: "SUM",
    });
  }

  /**
   * Creates a CloudFront metric with standard dimensions and statistics
   * @param metricName The name of the CloudFront metric to create
   * @returns {Metric} Configured CloudFront metric
   */
  createCloudFrontMetric(metricName: SUPPORTED_CLOUDFRONT_METRICS) {
    return new Metric({
      namespace: Namespace.CLOUDFRONT,
      metricName,
      region: "us-east-1",
      dimensionsMap: {
        Region: "Global",
        DistributionId: this.props.cloudFrontDistributionId,
      },
      statistic: "SUM",
    });
  }

  /**
   * Calculates the cache hit rate for the Image Handler distribution. This is represented as the % of requests which were returned from the cache.
   * @returns {MathExpression} The cache hit rate as a percentage
   */
  getCacheHitRate() {
    return new MathExpression({
      expression: "100 * (cloudFrontRequests - lambdaInvocations) / (cloudFrontRequests)",
      usingMetrics: {
        cloudFrontRequests: this.createCloudFrontMetric(SUPPORTED_CLOUDFRONT_METRICS.REQUESTS),
        lambdaInvocations: this.createLambdaMetric(SUPPORTED_LAMBDA_METRICS.INVOCATIONS),
      },
    });
  }

  /**
   * Calculates estimated cost in USD based on AWS pricing as of Dec 2024 in us-east-1.
   * Note: This is an approximation for the us-east-1 region only and includes
   * CloudFront data transfer and requests, and Lambda duration and invocations.
   * Some additional charges may apply for other services or regions.
   * @returns {MathExpression} Estimated cost in USD
   */
  getEstimatedCost() {
    return new MathExpression({
      expression: `${PRICING.CLOUDFRONT_BYTES} * cloudFrontBytesDownloaded + ${PRICING.CLOUDFRONT_REQUESTS} * cloudFrontRequests + ${PRICING.LAMBDA_DURATION} * lambdaDuration + ${PRICING.LAMBDA_INVOCATIONS} * lambdaInvocations`,
      usingMetrics: {
        cloudFrontBytesDownloaded: this.createCloudFrontMetric(SUPPORTED_CLOUDFRONT_METRICS.BYTES_DOWNLOAD),
        cloudFrontRequests: this.createCloudFrontMetric(SUPPORTED_CLOUDFRONT_METRICS.REQUESTS),
        lambdaDuration: this.createLambdaMetric(SUPPORTED_LAMBDA_METRICS.DURATION),
        lambdaInvocations: this.createLambdaMetric(SUPPORTED_LAMBDA_METRICS.INVOCATIONS),
      },
    });
  }

  /**
   * Calculates the average size of images served through CloudFront
   * @returns {MathExpression} Average image size in bytes per request
   */
  getAverageImageSize() {
    return new MathExpression({
      expression: "cloudFrontBytesDownloaded / cloudFrontRequests",
      usingMetrics: {
        cloudFrontBytesDownloaded: this.createCloudFrontMetric(SUPPORTED_CLOUDFRONT_METRICS.BYTES_DOWNLOAD),
        cloudFrontRequests: this.createCloudFrontMetric(SUPPORTED_CLOUDFRONT_METRICS.REQUESTS),
      },
    });
  }
}
