// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockRekognitionCommands } from "../mock";

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import sharp from "sharp";

import { ImageHandler } from "../../image-handler";
import { ImageEdits, ImageHandlerError, StatusCodes } from "../../lib";

const s3Client = new S3Client();
const rekognitionClient = new RekognitionClient();
// jest spy
const blurSpy = jest.spyOn(sharp.prototype, "blur");

describe("contentModeration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should pass and blur image with minConfidence provided", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const buffer = await image.toBuffer();
    const edits: ImageEdits = { contentModeration: { minConfidence: 70 } };

    // Mock
    mockRekognitionCommands.detectModerationLabels.mockResolvedValue({
      ModerationLabels: [
        {
          Confidence: 99.76720428466,
          Name: "Smoking",
          ParentName: "Tobacco",
        },
        { Confidence: 99.76720428466, Name: "Tobacco", ParentName: "" },
      ],
      ModerationModelVersion: "4.0",
    });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);
    const expected = image.blur(50);

    // Assert
    expect(mockRekognitionCommands.detectModerationLabels).toHaveBeenCalledWith({
      Image: { Bytes: buffer },
      MinConfidence: 70,
    });

    expect(result["options"].input).not.toEqual(originalImage); // eslint-disable-line dot-notation
    expect(result).toEqual(expected);
  });

  it("should pass and blur to specified amount if blur option is provided", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const buffer = await image.toBuffer();
    const edits: ImageEdits = {
      contentModeration: { minConfidence: 75, blur: 100 },
    };

    // Mock
    mockRekognitionCommands.detectModerationLabels.mockResolvedValue({
      ModerationLabels: [
        {
          Confidence: 99.76720428466,
          Name: "Smoking",
          ParentName: "Tobacco",
        },
        { Confidence: 99.76720428466, Name: "Tobacco", ParentName: "" },
      ],
      ModerationModelVersion: "4.0",
    });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);
    const expected = image.blur(100);

    // Assert
    expect(mockRekognitionCommands.detectModerationLabels).toHaveBeenCalledWith({
      Image: { Bytes: buffer },
      MinConfidence: 75,
    });
    expect(result["options"].input).not.toEqual(originalImage); // eslint-disable-line dot-notation
    expect(result).toEqual(expected);
  });

  it("should pass and blur if content moderation label matches specified moderation label", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const buffer = await image.toBuffer();
    const edits: ImageEdits = {
      contentModeration: { moderationLabels: ["Smoking"] },
    };

    // Mock
    mockRekognitionCommands.detectModerationLabels.mockResolvedValue({
      ModerationLabels: [
        {
          Confidence: 99.76720428466,
          Name: "Smoking",
          ParentName: "Tobacco",
        },
        { Confidence: 99.76720428466, Name: "Tobacco", ParentName: "" },
      ],
      ModerationModelVersion: "4.0",
    });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);
    const expected = image.blur(50);

    // Assert
    expect(mockRekognitionCommands.detectModerationLabels).toHaveBeenCalledWith({
      Image: { Bytes: buffer },
      MinConfidence: 75,
    });
    expect(result["options"].input).not.toEqual(originalImage); // eslint-disable-line dot-notation
    expect(result).toEqual(expected);
  });

  it("should not blur if provided moderationLabels not found", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const buffer = await image.toBuffer();
    const edits: ImageEdits = {
      contentModeration: {
        minConfidence: 80,
        blur: 100,
        moderationLabels: ["Alcohol"],
      },
    };

    // Mock
    mockRekognitionCommands.detectModerationLabels.mockResolvedValueOnce({
      ModerationLabels: [
        {
          Confidence: 99.76720428466,
          Name: "Smoking",
          ParentName: "Tobacco",
        },
        { Confidence: 99.76720428466, Name: "Tobacco", ParentName: "" },
      ],
      ModerationModelVersion: "4.0",
    });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    expect(mockRekognitionCommands.detectModerationLabels).toHaveBeenCalledWith({
      Image: { Bytes: buffer },
      MinConfidence: 80,
    });
    expect(result).toEqual(image);
  });

  it("Should pass and blur image when no parameters passed", async () => {
    // Arrange
    const originalImage = fs.readFileSync("./test/image/aws_logo.png");
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const buffer = await image.toBuffer();
    const edits: ImageEdits = { contentModeration: true };

    // Mock
    mockRekognitionCommands.detectModerationLabels.mockResolvedValue({
      ModerationLabels: [
        {
          Confidence: 99.76720428466,
          Name: "Fake Name",
          ParentName: "Fake Parent Name",
        },
        { Confidence: 99.76720428466, Name: "Fake Name", ParentName: "" },
      ],
      ModerationModelVersion: "5.0",
    });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await (await imageHandler.applyEdits(image, edits, false)).toBuffer();
    const expected = await sharp(originalImage, { failOnError: false }).withMetadata().blur(50).toBuffer();

    // Assert
    expect(mockRekognitionCommands.detectModerationLabels).toHaveBeenCalledWith({
      Image: { Bytes: buffer },
      MinConfidence: 75,
    });
    expect(result).toEqual(expected);
  });

  it("should fail if rekognition returns an error", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const buffer = await image.toBuffer();
    const edits: ImageEdits = {
      contentModeration: { minConfidence: 90, blur: 100 },
    };

    // Mock
    mockRekognitionCommands.detectModerationLabels.mockRejectedValue(
      new ImageHandlerError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Rekognition::DetectModerationLabelsError",
        "Rekognition call failed. Please contact the system administrator."
      )
    );

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.applyEdits(image, edits, false);
    } catch (error) {
      // Assert
      expect(mockRekognitionCommands.detectModerationLabels).toHaveBeenCalledWith({
        Image: { Bytes: buffer },
        MinConfidence: 90,
      });
      expect(error).toMatchObject({
        status: StatusCodes.INTERNAL_SERVER_ERROR,
        code: "Rekognition::DetectModerationLabelsError",
        message: "Rekognition call failed. Please contact the system administrator.",
      });
    }
  });
});

