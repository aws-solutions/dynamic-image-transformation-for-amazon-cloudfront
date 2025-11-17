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
 * @param {string} props.stat The statistic to use for the metric (Sum, Average, etc.), defaults to Sum.
 * @param {number} props.period The period to use for the metric, defaults to one week.
 * @param {string} props.identifier An identifier to be used for this metric to allow for uniqueness among the same metrics used for other resources.
 */
export function addCloudFrontMetric(
  this: SolutionsMetrics,
  props: {
    distributionId: string;
    metricName: string;
    stat?: string;
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
      Stat: props.stat || "Sum",
      Period: props.period || DEFAULT_PERIOD,
    },
    identifier: props.identifier,
    region: "us-east-1",
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

// ============================================================================
// V8 ECS Container Metrics (Image Transformation)
// ============================================================================

export function addECSImageSizeMetrics(
  this: SolutionsMetrics,
  props: {
    logGroups: ILogGroup[];
    identifier?: string;
  }
) {
  this.addQueryDefinition({
    logGroups: props.logGroups,
    queryString: new QueryString({
      fields: ['originImageSize', 'transformedImageSize'],
      filterStatements: ['metricType = "imageTransformation"'],
      stats: `sum(originImageSize) as ImageSize_TotalOrigin, sum(transformedImageSize) as ImageSize_TotalTransformed`,
    }),
    queryDefinitionName: `ECSImageSizeMetrics${props.identifier || ""}`,
  });
}

export function addECSImageFormatMetrics(
  this: SolutionsMetrics,
  props: {
    logGroups: ILogGroup[];
    identifier?: string;
  }
) {
  this.addQueryDefinition({
    logGroups: props.logGroups,
    queryString: new QueryString({
      fields: ['originFormat', 'transformedFormat'],
      filterStatements: ['metricType = "imageTransformation"'],
      stats: `sum(originFormat = "jpeg") as Format_Origin_Jpeg, sum(originFormat = "jpg") as Format_Origin_Jpg, sum(originFormat = "png") as Format_Origin_Png, sum(originFormat = "webp") as Format_Origin_Webp, sum(originFormat = "gif") as Format_Origin_Gif, sum(originFormat = "tiff") as Format_Origin_Tiff, sum(originFormat = "avif") as Format_Origin_Avif, sum(originFormat = "heif") as Format_Origin_Heif, sum(transformedFormat = "jpeg") as Format_Transformed_Jpeg, sum(transformedFormat = "jpg") as Format_Transformed_Jpg, sum(transformedFormat = "png") as Format_Transformed_Png, sum(transformedFormat = "webp") as Format_Transformed_Webp, sum(transformedFormat = "gif") as Format_Transformed_Gif, sum(transformedFormat = "tiff") as Format_Transformed_Tiff, sum(transformedFormat = "avif") as Format_Transformed_Avif, sum(transformedFormat = "heif") as Format_Transformed_Heif`,
    }),
    queryDefinitionName: `ECSImageFormatMetrics${props.identifier || ""}`,
  });
}

export function addECSTransformationTimeBuckets(
  this: SolutionsMetrics,
  props: {
    logGroups: ILogGroup[];
    identifier?: string;
  }
) {
  this.addQueryDefinition({
    logGroups: props.logGroups,
    queryString: new QueryString({
      fields: ['totalDurationMs', 'originFetchMs', 'transformationApplicationMs'],
      filterStatements: ['metricType = "request_latencies"'],
      stats: `sum(totalDurationMs >= 0 and totalDurationMs < 50) as TotalRequestTimeBucket0To50Ms, sum(totalDurationMs >= 50 and totalDurationMs < 100) as TotalRequestTimeBucket50To100Ms, sum(totalDurationMs >= 100 and totalDurationMs < 150) as TotalRequestTimeBucket100To150Ms, sum(totalDurationMs >= 150 and totalDurationMs < 200) as TotalRequestTimeBucket150To200Ms, sum(totalDurationMs >= 200 and totalDurationMs < 300) as TotalRequestTimeBucket200To300Ms, sum(totalDurationMs >= 300 and totalDurationMs < 400) as TotalRequestTimeBucket300To400Ms, sum(totalDurationMs >= 400 and totalDurationMs < 500) as TotalRequestTimeBucket400To500Ms, sum(totalDurationMs >= 500 and totalDurationMs < 600) as TotalRequestTimeBucket500To600Ms, sum(totalDurationMs >= 600 and totalDurationMs < 700) as TotalRequestTimeBucket600To700Ms, sum(totalDurationMs >= 700 and totalDurationMs < 800) as TotalRequestTimeBucket700To800Ms, sum(totalDurationMs >= 800 and totalDurationMs < 900) as TotalRequestTimeBucket800To900Ms, sum(totalDurationMs >= 900 and totalDurationMs < 1000) as TotalRequestTimeBucket900To1000Ms, sum(totalDurationMs >= 1000 and totalDurationMs < 1250) as TotalRequestTimeBucket1000To1250Ms, sum(totalDurationMs >= 1250 and totalDurationMs < 1500) as TotalRequestTimeBucket1250To1500Ms, sum(totalDurationMs >= 1500 and totalDurationMs < 2000) as TotalRequestTimeBucket1500To2000Ms, sum(totalDurationMs >= 2000) as TotalRequestTimeBucket2000MsPlus, sum(originFetchMs >= 0 and originFetchMs < 50) as OriginFetchBucket0To50Ms, sum(originFetchMs >= 50 and originFetchMs < 100) as OriginFetchBucket50To100Ms, sum(originFetchMs >= 100 and originFetchMs < 150) as OriginFetchBucket100To150Ms, sum(originFetchMs >= 150 and originFetchMs < 200) as OriginFetchBucket150To200Ms, sum(originFetchMs >= 200 and originFetchMs < 300) as OriginFetchBucket200To300Ms, sum(originFetchMs >= 300 and originFetchMs < 400) as OriginFetchBucket300To400Ms, sum(originFetchMs >= 400 and originFetchMs < 500) as OriginFetchBucket400To500Ms, sum(originFetchMs >= 500 and originFetchMs < 600) as OriginFetchBucket500To600Ms, sum(originFetchMs >= 600 and originFetchMs < 700) as OriginFetchBucket600To700Ms, sum(originFetchMs >= 700 and originFetchMs < 800) as OriginFetchBucket700To800Ms, sum(originFetchMs >= 800 and originFetchMs < 900) as OriginFetchBucket800To900Ms, sum(originFetchMs >= 900 and originFetchMs < 1000) as OriginFetchBucket900To1000Ms, sum(originFetchMs >= 1000 and originFetchMs < 1250) as OriginFetchBucket1000To1250Ms, sum(originFetchMs >= 1250 and originFetchMs < 1500) as OriginFetchBucket1250To1500Ms, sum(originFetchMs >= 1500 and originFetchMs < 2000) as OriginFetchBucket1500To2000Ms, sum(originFetchMs >= 2000) as OriginFetchBucket2000MsPlus, sum(transformationApplicationMs >= 0 and transformationApplicationMs < 50) as TransformationApplicationBucket0To50Ms, sum(transformationApplicationMs >= 50 and transformationApplicationMs < 100) as TransformationApplicationBucket50To100Ms, sum(transformationApplicationMs >= 100 and transformationApplicationMs < 150) as TransformationApplicationBucket100To150Ms, sum(transformationApplicationMs >= 150 and transformationApplicationMs < 200) as TransformationApplicationBucket150To200Ms, sum(transformationApplicationMs >= 200 and transformationApplicationMs < 300) as TransformationApplicationBucket200To300Ms, sum(transformationApplicationMs >= 300 and transformationApplicationMs < 400) as TransformationApplicationBucket300To400Ms, sum(transformationApplicationMs >= 400 and transformationApplicationMs < 500) as TransformationApplicationBucket400To500Ms, sum(transformationApplicationMs >= 500 and transformationApplicationMs < 600) as TransformationApplicationBucket500To600Ms, sum(transformationApplicationMs >= 600 and transformationApplicationMs < 700) as TransformationApplicationBucket600To700Ms, sum(transformationApplicationMs >= 700 and transformationApplicationMs < 800) as TransformationApplicationBucket700To800Ms, sum(transformationApplicationMs >= 800 and transformationApplicationMs < 900) as TransformationApplicationBucket800To900Ms, sum(transformationApplicationMs >= 900 and transformationApplicationMs < 1000) as TransformationApplicationBucket900To1000Ms, sum(transformationApplicationMs >= 1000 and transformationApplicationMs < 1250) as TransformationApplicationBucket1000To1250Ms, sum(transformationApplicationMs >= 1250 and transformationApplicationMs < 1500) as TransformationApplicationBucket1250To1500Ms, sum(transformationApplicationMs >= 1500 and transformationApplicationMs < 2000) as TransformationApplicationBucket1500To2000Ms, sum(transformationApplicationMs >= 2000) as TransformationApplicationBucket2000MsPlus`,
    }),
    queryDefinitionName: `ECSTransformationTimeBuckets${props.identifier || ""}`,
  });
}

export function addECSImageSizeBuckets(
  this: SolutionsMetrics,
  props: {
    logGroups: ILogGroup[];
    identifier?: string;
  }
) {
  this.addQueryDefinition({
    logGroups: props.logGroups,
    queryString: new QueryString({
      fields: ['originImageSize', 'transformedImageSize'],
      filterStatements: ['metricType = "imageTransformation"'],
      stats: `sum(originImageSize >= 0 and originImageSize < 25600) as ImageSize_Origin_Bucket0To25Kb, sum(originImageSize >= 25600 and originImageSize < 51200) as ImageSize_Origin_Bucket25To50Kb, sum(originImageSize >= 51200 and originImageSize < 102400) as ImageSize_Origin_Bucket50To100Kb, sum(originImageSize >= 102400 and originImageSize < 256000) as ImageSize_Origin_Bucket100To250Kb, sum(originImageSize >= 256000 and originImageSize < 512000) as ImageSize_Origin_Bucket250To500Kb, sum(originImageSize >= 512000 and originImageSize < 1048576) as ImageSize_Origin_Bucket500KbTo1Mb, sum(originImageSize >= 1048576 and originImageSize < 2097152) as ImageSize_Origin_Bucket1To2Mb, sum(originImageSize >= 2097152 and originImageSize < 5242880) as ImageSize_Origin_Bucket2To5Mb, sum(originImageSize >= 5242880 and originImageSize < 10485760) as ImageSize_Origin_Bucket5To10Mb, sum(originImageSize >= 10485760 and originImageSize < 20971520) as ImageSize_Origin_Bucket10To20Mb, sum(originImageSize >= 20971520 and originImageSize < 52428800) as ImageSize_Origin_Bucket20To50Mb, sum(originImageSize >= 52428800 and originImageSize < 78643200) as ImageSize_Origin_Bucket50To75Mb, sum(originImageSize >= 78643200 and originImageSize < 104857600) as ImageSize_Origin_Bucket75To100Mb, sum(originImageSize >= 104857600 and originImageSize < 157286400) as ImageSize_Origin_Bucket100To150Mb, sum(originImageSize >= 157286400) as ImageSize_Origin_Bucket150MbPlus, sum(transformedImageSize >= 0 and transformedImageSize < 25600) as ImageSize_Transformed_Bucket0To25Kb, sum(transformedImageSize >= 25600 and transformedImageSize < 51200) as ImageSize_Transformed_Bucket25To50Kb, sum(transformedImageSize >= 51200 and transformedImageSize < 102400) as ImageSize_Transformed_Bucket50To100Kb, sum(transformedImageSize >= 102400 and transformedImageSize < 256000) as ImageSize_Transformed_Bucket100To250Kb, sum(transformedImageSize >= 256000 and transformedImageSize < 512000) as ImageSize_Transformed_Bucket250To500Kb, sum(transformedImageSize >= 512000 and transformedImageSize < 1048576) as ImageSize_Transformed_Bucket500KbTo1Mb, sum(transformedImageSize >= 1048576 and transformedImageSize < 2097152) as ImageSize_Transformed_Bucket1To2Mb, sum(transformedImageSize >= 2097152 and transformedImageSize < 5242880) as ImageSize_Transformed_Bucket2To5Mb, sum(transformedImageSize >= 5242880 and transformedImageSize < 10485760) as ImageSize_Transformed_Bucket5To10Mb, sum(transformedImageSize >= 10485760 and transformedImageSize < 20971520) as ImageSize_Transformed_Bucket10To20Mb, sum(transformedImageSize >= 20971520 and transformedImageSize < 52428800) as ImageSize_Transformed_Bucket20To50Mb, sum(transformedImageSize >= 52428800 and transformedImageSize < 78643200) as ImageSize_Transformed_Bucket50To75Mb, sum(transformedImageSize >= 78643200 and transformedImageSize < 104857600) as ImageSize_Transformed_Bucket75To100Mb, sum(transformedImageSize >= 104857600 and transformedImageSize < 157286400) as ImageSize_Transformed_Bucket100To150Mb, sum(transformedImageSize >= 157286400) as ImageSize_Transformed_Bucket150MbPlus`,
    }),
    queryDefinitionName: `ECSImageSizeBuckets${props.identifier || ""}`,
  });
}

export function addECSImageRequestCount(
  this: SolutionsMetrics,
  props: {
    logGroups: ILogGroup[];
    identifier?: string;
  }
) {
  this.addQueryDefinition({
    logGroups: props.logGroups,
    queryString: new QueryString({
      filterStatements: ['metricType = "imageTransformation"'],
      stats: `count() as Requests_TotalImages`,
    }),
    queryDefinitionName: `ECSImageRequestCount${props.identifier || ""}`,
  });
}

export function addECSOriginTypeMetrics(
  this: SolutionsMetrics,
  props: {
    logGroups: ILogGroup[];
    identifier?: string;
  }
) {
  this.addQueryDefinition({
    logGroups: props.logGroups,
    queryString: new QueryString({
      fields: ['originType'],
      filterStatements: ['operation = "image_fetched"'],
      stats: `sum(originType = "s3") as OriginType_S3, sum(originType = "external") as OriginType_External`,
    }),
    queryDefinitionName: `ECSOriginTypeMetrics${props.identifier || ""}`,
  });
}

export function addECSTransformationUsageMetrics(
  this: SolutionsMetrics,
  props: {
    logGroups: ILogGroup[];
    identifier?: string;
  }
) {
  this.addQueryDefinition({
    logGroups: props.logGroups,
    queryString: new QueryString({
      fields: ['finalTransformations', 't_animated', 't_blur', 't_convolve', 't_extract', 't_flatten', 't_flip', 't_flop', 't_format', 't_grayscale', 't_normalize', 't_quality', 't_resize', 't_rotate', 't_sharpen', 't_smartCrop', 't_stripExif', 't_stripIcc', 't_tint', 't_watermark'],
      filterStatements: ['metricType = "transformations"'],
      stats: `sum(t_animated) as Transformation_Animated, sum(t_blur) as Transformation_Blur, sum(t_convolve) as Transformation_Convolve, sum(t_extract) as Transformation_Extract, sum(t_flatten) as Transformation_Flatten, sum(t_flip) as Transformation_Flip, sum(t_flop) as Transformation_Flop, sum(t_format) as Transformation_Format, sum(t_grayscale) as Transformation_Grayscale, sum(t_normalize) as Transformation_Normalize, sum(t_quality) as Transformation_Quality, sum(t_resize) as Transformation_Resize, sum(t_rotate) as Transformation_Rotate, sum(t_sharpen) as Transformation_Sharpen, sum(t_smartCrop) as Transformation_SmartCrop, sum(t_stripExif) as Transformation_StripExif, sum(t_stripIcc) as Transformation_StripIcc, sum(t_tint) as Transformation_Tint, sum(t_watermark) as Transformation_Watermark, sum(finalTransformations = 0) as TransformationCount_0, sum(finalTransformations = 1) as TransformationCount_1, sum(finalTransformations = 2) as TransformationCount_2, sum(finalTransformations = 3) as TransformationCount_3, sum(finalTransformations = 4) as TransformationCount_4, sum(finalTransformations = 5) as TransformationCount_5, sum(finalTransformations >= 6 and finalTransformations <= 10) as TransformationCount_6To10, sum(finalTransformations >= 11) as TransformationCount_11Plus, avg(finalTransformations) as Transformation_AvgPerRequest, count(*) as Transformation_TotalRequests`,
    }),
    queryDefinitionName: `ECSTransformationUsageMetrics${props.identifier || ""}`,
  });
}

export function addTransformationSourceMetrics(
  this: SolutionsMetrics,
  props: {
    logGroups: ILogGroup[];
    identifier?: string;
  }
) {
  this.addQueryDefinition({
    logGroups: props.logGroups,
    queryString: new QueryString({
      fields: ['urlTransformations', 'policyTransformations'],
      filterStatements: ['operation = "transformations_finalized"'],
      stats: `sum(urlTransformations > 0 and policyTransformations = 0) as TransformationSource_URL, sum(urlTransformations = 0 and policyTransformations > 0) as TransformationSource_Policy, sum(urlTransformations > 0 and policyTransformations > 0) as TransformationSource_Both`,
    }),
    queryDefinitionName: `TransformationSourceMetrics${props.identifier || ""}`,
  });
}
