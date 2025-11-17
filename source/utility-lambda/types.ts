// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBStreamEvent, ScheduledEvent } from "aws-lambda";

export type SupportedEvent = DynamoDBStreamEvent | ScheduledEvent;

export interface UtilityHandler {
  canHandle(event: SupportedEvent): boolean;
  execute(event: SupportedEvent): Promise<void>;
}
