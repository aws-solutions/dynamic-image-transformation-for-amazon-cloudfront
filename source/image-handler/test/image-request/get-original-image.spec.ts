// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockAwsS3 } from "../mock";

import S3 from "aws-sdk/clients/s3";
import SecretsManager from "aws-sdk/clients/secretsmanager";

import { ImageRequest } from "../../image-request";
import { ImageHandlerError, StatusCodes } from "../../lib";
import { SecretProvider } from "../../secret-provider";

describe("getOriginalImage", () => {
  const s3Client = new S3();
  const secretsManager = new SecretsManager();
  const secretProvider = new SecretProvider(secretsManager);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Should pass if the proper bucket name and key are supplied, simulating an image file that can be retrieved", async () => {
    // Mock - using JPEG signature bytes followed by sample content
    const jpegSignature = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const sampleContent = Buffer.from("SampleImageContent\n");
    const imageBuffer = Buffer.concat([jpegSignature, sampleContent]);
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ Body: imageBuffer });
      },
    }));

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = await imageRequest.getOriginalImage("validBucket", "validKey");

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "validBucket",
      Key: "validKey",
    });
    expect(result.originalImage).toEqual(imageBuffer);
    expect(result.contentType).toEqual("image/jpeg");
  });

  it("Should throw an error if an invalid bucket or key name is provided, simulating a non-existent original image", async () => {
    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject(new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "SimulatedException"));
      },
    }));

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Assert
    try {
      await imageRequest.getOriginalImage("invalidBucket", "invalidKey");
    } catch (error) {
      expect(mockAwsS3.getObject).toHaveBeenCalledWith({
        Bucket: "invalidBucket",
        Key: "invalidKey",
      });
      expect(error.status).toEqual(StatusCodes.NOT_FOUND);
    }
  });

  it("Should throw an error if an unknown problem happens when getting an object", async () => {
    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject(
          new ImageHandlerError(StatusCodes.INTERNAL_SERVER_ERROR, "InternalServerError", "SimulatedException")
        );
      },
    }));

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Assert
    try {
      await imageRequest.getOriginalImage("invalidBucket", "invalidKey");
    } catch (error) {
      expect(mockAwsS3.getObject).toHaveBeenCalledWith({
        Bucket: "invalidBucket",
        Key: "invalidKey",
      });
      expect(error.status).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
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
    ])("Should pass and infer $expected content type if there is no extension", async ({ hex, expected }) => {
      // Mock
      mockAwsS3.getObject.mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({
            ContentType: contentType,
            Body: Buffer.from(new Uint8Array(hex)),
          });
        },
      }));

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      const result = await imageRequest.getOriginalImage("validBucket", "validKey");

      // Assert
      expect(mockAwsS3.getObject).toHaveBeenCalledWith({
        Bucket: "validBucket",
        Key: "validKey",
      });
      expect(result.originalImage).toEqual(Buffer.from(new Uint8Array(hex)));
      expect(result.contentType).toEqual(expected);
    });
  });
});
