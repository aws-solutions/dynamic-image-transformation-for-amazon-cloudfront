// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ECSClient } from "@aws-sdk/client-ecs";
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { SupportedEvent } from "./types";
import { EcsDeploymentUtility } from "./utilities/ecs-deployment";
import { MetricsCollectorUtility } from "./utilities/metrics-collector";
import { getOptions } from "../solution-utils/get-options";

// Initialize clients outside handler for cold start optimization
const awsSdkOptions = getOptions();
const ecsClient = new ECSClient({...awsSdkOptions});
const cloudWatchClient = new CloudWatchClient({...awsSdkOptions});

// Initialize utilities
const utilities = [
  new EcsDeploymentUtility(ecsClient),
  new MetricsCollectorUtility(cloudWatchClient)
];

export const handler = async (event: SupportedEvent): Promise<void> => {
  for (const utility of utilities) {
    if (utility.canHandle(event)) {
      await utility.execute(event);
      return;
    }
  }
  
  console.warn("No utility found to handle event", JSON.stringify(event, null, 2));
};
