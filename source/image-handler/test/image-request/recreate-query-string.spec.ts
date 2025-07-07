// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { ImageRequest } from "../../image-request";
import { SecretProvider } from "../../secret-provider";

describe("recreateQueryString", () => {
  const s3Client = new S3Client();
  const secretsManager = new SecretsManagerClient();
  const secretProvider = new SecretProvider(secretsManager);

  it("Should accurately recreate query strings", () => {
    const testCases = [
      {
        // Signature should be removed
        queryParams: { signature: "test-signature", expires: "test-expires", format: "png" },
        expected: "expires=test-expires&format=png",
      },
      {
        queryParams: { grayscale: "true", expires: "test-expires", format: "png" },
        expected: "expires=test-expires&format=png&grayscale=true",
      },
      {
        queryParams: {
          signature: "test-signature",
          expires: "test-expires",
          format: "png",
          fit: "cover",
          width: "100",
          height: "100",
          rotate: "90",
          flip: "true",
          flop: "true",
          grayscale: "true",
        },

        expected:
          "expires=test-expires&fit=cover&flip=true&flop=true&format=png&grayscale=true&height=100&rotate=90&width=100",
      },
    ];

    const imageRequest = new ImageRequest(s3Client, secretProvider);
    testCases.forEach(({ queryParams, expected }) => {
      // @ts-ignore
      const result = imageRequest.recreateQueryString(queryParams);
      expect(result).toEqual(expected);
    });
  });
});
