// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Logger } from "@aws-lambda-powertools/logger";

export const logger = new Logger({
  logLevel: (process.env.POWERTOOLS_LOGGER_LOG_LEVEL as "DEBUG" | "INFO" | "WARN" | "ERROR") || "INFO",
  serviceName: "management-api",
});
