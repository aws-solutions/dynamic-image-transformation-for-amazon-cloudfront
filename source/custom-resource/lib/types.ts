// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CheckFallbackImageRequestProperties,
  CheckSecretManagerRequestProperties,
  CheckSourceBucketsRequestProperties,
  CreateLoggingBucketRequestProperties,
  CustomResourceRequestPropertiesBase,
  PutConfigRequestProperties,
  SendMetricsRequestProperties,
  CheckFirstBucketRegionRequestProperties,
  GetAppRegApplicationNameRequestProperties,
  ValidateExistingDistributionRequestProperties,
} from "./interfaces";

export type ResourcePropertyTypes =
  | CustomResourceRequestPropertiesBase
  | SendMetricsRequestProperties
  | PutConfigRequestProperties
  | CheckSourceBucketsRequestProperties
  | CheckSecretManagerRequestProperties
  | CheckFallbackImageRequestProperties
  | CreateLoggingBucketRequestProperties
  | CheckFirstBucketRegionRequestProperties
  | GetAppRegApplicationNameRequestProperties
  | ValidateExistingDistributionRequestProperties;

export class CustomResourceError extends Error {
  constructor(public readonly code: string, public readonly message: string) {
    super();
  }
}
