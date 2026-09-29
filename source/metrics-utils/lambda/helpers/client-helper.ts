// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { SQSClient } from "@aws-sdk/client-sqs";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { getOptions } from "../../../solution-utils/get-options";

export class ClientHelper {
  private sqsClient: SQSClient;
  private cwClients: { [key: string]: CloudWatchClient };
  private cwLogsClients: { [key: string]: CloudWatchLogsClient };

  constructor() {
    this.cwClients = {};
    this.cwLogsClients = {};
  }

  getSqsClient(): SQSClient {
    if (!this.sqsClient) {
      this.sqsClient = new SQSClient(getOptions());
    }
    return this.sqsClient;
  }

  getCwClient(region: string = "default"): CloudWatchClient {
    if (region === "default") {
      region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "default";
    }
    if (!(region in this.cwClients)) {
      this.cwClients[region] =
        region === "default" ? new CloudWatchClient(getOptions()) : new CloudWatchClient(getOptions({ region }));
    }
    return this.cwClients[region];
  }

  getCwLogsClient(region?: string): CloudWatchLogsClient {
    const key = region ?? "default";
    if (!(key in this.cwLogsClients)) {
      this.cwLogsClients[key] = region
        ? new CloudWatchLogsClient(getOptions({ region }))
        : new CloudWatchLogsClient(getOptions());
    }
    return this.cwLogsClients[key];
  }
}
