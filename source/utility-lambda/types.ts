// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBStreamEvent } from "aws-lambda";

export type SupportedEvent = DynamoDBStreamEvent;

export interface UtilityHandler {
  canHandle(event: SupportedEvent): boolean;
  execute(event: SupportedEvent): Promise<void>;
}
