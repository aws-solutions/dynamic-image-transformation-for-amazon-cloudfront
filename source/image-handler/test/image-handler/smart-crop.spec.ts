// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockRekognitionCommands } from "../mock";

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { ImageHandler } from "../../image-handler";
import { BoundingBox, BoxSize, ImageEdits, ImageHandlerError, StatusCodes } from "../../lib";

const s3Client = new S3Client();
const rekognitionClient = new RekognitionClient();

describe("smartCrop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should pass if an edit with the smartCrop keyname is passed to the function", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const buffer = await image.toBuffer();
    const edits: ImageEdits = { smartCrop: { faceIndex: 0, padding: 0 } };

    // Mock
    mockRekognitionCommands.detectFaces.mockResolvedValue({
      FaceDetails: [
        {
          BoundingBox: { Height: 0.18, Left: 0.55, Top: 0.33, Width: 0.23 },
        },
      ],
    });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    expect(mockRekognitionCommands.detectFaces).toHaveBeenCalledWith({
      Image: { Bytes: buffer },
    });
    expect(result["options"].input).not.toEqual(originalImage);
  });

  it("should format to png before call to rekognition regardless of toFormat ", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", // PNG
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const edits: ImageEdits = {
      toFormat: "webp",
      smartCrop: { padding: 60 },
    };

    // Mock
    mockRekognitionCommands.detectFaces.mockResolvedValue({
      FaceDetails: [
        {
          BoundingBox: { Height: 0.18, Left: 0.55, Top: 0.33, Width: 0.23 },
        },
      ],
    });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    await imageHandler.applyEdits(image, edits, false);

    // Rekognition should have been called with a png image, regardless of the toFormat edit
    expect((await sharp(mockRekognitionCommands.detectFaces.mock.calls[0][0].Image.Bytes).metadata()).format).toEqual(
      "png"
    );
  });

  it("Should pass if an excessive padding value is passed to the smartCrop filter", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const buffer = await image.toBuffer();
    const edits: ImageEdits = { smartCrop: { faceIndex: 0, padding: 80 } };

    // Mock
    mockRekognitionCommands.detectFaces.mockResolvedValue({
      FaceDetails: [
        {
          BoundingBox: { Height: 0.18, Left: 0.55, Top: 0.33, Width: 0.23 },
        },
      ],
    });

    // Act
    try {
      const imageHandler = new ImageHandler(s3Client, rekognitionClient);
      await imageHandler.applyEdits(image, edits, false);
    } catch (error) {
      // Assert
      expect(mockRekognitionCommands.detectFaces).toHaveBeenCalledWith({
        Image: { Bytes: buffer },
      });
      expect(error).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        code: "SmartCrop::PaddingOutOfBounds",
        message:
          "The padding value you provided exceeds the boundaries of the original image. Please try choosing a smaller value or applying padding via Sharp for greater specificity.",
      });
    }
  });

  it("Should pass if an excessive faceIndex value is passed to the smartCrop filter", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const buffer = await image.toBuffer();
    const edits: ImageEdits = { smartCrop: { faceIndex: 10, padding: 0 } };

    // Mock
    mockRekognitionCommands.detectFaces.mockResolvedValue({
      FaceDetails: [
        {
          BoundingBox: { Height: 0.18, Left: 0.55, Top: 0.33, Width: 0.23 },
        },
      ],
    });

    // Act
    try {
      const imageHandler = new ImageHandler(s3Client, rekognitionClient);
      await imageHandler.applyEdits(image, edits, false);
    } catch (error) {
      // Assert
      expect(mockRekognitionCommands.detectFaces).toHaveBeenCalledWith({
        Image: { Bytes: buffer },
      });
      expect(error).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        code: "SmartCrop::FaceIndexOutOfRange",
        message:
          "You have provided a FaceIndex value that exceeds the length of the zero-based detectedFaces array. Please specify a value that is in-range.",
      });
    }
  });

  it("Should pass if a faceIndex value of undefined is passed to the smartCrop filter", async () => {
    // Arrange
    const originalImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = sharp(originalImage, { failOnError: false }).withMetadata();
    const buffer = await image.toBuffer();
    const edits: ImageEdits = { smartCrop: true };

    // Mock
    mockRekognitionCommands.detectFaces.mockResolvedValue({
      FaceDetails: [
        {
          BoundingBox: { Height: 0.18, Left: 0.55, Top: 0.33, Width: 0.23 },
        },
      ],
    });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.applyEdits(image, edits, false);

    // Assert
    expect(mockRekognitionCommands.detectFaces).toHaveBeenCalledWith({
      Image: { Bytes: buffer },
    });
    expect(result["options"].input).not.toEqual(originalImage); // eslint-disable-line dot-notation
  });

  it("Should pass if the crop area can be calculated using a series of valid inputs/parameters", () => {
    // Arrange
    const boundingBox: BoundingBox = {
      height: 0.18,
      left: 0.55,
      top: 0.33,
      width: 0.23,
    };
    const metadata: BoxSize = { width: 200, height: 400 };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = imageHandler.getCropArea(boundingBox, 20, metadata);

    // Assert
    const expectedResult: BoundingBox = {
      left: 90,
      top: 112,
      width: 86,
      height: 112,
    };
    expect(result).toEqual(expectedResult);
  });

  it("Should pass if the crop area is beyond the range of the image after padding is applied", () => {
    // Arrange
    const boundingBox: BoundingBox = {
      height: 0.18,
      left: 0.55,
      top: 0.33,
      width: 0.23,
    };
    const metadata: BoxSize = { width: 200, height: 400 };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = imageHandler.getCropArea(boundingBox, 500, metadata);

    // Assert
    const expectedResult: BoundingBox = {
      left: 0,
      top: 0,
      width: 200,
      height: 400,
    };
    expect(result).toEqual(expectedResult);
  });

  it("Should pass if the proper parameters are passed to the function", async () => {
    // Arrange
    const currentImage = Buffer.from("TestImageData");
    const faceIndex = 0;

    // Mock
    mockRekognitionCommands.detectFaces.mockResolvedValue({
      FaceDetails: [
        {
          BoundingBox: { Height: 0.18, Left: 0.55, Top: 0.33, Width: 0.23 },
        },
      ],
    });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.getBoundingBox(currentImage, faceIndex);

    // Assert
    const expectedResult: BoundingBox = {
      height: 0.18,
      left: 0.55,
      top: 0.33,
      width: 0.23,
    };
    expect(mockRekognitionCommands.detectFaces).toHaveBeenCalledWith({
      Image: { Bytes: currentImage },
    });
    expect(result).toEqual(expectedResult);
  });

  it("Should simulate an error condition returned by Rekognition", async () => {
    // Arrange
    const currentImage = Buffer.from("NotTestImageData");
    const faceIndex = 0;

    // Mock
    mockRekognitionCommands.detectFaces.mockRejectedValue(
      new ImageHandlerError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "SmartCrop::Error",
        "Smart Crop could not be applied. Please contact the system administrator."
      )
    );

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.getBoundingBox(currentImage, faceIndex);
    } catch (error) {
      // Assert
      expect(mockRekognitionCommands.detectFaces).toHaveBeenCalledWith({
        Image: { Bytes: currentImage },
      });
      expect(error).toMatchObject({
        status: StatusCodes.INTERNAL_SERVER_ERROR,
        code: "SmartCrop::Error",
        message: "Smart Crop could not be applied. Please contact the system administrator.",
      });
    }
  });

  it("Should pass if no faces are detected", async () => {
    // Arrange
    const currentImage = Buffer.from("TestImageData");
    const faceIndex = 0;

    // Mock
    mockRekognitionCommands.detectFaces.mockResolvedValue({ FaceDetails: [] });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.getBoundingBox(currentImage, faceIndex);

    // Assert
    const expectedResult: BoundingBox = {
      height: 1,
      left: 0,
      top: 0,
      width: 1,
    };
    expect(mockRekognitionCommands.detectFaces).toHaveBeenCalledWith({
      Image: { Bytes: currentImage },
    });
    expect(result).toEqual(expectedResult);
  });

  it("Should pass if bounds detected go beyond the image dimensions", async () => {
    // Arrange
    const currentImage = Buffer.from("TestImageData");
    const faceIndex = 0;

    // Mock
    mockRekognitionCommands.detectFaces.mockResolvedValue({
      FaceDetails: [
        {
          BoundingBox: { Height: 1, Left: 0.5, Top: 0.3, Width: 0.65 },
        },
      ],
    });

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    const result = await imageHandler.getBoundingBox(currentImage, faceIndex);

    // Assert
    const expectedResult: BoundingBox = {
      height: 0.7,
      left: 0.5,
      top: 0.3,
      width: 0.5,
    };
    expect(mockRekognitionCommands.detectFaces).toHaveBeenCalledWith({
      Image: { Bytes: currentImage },
    });
    expect(result).toEqual(expectedResult);
  });
});

