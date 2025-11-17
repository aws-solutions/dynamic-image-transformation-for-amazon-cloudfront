// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// eslint-disable-next-line import/no-unresolved
import { SQSEvent, Context } from "aws-lambda";
import { MetricsHelper } from "./helpers/metrics-helper";
import {
  EventBridgeQueryEvent,
  ExecutionDay,
  MetricData,
  SQSEventBody,
  isEventBridgeQueryEvent,
  isSQSEvent,
} from "./helpers/types";

/**
 * Metrics collector Lambda handler.
 * @param {EventBridgeQueryEvent | SQSEvent} event The EventBridge or SQS request event.
 * @param {Context}_context The request context
 * @returns {any}  Processed request response.
 */
export async function handler(event: EventBridgeQueryEvent | SQSEvent, _context: Context) {
  const metricsHelper = new MetricsHelper();
  console.log("Event: ", JSON.stringify(event, null, 2));
  const { EXECUTION_DAY } = process.env;
  if (isEventBridgeQueryEvent(event)) {
    console.info("Processing EventBridge event.");

    const endTime = new Date(event.time);
    const metricsData = await metricsHelper.getMetricsData(event);
    console.info("Metrics data: ", JSON.stringify(metricsData, null, 2));
    await metricsHelper.sendAnonymousMetric(
      metricsData,
      new Date(endTime.getTime() - (EXECUTION_DAY === ExecutionDay.DAILY ? 1 : 7) * 86400 * 1000),
      endTime
    );
    await metricsHelper.startQueries(event);
  } else if (isSQSEvent(event)) {
    console.info("Processing SQS event.");
    const body: SQSEventBody = JSON.parse(event.Records[0].body);
    const resolvedQueries = await metricsHelper.resolveQueries(event);
    console.debug(`Resolved Queries: ${JSON.stringify(resolvedQueries)}`);
    const metricsData: MetricData = metricsHelper.processQueryResults(resolvedQueries, body);
    if (Object.keys(metricsData).length > 0) {
      await metricsHelper.sendAnonymousMetric(
        metricsData,
        new Date(body.endTime - (EXECUTION_DAY === ExecutionDay.DAILY ? 1 : 7) * 86400 * 1000),
        new Date(body.endTime)
      );
    }
  } else {
    console.error("Invalid event type.");
    throw new Error("Invalid event type.");
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Successfully processed event." }),
  };
}