describe("blurImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should blur to specified value if the specified labels match the found rekognition moderation labels", () => {
    // Arrange
    const currentImage = Buffer.from("TestImageData");
    const image = sharp(currentImage, { failOnError: false }).withMetadata();
    const rekognitionResponse = {
      ModerationLabels: [
        {
          Confidence: 99.24723052978516,
          ParentName: "Rude Gestures",
          Name: "Middle Finger",
        },
        {
          Confidence: 99.24723052978516,
          ParentName: "Alcohol",
          Name: "Drinking",
        },
      ],
    };
    const moderationLabels = ["Middle Finger"];
    const blurValue = 0.5;
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["blurImage"](image, blurValue, moderationLabels, rekognitionResponse);

    // Assert
    expect(blurSpy).toHaveBeenCalledWith(Math.ceil(blurValue));
  });

  it("should blur if no labels were provided but moderation content was found", () => {
    // Arrange
    const currentImage = Buffer.from("TestImageData");
    const image = sharp(currentImage, { failOnError: false }).withMetadata();
    const rekognitionResponse = {
      ModerationLabels: [
        {
          Confidence: 99.24723052978516,
          ParentName: "Rude Gestures",
          Name: "Middle Finger",
        },
        {
          Confidence: 99.24723052978516,
          ParentName: "Alcohol",
          Name: "Drinking",
        },
      ],
    };
    const moderationLabels = undefined;
    const blurValue = 2;
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["blurImage"](image, blurValue, moderationLabels, rekognitionResponse);

    // Assert
    expect(blurSpy).toHaveBeenCalledWith(Math.ceil(blurValue));
  });

  it("should not blur if labels were provided but do not match found rekognition content", () => {
    // Arrange
    const currentImage = Buffer.from("TestImageData");
    const image = sharp(currentImage, { failOnError: false }).withMetadata();
    const rekognitionResponse = {
      ModerationLabels: [
        {
          Confidence: 99.24723052978516,
          ParentName: "Rude Gestures",
          Name: "Middle Finger",
        },
        {
          Confidence: 99.24723052978516,
          ParentName: "Alcohol",
          Name: "Drinking",
        },
      ],
    };
    const moderationLabels = ["Smoking"];
    const blurValue = 2;
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["blurImage"](image, blurValue, moderationLabels, rekognitionResponse);

    // Assert
    expect(blurSpy).not.toHaveBeenCalled();
  });
});
