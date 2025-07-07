// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from "fs";
import { mockS3Commands, mockContext } from "./mock";

import { handler } from "../index";
import { ImageHandlerError, ImageHandlerEvent, S3GetObjectEvent, StatusCodes } from "../lib";
// eslint-disable-next-line import/no-unresolved
import { Context } from "aws-lambda";

describe("index", () => {
  // Arrange
  process.env.SOURCE_BUCKETS = "source-bucket";
  const OLD_ENV = process.env;

  // Mock for SdkStream body
  const mockImage = Buffer.from("SampleImageContent\n");
  const mockImageBody = {
    transformToByteArray: async () => new Uint8Array(mockImage),
    transformToString: async (encoding) => mockImage.toString(encoding || "utf-8"),
  };
  const mockFallbackImageBuffer = Buffer.from("SampleFallbackImageContent\n");
  const mockFallbackImage = {
    transformToByteArray: async () => new Uint8Array(mockFallbackImageBuffer),
    transformToString: async (encoding) => mockFallbackImageBuffer.toString(encoding || "utf-8"),
  };

  const commonMetadata = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET",
    "Content-Type": "image/jpeg",
    StatusCode: "200",
  };

  beforeEach(() => {
    // reset all mockS3Commands mocks
    Object.values(mockS3Commands).forEach((mock) => {
      mock.mockReset();
    });
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("should return the image when there is no error using RestAPI handler", async () => {
    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody, ContentType: "image/jpeg" });

    // Arrange
    const event: ImageHandlerEvent = { path: "/test.jpg" };

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.OK,
      isBase64Encoded: true,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "image/jpeg",
        Expires: undefined,
        "Cache-Control": "max-age=31536000,public",
        "Last-Modified": undefined,
      },
      body: mockImage.toString("base64"),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return the image when there is no error using S3 Object Lambda handler", async () => {
    process.env.ENABLE_S3_OBJECT_LAMBDA = "Yes";
    // Mock
    mockS3Commands.getObject.mockResolvedValueOnce({ Body: mockImageBody, ContentType: "image/jpeg" });
    mockS3Commands.writeGetObjectResponse.mockResolvedValueOnce({ status: 200, Body: undefined });
    mockContext.getRemainingTimeInMillis.mockImplementationOnce(() => 60000);
    // Arrange
    const event: S3GetObjectEvent = {
      getObjectContext: {
        outputRoute: "testOutputRoute",
        outputToken: "testOutputToken",
      },
      userRequest: {
        url: "example.com/image/test.jpg",
        headers: { Host: "example.com" },
      },
    };

    // Act
    const result = await handler(event, mockContext as unknown as Context);

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(undefined);
    expect(mockS3Commands.writeGetObjectResponse).toHaveBeenCalledWith({
      Body: mockImage,
      RequestRoute: event.getObjectContext.outputRoute,
      RequestToken: event.getObjectContext.outputToken,
      CacheControl: "max-age=31536000,public",
      Metadata: {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET",
        "Content-Type": "image/jpeg",
        StatusCode: "200",
      },
    });
  });

  it("should return timeout error when s3 object lambda duration is exceeded", async () => {
    process.env.ENABLE_S3_OBJECT_LAMBDA = "Yes";
    // Mock
    mockS3Commands.getObject.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ Body: mockImageBody, ContentType: "image/jpeg" });
        }, 100);
      });
    });
    mockS3Commands.writeGetObjectResponse.mockResolvedValue({ status: 200, Body: undefined });
    mockContext.getRemainingTimeInMillis.mockImplementationOnce(() => 1000);
    // Arrange
    const event: S3GetObjectEvent = {
      getObjectContext: {
        outputRoute: "testOutputRoute",
        outputToken: "testOutputToken",
      },
      userRequest: {
        url: "example.com/image/test.jpg",
        headers: { Host: "example.com" },
      },
    };

    // Act
    const result = await handler(event, mockContext as unknown as Context);

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(undefined);
    expect(mockS3Commands.writeGetObjectResponse).toHaveBeenCalledWith({
      Body: '{"status":503,"code":"TimeoutException","message":"Image processing timed out."}',
      RequestRoute: event.getObjectContext.outputRoute,
      RequestToken: event.getObjectContext.outputToken,
      CacheControl: "max-age=600,public",
      Metadata: {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET",
        "Content-Type": "application/json",
        StatusCode: "503",
      },
    });
  });

  it("should return the image with custom headers when custom headers are provided", async () => {
    // Mock
    mockS3Commands.getObject.mockResolvedValue({ Body: mockImageBody, ContentType: "image/jpeg" });

    // Arrange
    const event: ImageHandlerEvent = {
      path: "/eyJidWNrZXQiOiJzb3VyY2UtYnVja2V0Iiwia2V5IjoidGVzdC5qcGciLCJoZWFkZXJzIjp7IkN1c3RvbS1IZWFkZXIiOiJDdXN0b21WYWx1ZSJ9fQ==",
    };

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.OK,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "image/jpeg",
        Expires: undefined,
        "Cache-Control": "max-age=31536000,public",
        "Last-Modified": undefined,
        "Custom-Header": "CustomValue",
      },
      body: mockImage.toString("base64"),
      isBase64Encoded: true,
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return the image when the request is from ALB", async () => {
    // Mock
    mockS3Commands.getObject.mockResolvedValueOnce({ Body: mockImageBody, ContentType: "image/jpeg" });

    // Arrange
    const event: ImageHandlerEvent = {
      path: "/test.jpg",
      requestContext: {
        elb: {},
      },
    };

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.OK,
      isBase64Encoded: true,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "image/jpeg",
        Expires: undefined,
        "Cache-Control": "max-age=31536000,public",
        "Last-Modified": undefined,
      },
      body: mockImage.toString("base64"),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return an error JSON when an error occurs", async () => {
    // Arrange
    const event: ImageHandlerEvent = { path: "/test.jpg" };
    // Mock
    mockS3Commands.getObject.mockRejectedValueOnce(
      new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened.")
    );

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      isBase64Encoded: false,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.NOT_FOUND,
        code: "NoSuchKey",
        message: `The image test.jpg does not exist or the request may not be base64 encoded properly.`,
      }),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return 400 error when sharp is passed invalid image format", async () => {
    // Arrange
    const event: ImageHandlerEvent = {
      path: "eyJidWNrZXQiOiJzb3VyY2UtYnVja2V0Iiwia2V5IjoidGVzdC5qcGciLCJlZGl0cyI6eyJ3cm9uZ0ZpbHRlciI6dHJ1ZX19",
    };

    // Mock
    mockS3Commands.getObject.mockResolvedValueOnce({ Body: mockImageBody, ContentType: "image/jpeg" });

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.BAD_REQUEST,
      isBase64Encoded: false,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.BAD_REQUEST,
        code: "InstantiationError",
        message: "Input image could not be instantiated. Please choose a valid image.",
      }),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return the default fallback image when an error occurs if the default fallback image is enabled", async () => {
    // Arrange
    process.env.ENABLE_DEFAULT_FALLBACK_IMAGE = "Yes";
    process.env.DEFAULT_FALLBACK_IMAGE_BUCKET = "fallback-image-bucket";
    process.env.DEFAULT_FALLBACK_IMAGE_KEY = "fallback-image.png";
    process.env.CORS_ENABLED = "Yes";
    process.env.CORS_ORIGIN = "*";
    const event: ImageHandlerEvent = { path: "/test.jpg" };

    // Mock
    mockS3Commands.getObject
      .mockRejectedValueOnce(new ImageHandlerError(StatusCodes.INTERNAL_SERVER_ERROR, "UnknownError", null))
      .mockResolvedValueOnce({
        Body: mockFallbackImage,
        ContentType: "image/png",
      });

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      isBase64Encoded: true,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "image/png",
        "Cache-Control": "max-age=31536000,public",
      },
      body: mockFallbackImageBuffer.toString("base64"),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenNthCalledWith(1, {
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(mockS3Commands.getObject).toHaveBeenNthCalledWith(2, {
      Bucket: "fallback-image-bucket",
      Key: "fallback-image.png",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return the cache-control header supplied on fallback image when an error occurs if the default fallback image is enabled", async () => {
    // Arrange
    process.env.ENABLE_DEFAULT_FALLBACK_IMAGE = "Yes";
    process.env.DEFAULT_FALLBACK_IMAGE_BUCKET = "fallback-image-bucket";
    process.env.DEFAULT_FALLBACK_IMAGE_KEY = "fallback-image.png";
    process.env.CORS_ENABLED = "Yes";
    process.env.CORS_ORIGIN = "*";

    // {key: "test.jpg", headers: {Cache-Control: "max-age=11,public"}}
    const event: ImageHandlerEvent = {
      path: "ewoia2V5IjogInRlc3QuanBnIiwKImhlYWRlcnMiOiB7CiJDYWNoZS1Db250cm9sIjoibWF4LWFnZT0xMSxwdWJsaWMiCn0KfQ==",
    };

    // Mock
    mockS3Commands.getObject
      .mockRejectedValueOnce(new ImageHandlerError(StatusCodes.INTERNAL_SERVER_ERROR, "UnknownError", null))
      .mockResolvedValueOnce({
        Body: mockFallbackImage,
        ContentType: "image/png",
        CacheControl: "max-age=12,public",
      });

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      isBase64Encoded: true,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "image/png",
        "Cache-Control": "max-age=12,public",
        "Last-Modified": undefined,
      },
      body: mockFallbackImageBuffer.toString("base64"),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenNthCalledWith(1, {
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(mockS3Commands.getObject).toHaveBeenNthCalledWith(2, {
      Bucket: "fallback-image-bucket",
      Key: "fallback-image.png",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return the cache-control header attached to image when an error occurs if the default fallback image is enabled and the request does not contain the header", async () => {
    // Arrange
    process.env.ENABLE_DEFAULT_FALLBACK_IMAGE = "Yes";
    process.env.DEFAULT_FALLBACK_IMAGE_BUCKET = "fallback-image-bucket";
    process.env.DEFAULT_FALLBACK_IMAGE_KEY = "fallback-image.png";
    process.env.CORS_ENABLED = "Yes";
    process.env.CORS_ORIGIN = "*";

    const event: ImageHandlerEvent = {
      path: "ewoia2V5IjogInRlc3QuanBnIiwKImhlYWRlcnMiOiB7CiJDYWNoZS1Db250cm9sIjoibWF4LWFnZT0xMSxwdWJsaWMiCn0KfQ==",
    };

    // Mock
    mockS3Commands.getObject
      .mockRejectedValueOnce(new ImageHandlerError(StatusCodes.INTERNAL_SERVER_ERROR, "UnknownError", null))
      .mockResolvedValueOnce({
        Body: mockFallbackImage,
        ContentType: "image/png",
      });

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      isBase64Encoded: true,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "image/png",
        "Cache-Control": "max-age=11,public",
        "Last-Modified": undefined,
      },
      body: mockFallbackImageBuffer.toString("base64"),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenNthCalledWith(1, {
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(mockS3Commands.getObject).toHaveBeenNthCalledWith(2, {
      Bucket: "fallback-image-bucket",
      Key: "fallback-image.png",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return an error JSON when getting the default fallback image fails if the default fallback image is enabled", async () => {
    // Arrange
    process.env.ENABLE_DEFAULT_FALLBACK_IMAGE = "Yes";
    process.env.DEFAULT_FALLBACK_IMAGE_BUCKET = "fallback-image-bucket";
    process.env.DEFAULT_FALLBACK_IMAGE_KEY = "fallback-image.png";
    process.env.CORS_ENABLED = "Yes";
    process.env.CORS_ORIGIN = "*";

    const event: ImageHandlerEvent = {
      path: "/test.jpg",
    };

    // Mock
    mockS3Commands.getObject.mockRejectedValueOnce(
      new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened.")
    );

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      isBase64Encoded: false,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.NOT_FOUND,
        code: "NoSuchKey",
        message: `The image test.jpg does not exist or the request may not be base64 encoded properly.`,
      }),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenNthCalledWith(1, {
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(mockS3Commands.getObject).toHaveBeenNthCalledWith(2, {
      Bucket: "fallback-image-bucket",
      Key: "fallback-image.png",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return an error JSON when the default fallback image key is not provided if the default fallback image is enabled", async () => {
    // Arrange
    process.env.DEFAULT_FALLBACK_IMAGE_KEY = "";
    process.env.CORS_ENABLED = "Yes";
    process.env.CORS_ORIGIN = "*";
    const event: ImageHandlerEvent = { path: "/test.jpg" };

    // Mock
    mockS3Commands.getObject.mockRejectedValueOnce(
      new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened.")
    );

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      isBase64Encoded: false,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.NOT_FOUND,
        code: "NoSuchKey",
        message: `The image test.jpg does not exist or the request may not be base64 encoded properly.`,
      }),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return an error JSON when the default fallback image bucket is not provided if the default fallback image is enabled", async () => {
    // Arrange
    process.env.DEFAULT_FALLBACK_IMAGE_BUCKET = "";
    process.env.CORS_ENABLED = "Yes";
    process.env.CORS_ORIGIN = "*";
    const event: ImageHandlerEvent = { path: "/test.jpg" };

    // Mock
    mockS3Commands.getObject.mockRejectedValueOnce(
      new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened.")
    );

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      isBase64Encoded: false,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.NOT_FOUND,
        code: "NoSuchKey",
        message: `The image test.jpg does not exist or the request may not be base64 encoded properly.`,
      }),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("Should return an error JSON when ALB request is failed", async () => {
    // Arrange
    process.env.CORS_ENABLED = "Yes";
    process.env.CORS_ORIGIN = "*";
    const event: ImageHandlerEvent = {
      path: "/test.jpg",
      requestContext: {
        elb: {},
      },
    };

    // Mock
    mockS3Commands.getObject.mockRejectedValueOnce(
      new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened.")
    );

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      isBase64Encoded: false,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.NOT_FOUND,
        code: "NoSuchKey",
        message: `The image test.jpg does not exist or the request may not be base64 encoded properly.`,
      }),
    };

    // Assert
    expect(mockS3Commands.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return an error JSON with the expected message when one or both overlay image dimensions are greater than the base image dimensions", async () => {
    process.env.CORS_ENABLED = "Yes";
    process.env.CORS_ORIGIN = "*";
    const imageRequest = {
      bucket: "source-bucket",
      key: "transparent-5x5.png",
      edits: { overlayWith: { bucket: "source-bucket", key: "transparent-10x10.png" } },
      headers: { "Custom-Header": "Custom header test", "Cache-Control": "max-age:1,public" },
    };
    const encStr = Buffer.from(JSON.stringify(imageRequest)).toString("base64");
    const event: ImageHandlerEvent = {
      path: `${encStr}`,
    };
    const overlayImage = fs.readFileSync("./test/image/transparent-10x10.jpeg");
    const baseImage = fs.readFileSync("./test/image/transparent-5x5.jpeg");

    // Mock
    mockS3Commands.getObject.mockImplementation((data) => {
      return Promise.resolve({
        Body:
          data.Key === "transparent-10x10.png"
            ? { transformToByteArray: async () => new Uint8Array(overlayImage) }
            : { transformToByteArray: async () => new Uint8Array(baseImage) },
      });
    });

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.BAD_REQUEST,
      isBase64Encoded: false,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.BAD_REQUEST,
        code: "BadRequest",
        message: `Image to overlay must have same dimensions or smaller`,
      }),
    };
    expect(result).toEqual(expectedResult);
  });

  const writeGetObjectAssertion = (
    event: S3GetObjectEvent,
    cacheControl: string | RegExp,
    additionalMetadata: {} = {}
  ) => {
    expect(mockS3Commands.writeGetObjectResponse).toHaveBeenCalledWith({
      Body: mockImage,
      RequestRoute: event.getObjectContext.outputRoute,
      RequestToken: event.getObjectContext.outputToken,
      CacheControl: cacheControl,
      Metadata: { ...commonMetadata, ...additionalMetadata },
    });
  };

  it("should return the image with properly encoded headers when custom headers are provided to S3 OL implementation", async () => {
    // Mock
    const imageRequest = { bucket: "source-bucket", key: "test.jpg", headers: { "Custom-Header": "CustomValue\n" } };
    const event = setupObjectLambdaB64EncodedTest(imageRequest);

    // Act
    await handler(event, mockContext as unknown as Context);

    // Assert
    writeGetObjectAssertion(event, "max-age=31536000,public", { "Custom-Header": "CustomValue%0A" });
  });

  it("should allow overwriting of CacheControl header when expires is not provided", async () => {
    // Mock
    const imageRequest = {
      bucket: "source-bucket",
      key: "test.jpg",
      headers: { "Cache-Control": "max-age=50,public" },
    };
    const event = setupObjectLambdaB64EncodedTest(imageRequest);

    // Act
    await handler(event, mockContext as unknown as Context);

    // Assert
    writeGetObjectAssertion(event, "max-age=50,public");
  });

  it("should disallow overwriting of CacheControl header when expires is provided", async () => {
    // Mock
    const imageRequest = {
      bucket: "source-bucket",
      key: "test.jpg",
      headers: { "Cache-Control": "max-age=50,public" },
    };
    const event = setupObjectLambdaB64EncodedTest(imageRequest);
    const validDate = new Date();
    validDate.setSeconds(validDate.getSeconds() + 5);
    const validDateString = validDate.toISOString().replace(/-/g, "").replace(/:/g, "").slice(0, 15) + "Z";
    event.userRequest.url = `${event.userRequest.url}?expires=${validDateString}`;

    // Act
    await handler(event, mockContext as unknown as Context);

    // Assert
    writeGetObjectAssertion(event, expect.stringMatching(/^max-age=[0-5],public$/));
  });

  function setupObjectLambdaB64EncodedTest(eventObject: Object): S3GetObjectEvent {
    process.env.ENABLE_S3_OBJECT_LAMBDA = "Yes";
    mockS3Commands.getObject.mockResolvedValueOnce({ Body: mockImageBody, ContentType: "image/jpeg" });

    const encStr = Buffer.from(JSON.stringify(eventObject)).toString("base64");

    mockS3Commands.writeGetObjectResponse.mockResolvedValue({ status: 200, Body: undefined });
    mockContext.getRemainingTimeInMillis.mockImplementationOnce(() => 60000);
    return {
      getObjectContext: {
        outputRoute: "testOutputRoute",
        outputToken: "testOutputToken",
      },
      userRequest: {
        url: `example.com/image/${encStr}`,
        headers: { Host: "example.com" },
      },
    };
  }
});
