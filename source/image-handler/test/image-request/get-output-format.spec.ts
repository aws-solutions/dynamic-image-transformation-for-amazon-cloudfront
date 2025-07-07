// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { ImageRequest } from "../../image-request";
import { SecretProvider } from "../../secret-provider";

describe("getOutputFormat", () => {
  const s3Client = new S3Client();
  const secretsManager = new SecretsManagerClient();
  const secretProvider = new SecretProvider(secretsManager);
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('Should pass if it returns "webp" for a capitalized accepts header which includes webp', () => {
    // Arrange
    const event = {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
      },
    };
    process.env.AUTO_WEBP = "Yes";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.getOutputFormat(event);

    // Assert
    expect(result).toEqual("webp");
  });

  it('Should pass if it returns "webp" for a lowercase accepts header which includes webp', () => {
    // Arrange
    const event = {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
      },
    };
    process.env.AUTO_WEBP = "Yes";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.getOutputFormat(event);

    // Assert
    expect(result).toEqual("webp");
  });

  it("Should pass if it returns null for an accepts header which does not include webp", () => {
    // Arrange
    const event = {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
      },
    };
    process.env.AUTO_WEBP = "Yes";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.getOutputFormat(event);

    // Assert
    expect(result).toBeNull();
  });

  it("Should pass if it returns null when AUTO_WEBP is disabled with accepts header including webp", () => {
    // Arrange
    const event = {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
      },
    };
    process.env.AUTO_WEBP = "No";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.getOutputFormat(event);

    // Assert
    expect(result).toBeNull();
  });

  it("Should pass if it returns null when AUTO_WEBP is not set with accepts header including webp", () => {
    // Arrange
    const event = {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
      },
    };

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.getOutputFormat(event);

    // Assert
    expect(result).toBeNull();
  });
});
