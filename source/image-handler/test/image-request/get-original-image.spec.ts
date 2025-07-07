// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockS3Commands } from "../mock";

import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { ImageRequest } from "../../image-request";
import { ImageHandlerError, StatusCodes } from "../../lib";
import { SecretProvider } from "../../secret-provider";

describe("getOriginalImage", () => {
  const s3Client = new S3Client();
  const secretsManager = new SecretsManagerClient();
  const secretProvider = new SecretProvider(secretsManager);

  const mockImage = Buffer.from("SampleImageContent\n");

  // Mock for SdkStream body
  const mockImageBody = {
    transformToByteArray: async () => new Uint8Array(mockImage),
    transformToString: async (encoding) => mockImage.toString(encoding || "utf-8"),
  };

  beforeEach(() => {
    // reset all mockS3Commands mocks
    Object.values(mockS3Commands).forEach((mock, key) => {
      mock.mockReset();
    });
  });

  it("Should pass if the proper bucket name and key are supplied, simulating an image file that can be retrieved", async () => {
    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = await imageRequest.getOriginalImage("validBucket", "validKey");

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "validBucket",
      Key: "validKey",
    });
    expect(result.originalImage).toEqual(mockImage);
  });

  it("Should throw an error if an invalid file signature is found, simulating an unsupported image type", async () => {
    // Mock
    mockS3Commands.getObject.mockResolvedValueOnce({
      Body: mockImageBody,
      ContentType: "binary/octet-stream",
    });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Assert
    try {
      await imageRequest.getOriginalImage("validBucket", "validKey");
    } catch (error) {
      expect(mockS3Commands.getObject).toHaveBeenCalledWith({
        Bucket: "validBucket",
        Key: "validKey",
      });
      expect(error.status).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  it("Should throw an error if an invalid bucket or key name is provided, simulating a non-existent original image", async () => {
    // Mock
    mockS3Commands.getObject.mockRejectedValue(
      new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "SimulatedException")
    );

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Assert
    try {
      await imageRequest.getOriginalImage("invalidBucket", "invalidKey");
    } catch (error) {
      expect(mockS3Commands.getObject).toHaveBeenCalledWith({
        Bucket: "invalidBucket",
        Key: "invalidKey",
      });
      expect(error.status).toEqual(StatusCodes.NOT_FOUND);
    }
  });

  it("Should throw an error if an unknown problem happens when getting an object", async () => {
    // Mock
    mockS3Commands.getObject.mockRejectedValue(
      new ImageHandlerError(StatusCodes.INTERNAL_SERVER_ERROR, "InternalServerError", "SimulatedException")
    );

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Assert
    try {
      await imageRequest.getOriginalImage("invalidBucket", "invalidKey");
    } catch (error) {
      expect(mockS3Commands.getObject).toHaveBeenCalledWith({
        Bucket: "invalidBucket",
        Key: "invalidKey",
      });
      expect(error.status).toEqual(StatusCodes.NOT_FOUND);
    }
  });

  ["binary/octet-stream", "application/octet-stream"].forEach((contentType) => {
    test.each([
      { hex: [0x89, 0x50, 0x4e, 0x47], expected: "image/png" },
      { hex: [0xff, 0xd8, 0xff, 0xdb], expected: "image/jpeg" },
      { hex: [0xff, 0xd8, 0xff, 0xe0], expected: "image/jpeg" },
      { hex: [0xff, 0xd8, 0xff, 0xee], expected: "image/jpeg" },
      { hex: [0xff, 0xd8, 0xff, 0xe1], expected: "image/jpeg" },
      { hex: [0x52, 0x49, 0x46, 0x46], expected: "image/webp" },
      { hex: [0x49, 0x49, 0x2a, 0x00], expected: "image/tiff" },
      { hex: [0x4d, 0x4d, 0x00, 0x2a], expected: "image/tiff" },
      { hex: [0x47, 0x49, 0x46, 0x38], expected: "image/gif" },
      { hex: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], expected: "image/avif" },
    ])("Should pass and infer $expected content type if there is no extension", async ({ hex, expected }) => {
      // Mock
      mockS3Commands.getObject.mockResolvedValue({
        ContentType: contentType,
        Body: { transformToByteArray: async () => new Uint8Array(hex) },
      });

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      const result = await imageRequest.getOriginalImage("validBucket", "validKey");

      // Assert
      expect(mockS3Commands.getObject).toHaveBeenCalledWith({
        Bucket: "validBucket",
        Key: "validKey",
      });
      expect(result.originalImage).toEqual(Buffer.from(hex));
      expect(result.contentType).toEqual(expected);
    });
  });
});
