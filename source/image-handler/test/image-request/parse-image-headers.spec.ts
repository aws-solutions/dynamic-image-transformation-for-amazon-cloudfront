// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { ImageRequest } from "../../image-request";
import { RequestTypes } from "../../lib";
import { SecretProvider } from "../../secret-provider";

describe("parseImageHeaders", () => {
  const s3Client = new S3Client();
  const secretsManager = new SecretsManagerClient();
  const secretProvider = new SecretProvider(secretsManager);

  it("001/Should return headers if headers are provided for a sample base64-encoded image request", () => {
    // Arrange
    const event = {
      path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiaGVhZGVycyI6eyJDYWNoZS1Db250cm9sIjoibWF4LWFnZT0zMTUzNjAwMCxwdWJsaWMifSwib3V0cHV0Rm9ybWF0IjoianBlZyJ9",
    };

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.parseImageHeaders(event, RequestTypes.DEFAULT);

    // Assert
    const expectedResult = {
      "Cache-Control": "max-age=31536000,public",
    };
    expect(result).toEqual(expectedResult);
  });

  it("001/Should remove restricted headers if included with a base64-encoded image request", () => {
    //Arrange
    /** Includes restricted headers:
     *  'Transfer-encoding',
     *  'x-api-key',
     *  'x-amz-header',
     *  'content-type',
     *  'Access-Control-Allow-Origin'
     **/
    const event = {
      path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5IiwiaGVhZGVycyI6eyJDYWNoZS1Db250cm9sIjoibWF4LWFnZT0zMTUzNjAwMCxwdWJsaWMiLCAiVHJhbnNmZXItZW5jb2RpbmciOiAidmFsdWUiLCAieC1hcGkta2V5IjogInZhbHVlIiwgIngtYW16LWhlYWRlciI6ICJ2YWx1ZSIsICJjb250ZW50LXR5cGUiOiAiaHRtbCIsICJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4iOiAiKiJ9LCJvdXRwdXRGb3JtYXQiOiJqcGVnIn0=",
    };
    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.parseImageHeaders(event, RequestTypes.DEFAULT);

    // Assert
    const expectedResult = {
      "Cache-Control": "max-age=31536000,public",
    };
    expect(result).toEqual(expectedResult);
  });

  it("001/Should return undefined if headers are not provided for a base64-encoded image request", () => {
    // Arrange
    const event = {
      path: "/eyJidWNrZXQiOiJ2YWxpZEJ1Y2tldCIsImtleSI6InZhbGlkS2V5In0=",
    };

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.parseImageHeaders(event, RequestTypes.DEFAULT);

    // Assert
    expect(result).toEqual(undefined);
  });

  it("001/Should return undefined for Thumbor or Custom requests", () => {
    // Arrange
    const event = { path: "/test.jpg" };

    // Act
    const imageRequest = new ImageRequest(s3Client, secretProvider);
    const result = imageRequest.parseImageHeaders(event, RequestTypes.THUMBOR);

    // Assert
    expect(result).toEqual(undefined);
  });
});
