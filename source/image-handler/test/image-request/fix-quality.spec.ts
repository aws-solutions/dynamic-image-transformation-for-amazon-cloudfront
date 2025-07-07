// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { ImageRequest } from "../../image-request";
import { ImageFormatTypes, ImageRequestInfo, RequestTypes } from "../../lib";
import { SecretProvider } from "../../secret-provider";

const imageRequestInfo: ImageRequestInfo = {
  bucket: "bucket",
  key: "key",
  requestType: RequestTypes.THUMBOR,
  edits: { png: { quality: 80 } },
  originalImage: Buffer.from("image"),
  outputFormat: ImageFormatTypes.JPEG,
};

describe("fixQuality", () => {
  const s3Client = new S3Client();
  const secretsManager = new SecretsManagerClient();
  const secretProvider = new SecretProvider(secretsManager);

  beforeEach(() => {
    jest.clearAllMocks();
    imageRequestInfo.edits = { png: { quality: 80 } };
  });

  it("Should map correct edits with quality key to edits if output in edits differs from output format in request ", () => {
    // Arrange
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Act
    imageRequest["fixQuality"](imageRequestInfo);

    // Assert
    expect(imageRequestInfo.edits).toEqual(expect.objectContaining({ jpeg: { quality: 80 } }));
    expect(imageRequestInfo.edits.png).toBe(undefined);
  });

  it("should not map edits with quality key if not output format is not a supported type", () => {
    // Arrange
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    imageRequestInfo.outputFormat = "pdf" as ImageFormatTypes;

    // Act
    imageRequest["fixQuality"](imageRequestInfo);

    // Assert
    expect(imageRequestInfo.edits).toEqual(expect.objectContaining({ png: { quality: 80 } }));
  });

  it("should not map edits with quality key if not output format is the same as the quality key", () => {
    // Arrange
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    imageRequestInfo.outputFormat = ImageFormatTypes.PNG;

    // Act
    imageRequest["fixQuality"](imageRequestInfo);

    // Assert
    expect(imageRequestInfo.edits).toEqual(expect.objectContaining({ png: { quality: 80 } }));
  });

  it("should not map edits with quality key if the request is of default type", () => {
    // Arrange
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    imageRequestInfo.outputFormat = ImageFormatTypes.JPEG;
    imageRequestInfo.requestType = RequestTypes.DEFAULT;

    // Act
    imageRequest["fixQuality"](imageRequestInfo);

    // Assert
    expect(imageRequestInfo.edits).toEqual(expect.objectContaining({ png: { quality: 80 } }));
  });

  it("should not map edits with quality key if the request is default type", () => {
    // Arrange
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    imageRequestInfo.outputFormat = ImageFormatTypes.JPEG;
    imageRequestInfo.requestType = RequestTypes.DEFAULT;

    // Act
    imageRequest["fixQuality"](imageRequestInfo);

    // Assert
    expect(imageRequestInfo.edits).toEqual(expect.objectContaining({ png: { quality: 80 } }));
  });

  it("should not map edits with quality key if the request if there is no output format", () => {
    // Arrange
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    delete imageRequestInfo.outputFormat;

    // Act
    imageRequest["fixQuality"](imageRequestInfo);

    // Assert
    expect(imageRequestInfo.edits).toEqual(expect.objectContaining({ png: { quality: 80 } }));
  });
});
