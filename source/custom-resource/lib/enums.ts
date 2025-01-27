// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export enum CustomResourceActions {
  SEND_ANONYMOUS_METRIC = "sendMetric",
  PUT_CONFIG_FILE = "putConfigFile",
  CREATE_UUID = "createUuid",
  CHECK_SOURCE_BUCKETS = "checkSourceBuckets",
  CHECK_FIRST_BUCKET_REGION = "checkFirstBucketRegion",
  CHECK_SECRETS_MANAGER = "checkSecretsManager",
  CHECK_FALLBACK_IMAGE = "checkFallbackImage",
  CREATE_LOGGING_BUCKET = "createCloudFrontLoggingBucket",
  GET_APP_REG_APPLICATION_NAME = "getAppRegApplicationName",
  VALIDATE_EXISTING_DISTRIBUTION = "validateExistingDistribution",
}

export enum CustomResourceRequestTypes {
  CREATE = "Create",
  UPDATE = "Update",
  DELETE = "Delete",
}

export enum StatusTypes {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export enum ErrorCodes {
  ACCESS_DENIED = "AccessDenied",
  FORBIDDEN = "Forbidden",
}
