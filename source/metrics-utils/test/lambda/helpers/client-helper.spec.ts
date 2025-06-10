// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { SQSClient } from "@aws-sdk/client-sqs";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { ClientHelper } from "../../../lambda/helpers/client-helper";

// Mock AWS SDK clients
jest.mock("@aws-sdk/client-cloudwatch");
jest.mock("@aws-sdk/client-sqs");
jest.mock("@aws-sdk/client-cloudwatch-logs");

describe("ClientHelper", () => {
  let clientHelper: ClientHelper;

  beforeEach(() => {
    clientHelper = new ClientHelper();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should not create any instance until requested", () => {
    clientHelper = new ClientHelper();
    expect(SQSClient).toHaveBeenCalledTimes(0);
    expect(CloudWatchClient).toHaveBeenCalledTimes(0);
    expect(CloudWatchLogsClient).toHaveBeenCalledTimes(0);
  });

  it("should initialize and return an SQSClient instance", () => {
    const sqsClient = clientHelper.getSqsClient();
    expect(sqsClient).toBeInstanceOf(SQSClient);
    expect(SQSClient).toHaveBeenCalledTimes(1);
  });

  it("should return the same SQSClient instance on subsequent calls", () => {
    const sqsClient1 = clientHelper.getSqsClient();
    const sqsClient2 = clientHelper.getSqsClient();
    expect(sqsClient1).toBe(sqsClient2);
    expect(SQSClient).toHaveBeenCalledTimes(1);
  });

  it("should initialize and return a CloudWatchClient instance", () => {
    const cwClient = clientHelper.getCwClient();
    expect(cwClient).toBeInstanceOf(CloudWatchClient);
    expect(CloudWatchClient).toHaveBeenCalledTimes(1);
  });

  it("should return the same CloudWatchClient instance on subsequent calls", () => {
    const cwClient1 = clientHelper.getCwClient();
    const cwClient2 = clientHelper.getCwClient();
    expect(cwClient1).toBe(cwClient2);
    expect(CloudWatchClient).toHaveBeenCalledTimes(1);
  });

  it("should return different CloudWatchClient instances on different provided regions", () => {
    const cwClient1 = clientHelper.getCwClient("us-west-1");
    const cwClient2 = clientHelper.getCwClient("us-east-1");
    expect(cwClient1).not.toBe(cwClient2);
    expect(CloudWatchClient).toHaveBeenCalledTimes(2);
  });

  it("should return identical CloudWatchClient instances when AWS_REGION is set", () => {
    process.env.AWS_REGION = "us-east-1";
    const cwClient1 = clientHelper.getCwClient();
    const cwClient2 = clientHelper.getCwClient("us-east-1");
    expect(cwClient1).toBe(cwClient2);
    expect(CloudWatchClient).toHaveBeenCalledTimes(1);
  });

  it("should return different CloudWatchClient instances when AWS_REGION is set", () => {
    const cwClient1 = clientHelper.getCwClient("us-west-2");
    const cwClient2 = clientHelper.getCwClient("us-east-1");
    expect(cwClient1).not.toBe(cwClient2);
    expect(CloudWatchClient).toHaveBeenCalledTimes(2);
  });

  it("should initialize and return a CloudWatchLogsClient instance", () => {
    const cwLogsClient = clientHelper.getCwLogsClient();
    expect(cwLogsClient).toBeInstanceOf(CloudWatchLogsClient);
    expect(CloudWatchLogsClient).toHaveBeenCalledTimes(1);
  });

  it("should return the same CloudWatchLogsClient instance on subsequent calls", () => {
    const cwLogsClient1 = clientHelper.getCwLogsClient();
    const cwLogsClient2 = clientHelper.getCwLogsClient();
    expect(cwLogsClient1).toBe(cwLogsClient2);
    expect(CloudWatchLogsClient).toHaveBeenCalledTimes(1);
  });
});
