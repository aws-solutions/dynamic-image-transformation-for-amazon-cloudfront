// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ECSClient, UpdateServiceCommand } from "@aws-sdk/client-ecs";
import { DynamoDBStreamEvent } from "aws-lambda";
import { UtilityHandler, SupportedEvent } from "../types";

export class EcsDeploymentUtility implements UtilityHandler {
  constructor(private ecsClient: ECSClient) {}

  canHandle(event: SupportedEvent): boolean {
    return "Records" in event && Array.isArray(event.Records);
  }

  async execute(event: SupportedEvent): Promise<void> {
    const streamEvent = event as DynamoDBStreamEvent;
    
    const hasChanges = streamEvent.Records.some(
      (record) => record.eventName === "INSERT" || record.eventName === "MODIFY" || record.eventName === "REMOVE"
    );

    if (!hasChanges) return;

    // Only path by which config edits reach running tasks. A new forced deployment supersedes one in progress;
    // the 180s maxBatchingWindow in constructs/lib/v8/constructs/common/utility.ts coalesces bursts of edits to
    // limit how often that happens.
    await this.ecsClient.send(
      new UpdateServiceCommand({
        cluster: process.env.ECS_CLUSTER_NAME,
        service: process.env.ECS_SERVICE_NAME,
        forceNewDeployment: true,
      })
    );

    console.log("Rolling deployment triggered");
  }
}
