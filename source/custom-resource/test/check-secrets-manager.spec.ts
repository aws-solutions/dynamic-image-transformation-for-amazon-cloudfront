// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockSecretsManagerCommands, mockContext } from "./mock";
import {
  CustomResourceActions,
  CustomResourceRequestTypes,
  CheckSecretManagerRequestProperties,
  CustomResourceRequest,
  CustomResourceError,
} from "../lib";
import { handler } from "../index";

describe("CHECK_SECRETS_MANAGER", () => {
  // Mock event data
  const event: CustomResourceRequest = {
    RequestType: CustomResourceRequestTypes.CREATE,
    ResponseURL: "/cfn-response",
    PhysicalResourceId: "mock-physical-id",
    StackId: "mock-stack-id",
    ServiceToken: "mock-service-token",
    RequestId: "mock-request-id",
    LogicalResourceId: "mock-logical-resource-id",
    ResourceType: "mock-resource-type",
    ResourceProperties: {
      CustomAction: CustomResourceActions.CHECK_SECRETS_MANAGER,
      SecretsManagerName: "secrets-manager-name",
      SecretsManagerKey: "secrets-manager-key",
    },
  };
  const secret = {
    SecretString: '{"secrets-manager-key":"secret-ingredient"}',
    ARN: "arn:of:secrets:managers:secret",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should return success when secrets manager secret and secret's key exists", async () => {
    mockSecretsManagerCommands.getSecretValue.mockResolvedValue(secret);
    const result = await handler(event, mockContext);

    expect.assertions(1);

    expect(result).toEqual({
      Status: "SUCCESS",
      Data: {
        Message: "Secrets Manager validated.",
        ARN: secret.ARN,
      },
    });
  });

  it("Should return failed when secretName is not provided", async () => {
    (event.ResourceProperties as CheckSecretManagerRequestProperties).SecretsManagerName = "";

    const result = await handler(event, mockContext);

    expect.assertions(1);

    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "SecretNotProvided",
          Message: "You need to provide AWS Secrets Manager secret.",
        },
      },
    });
  });

  it("Should return failed when secretKey is not provided", async () => {
    const resourceProperties = event.ResourceProperties as CheckSecretManagerRequestProperties;
    resourceProperties.SecretsManagerName = "secrets-manager-name";
    resourceProperties.SecretsManagerKey = "";

    const result = await handler(event, mockContext);

    expect.assertions(1);

    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "SecretKeyNotProvided",
          Message: "You need to provide AWS Secrets Manager secret key.",
        },
      },
    });
  });

  it("Should return failed when secret key does not exist", async () => {
    mockSecretsManagerCommands.getSecretValue.mockResolvedValue(secret);

    const resourceProperties = event.ResourceProperties as CheckSecretManagerRequestProperties;
    resourceProperties.SecretsManagerKey = "none-existing-key";

    const result = await handler(event, mockContext);

    expect.assertions(1);

    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "SecretKeyNotFound",
          Message: `AWS Secrets Manager secret requires ${resourceProperties.SecretsManagerKey} key.`,
        },
      },
    });
  });

  it("Should return failed when GetSecretValue fails", async () => {
    mockSecretsManagerCommands.getSecretValue.mockRejectedValue(
      new CustomResourceError("InternalServerError", "GetSecretValue failed.")
    );

    (event.ResourceProperties as CheckSecretManagerRequestProperties).SecretsManagerName = "secrets-manager-key";

    const result = await handler(event, mockContext);

    expect.assertions(1);

    expect(result).toEqual({
      Status: "FAILED",
      Data: {
        Error: {
          Code: "InternalServerError",
          Message: "GetSecretValue failed.",
        },
      },
    });
  });
});
