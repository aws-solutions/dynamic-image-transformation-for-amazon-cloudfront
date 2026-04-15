// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Rekognition from "aws-sdk/clients/rekognition";
import S3 from "aws-sdk/clients/s3";
import sharp from "sharp";

import { ImageHandler } from "../../image-handler";
import { ImageEdits, ImageRequestInfo, RequestTypes } from "../../lib";
import fs from "fs";

const s3Client = new S3();
const rekognitionClient = new Rekognition();
const image = fs.readFileSync("./test/image/25x15.png");
const rotateSpy = jest.spyOn(sharp.prototype, "rotate");

describe("standard", () => {
  it("Should pass if a series of standard edits are provided to the function", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
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
    expect(result).toEqual(request.originalImage.toString("base64"));
  });
});

describe("instantiateSharpImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should not rotate when edits.rotate is null", async () => {
    const edits = { rotate: null };
    const options = { faiOnError: false };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    await imageHandler["instantiateSharpImage"](image, edits, options);

    expect(rotateSpy).not.toHaveBeenCalled();
  });

  it("Should auto-rotate from EXIF when edits.rotate is undefined", async () => {
    const edits = { rotate: undefined };
    const options = { faiOnError: false };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    await imageHandler["instantiateSharpImage"](image, edits, options);

    expect(rotateSpy).toHaveBeenCalledWith();
  });

  it("Should rotate by the specified angle when edits.rotate is a number", async () => {
    const edits = { rotate: 90 };
    const options = { faiOnError: false };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    await imageHandler["instantiateSharpImage"](image, edits, options);

    expect(rotateSpy).toHaveBeenCalledWith(90);
  });
});
