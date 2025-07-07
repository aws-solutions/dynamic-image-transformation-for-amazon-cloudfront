// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { ImageRequest } from "../../image-request";
import { RequestTypes, StatusCodes } from "../../lib";
import { SecretProvider } from "../../secret-provider";

describe("parseImageBucket", () => {
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

  it("Should pass if the bucket name is provided in the image request and has been allowed in SOURCE_BUCKETS", () => {
    // Arrange
    const event = {
      path: "/eyJidWNrZXQiOiJhbGxvd2VkQnVja2V0MDAxIiwia2V5Ijoic2FtcGxlSW1hZ2VLZXkwMDEuanBnIiwiZWRpdHMiOnsiZ3JheXNjYWxlIjoidHJ1ZSJ9fQ==",
    };
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.parseImageBucket(event, RequestTypes.DEFAULT);

    // Assert
    const expectedResult = "allowedBucket001";
    expect(result).toEqual(expectedResult);
  });

  it("Should throw an error if the bucket name is provided in the image request but has not been allowed in SOURCE_BUCKETS", () => {
    // Arrange
    const event = {
      path: "/eyJidWNrZXQiOiJhbGxvd2VkQnVja2V0MDAxIiwia2V5Ijoic2FtcGxlSW1hZ2VLZXkwMDEuanBnIiwiZWRpdHMiOnsiZ3JheXNjYWxlIjoidHJ1ZSJ9fQ==",
    };
    process.env.SOURCE_BUCKETS = "allowedBucket003, allowedBucket004";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Assert
    try {
      imageRequest.parseImageBucket(event, RequestTypes.DEFAULT);
    } catch (error) {
      expect(error).toMatchObject({
        status: StatusCodes.FORBIDDEN,
        code: "ImageBucket::CannotAccessBucket",
        message:
          "The bucket you specified could not be accessed. Please check that the bucket is specified in your SOURCE_BUCKETS.",
      });
    }
  });

  it("Should pass if the image request does not contain a source bucket but SOURCE_BUCKETS contains at least one bucket that can be used as a default", () => {
    // Arrange
    const event = {
      path: "/eyJrZXkiOiJzYW1wbGVJbWFnZUtleTAwMS5qcGciLCJlZGl0cyI6eyJncmF5c2NhbGUiOiJ0cnVlIn19==",
    };
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.parseImageBucket(event, RequestTypes.DEFAULT);

    // Assert
    const expectedResult = "allowedBucket001";
    expect(result).toEqual(expectedResult);
  });

  it("Should pass if there is at least one SOURCE_BUCKET specified that can be used as the default for Thumbor requests", () => {
    // Arrange
    const event = { path: "/filters:grayscale()/test-image-001.jpg" };
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.parseImageBucket(event, RequestTypes.THUMBOR);

    // Assert
    const expectedResult = "allowedBucket001";
    expect(result).toEqual(expectedResult);
  });

  it("Should pass if there is at least one SOURCE_BUCKET specified that can be used as the default for Custom requests", () => {
    // Arrange
    const event = { path: "/filters:grayscale()/test-image-001.jpg" };

    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.parseImageBucket(event, RequestTypes.CUSTOM);

    // Assert
    const expectedResult = "allowedBucket001";
    expect(result).toEqual(expectedResult);
  });

  it("Should pass if there is at least one SOURCE_BUCKET specified that can be used as the default for Custom requests", () => {
    // Arrange
    const event = { path: "/filters:grayscale()/test-image-001.jpg" };
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Assert
    try {
      imageRequest.parseImageBucket(event, undefined);
    } catch (error) {
      expect(error).toMatchObject({
        status: StatusCodes.NOT_FOUND,
        code: "ImageBucket::CannotFindBucket",
        message:
          "The bucket you specified could not be found. Please check the spelling of the bucket name in your request.",
      });
    }
  });

  it("should parse bucket-name from first part in thumbor request but fail since it's not allowed", () => {
    // Arrange
    const event = { path: "/filters:grayscale()/s3:test-bucket/test-image-001.jpg" };
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    const bucket = imageRequest.parseImageBucket(event, RequestTypes.THUMBOR);
    // Assert
    expect(bucket).toEqual("allowedBucket001");
  });

  it("should parse bucket-name from any section in the url", () => {
    // Arrange
    const event = { path: "/s3:test-bucket/filters:grayscale()/test-image-001.jpg" };
    process.env.SOURCE_BUCKETS = "allowedBucket001, test-bucket";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    const bucket = imageRequest.parseImageBucket(event, RequestTypes.THUMBOR);
    // Assert
    expect(bucket).toEqual("test-bucket");
  });

  it("should only parse bucket-names in source_buckets", () => {
    // Arrange
    const event = { path: "/s3:non-test-bucket/s3:test-bucket/test-image-001.jpg" };
    process.env.SOURCE_BUCKETS = "allowedBucket001, test-bucket";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    const bucket = imageRequest.parseImageBucket(event, RequestTypes.THUMBOR);
    // Assert
    expect(bucket).toEqual("test-bucket");
  });

  it("should parse bucket-name from first part in thumbor request and return it", () => {
    // Arrange
    const event = { path: "/filters:grayscale()/s3:test-bucket/test-image-001.jpg" };
    process.env.SOURCE_BUCKETS = "allowedBucket001, test-bucket";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    const bucket = imageRequest.parseImageBucket(event, RequestTypes.THUMBOR);
    // Assert
    expect(bucket).toEqual("test-bucket");
  });

  it("should take bucket-name from env-variable if not present in the URL", () => {
    // Arrange
    const event = { path: "/filters:grayscale()/test-image-001.jpg" };
    process.env.SOURCE_BUCKETS = "allowedBucket001, test-bucket";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    const bucket = imageRequest.parseImageBucket(event, RequestTypes.THUMBOR);
    // Assert
    expect(bucket).toEqual("allowedBucket001");
  });

  it("should parse bucket-name from first part in thumbor request and return it when using legacy multiple filters", () => {
    // Arrange
    const event = { path: "/filters:grayscale()/filters:rotate(180)/s3:test-bucket/test-image-001.jpg" };
    process.env.SOURCE_BUCKETS = "allowedBucket001, test-bucket";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    const bucket = imageRequest.parseImageBucket(event, RequestTypes.THUMBOR);
    // Assert
    expect(bucket).toEqual("test-bucket");
  });

  it("should parse bucket-name from first part in thumbor request and return it when chaining multiple filters", () => {
    // Arrange
    const event = { path: "/filters:grayscale():rotate(180)/s3:test-bucket/test-image-001.jpg" };
    process.env.SOURCE_BUCKETS = "allowedBucket001, test-bucket";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    const bucket = imageRequest.parseImageBucket(event, RequestTypes.THUMBOR);
    // Assert
    expect(bucket).toEqual("test-bucket");
  });
});
