// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Logger } from "@aws-lambda-powertools/logger";

/**
 * Shared Powertools logger for the metrics collector Lambda.
 *
 * Log level is driven by the POWERTOOLS_LOGGER_LOG_LEVEL environment variable
 * (set on the Lambda in lib/solutions-metrics.ts) and defaults to INFO, so
 * DEBUG output is suppressed unless an operator explicitly enables it.
 */
export const logger = new Logger({
  logLevel: (process.env.POWERTOOLS_LOGGER_LOG_LEVEL as "DEBUG" | "INFO" | "WARN" | "ERROR") || "INFO",
  serviceName: "metrics-utils",
});
