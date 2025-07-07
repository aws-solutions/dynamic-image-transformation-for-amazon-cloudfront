// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { ImageHandler } from "../../image-handler";
import { ImageEdits, ImageHandlerError } from "../../lib";

const s3Client = new S3Client();
const rekognitionClient = new RekognitionClient();

describe("resize", () => {
  it("Should pass if resize width and height are provided as string number to the function", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = { resize: { width: "99.1", height: "99.9" } };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    const resultBuffer = await result.toBuffer();
    const convertedImage = await sharp(originalImage, { failOnError: false })
      .withMetadata()
      .resize({ width: 99, height: 100 })
      .toBuffer();
    expect(resultBuffer).toEqual(convertedImage);
  });

  it("Should throw an error if image edits dimensions are invalid", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = { resize: { width: 0, height: 0 } };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Assert
    await expect(imageHandler.applyEdits(image, edits, false)).rejects.toThrow(ImageHandlerError);
  });

  it("Should not throw an error if image edits dimensions contain null", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = { resize: { width: 100, height: null } };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Assert
    const result = await imageHandler.applyEdits(image, edits, false);
    const resultBuffer = await result.toBuffer();
    const convertedImage = await sharp(originalImage, { failOnError: false })
      .withMetadata()
      .resize({ width: 100, height: null })
      .toBuffer();
    expect(resultBuffer).toEqual(convertedImage);
  });
});
