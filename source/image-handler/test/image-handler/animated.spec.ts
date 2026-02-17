// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Rekognition from "aws-sdk/clients/rekognition";
import S3 from "aws-sdk/clients/s3";
import fs from "fs";

import { ImageHandler } from "../../image-handler";
import { ContentTypes, ImageRequestInfo, RequestTypes } from "../../lib";

const s3Client = new S3();
const rekognitionClient = new Rekognition();
const image = fs.readFileSync("./test/image/25x15.png");

describe("animated", () => {
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
    });
  });

  it("Should create animated image if the input image is GIF and has multiple pages", async () => {
    // Arrange
    const gifImage = fs.readFileSync("./test/image/transparent-5x5-2page.gif");
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
    });
  });
});
