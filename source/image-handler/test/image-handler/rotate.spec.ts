// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import sharp from "sharp";

import { ImageHandler } from "../../image-handler";
import { ImageRequestInfo, RequestTypes } from "../../lib";

const s3Client = new S3Client();
const rekognitionClient = new RekognitionClient();

describe("rotate", () => {
  it("Should pass if rotate is null and return image without EXIF and ICC", async () => {
    // Arrange
    const originalImage = fs.readFileSync("./test/image/1x1.jpg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: { rotate: null },
      originalImage,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    // Assert
    const metadata = await sharp(result).metadata();
    expect(metadata).not.toHaveProperty("exif");
    expect(metadata).not.toHaveProperty("icc");
    expect(metadata).not.toHaveProperty("orientation");
  });

  it("Should pass if the original image has orientation", async () => {
    // Arrange
    const originalImage = fs.readFileSync("./test/image/1x1.jpg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {},
      originalImage,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    // Assert
    const metadata = await sharp(result).metadata();
    expect(metadata).toHaveProperty("icc");
    expect(metadata).toHaveProperty("exif");
    expect(metadata.orientation).toEqual(3);
  });

  it("Should pass if the original image does not have orientation", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: {},
      originalImage: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    // Assert
    const metadata = await sharp(result).metadata();
    expect(metadata).not.toHaveProperty("orientation");
  });

  it("Should call autoOrient when rotate is undefined (filters:rotate() without parameters)", async () => {
    // Arrange
    const originalImage = fs.readFileSync("./test/image/1x1.jpg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: { rotate: undefined },
      originalImage,
    };

    // Create a spy on Sharp's autoOrient method
    const autoOrientSpy = jest.spyOn(sharp.prototype, "autoOrient");

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    await imageHandler.process(request);

    // Assert
    expect(autoOrientSpy).toHaveBeenCalled();

    // Clean up
    autoOrientSpy.mockRestore();
  });
});
