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

describe("limit-input-pixels", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("Should resort to default input image limit when not provided", async () => {
    // Arrange
    process.env.SHARP_SIZE_LIMIT = undefined;
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.JPEG,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      edits: { grayscale: true },
      originalImage: image,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: true,
    });
  });

  it("Should resort to default input image limit when not provided ", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.JPEG,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      edits: { grayscale: true },
      originalImage: image,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: true,
    });
  });

  it("Should use default input image limit when limit is Default ", async () => {
    // Arrange
    process.env.SHARP_SIZE_LIMIT = "Default";
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.JPEG,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      edits: { grayscale: true },
      originalImage: image,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: true,
    });
  });

  it("Should use defined input image limit when limit is a number ", async () => {
    // Arrange
    process.env.SHARP_SIZE_LIMIT = "1000000";
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.JPEG,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      edits: { grayscale: true },
      originalImage: image,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: 1000000,
    });
  });

  it("Should resort to default input image limit when Invalid value is provided", async () => {
    // Arrange
    process.env.SHARP_SIZE_LIMIT = "Invalid";
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.JPEG,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      edits: { grayscale: true },
      originalImage: image,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: true,
    });
  });

  it("Should resort to infinite input image limit when 0 is provided", async () => {
    // Arrange
    process.env.SHARP_SIZE_LIMIT = "0";
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.JPEG,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      edits: { grayscale: true },
      originalImage: image,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: 0,
    });
  });

  it("Should resort to default input image limit when empty string is provided", async () => {
    // Arrange
    process.env.SHARP_SIZE_LIMIT = "";
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.JPEG,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      edits: { grayscale: true },
      originalImage: image,
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    // SpyOn InstantiateSharpImage
    const instantiateSpy = jest.spyOn<any, "instantiateSharpImage">(imageHandler, "instantiateSharpImage");
    await imageHandler.process(request);
    expect(instantiateSpy).toHaveBeenCalledWith(request.originalImage, request.edits, {
      failOnError: false,
      animated: false,
      limitInputPixels: true,
    });
  });
});
