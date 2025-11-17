// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CustomResourceActions, CustomResourceRequestTypes, StatusTypes } from "./enums";
import { ResourcePropertyTypes } from "./types";

export interface CustomResourceRequestPropertiesBase {
  CustomAction: CustomResourceActions;
}

export interface SendMetricsRequestProperties extends CustomResourceRequestPropertiesBase {
  AnonymousData: "Yes" | "No";
  UUID: string;
  CorsEnabled: string;
  SourceBuckets: string;
  DeployDemoUi: string;
  LogRetentionPeriod: number;
  AutoWebP: string;
  EnableSignature: string;
  EnableDefaultFallbackImage: string;
  EnableS3ObjectLambda: string;
  OriginShieldRegion: string;
  UseExistingCloudFrontDistribution: string;
}

export interface PutConfigRequestProperties extends CustomResourceRequestPropertiesBase {
  ConfigItem: unknown;
  DestS3Bucket: string;
  DestS3key: string;
}

export interface CheckSourceBucketsRequestProperties extends CustomResourceRequestPropertiesBase {
  SourceBuckets: string;
}

export interface CheckFirstBucketRegionRequestProperties extends CheckSourceBucketsRequestProperties {
  UUID: string;
  S3ObjectLambda: string;
  StackId: string;
}


export interface ValidateExistingDistributionRequestProperties extends CustomResourceRequestPropertiesBase {
  ExistingDistributionID: string;
}

export interface CheckSecretManagerRequestProperties extends CustomResourceRequestPropertiesBase {
  SecretsManagerName: string;
  SecretsManagerKey: string;
}

export interface CheckFallbackImageRequestProperties extends CustomResourceRequestPropertiesBase {
  FallbackImageS3Bucket: string;
  FallbackImageS3Key: string;
}

export interface PolicyStatement {
  Action?: string;
  Resource?: string;
  Effect?: string;
  Principal?: string;
  Sid?: string;
  Condition?: Record<string, unknown>;
}

export interface CreateLoggingBucketRequestProperties extends CustomResourceRequestPropertiesBase {
  BucketSuffix: string;
  StackId: string;
}

export interface CustomResourceRequest {
  RequestType: CustomResourceRequestTypes;
  PhysicalResourceId: string;
  StackId: string;
  ServiceToken: string;
  RequestId: string;
  LogicalResourceId: string;
  ResponseURL: string;
  ResourceType: string;
  ResourceProperties: ResourcePropertyTypes;
}

export interface CompletionStatus {
  Status: StatusTypes;
  Data: Record<string, unknown> | { Error?: { Code: string; Message: string } };
}

export interface LambdaContext {
  logStreamName: string;
}

export interface MetricsPayloadData {
  Region: string;
  Type: CustomResourceRequestTypes;
  CorsEnabled: string;
  NumberOfSourceBuckets: number;
  DeployDemoUi: string;
  LogRetentionPeriod: number;
  AutoWebP: string;
  EnableSignature: string;
  EnableDefaultFallbackImage: string;
  EnableS3ObjectLambda: string;
  OriginShieldRegion: string;
  UseExistingCloudFrontDistribution: string;
}

export interface MetricPayload {
  Solution: string;
  Version: string;
  UUID: string;
  TimeStamp: string;
  Data: MetricsPayloadData;
}
