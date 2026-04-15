// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Rekognition from "aws-sdk/clients/rekognition";
import S3 from "aws-sdk/clients/s3";
import fs from "fs";
import sharp from "sharp";

import { ImageHandler } from "../../image-handler";
import { ImageFormatTypes, ImageRequestInfo, RequestTypes } from "../../lib";

const s3Client = new S3();
const rekognitionClient = new Rekognition();

describe("rotate", () => {
  it("Should pass if rotate is null and return image without EXIF and ICC", async () => {
    // Arrange
    const originalImage = fs.readFileSync("./test/image/1x1.jpg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: { rotate: null },
      originalImage: originalImage,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    // Assert
    const metadata = await sharp(Buffer.from(result, "base64")).metadata();
    expect(metadata).not.toHaveProperty("exif");
    expect(metadata).not.toHaveProperty("icc");
    expect(metadata).not.toHaveProperty("orientation");
  });

  it("Should bake EXIF orientation into pixels and strip the orientation tag when edits are applied", async () => {
    // AVIF/WebP decoders ignore embedded EXIF orientation (HEIF spec only honors
    // container-level irot/imir boxes). The input 1x1.jpg has orientation=3; after
    // processing, the rotation must be applied to the pixels and the tag stripped so
    // every downstream format renders correctly.
    const originalImage = fs.readFileSync("./test/image/1x1.jpg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: { grayscale: true },
      originalImage: originalImage,
    };

    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    const metadata = await sharp(Buffer.from(result, "base64")).metadata();
    expect(metadata.orientation).toBeUndefined();
  });

  it("Should stack EXIF orientation with an explicit rotate edit", async () => {
    // Source: 4x2 red image, EXIF orientation=6 (rotate 90 CW). Effective display: 2x4.
    // With edits.rotate=90, the final pixels should be rotated 90° on top of the EXIF,
    // i.e. total 180° from the raw pixels → final dimensions back to 4x2.
    const originalImage = await sharp({
      create: { width: 4, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      edits: { rotate: 90 },
      originalImage,
    };

    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    const metadata = await sharp(Buffer.from(result, "base64")).metadata();
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.width).toEqual(4);
    expect(metadata.height).toEqual(2);
  });

  it("Should bake EXIF orientation into pixels for format-only (AVIF) requests", async () => {
    const originalImage = fs.readFileSync("./test/image/1x1.jpg");
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "test.jpg",
      outputFormat: ImageFormatTypes.AVIF,
      originalImage: originalImage,
    };

    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.process(request);

    const metadata = await sharp(Buffer.from(result, "base64")).metadata();
    expect(metadata.format).toEqual("heif");
    expect(metadata.orientation).toBeUndefined();
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
    const metadata = await sharp(Buffer.from(result, "base64")).metadata();
    expect(metadata).not.toHaveProperty("orientation");
  });
});
