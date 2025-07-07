// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { ImageHandler } from "../../image-handler";
import { ImageEdits } from "../../lib";

const s3Client = new S3Client();
const rekognitionClient = new RekognitionClient();

// jest spies
const hasRoundCropSpy = jest.spyOn(ImageHandler.prototype as any, "hasRoundCrop");
const validRoundCropParamSpy = jest.spyOn(ImageHandler.prototype as any, "validRoundCropParam");
const compositeSpy = jest.spyOn(sharp.prototype, "composite");

describe("roundCrop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should pass if roundCrop keyName is passed with no additional options", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAEAAQDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwD/2Q==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const metadata = await image.metadata();
    const edits: ImageEdits = { roundCrop: true };
    const radiusX = Math.min(metadata.height, metadata.width) / 2;
    const radiusY = radiusX;
    const height = metadata.height;
    const width = metadata.width;
    const leftOffset = metadata.width / 2;
    const topOffset = metadata.height / 2;
    const ellipse = Buffer.from(
      `<svg viewBox="0 0 ${width} ${height}"> <ellipse cx="${leftOffset}" cy="${topOffset}" rx="${radiusX}" ry="${radiusY}" /></svg>`
    );
    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    const expectedResult = { width: metadata.width / 2, height: metadata.height / 2 };
    expect(result["options"].input).not.toEqual(expectedResult);
    expect(hasRoundCropSpy).toHaveReturnedWith(true);
    expect(validRoundCropParamSpy).toHaveBeenCalledTimes(4);
    for (let i = 1; i <= 4; i++) {
      expect(validRoundCropParamSpy).toHaveNthReturnedWith(i, undefined);
    }
    expect(compositeSpy).toHaveBeenCalledWith([{ input: ellipse, blend: "dest-in" }]);
  });

  it("Should pass if roundCrop keyName is passed with additional options", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAEAAQDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwD/2Q==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const metadata = await image.metadata();

    const edits: ImageEdits = { roundCrop: { top: 100, left: 100, rx: 100, ry: 100 } };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    const expectedResult = { width: metadata.width / 2, height: metadata.height / 2 };
    expect(result["options"].input).not.toEqual(expectedResult);
    expect(hasRoundCropSpy).toHaveReturnedWith(true);
    expect(validRoundCropParamSpy).toHaveReturnedWith(true);
    expect(compositeSpy).toHaveBeenCalled();
  });
});

describe("hasRoundCrop", () => {
  it("Should return true when the edits object has roundCrop key", () => {
    // Arrange
    const edits: ImageEdits = { roundCrop: { top: 100, left: 100, rx: 100, ry: 100 } };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = imageHandler["hasRoundCrop"](edits);

    // Assert
    expect(result).toBe(true);
  });

  it("should return false when the edits object does not have roundCrop key", () => {
    // Arrange
    const edits: ImageEdits = { resize: { width: 50, height: 50 } };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = imageHandler["hasRoundCrop"](edits);

    // Assert
    expect(result).toBe(false);
  });
});

describe("validRoundCropParam", () => {
  it("Should return true when the input is a number greater than 0", () => {
    // Arrange
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = imageHandler["validRoundCropParam"](2);

    // Assert
    expect(result).toBe(true);
  });

  it("Should return false when the input is a number less than 0", () => {
    // Arrange
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = imageHandler["validRoundCropParam"](-1);

    // Assert
    expect(result).toBe(false);
  });

  it("Should return falsey value when the input is undefined", () => {
    // Arrange
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = imageHandler["validRoundCropParam"](undefined);

    // Assert
    // Converted to bool to show falsey values would be false as the parameters is used in if expression.
    expect(!!result).toBe(false);
  });
});
