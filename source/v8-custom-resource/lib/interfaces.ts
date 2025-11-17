// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CustomResourceActions, CustomResourceRequestTypes, StatusTypes } from "./enums";

export interface CustomResourceRequestPropertiesBase {
  CustomAction: CustomResourceActions;
}

export interface SendMetricsRequestProperties extends CustomResourceRequestPropertiesBase {
  AnonymousData: "Yes" | "No";
  UUID: string;
  AccountId: string;
  StackId: string;
  Region: string;
  UseExistingCloudFrontDistribution: string;
  DeploymentSize: string;
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
  ResourceProperties: CustomResourceRequestPropertiesBase;
}

export interface CompletionStatus {
  Status: StatusTypes;
  Data: Record<string, unknown>;
}

export interface LambdaContext {
  logStreamName: string;
}

export interface MetricPayload {
  Solution: string | undefined;
  Version: string | undefined;
  UUID: string;
  TimeStamp: string;
  AccountId: string;
  StackId: string;
  Data: {
    Region: string;
    Type: CustomResourceRequestTypes;
    UseExistingCloudFrontDistribution: string;
    DeploymentSize: string;
  };
}
