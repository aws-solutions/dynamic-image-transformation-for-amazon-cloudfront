// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import fs from "fs";

import { ImageHandler } from "../../image-handler";
import { ContentTypes, ImageRequestInfo, RequestTypes } from "../../lib";

const s3Client = new S3Client();
const rekognitionClient = new RekognitionClient();
const image = fs.readFileSync("./test/image/25x15.png");
const gifImage = fs.readFileSync("./test/image/transparent-5x5-2page.gif");

describe("animated", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("Should create non animated image if the input image is a GIF but does not have multiple pages", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.GIF,
      bucket: "sample-bucket",
      key: "sample-image-001.gif",
      edits: { grayscale: true },
      originalImage: image,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledTimes(2);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: true,
    });
  });

  it("Should create animated image if the input image is GIF and has multiple pages", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.GIF,
      bucket: "sample-bucket",
      key: "sample-image-001.gif",
      edits: { grayscale: true },
      originalImage: gifImage,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledTimes(1);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: true,
      limitInputPixels: true,
    });
  });

  it("Should create non animated image if the input image is not a GIF", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.PNG,
      bucket: "sample-bucket",
      key: "sample-image-001.png",
      edits: { grayscale: true },
      originalImage: image,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledTimes(1);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: true,
    });
  });

  it("Should create non animated image if AutoWebP is enabled and the animated edit is not provided", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.WEBP,
      bucket: "sample-bucket",
      key: "sample-image-001.gif",
      edits: { grayscale: true },
      originalImage: gifImage,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledTimes(1);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: true,
    });
  });

  it("Should create animated image if AutoWebP is enabled and the animated edit is true", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.WEBP,
      bucket: "sample-bucket",
      key: "sample-image-001.gif",
      edits: { grayscale: true, animated: true },
      originalImage: gifImage,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledTimes(1);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: true,
      limitInputPixels: true,
    });
  });

  it("Should create non animated image if image is multipage gif, but animated edit is set to false", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.GIF,
      bucket: "sample-bucket",
      key: "sample-image-001.gif",
      edits: { grayscale: true, animated: false },
      originalImage: gifImage,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledTimes(1);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: true,
    });
  });

  it("Should attempt to create animated image if animated edit is set to true, regardless of original image and content type", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.PNG,
      bucket: "sample-bucket",
      key: "sample-image-001.png",
      edits: { grayscale: true, animated: true },
      originalImage: image,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledTimes(2);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: true,
    });
  });
});
