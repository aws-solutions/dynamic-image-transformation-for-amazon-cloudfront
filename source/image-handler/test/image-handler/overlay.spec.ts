// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockAwsS3 } from "../mock";

import Rekognition from "aws-sdk/clients/rekognition";
import S3 from "aws-sdk/clients/s3";
import fs from "fs";
import sharp from "sharp";

import { ImageHandler } from "../../image-handler";
import { ImageEdits, ImageHandlerError, StatusCodes, ImageRequestInfo, RequestTypes } from "../../lib";

const s3Client = new S3();
const rekognitionClient = new Rekognition();

describe("overlay", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Should pass if an edit with the overlayWith keyname is passed to the function", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = {
      overlayWith: { bucket: "bucket", key: "key" },
    };

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64"
          ),
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "bucket",
      Key: "key",
    });
    expect(result["options"].input.buffer).toEqual(originalImage); // eslint-disable-line dot-notation
  });

  it("Should pass if an edit with the overlayWith keyname is passed to the function", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAEAAQDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwD/2Q==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = {
      overlayWith: {
        bucket: "bucket",
        key: "key",
        options: { left: "-1", top: "-1" },
      },
    };

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64"
          ),
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "bucket",
      Key: "key",
    });
    expect(result["options"].input.buffer).toEqual(originalImage); // eslint-disable-line dot-notation
  });

  it("Should pass if an edit with the overlayWith keyname is passed to the function", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAEAAQDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwD/2Q==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = {
      overlayWith: {
        bucket: "bucket",
        key: "key",
        options: { left: "1", top: "1" },
      },
    };

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64"
          ),
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "bucket",
      Key: "key",
    });
    expect(result["options"].input.buffer).toEqual(originalImage); // eslint-disable-line dot-notation
  });

  it("Should pass if an edit with the overlayWith keyname is passed to the function", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAEAAQDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwD/2Q==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = {
      overlayWith: {
        bucket: "bucket",
        key: "key",
        options: { left: "50p", top: "50p" },
      },
    };

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64"
          ),
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "bucket",
      Key: "key",
    });
    expect(result["options"].input.buffer).toEqual(originalImage); // eslint-disable-line dot-notation
  });

  it("Should pass if an edit with the overlayWith keyname contains position which could produce float number", async () => {
    // Arrange
    const originalImage = fs.readFileSync("./test/image/25x15.png");
    const overlayImage = fs.readFileSync("./test/image/1x1.jpg");
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = {
      overlayWith: {
        bucket: "bucket",
        key: "key",
        options: { left: "25.5p", top: "25.5p" },
      },
    };

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ Body: overlayImage });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);
    const metadata = await result.metadata();

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "bucket",
      Key: "key",
    });
    expect(metadata.width).toEqual(25);
    expect(metadata.height).toEqual(15);
    expect(result.toBuffer()).not.toEqual(originalImage);
  });

  it("Should pass if an edit with the overlayWith keyname is passed to the function", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAEAAQDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwD/2Q==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = {
      overlayWith: {
        bucket: "bucket",
        key: "key",
        options: { left: "-50p", top: "-50p" },
      },
    };

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64"
          ),
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "bucket",
      Key: "key",
    });
    expect(result["options"].input.buffer).toEqual(originalImage); // eslint-disable-line dot-notation
  });

  it("Should pass if the proper bucket name and key are supplied, simulating an image file that can be retrieved", async () => {
    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64"
          ),
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const metadata = await sharp(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      )
    ).metadata();
    const result = await imageHandler.getOverlayImage("validBucket", "validKey", "100", "100", "20", metadata);

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "validBucket",
      Key: "validKey",
    });
    const resultMetadata = await sharp(result).metadata();
    expect(resultMetadata.format).toEqual("png");
    expect(resultMetadata.width).toEqual(1);
    expect(resultMetadata.height).toEqual(1);
  });

  it("Should pass and do not throw an exception that the overlay image dimensions are not integer numbers", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/25x15.png");
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ Body: originalImage });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const originalImageMetadata = await sharp(originalImage).metadata();
    const result = await imageHandler.getOverlayImage("bucket", "key", "75", "75", "20", originalImageMetadata);
    const overlayImageMetadata = await sharp(result).metadata();

    // Assert
    expect(overlayImageMetadata.width).toEqual(18);
    expect(overlayImageMetadata.height).toEqual(11);
  });

  it("Should throw an error if an invalid bucket or key name is provided, simulating a nonexistent overlay image", async () => {
    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject(
          new ImageHandlerError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            "InternalServerError",
            "SimulatedInvalidParameterException"
          )
        );
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const metadata = await sharp(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      )
    ).metadata();
    try {
      await imageHandler.getOverlayImage("invalidBucket", "invalidKey", "100", "100", "20", metadata);
    } catch (error) {
      // Assert
      expect(mockAwsS3.getObject).toHaveBeenCalledWith({
        Bucket: "invalidBucket",
        Key: "invalidKey",
      });
      expect(error).toMatchObject({
        status: StatusCodes.INTERNAL_SERVER_ERROR,
        code: "InternalServerError",
        message: "SimulatedInvalidParameterException",
      });
    }
  });
});

