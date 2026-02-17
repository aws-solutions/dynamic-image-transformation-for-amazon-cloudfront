// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import S3 from "aws-sdk/clients/s3";
import SecretsManager from "aws-sdk/clients/secretsmanager";

import { ImageRequest } from "../../image-request";
import { SecretProvider } from "../../secret-provider";

describe("inferImageType", () => {
  const s3Client = new S3();
  const secretsManager = new SecretsManager();
  const secretProvider = new SecretProvider(secretsManager);

  test.each([
    { value: "FFD8FFDB" },
    { value: "FFD8FFE0" },
    { value: "FFD8FFED" },
    { value: "FFD8FFEE" },
    { value: "FFD8FFE1" },
    { value: "FFD8FFE2" },
  ])('Should pass if it returns "image/jpeg" for a magic number of $value', ({ value }) => {
    const byteValues = value.match(/.{1,2}/g).map((x) => parseInt(x, 16));
    const imageBuffer = Buffer.from(byteValues.concat(new Array(8).fill(0x00)));

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.inferImageType(imageBuffer);

    // Assert
    expect(result).toEqual("image/jpeg");
  });

  it("Should pass throw an exception", () => {
    // Arrange
    const imageBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

    try {
      // Act
      const imageRequest = new ImageRequest(s3Client, secretProvider);
      imageRequest.inferImageType(imageBuffer);
    } catch (error) {
      // Assert
      expect(error.status).toEqual(500);
      expect(error.code).toEqual("RequestTypeError");
      expect(error.message).toEqual(
        "The file does not have an extension and the file type could not be inferred. Please ensure that your original image is of a supported file type (jpg, png, tiff, webp, svg). Refer to the documentation for additional guidance on forming image requests."
      );
    }
  });
});
