// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import axios, { RawAxiosRequestConfig, AxiosResponse } from "axios";
import { randomUUID } from "crypto";
import moment from "moment";

import {
  CustomResourceActions,
  CustomResourceRequest,
  CustomResourceRequestTypes,
  CompletionStatus,
  LambdaContext,
  MetricPayload,
  SendMetricsRequestProperties,
  StatusTypes,
} from "./lib";

const { SOLUTION_ID, SOLUTION_VERSION } = process.env;
const METRICS_ENDPOINT = "https://metrics.awssolutionsbuilder.com/generic";

export async function handler(event: CustomResourceRequest, context: LambdaContext) {
  console.info(`Received event: ${event.RequestType}::${event.ResourceProperties.CustomAction}`);
  console.info(`Resource properties: ${JSON.stringify(event.ResourceProperties)}`);

  const { RequestType, ResourceProperties } = event;
  const response: CompletionStatus = {
    Status: StatusTypes.SUCCESS,
    Data: {},
  };

  try {
    switch (ResourceProperties.CustomAction) {
      case CustomResourceActions.CREATE_UUID: {
        if (RequestType === CustomResourceRequestTypes.CREATE) {
          response.Data = { UUID: randomUUID() };
        }
        break;
      }
      case CustomResourceActions.SEND_METRIC: {
        const requestProperties = {
          ...ResourceProperties,
          AccountId: event.StackId.split(':')[4],
          StackId: event.StackId,
        } as SendMetricsRequestProperties;
        if (requestProperties.AnonymousData === "Yes") {
          response.Data = await sendAnonymousMetric(requestProperties, RequestType);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`Error occurred at ${event.RequestType}::${ResourceProperties.CustomAction}`, error);

    response.Status = StatusTypes.FAILED;
    response.Data = {
      Error: {
        Code: (error as any)?.code ?? "CustomResourceError",
        Message: (error as any)?.message ?? "Custom resource error occurred.",
      },
    };
  } finally {
    await sendCloudFormationResponse(event, context.logStreamName, response);
  }

  return response;
}

async function sendAnonymousMetric(
  requestProperties: SendMetricsRequestProperties,
  requestType: CustomResourceRequestTypes
): Promise<{ Message: string; Data?: MetricPayload }> {
  const result: { Message: string; Data?: MetricPayload } = {
    Message: "",
  };

  try {
    const payload: MetricPayload = {
      Solution: SOLUTION_ID,
      Version: SOLUTION_VERSION,
      UUID: requestProperties.UUID,
      TimeStamp: moment.utc().format("YYYY-MM-DD HH:mm:ss.S"),
      AccountId: requestProperties.AccountId,
      StackId: requestProperties.StackId,
      Data: {
        Region: requestProperties.Region,
        Type: requestType,
        UseExistingCloudFrontDistribution: requestProperties.UseExistingCloudFrontDistribution,
        DeploymentSize: requestProperties.DeploymentSize,
      },
    };

    result.Data = payload;

    const payloadStr = JSON.stringify(payload);
    const config: RawAxiosRequestConfig = {
      headers: {
        "content-type": "application/json",
        "content-length": payloadStr.length,
      },
    };

    console.info("Sending anonymous metric", payloadStr);
    const response = await axios.post(METRICS_ENDPOINT, payloadStr, config);
    console.info(`Anonymous metric response: ${response.statusText} (${response.status})`);

    result.Message = "Anonymous data was sent successfully.";
  } catch (err) {
    console.error("Error sending anonymous metric", err);
    result.Message = "Anonymous data was sent failed.";
  }

  return result;
}

async function sendCloudFormationResponse(
  event: CustomResourceRequest,
  logStreamName: string,
  response: CompletionStatus
): Promise<AxiosResponse> {
  const responseBody = JSON.stringify({
    Status: response.Status,
    Reason: `See the details in CloudWatch Log Stream: ${logStreamName}`,
    PhysicalResourceId: event.LogicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: response.Data,
  });

  const config: RawAxiosRequestConfig = {
    headers: {
      "Content-Type": "",
      "Content-Length": responseBody.length,
    },
  };

  return axios.put(event.ResponseURL, responseBody, config);
}
