// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockS3Commands } from "../mock";
import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { ImageRequest } from "../../image-request";
import { ImageHandlerEvent, StatusCodes } from "../../lib";
import { SecretProvider } from "../../secret-provider";

describe("decodeRequest", () => {
  const s3Client = new S3Client();
  const secretsManager = new SecretsManagerClient();
  const secretProvider = new SecretProvider(secretsManager);

  it("Should pass if a valid base64-encoded path has been specified", () => {
    // Arrange
    const event = {
      path: "/eyJidWNrZXQiOiJidWNrZXQtbmFtZS1oZXJlIiwia2V5Ijoia2V5LW5hbWUtaGVyZSJ9",
    };

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.decodeRequest(event);

    // Assert
    const expectedResult = {
      bucket: "bucket-name-here",
      key: "key-name-here",
    };
    expect(result).toEqual(expectedResult);
  });

  it("Should throw an error if a valid base64-encoded path has not been specified", () => {
    // Arrange
    const event = { path: "/someNonBase64EncodedContentHere" };

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Assert
    try {
      imageRequest.decodeRequest(event);
    } catch (error) {
      expect(error).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        code: "DecodeRequest::CannotDecodeRequest",
        message:
          "The image request you provided could not be decoded. Please check that your request is base64 encoded properly and refer to the documentation for additional guidance.",
      });
    }
  });

  it("Should throw an error if no path is specified at all", () => {
    // Arrange
    const event = {};

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Assert
    try {
      imageRequest.decodeRequest(event);
    } catch (error) {
      expect(error).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        code: "DecodeRequest::CannotReadPath",
        message:
          "The URL path you provided could not be read. Please ensure that it is properly formed according to the solution documentation.",
      });
    }
  });

  describe("expires", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      jest.clearAllMocks();
      process.env = { ...OLD_ENV };
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    const baseRequest = {
      bucket: "validBucket",
      requestType: "Default",
      key: "validKey",
    };
    const path = `/${Buffer.from(JSON.stringify(baseRequest)).toString("base64")}`;
    const mockImage = Buffer.from("SampleImageContent\n");
    // Mock for SdkStream body
    const mockImageBody = {
      transformToByteArray: async () => new Uint8Array(mockImage),
    };
    it.each([
      {
        expires: "19700101T000000Z",
        error: {
          code: "ImageRequestExpired",
          status: StatusCodes.BAD_REQUEST,
        },
      },
      {
        expires: "19700001T000000Z",
        error: {
          code: "ImageRequestExpiryFormat",
          status: StatusCodes.BAD_REQUEST,
        },
      },
      {
        expires: "19700101S000000Z",
        error: {
          code: "ImageRequestExpiryFormat",
          status: StatusCodes.BAD_REQUEST,
        },
      },
      {
        expires: "19700101T000000",
        error: {
          code: "ImageRequestExpiryFormat",
          status: StatusCodes.BAD_REQUEST,
        },
      },
    ] as { expires: ImageHandlerEvent["queryStringParameters"]["expires"]; error: object }[])(
      "Should throw an error when expires: $expires",
      async ({ error: expectedError, expires }) => {
        // Arrange
        const event: ImageHandlerEvent = {
          path,
          queryStringParameters: {
            expires,
          },
        };
        // Act
        const imageRequest = new ImageRequest(s3Client, secretProvider);
        await expect(imageRequest.setup(event)).rejects.toMatchObject(expectedError);
      }
    );

    it("Should validate request if expires is not provided", async () => {
      // Arrange
      process.env = { SOURCE_BUCKETS: "validBucket, validBucket2" };
      const event: ImageHandlerEvent = {
        path,
      };
      // Mock
      mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);

      const imageRequestInfo = await imageRequest.setup(event);

      // Assert
      expect(mockS3Commands.getObject).toHaveBeenCalledWith({
        Bucket: "validBucket",
        Key: "validKey",
      });

      expect(imageRequestInfo.originalImage).toEqual(mockImage);
    });

    it("Should validate request if expires is valid", async () => {
      // Arrange
      const validDate = new Date();
      validDate.setFullYear(validDate.getFullYear() + 1);
      const validDateString = validDate.toISOString().replace(/-/g, "").replace(/:/g, "").slice(0, 15) + "Z";

      process.env = { SOURCE_BUCKETS: "validBucket, validBucket2" };

      const event: ImageHandlerEvent = {
        path,
        queryStringParameters: {
          expires: validDateString,
        },
      };
      // Mock
      mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      const imageRequestInfo = await imageRequest.setup(event);
      expect(mockS3Commands.getObject).toHaveBeenCalledWith({
        Bucket: "validBucket",
        Key: "validKey",
      });
      expect(imageRequestInfo.originalImage).toEqual(mockImage);
    });
  });
});
