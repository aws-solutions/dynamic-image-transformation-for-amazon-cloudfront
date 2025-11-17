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

    await this.ecsClient.send(
      new UpdateServiceCommand({
        cluster: process.env.ECS_CLUSTER_NAME,
        service: process.env.ECS_SERVICE_NAME,
        forceNewDeployment: true,
      })
    ); // fails silently if deployment is in progress

    console.log("Rolling deployment triggered");
  }
}
