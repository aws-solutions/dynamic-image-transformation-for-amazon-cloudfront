// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CheckFallbackImageRequestProperties,
  CheckSecretManagerRequestProperties,
  CheckSourceBucketsRequestProperties,
  CopyS3AssetsRequestProperties,
  CreateLoggingBucketRequestProperties,
  CustomResourceRequestPropertiesBase,
  PutConfigRequestProperties,
  SendMetricsRequestProperties,
} from "./interfaces";

export type ResourcePropertyTypes =
  | CustomResourceRequestPropertiesBase
  | SendMetricsRequestProperties
  | PutConfigRequestProperties
  | CopyS3AssetsRequestProperties
  | CheckSourceBucketsRequestProperties
  | CheckSecretManagerRequestProperties
  | CheckFallbackImageRequestProperties
  | CreateLoggingBucketRequestProperties;

export class CustomResourceError extends Error {
  // prettier-ignore
  constructor(public readonly code: string, public readonly message: string) {
    super();
  }
}
