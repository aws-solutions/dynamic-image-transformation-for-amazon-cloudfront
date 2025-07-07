// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { ImageHandler } from "../../image-handler";
import { ImageEdits, StatusCodes } from "../../lib";

const s3Client = new S3Client();
const rekognitionClient = new RekognitionClient();

// base64 encoded images
const imagePngWhite5x5 =
  "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFAQAAAAClFBtIAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QAAd2KE6QAAAAHdElNRQfnAxYODhUMhxdmAAAADElEQVQI12P4wQCFABhCBNn4i/hQAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDIzLTAzLTIyVDE0OjE0OjIxKzAwOjAwtK8ALAAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyMy0wMy0yMlQxNDoxNDoyMSswMDowMMXyuJAAAAAASUVORK5CYII=";
const imagePngWhite1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC";

describe("crop", () => {
  it("Should fail if a cropping area value is out of bounds", async () => {
    // Arrange
    const originalImage = Buffer.from(imagePngWhite1x1, "base64");
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = {
      crop: { left: 0, top: 0, width: 100, height: 100 },
    };

    // Act
    try {
      const imageHandler = new ImageHandler(s3Client, rekognitionClient);
      await imageHandler.applyEdits(image, edits, false);
    } catch (error) {
      // Assert
      expect(error).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        code: "Crop::AreaOutOfBounds",
        message:
          "The cropping area you provided exceeds the boundaries of the original image. Please try choosing a correct cropping value.",
      });
    }
  });

  // confirm that crops perform as expected
  it("Should pass with a standard crop", async () => {
    // 5x5 png
    const originalImage = Buffer.from(imagePngWhite5x5, "base64");
    const image = sharp(originalImage, { failOnError: true });
    const edits: ImageEdits = {
      crop: { left: 0, top: 0, width: 1, height: 1 },
    };

    // crop an image and compare with the result expected
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);
    const resultBuffer = await result.toBuffer();
    expect(resultBuffer).toEqual(Buffer.from(imagePngWhite1x1, "base64"));
  });

  // confirm that an invalid attribute sharp crop request containing *right* rather than *top* returns as a cropping error,
  // note that this only confirms the behavior of the image-handler in this case,
  // it is not an accurate description of the actual error
  it("Should fail with an invalid crop request", async () => {
    // 5x5 png
    const originalImage = Buffer.from(imagePngWhite5x5, "base64");
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = {
      crop: { left: 0, right: 0, width: 1, height: 1 },
    };

    // crop an image and compare with the result expected
    try {
      const imageHandler = new ImageHandler(s3Client, rekognitionClient);
      await imageHandler.applyEdits(image, edits, false);
    } catch (error) {
      // Assert
      expect(error).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        code: "Crop::AreaOutOfBounds",
        message:
          "The cropping area you provided exceeds the boundaries of the original image. Please try choosing a correct cropping value.",
      });
    }
  });
});