describe("handleBounds", () => {
  it("Should set bounding box with a bounding box that matches rekognition when the bounds are within the image size", () => {
    // Arrange
    const boundingBox = {};
    const rekognitionResponse = {
      FaceDetails: [
        {
          AgeRange: {
            High: 43,
            Low: 26,
          },
          BoundingBox: {
            Height: 0.6968063116073608,
            Left: 0.26937249302864075,
            Top: 0.11424895375967026,
            Width: 0.42325547337532043,
          },
        },
      ],
    };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["handleBounds"](rekognitionResponse, 0, boundingBox);

    // Assert
    expect(boundingBox).toEqual({
      Height: 0.6968063116073608,
      Left: 0.26937249302864075,
      Top: 0.11424895375967026,
      Width: 0.42325547337532043,
    });
  });

  it("Should set bounding box with a bounding box with width set to (1 - left) when the bounds are wider than the image", () => {
    // Arrange
    const boundingBox = {};
    const rekognitionResponse = {
      FaceDetails: [
        {
          AgeRange: {
            High: 43,
            Low: 26,
          },
          BoundingBox: {
            Height: 0.6968063116073608,
            Left: 0.76937249302864075,
            Top: 0.11424895375967026,
            Width: 0.42325547337532043,
          },
        },
      ],
    };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["handleBounds"](rekognitionResponse, 0, boundingBox);

    // Assert
    expect(boundingBox).toEqual({
      Height: 0.6968063116073608,
      Left: 0.76937249302864075,
      Top: 0.11424895375967026,
      Width: 1 - 0.76937249302864075,
    });
  });

  it("Should set bounding box with a bounding box with height set to (1 - top) when the bounds are wider than the image", () => {
    // Arrange
    const boundingBox = {};
    const rekognitionResponse = {
      FaceDetails: [
        {
          AgeRange: {
            High: 43,
            Low: 26,
          },
          BoundingBox: {
            Height: 0.6968063116073608,
            Left: 0.26937249302864075,
            Top: 0.5142489537596702,
            Width: 0.42325547337532043,
          },
        },
      ],
    };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["handleBounds"](rekognitionResponse, 0, boundingBox);

    // Assert
    expect(boundingBox).toEqual({
      Height: 1 - 0.5142489537596702,
      Left: 0.26937249302864075,
      Top: 0.5142489537596702,
      Width: 0.42325547337532043,
    });
  });

  it("Should set bounding box with a height set to (1 - top) when height is greater than the 1", () => {
    // Arrange
    const boundingBox = {};
    const rekognitionResponse = {
      FaceDetails: [
        {
          AgeRange: {
            High: 43,
            Low: 26,
          },
          BoundingBox: {
            Height: 1.6968063116073608,
            Left: 0.26937249302864075,
            Top: 0.11424895375967026,
            Width: 0.42325547337532043,
          },
        },
      ],
    };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["handleBounds"](rekognitionResponse, 0, boundingBox);

    // Assert
    expect(boundingBox).toEqual({
      Height: 1 - 0.11424895375967026,
      Left: 0.26937249302864075,
      Top: 0.11424895375967026,
      Width: 0.42325547337532043,
    });
  });

  it("Should set bounding box with a height set to (1 - left) when width is greater than the 1", () => {
    // Arrange
    const boundingBox = {};
    const rekognitionResponse = {
      FaceDetails: [
        {
          AgeRange: {
            High: 43,
            Low: 26,
          },
          BoundingBox: {
            Height: 0.6968063116073608,
            Left: 0.26937249302864075,
            Top: 0.11424895375967026,
            Width: 5.42325547337532043,
          },
        },
      ],
    };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["handleBounds"](rekognitionResponse, 0, boundingBox);

    // Assert
    expect(boundingBox).toEqual({
      Height: 0.6968063116073608,
      Left: 0.26937249302864075,
      Top: 0.11424895375967026,
      Width: 1 - 0.26937249302864075,
    });
  });

  it("Should set bounding box with a top set to 1 when top is greater than the 1", () => {
    // Arrange
    const boundingBox = {};
    const rekognitionResponse = {
      FaceDetails: [
        {
          AgeRange: {
            High: 43,
            Low: 26,
          },
          BoundingBox: {
            Height: 0.6968063116073608,
            Left: 0.26937249302864075,
            Top: 1.11424895375967026,
            Width: 5.42325547337532043,
          },
        },
      ],
    };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["handleBounds"](rekognitionResponse, 0, boundingBox);

    // Assert
    expect(boundingBox).toEqual({
      Height: 0,
      Left: 0.26937249302864075,
      Top: 1,
      Width: 1 - 0.26937249302864075,
    });
  });

  it("Should set bounding box with a top set to 0 when top is less than the 0", () => {
    // Arrange
    const boundingBox = {};
    const rekognitionResponse = {
      FaceDetails: [
        {
          AgeRange: {
            High: 43,
            Low: 26,
          },
          BoundingBox: {
            Height: 0.6968063116073608,
            Left: 0.26937249302864075,
            Top: -0.11424895375967026,
            Width: 5.42325547337532043,
          },
        },
      ],
    };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["handleBounds"](rekognitionResponse, 0, boundingBox);

    // Assert
    expect(boundingBox).toEqual({
      Height: 0.6968063116073608,
      Left: 0.26937249302864075,
      Top: 0,
      Width: 1 - 0.26937249302864075,
    });
  });

  it("Should set bounding box with a left set to 1 when left is greater than the 1", () => {
    // Arrange
    const boundingBox = {};
    const rekognitionResponse = {
      FaceDetails: [
        {
          AgeRange: {
            High: 43,
            Low: 26,
          },
          BoundingBox: {
            Height: 0.6968063116073608,
            Left: 8.26937249302864075,
            Top: 0.11424895375967026,
            Width: 0.42325547337532043,
          },
        },
      ],
    };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["handleBounds"](rekognitionResponse, 0, boundingBox);

    // Assert
    expect(boundingBox).toEqual({
      Height: 0.6968063116073608,
      Left: 1,
      Top: 0.11424895375967026,
      Width: 0,
    });
  });

  it("Should set bounding box with a left set to 0 when left is less than the 0", () => {
    // Arrange
    const boundingBox = {};
    const rekognitionResponse = {
      FaceDetails: [
        {
          AgeRange: {
            High: 43,
            Low: 26,
          },
          BoundingBox: {
            Height: 0.6968063116073608,
            Left: -0.26937249302864075,
            Top: 0.11424895375967026,
            Width: 0.42325547337532043,
          },
        },
      ],
    };
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);

    // Act
    imageHandler["handleBounds"](rekognitionResponse, 0, boundingBox);

    // Assert
    expect(boundingBox).toEqual({
      Height: 0.6968063116073608,
      Left: 0,
      Top: 0.11424895375967026,
      Width: 0.42325547337532043,
    });
  });
});
