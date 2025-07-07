// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockS3Commands, mockSecretsManagerCommands } from "../mock";

import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { ImageRequest } from "../../image-request";
import { ImageHandlerError, ImageHandlerEvent, RequestTypes, StatusCodes } from "../../lib";
import { SecretProvider } from "../../secret-provider";

describe("setup", () => {
  const OLD_ENV = process.env;
  const s3Client = new S3Client();
  const secretsManager = new SecretsManagerClient();
  let secretProvider = new SecretProvider(secretsManager);

  const mockImage = Buffer.from("SampleImageContent\n");

  // Mock for SdkStream body
  const mockImageBody = {
    transformToByteArray: async () => new Uint8Array(mockImage),
    transformToString: async (encoding) => mockImage.toString(encoding || "utf-8"),
  };

  beforeEach(() => {
    // reset all mockS3Commands mocks
    Object.values(mockS3Commands).forEach((mock) => {
      mock.mockReset();
    });
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    jest.clearAllMocks();
    secretProvider = new SecretProvider(secretsManager); // need to re-create the provider to make sure the secret is not cached
    process.env = OLD_ENV;
  });

  it("Should pass when a default image request is provided and populate the ImageRequest object with the proper values", async () => {
    // Arrange
    const event = {
      path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiZWRpdHMiOnsiZ3JheXNjYWxlIjp0cnVlfSwib3V0cHV0Rm9ybWF0IjoianBlZyJ9",
    };
    process.env.SOURCE_BUCKETS = "validBucket, validBucket2";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Default",
      bucket: "validBucket",
      key: "validKey",
      edits: { grayscale: true },
      outputFormat: "jpeg",
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      contentType: "image/jpeg",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "validBucket",
      Key: "validKey",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass when a default image request is provided and populate the ImageRequest object with the proper values with UTF-8 key", async () => {
    // Arrange
    const event = {
      path: "eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6IuS4reaWhyIsImVkaXRzIjp7ImdyYXlzY2FsZSI6dHJ1ZX0sIm91dHB1dEZvcm1hdCI6ImpwZWcifQ==",
    };
    process.env = { SOURCE_BUCKETS: "validBucket, validBucket2" };

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Default",
      bucket: "validBucket",
      key: "中文",
      edits: { grayscale: true },
      outputFormat: "jpeg",
      originalImage: mockImage,
      contentType: "image/jpeg",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "validBucket",
      Key: "中文",
    });
    expect(imageRequestInfo).toMatchObject(expectedResult);
  });

  it("Should pass when a default image request is provided and populate the ImageRequest object with the proper values", async () => {
    // Arrange
    const event = {
      path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiZWRpdHMiOnsidG9Gb3JtYXQiOiJwbmcifX0=",
    };
    process.env.SOURCE_BUCKETS = "validBucket, validBucket2";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Default",
      bucket: "validBucket",
      key: "validKey",
      edits: { toFormat: "png" },
      outputFormat: "png",
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      contentType: "image/png",
    };
    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "validBucket",
      Key: "validKey",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass when a thumbor image request is provided and populate the ImageRequest object with the proper values", async () => {
    // Arrange
    const event = { path: "/filters:grayscale()/test-image-001.jpg" };
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Thumbor",
      bucket: "allowedBucket001",
      key: "test-image-001.jpg",
      edits: { grayscale: true },
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      contentType: "image",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "allowedBucket001",
      Key: "test-image-001.jpg",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass when a thumbor image request is provided and populate the ImageRequest object with the proper values", async () => {
    // Arrange
    const event = {
      path: "/filters:format(png)/filters:quality(50)/test-image-001.jpg",
    };
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Thumbor",
      bucket: "allowedBucket001",
      key: "test-image-001.jpg",
      edits: {
        toFormat: "png",
        png: { quality: 50 },
      },
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      outputFormat: "png",
      contentType: "image/png",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "allowedBucket001",
      Key: "test-image-001.jpg",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass when a custom image request is provided and populate the ImageRequest object with the proper values", async () => {
    // Arrange
    const event = {
      path: "/filters-rotate(90)/filters-grayscale()/custom-image.jpg",
    };
    process.env = {
      SOURCE_BUCKETS: "allowedBucket001, allowedBucket002",
      REWRITE_MATCH_PATTERN: "/(filters-)/gm",
      REWRITE_SUBSTITUTION: "filters:",
    };

    // Mock
    mockS3Commands.getObject.mockResolvedValue({
      CacheControl: "max-age=300,public",
      ContentType: "image/jpeg",
      Expires: "Tue, 24 Dec 2019 13:46:28 GMT",
      LastModified: "Sat, 19 Dec 2009 16:30:47 GMT",
      Body: mockImageBody,
    });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: RequestTypes.CUSTOM,
      bucket: "allowedBucket001",
      key: "custom-image.jpg",
      edits: {
        grayscale: true,
        rotate: 90,
      },
      originalImage: mockImage,
      cacheControl: "max-age=300,public",
      contentType: "image/jpeg",
      expires: "Tue, 24 Dec 2019 13:46:28 GMT",
      lastModified: "Sat, 19 Dec 2009 16:30:47 GMT",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "allowedBucket001",
      Key: "custom-image.jpg",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass when a custom image request is provided and populate the ImageRequest object with the proper values and no file extension", async () => {
    // Arrange
    const event = {
      path: "/filters-rotate(90)/filters-grayscale()/custom-image",
    };
    process.env = {
      SOURCE_BUCKETS: "allowedBucket001, allowedBucket002",
      REWRITE_MATCH_PATTERN: "/(filters-)/gm",
      REWRITE_SUBSTITUTION: "filters:",
    };

    // Mock
    mockS3Commands.getObject.mockResolvedValue({
      CacheControl: "max-age=300,public",
      ContentType: "image/jpeg",
      Expires: "Tue, 24 Dec 2019 13:46:28 GMT",
      LastModified: "Sat, 19 Dec 2009 16:30:47 GMT",
      Body: mockImageBody,
    });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: RequestTypes.CUSTOM,
      bucket: "allowedBucket001",
      key: "custom-image",
      edits: {
        grayscale: true,
        rotate: 90,
      },
      originalImage: mockImage,
      cacheControl: "max-age=300,public",
      contentType: "image/jpeg",
      expires: "Tue, 24 Dec 2019 13:46:28 GMT",
      lastModified: "Sat, 19 Dec 2009 16:30:47 GMT",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "allowedBucket001",
      Key: "custom-image",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass when an error is caught", async () => {
    // Arrange
    const event = {
      path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiZWRpdHMiOnsiZ3JheXNjYWxlIjp0cnVlfX0=",
    };
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);

    // Assert
    try {
      await imageRequest.setup(event);
    } catch (error) {
      expect(error.code).toEqual("ImageBucket::CannotAccessBucket");
    }
  });

  describe("enableSignature", () => {
    beforeAll(() => {
      process.env.ENABLE_SIGNATURE = "Yes";
      process.env.SECRETS_MANAGER = "dynamic-image-transformation-for-amazon-cloudfront";
      process.env.SECRET_KEY = "signatureKey";
      process.env.SOURCE_BUCKETS = "validBucket";
    });

    it("Should pass when the image signature is correct", async () => {
      // Arrange
      const event = {
        path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiZWRpdHMiOnsidG9Gb3JtYXQiOiJwbmcifX0=",
        queryStringParameters: {
          signature: "4d41311006641a56de7bca8abdbda91af254506107a2c7b338a13ca2fa95eac3",
        },
      };

      // Mock
      mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });
      mockSecretsManagerCommands.getSecretValue.mockResolvedValue({
        SecretString: JSON.stringify({
          [process.env.SECRET_KEY]: "secret",
        }),
      });

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      const imageRequestInfo = await imageRequest.setup(event);
      const expectedResult = {
        requestType: "Default",
        bucket: "validBucket",
        key: "validKey",
        edits: { toFormat: "png" },
        outputFormat: "png",
        originalImage: mockImage,
        cacheControl: "max-age=31536000,public",
        contentType: "image/png",
      };

      // Assert
      expect(mockS3Commands.getObject).toHaveBeenCalledWith({
        Bucket: "validBucket",
        Key: "validKey",
      });
      expect(mockSecretsManagerCommands.getSecretValue).toHaveBeenCalledWith({
        SecretId: process.env.SECRETS_MANAGER,
      });
      expect(imageRequestInfo).toEqual(expectedResult);
    });

    it("Should throw an error when queryStringParameters are missing", async () => {
      // Arrange
      const event = {
        path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiZWRpdHMiOnsidG9Gb3JtYXQiOiJwbmcifX0=",
      };

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      try {
        await imageRequest.setup(event);
      } catch (error) {
        // Assert
        expect(error).toMatchObject({
          status: StatusCodes.BAD_REQUEST,
          code: "AuthorizationQueryParametersError",
          message: "Query-string requires the signature parameter.",
        });
      }
    });

    it("Should throw an error when the image signature query parameter is missing", async () => {
      // Arrange
      const event = {
        path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiZWRpdHMiOnsidG9Gb3JtYXQiOiJwbmcifX0=",
        queryStringParameters: null,
      };

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      try {
        await imageRequest.setup(event);
      } catch (error) {
        // Assert
        expect(error).toMatchObject({
          status: StatusCodes.BAD_REQUEST,
          message: "Query-string requires the signature parameter.",
          code: "AuthorizationQueryParametersError",
        });
      }
    });

    it("Should throw an error when signature does not match", async () => {
      // Arrange
      const event = {
        path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiZWRpdHMiOnsidG9Gb3JtYXQiOiJwbmcifX0=",
        queryStringParameters: {
          signature: "invalid",
        },
      };

      // Mock
      mockSecretsManagerCommands.getSecretValue.mockResolvedValue({
        SecretString: JSON.stringify({
          [process.env.SECRET_KEY]: "secret",
        }),
      });

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      try {
        await imageRequest.setup(event);
      } catch (error) {
        // Assert
        expect(mockSecretsManagerCommands.getSecretValue).toHaveBeenCalledWith({
          SecretId: process.env.SECRETS_MANAGER,
        });
        expect(error).toMatchObject({
          status: 403,
          message: "Signature does not match.",
          code: "SignatureDoesNotMatch",
        });
      }
    });

    it("Should throw an error when any other error occurs", async () => {
      // Arrange
      const event = {
        path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiZWRpdHMiOnsidG9Gb3JtYXQiOiJwbmcifX0=",
        queryStringParameters: {
          signature: "4d41311006641a56de7bca8abdbda91af254506107a2c7b338a13ca2fa95eac3",
        },
      };

      // Mock
      mockSecretsManagerCommands.getSecretValue.mockImplementationOnce(() => ({
        promise() {
          return Promise.reject(
            new ImageHandlerError(
              StatusCodes.INTERNAL_SERVER_ERROR,
              "SmartCrop::Error",
              "Smart Crop could not be applied. Please contact the system administrator."
            )
          );
        },
      }));

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      try {
        await imageRequest.setup(event);
      } catch (error) {
        // Assert
        expect(mockSecretsManagerCommands.getSecretValue).toHaveBeenCalledWith({
          SecretId: process.env.SECRETS_MANAGER,
        });
        expect(error).toMatchObject({
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          message: "Signature validation failed.",
          code: "SignatureValidationFailure",
        });
      }
    });
  });

  describe("SVGSupport", () => {
    beforeAll(() => {
      process.env.ENABLE_SIGNATURE = "No";
      process.env.SOURCE_BUCKETS = "validBucket";
    });

    it("Should return SVG image when no edit is provided for the SVG image", async () => {
      // Arrange
      const event = {
        path: "/image.svg",
      };

      // Mock
      mockS3Commands.getObject.mockResolvedValue({
        ContentType: "image/svg+xml",
        Body: mockImageBody,
      });

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      const imageRequestInfo = await imageRequest.setup(event);
      const expectedResult = {
        requestType: "Thumbor",
        bucket: "validBucket",
        key: "image.svg",
        edits: {},
        originalImage: mockImage,
        cacheControl: "max-age=31536000,public",
        contentType: "image/svg+xml",
      };

      // Assert
      expect(mockS3Commands.getObject).toHaveBeenCalledWith({
        Bucket: "validBucket",
        Key: "image.svg",
      });
      expect(imageRequestInfo).toEqual(expectedResult);
    });

    it("Should return WebP image when there are any edits and no output is specified for the SVG image", async () => {
      // Arrange
      const event = {
        path: "/100x100/image.svg",
      };

      // Mock
      mockS3Commands.getObject.mockResolvedValue({
        ContentType: "image/svg+xml",
        Body: mockImageBody,
      });

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      const imageRequestInfo = await imageRequest.setup(event);
      const expectedResult = {
        requestType: "Thumbor",
        bucket: "validBucket",
        key: "image.svg",
        edits: { resize: { width: 100, height: 100 } },
        outputFormat: "png",
        originalImage: mockImage,
        cacheControl: "max-age=31536000,public",
        contentType: "image/png",
      };

      // Assert
      expect(mockS3Commands.getObject).toHaveBeenCalledWith({
        Bucket: "validBucket",
        Key: "image.svg",
      });
      expect(imageRequestInfo).toEqual(expectedResult);
    });

    it("Should return JPG image when output is specified to JPG for the SVG image", async () => {
      // Arrange
      const event = {
        path: "/filters:format(jpg)/image.svg",
      };

      // Mock
      mockS3Commands.getObject.mockResolvedValue({
        ContentType: "image/svg+xml",
        Body: mockImageBody,
      });

      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      const imageRequestInfo = await imageRequest.setup(event);
      const expectedResult = {
        requestType: "Thumbor",
        bucket: "validBucket",
        key: "image.svg",
        edits: { toFormat: "jpeg" },
        outputFormat: "jpeg",
        originalImage: mockImage,
        cacheControl: "max-age=31536000,public",
        contentType: "image/jpeg",
      };

      // Assert
      expect(mockS3Commands.getObject).toHaveBeenCalledWith({
        Bucket: "validBucket",
        Key: "image.svg",
      });
      expect(imageRequestInfo).toEqual(expectedResult);
    });
  });

  it("Should pass and return the customer headers if custom headers are provided", async () => {
    // Arrange
    const event = {
      path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiaGVhZGVycyI6eyJDYWNoZS1Db250cm9sIjoibWF4LWFnZT0zMTUzNjAwMCxwdWJsaWMifSwib3V0cHV0Rm9ybWF0IjoianBlZyJ9",
    };
    process.env.SOURCE_BUCKETS = "validBucket, validBucket2";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Default",
      bucket: "validBucket",
      key: "validKey",
      headers: { "Cache-Control": "max-age=31536000,public" },
      outputFormat: "jpeg",
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      contentType: "image/jpeg",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "validBucket",
      Key: "validKey",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass when valid reduction effort is provided and output is webp", async () => {
    const event = {
      path: "/eyJidWNrZXQiOiJ0ZXN0Iiwia2V5IjoidGVzdC5wbmciLCJvdXRwdXRGb3JtYXQiOiJ3ZWJwIiwicmVkdWN0aW9uRWZmb3J0IjozfQ==",
    };
    process.env.SOURCE_BUCKETS = "test, validBucket, validBucket2";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Default",
      bucket: "test",
      key: "test.png",
      edits: undefined,
      headers: undefined,
      outputFormat: "webp",
      originalImage: Buffer.from("SampleImageContent\n"),
      cacheControl: "max-age=31536000,public",
      contentType: "image/webp",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "test",
      Key: "test.png",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass and use default reduction effort if it is invalid type and output is webp", async () => {
    const event = {
      path: "/eyJidWNrZXQiOiJ0ZXN0Iiwia2V5IjoidGVzdC5wbmciLCJvdXRwdXRGb3JtYXQiOiJ3ZWJwIiwicmVkdWN0aW9uRWZmb3J0IjoidGVzdCJ9",
    };
    process.env.SOURCE_BUCKETS = "test, validBucket, validBucket2";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Default",
      bucket: "test",
      key: "test.png",
      edits: undefined,
      headers: undefined,
      outputFormat: "webp",
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      contentType: "image/webp",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "test",
      Key: "test.png",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass and use default reduction effort if it is out of range and output is webp", async () => {
    const event = {
      path: "/eyJidWNrZXQiOiJ0ZXN0Iiwia2V5IjoidGVzdC5wbmciLCJvdXRwdXRGb3JtYXQiOiJ3ZWJwIiwicmVkdWN0aW9uRWZmb3J0IjoxMH0=",
    };
    process.env.SOURCE_BUCKETS = "test, validBucket, validBucket2";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Default",
      bucket: "test",
      key: "test.png",
      edits: undefined,
      headers: undefined,
      outputFormat: "webp",
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      contentType: "image/webp",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "test",
      Key: "test.png",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass and not use reductionEffort if it is not provided and output is webp", async () => {
    const event = {
      path: "/eyJidWNrZXQiOiJ0ZXN0Iiwia2V5IjoidGVzdC5wbmciLCJvdXRwdXRGb3JtYXQiOiJ3ZWJwIn0=",
    };
    process.env.SOURCE_BUCKETS = "test, validBucket, validBucket2";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Default",
      bucket: "test",
      key: "test.png",
      edits: undefined,
      headers: undefined,
      outputFormat: "webp",
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      contentType: "image/webp",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "test",
      Key: "test.png",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass and use query param edit on default requests", async () => {
    const event: ImageHandlerEvent = {
      path: "/eyJidWNrZXQiOiJ0ZXN0Iiwia2V5IjoidGVzdC5wbmciLCJvdXRwdXRGb3JtYXQiOiJ3ZWJwIn0=",
      queryStringParameters: {
        format: "png",
      },
    };
    process.env.SOURCE_BUCKETS = "test, validBucket, validBucket2";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Default",
      bucket: "test",
      key: "test.png",
      edits: { toFormat: "png" },
      headers: undefined,
      outputFormat: "png",
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      contentType: "image/png",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "test",
      Key: "test.png",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass when a default image request is provided and populate the ImageRequest object with the proper values and a utf-8 key", async () => {
    // Arrange
    const event = {
      path: "eyJidWNrZXQiOiJ0ZXN0Iiwia2V5Ijoi5Lit5paHIiwiZWRpdHMiOnsiZ3JheXNjYWxlIjp0cnVlfSwib3V0cHV0Rm9ybWF0IjoianBlZyJ9",
    };
    process.env = {
      SOURCE_BUCKETS: "test, test2",
    };
    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Default",
      bucket: "test",
      key: "中文",
      edits: { grayscale: true },
      headers: undefined,
      outputFormat: "jpeg",
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      contentType: "image/jpeg",
    };
    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({ Bucket: "test", Key: "中文" });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass when a query-param image request is provided and populate the ImageRequest object with the proper values", async () => {
    // Arrange
    const event: ImageHandlerEvent = {
      path: "/test-image-001.jpg",
      queryStringParameters: {
        format: "png",
      },
    };
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Thumbor",
      bucket: "allowedBucket001",
      key: "test-image-001.jpg",
      edits: {
        toFormat: "png",
      },
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      outputFormat: "png",
      contentType: "image/png",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "allowedBucket001",
      Key: "test-image-001.jpg",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });

  it("Should pass when a query-param/thumbor request is provided and have query overwrite existing values", async () => {
    // Arrange
    const event: ImageHandlerEvent = {
      path: "/filters:format(jpg)/test-image-001.jpg",
      queryStringParameters: {
        format: "png",
      },
    };
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody });

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const imageRequestInfo = await imageRequest.setup(event);
    const expectedResult = {
      requestType: "Thumbor",
      bucket: "allowedBucket001",
      key: "test-image-001.jpg",
      edits: {
        toFormat: "png",
      },
      originalImage: mockImage,
      cacheControl: "max-age=31536000,public",
      outputFormat: "png",
      contentType: "image/png",
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "allowedBucket001",
      Key: "test-image-001.jpg",
    });
    expect(imageRequestInfo).toEqual(expectedResult);
  });
});
