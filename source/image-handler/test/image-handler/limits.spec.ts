// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";

import { ImageHandler } from "../../image-handler";
import { ImageRequestInfo, RequestTypes, StatusCodes } from "../../lib";

const s3Client = new S3Client();
const rekognitionClient = new RekognitionClient();

describe("limits", () => {
  it("Should fail the return payload is larger than 6MB", async () => {
    // Arrange
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "sample-image-001.jpg",
      originalImage: Buffer.alloc(6 * 1024 * 1024),
    };

    // Act
    const imageHandler = new ImageHandler(s3Client, rekognitionClient);
    try {
      await imageHandler.process(request);
    } catch (error) {
      // Assert
      expect(error).toMatchObject({
        status: StatusCodes.REQUEST_TOO_LONG,
        code: "TooLargeImageException",
        message: "The converted image is too large to return.",
      });
    }
  });
});
