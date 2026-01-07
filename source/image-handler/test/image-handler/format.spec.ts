// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Rekognition from "aws-sdk/clients/rekognition";
import S3 from "aws-sdk/clients/s3";
import sharp from "sharp";
import fs from "fs";

import { ImageHandler } from "../../image-handler";
import { ImageFormatTypes, ImageRequestInfo, RequestTypes } from "../../lib";

const s3Client = new S3();
const rekognitionClient = new Rekognition();
const image = fs.readFileSync("./test/image/25x15.png");

describe("format", () => {
  it("Should pass if the output image is in a different format than the original image", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      outputFormat: ImageFormatTypes.PNG,
      edits: { grayscale: true, flip: true },
      originalImage: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    // Assert
    expect(result).not.toEqual(request.originalImage);
  });

  it("Should pass if the output image is webp format and reductionEffort is provided", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      outputFormat: ImageFormatTypes.WEBP,
      effort: 3,
      originalImage: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    };
    jest.spyOn(sharp(), "webp");

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    // Assert
    expect(result).not.toEqual(request.originalImage);
  });

  it("Should pass if the output image is different from the input image with edits applied", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      edits: { grayscale: true, flip: true },
      originalImage: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    // Assert
    expect(result).not.toEqual(request.originalImage);
  });
});

describe("modifyImageOutput", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should return an image in the specified format when outputFormat is provided", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "sample-image-001.png",
      edits: { grayscale: true, flip: true },
      outputFormat: ImageFormatTypes.JPEG,
      originalImage: image,
    };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const sharpImage = sharp(request.originalImage, { failOnError: false }).withMetadata();
    const jpegSpy = jest.spyOn(sharp.prototype, "jpeg");
    const result = await imageHandler["modifyImageOutput"](sharpImage, request).toBuffer();

    // Act
    const resultFormat = (await sharp(result).metadata()).format;

    // Assert
    expect(jpegSpy).toHaveBeenCalledWith({ quality: 80 });
    expect(resultFormat).toEqual(ImageFormatTypes.JPEG);
  });

  it("Should return an image in the same format when outputFormat is not provided", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "sample-image-001.png",
      edits: { grayscale: true, flip: true },
      originalImage: image,
    };
    const sharpImage = sharp(request.originalImage, { failOnError: false }).withMetadata();
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = await imageHandler["modifyImageOutput"](sharpImage, request).toBuffer();
    const resultFormat = (await sharp(result).metadata()).format;

    // Assert
    expect(resultFormat).toEqual(ImageFormatTypes.PNG);
  });

  it("Should return an image webp with reduction effort when outputFormat wepb and reduction effot provided", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "sample-image-001.png",
      edits: { grayscale: true, flip: true },
      outputFormat: ImageFormatTypes.WEBP,
      effort: 3,
      originalImage: image,
    };
    const sharpImage = sharp(request.originalImage, { failOnError: false }).withMetadata();
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const webpSpy = jest.spyOn(sharp.prototype, "webp");

    // Act
    const result = await imageHandler["modifyImageOutput"](sharpImage, request).toBuffer();
    const resultFormat = (await sharp(result).metadata()).format;

    // Assert
    expect(webpSpy).toHaveBeenCalledWith({ effort: request.effort });
    expect(resultFormat).toEqual(ImageFormatTypes.WEBP);
  });

  it("Should return an image in AVIF format when outputFormat is AVIF", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "sample-image-001.png",
      edits: { grayscale: true },
      outputFormat: ImageFormatTypes.AVIF,
      originalImage: image,
    };
    const sharpImage = sharp(request.originalImage, { failOnError: false }).withMetadata();
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const avifSpy = jest.spyOn(sharp.prototype, "avif");

    // Act
    const result = await imageHandler["modifyImageOutput"](sharpImage, request).toBuffer();
    const resultFormat = (await sharp(result).metadata()).format;

    // Assert
    expect(avifSpy).toHaveBeenCalledWith({ quality: 70 });
    expect(resultFormat).toEqual("heif");
  });
});
