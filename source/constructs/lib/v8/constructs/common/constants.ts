// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration, aws_logs as logs } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";

// Lambda constants
export const DIT_LAMBDA_RUNTIME = Runtime.NODEJS_20_X;
export const DIT_LAMBDA_DEFAULT_MEMORY_SIZE = 512;
export const DIT_LAMBDA_DEFAULT_TIMEOUT = Duration.seconds(30);
export const DIT_CONFIG_TABLE_NAME = "DIT-Config-Table";

// ALB and ECS constants
export const CONTAINER_PORT = 8080; // port at which http server with the express app is running
export const HEALTH_CHECK_PATH = "/health";
export const CPU_TARGET_UTILIZATION_SCALE_OUT = 70;
export const CPU_TARGET_UTILIZATION_SCALE_IN = 30;
export const SCALE_IN_COOLDOWN_MINUTES = 1;
export const LOG_RETENTION_DAYS = logs.RetentionDays.TEN_YEARS;
export const HEALTH_CHECK_INTERVAL_SECONDS = 30;
export const HEALTH_CHECK_TIMEOUT_SECONDS = 5;
export const HEALTH_CHECK_HEALTHY_THRESHOLD_COUNT = 2;
export const HEALTH_CHECK_UNHEALTHY_THRESHOLD_COUNT = 3;
export const HEALTH_CHECK_HEALTHY_HTTP_CODES = "200";
