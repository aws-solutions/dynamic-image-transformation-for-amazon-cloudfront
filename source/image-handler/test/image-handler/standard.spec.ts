// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { ImageHandler } from "../../image-handler";
import { ImageEdits, ImageRequestInfo, RequestTypes } from "../../lib";
import fs from "fs";

const s3Client = new S3Client();
const rekognitionClient = new RekognitionClient();
const image = fs.readFileSync("./test/image/25x15.png");
const keepMetadataSpy = jest.spyOn(sharp.prototype, "keepMetadata");

describe("standard", () => {
  it("Should pass if a series of standard edits are provided to the function", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOn: "none" }).withMetadata();
    const edits: ImageEdits = { grayscale: true, flip: true };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    /* eslint-disable dot-notation */
    const expectedResult1 = result["options"].greyscale;
    const expectedResult2 = result["options"].flip;
    const combinedResults = expectedResult1 && expectedResult2;
    expect(combinedResults).toEqual(true);
  });

  it("Should pass if no edits are specified and the original image is returned", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      originalImage: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    // Assert
    expect(result).toEqual(request.originalImage);
  });
});

describe("instantiateSharpImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should keep metadata by default", async () => {
    // Arrange
    const edits = {};
    const options = { failOn: "none" };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    await imageHandler["instantiateSharpImage"](image, edits, options);

    // Assert
    expect(keepMetadataSpy).toHaveBeenCalled();
  });

  it("Should strip EXIF when stripExif is true", async () => {
    // Arrange
    const originalImage = fs.readFileSync("./test/image/1x1.jpg");
    const edits = { stripExif: true };
    const options = { failOn: "none" };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = await imageHandler["instantiateSharpImage"](originalImage, edits, options);
    const outputBuffer = await result.toBuffer();
    const metadata = await sharp(outputBuffer).metadata();

    // Assert - stripExif should be removed from edits after processing
    expect(edits.stripExif).toBeUndefined();
    // ICC should be preserved
    expect(metadata).toHaveProperty("icc");
  });

  it("Should strip ICC when stripIcc is true", async () => {
    // Arrange
    const originalImage = fs.readFileSync("./test/image/1x1.jpg");
    const edits = { stripIcc: true };
    const options = { failOn: "none" };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    const result = await imageHandler["instantiateSharpImage"](originalImage, edits, options);
    const outputBuffer = await result.toBuffer();
    const metadata = await sharp(outputBuffer).metadata();

    // Assert - stripIcc should be removed from edits after processing
    expect(edits.stripIcc).toBeUndefined();
    // EXIF should be preserved
    expect(metadata).toHaveProperty("exif");
  });
});