describe("calcOverlaySizeOption", () => {
  it('should return percentage of imagesize when parameter ends in "p"', () => {
    // Arrange
    const imageSize = 100;
    const editSize = "50p";
    const overlaySize = 10;
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = imageHandler["calcOverlaySizeOption"](editSize, imageSize, overlaySize);

    // Assert
    expect(result).toEqual(50);
  });

  it('should return the image size plus the percentage minus the overlay size if param is less than 1 and ends in "p"', () => {
    // Arrange
    const imageSize = 100;
    const editSize = "-50p";
    const overlaySize = 50;
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = imageHandler["calcOverlaySizeOption"](editSize, imageSize, overlaySize);

    // Assert
    expect(result).toEqual(0);
  });

  it("should return the specified parameter if param is a positive number", () => {
    // Arrange
    const imageSize = 100;
    const editSize = "50";
    const overlaySize = 50;
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = imageHandler["calcOverlaySizeOption"](editSize, imageSize, overlaySize);

    // Assert
    expect(result).toEqual(50);
  });

  it("should return the image size + specified parameter - overlay size if param is less than 0", () => {
    // Arrange
    const imageSize = 100;
    const editSize = "-50";
    const overlaySize = 50;
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = imageHandler["calcOverlaySizeOption"](editSize, imageSize, overlaySize);

    // Assert
    expect(result).toEqual(0);
  });

  it("should return NaN if param is undefined", () => {
    // Arrange
    const imageSize = 100;
    const editSize = undefined;
    const overlaySize = 50;
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = imageHandler["calcOverlaySizeOption"](editSize, imageSize, overlaySize);

    // Assert
    expect(result).toEqual(NaN);
  });
});

/**
 * series of tests to confirm sharp and SIH behavior with overlays in relation to base images that are:
 * - dimensions are both equal
 * - dimensions are both smaller
 * - dimensions are both larger
 * - width is greater
 * - height is greater
 */
describe("overlay-dimensions", () => {
  const SHARP_ERROR = "Image to composite must have same dimensions or smaller";
  it("Should pass and not throw an exception when the overlay image dimensions are both equal - png", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/25x15.png");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {
        overlayWith: {
          bucket: "sample-bucket",
          key: "test.jpg",
        },
      },
      originalImage,
    };
    const overlayImage = fs.readFileSync("./test/image/25x15.png");

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: overlayImage,
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error).not.toThrow(error);
    }
  });
  it("Should pass and not throw an exception when the overlay image dimensions are both smaller - png", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/aws_logo.png");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {
        overlayWith: {
          bucket: "sample-bucket",
          key: "test.jpg",
        },
      },
      originalImage,
    };
    const overlayImage = fs.readFileSync("./test/image/25x15.png");

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: overlayImage,
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error).not.toThrow(error);
    }
  });
  it("Should pass and throw an exception that the overlay image dimensions are both larger - png", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/25x15.png");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {
        overlayWith: {
          bucket: "sample-bucket",
          key: "test.jpg",
        },
      },
      originalImage,
    };
    const overlayImage = fs.readFileSync("./test/image/aws_logo.png");

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: overlayImage,
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error.message).toMatch(SHARP_ERROR);
    }
  });
  it("Should pass and throw an exception that the overlay image width is greater", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/transparent-5x10.png");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {
        overlayWith: {
          bucket: "sample-bucket",
          key: "test.jpg",
        },
      },
      originalImage,
    };
    const overlayImage = fs.readFileSync("./test/image/transparent-10x10.png");

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: overlayImage,
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error.message).toMatch(SHARP_ERROR);
    }
  });
  it("Should pass and throw an exception that the overlay image height is greater", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/transparent-10x5.png");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {
        overlayWith: {
          bucket: "sample-bucket",
          key: "test.jpg",
        },
      },
      originalImage,
    };
    const overlayImage = fs.readFileSync("./test/image/transparent-10x10.png");

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: overlayImage,
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error.message).toMatch(SHARP_ERROR);
    }
  });

  it("Should pass and not throw an exception when the overlay image dimensions are both equal - jpeg", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/transparent-10x10.jpeg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {
        overlayWith: {
          bucket: "sample-bucket",
          key: "test.jpg",
        },
      },
      originalImage,
    };
    const overlayImage = fs.readFileSync("./test/image/transparent-10x10.jpeg");

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: overlayImage,
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error).not.toThrow(error);
    }
  });
  it("Should pass and not throw an exception when the overlay image dimensions are both smaller - jpeg", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/transparent-10x10.jpeg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {
        overlayWith: {
          bucket: "sample-bucket",
          key: "test.jpg",
        },
      },
      originalImage,
    };
    const overlayImage = fs.readFileSync("./test/image/transparent-10x5.jpeg");

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: overlayImage,
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error).not.toThrow(error);
    }
  });
  it("Should pass and throw an exception that the overlay image dimensions are both larger - jpeg", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/transparent-5x5.jpeg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {
        overlayWith: {
          bucket: "sample-bucket",
          key: "test.jpg",
        },
      },
      originalImage,
    };
    const overlayImage = fs.readFileSync("./test/image/transparent-10x10.jpeg");

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: overlayImage,
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error.message).toMatch(SHARP_ERROR);
    }
  });
  it("Should pass and throw an exception that the overlay image width is greater - jpeg", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/transparent-5x10.jpeg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {
        overlayWith: {
          bucket: "sample-bucket",
          key: "test.jpg",
        },
      },
      originalImage,
    };
    const overlayImage = fs.readFileSync("./test/image/transparent-10x10.jpeg");

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: overlayImage,
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error.message).toMatch(SHARP_ERROR);
    }
  });
  it("Should pass and throw an exception that the overlay image height is greater - jpeg", async () => {
    // Mock
    const originalImage = fs.readFileSync("./test/image/transparent-10x5.jpeg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {
        overlayWith: {
          bucket: "sample-bucket",
          key: "test.jpg",
        },
      },
      originalImage,
    };
    const overlayImage = fs.readFileSync("./test/image/transparent-10x10.jpeg");

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Body: overlayImage,
        });
      },
    }));

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error.message).toMatch(SHARP_ERROR);
    }
  });
});
