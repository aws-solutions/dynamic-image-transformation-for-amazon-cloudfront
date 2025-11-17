// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ECSClient, UpdateServiceCommand } from "@aws-sdk/client-ecs";
import { DynamoDBStreamEvent } from "aws-lambda";
import { EcsDeploymentUtility } from "../utilities/ecs-deployment";

// Mock ECS client
const mockSend = jest.fn();
const mockEcsClient = {
  send: mockSend,
} as unknown as ECSClient;

describe("EcsDeploymentUtility", () => {
  let ecsUtility: EcsDeploymentUtility;

  beforeEach(() => {
    ecsUtility = new EcsDeploymentUtility(mockEcsClient);
    mockSend.mockClear();
    process.env.ECS_CLUSTER_NAME = "test-cluster";
    process.env.ECS_SERVICE_NAME = "test-service";
  });

  const sampleDdbStreamEvent: DynamoDBStreamEvent = {
    Records: [
      {
        eventID: "c4ca4238a0b923820dcc509a6f75849b",
        eventName: "INSERT",
        eventVersion: "1.1",
        eventSource: "aws:dynamodb",
        awsRegion: "us-east-1",
        dynamodb: {
          Keys: { Id: { N: "101" } },
          NewImage: { Message: { S: "New item!" }, Id: { N: "101" } },
          ApproximateCreationDateTime: 1428537600,
          SequenceNumber: "4421584500000000017450439091",
          SizeBytes: 26,
          StreamViewType: "NEW_AND_OLD_IMAGES",
        },
        eventSourceARN: "arn:aws:dynamodb:us-east-1:123456789012:table/ExampleTableWithStream/stream/2015-06-27T00:48:05.899",
      },
    ],
  };

  test("canHandle returns true for DynamoDB stream events", () => {
    expect(ecsUtility.canHandle(sampleDdbStreamEvent)).toBe(true);
  });

  test("canHandle returns false for non-DynamoDB events", () => {
    const scheduledEvent = { source: "aws.events", time: "2023-01-01T00:00:00Z" };
    expect(ecsUtility.canHandle(scheduledEvent as any)).toBe(false);
  });

  test("execute triggers ECS deployment for INSERT events", async () => {
    await ecsUtility.execute(sampleDdbStreamEvent);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          cluster: "test-cluster",
          service: "test-service",
          forceNewDeployment: true,
        },
      })
    );
  });

  test("execute does not trigger deployment for no changes", async () => {
    const noChangeEvent: DynamoDBStreamEvent = {
      Records: [
        {
          ...sampleDdbStreamEvent.Records[0],
          eventName: "OTHER" as any,
        },
      ],
    };

    await ecsUtility.execute(noChangeEvent);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
