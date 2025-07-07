// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { ImageRequest } from "../../image-request";
import { ImageHandlerEvent, ImageFormatTypes, ImageRequestInfo, RequestTypes } from "../../lib";
import { SecretProvider } from "../../secret-provider";

const request: Record<string, string | number | object> = {
  bucket: "bucket",
  key: "key",
  edits: {
    roundCrop: true,
    resize: {
      width: 100,
      height: 100,
    },
  },
};

const createEvent = (request): ImageHandlerEvent => ({
  path: `${Buffer.from(JSON.stringify(request)).toString("base64")}`,
});

describe("determineOutputFormat", () => {
  const s3Client = new S3Client();
  const secretsManager = new SecretsManagerClient();
  const secretProvider = new SecretProvider(secretsManager);

  it("Should map edits.toFormat to outputFormat in image request", () => {
    // Arrange
    const imageRequestInfo: ImageRequestInfo = {
      bucket: "bucket",
      key: "key",
      requestType: RequestTypes.DEFAULT,
      edits: { toFormat: ImageFormatTypes.PNG },
      originalImage: Buffer.from("image"),
    };
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Act
    imageRequest["determineOutputFormat"](imageRequestInfo, createEvent(request));

    // Assert
    expect(imageRequestInfo.outputFormat).toEqual(ImageFormatTypes.PNG);
  });

  it("Should map output format from edits to image request", () => {
    // Arrange
    const imageRequestInfo: ImageRequestInfo = {
      bucket: "bucket",
      key: "key",
      requestType: RequestTypes.DEFAULT,
      originalImage: Buffer.from("image"),
    };
    request.outputFormat = ImageFormatTypes.PNG;
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Act
    imageRequest["determineOutputFormat"](imageRequestInfo, createEvent(request));

    // Assert
    expect(imageRequestInfo.outputFormat).toEqual(ImageFormatTypes.PNG);
  });

  it("Should map reduction effort if included and output format is webp", () => {
    // Arrange
    const imageRequestInfo: ImageRequestInfo = {
      bucket: "bucket",
      key: "key",
      requestType: RequestTypes.DEFAULT,
      originalImage: Buffer.from("image"),
    };
    request.outputFormat = ImageFormatTypes.WEBP;
    request.effort = 3;
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Act
    imageRequest["determineOutputFormat"](imageRequestInfo, createEvent(request));

    // Assert
    expect(imageRequestInfo.outputFormat).toEqual(ImageFormatTypes.WEBP);
    expect(imageRequestInfo.effort).toEqual(3);
  });

  it("Should map default reduction effort if included but NaN and output format is webp", () => {
    // Arrange
    const imageRequestInfo: ImageRequestInfo = {
      bucket: "bucket",
      key: "key",
      requestType: RequestTypes.DEFAULT,
      originalImage: Buffer.from("image"),
    };
    request.outputFormat = ImageFormatTypes.WEBP;
    request.effort = "invalid";
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Act
    imageRequest["determineOutputFormat"](imageRequestInfo, createEvent(request));

    // Assert
    expect(imageRequestInfo.outputFormat).toEqual(ImageFormatTypes.WEBP);
    expect(imageRequestInfo.effort).toEqual(4);
  });

  it("Should map default reduction effort if included > 6 and output format is webp", () => {
    // Arrange
    const imageRequestInfo: ImageRequestInfo = {
      bucket: "bucket",
      key: "key",
      requestType: RequestTypes.DEFAULT,
      originalImage: Buffer.from("image"),
    };
    request.outputFormat = ImageFormatTypes.WEBP;
    request.effort = 7;
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Act
    imageRequest["determineOutputFormat"](imageRequestInfo, createEvent(request));

    // Assert
    expect(imageRequestInfo.outputFormat).toEqual(ImageFormatTypes.WEBP);
    expect(imageRequestInfo.effort).toEqual(4);
  });

  it("Should map default reduction effort if included but < 0 and output format is webp", () => {
    // Arrange
    const imageRequestInfo: ImageRequestInfo = {
      bucket: "bucket",
      key: "key",
      requestType: RequestTypes.DEFAULT,
      originalImage: Buffer.from("image"),
    };
    request.outputFormat = ImageFormatTypes.WEBP;
    request.effort = -1;
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Act
    imageRequest["determineOutputFormat"](imageRequestInfo, createEvent(request));

    // Assert
    expect(imageRequestInfo.outputFormat).toEqual(ImageFormatTypes.WEBP);
    expect(imageRequestInfo.effort).toEqual(4);
  });

  it("Should map truncated reduction effort if included but has a decimal and output format is webp", () => {
    // Arrange
    const imageRequestInfo: ImageRequestInfo = {
      bucket: "bucket",
      key: "key",
      requestType: RequestTypes.DEFAULT,
      originalImage: Buffer.from("image"),
    };
    request.outputFormat = ImageFormatTypes.WEBP;
    request.effort = 2.378;
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Act
    imageRequest["determineOutputFormat"](imageRequestInfo, createEvent(request));

    // Assert
    expect(imageRequestInfo.outputFormat).toEqual(ImageFormatTypes.WEBP);
    expect(imageRequestInfo.effort).toEqual(2);
  });
});
