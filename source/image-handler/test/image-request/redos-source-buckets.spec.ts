// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { ImageRequest } from "../../image-request";
import { RequestTypes } from "../../lib";
import { SecretProvider } from "../../secret-provider";

// Reproduces V1600765004: a malicious bucket name injected into the SOURCE_BUCKETS Lambda environment
// variable is selected by a Thumbor request and then used to build a RegExp in parseImageKey.
describe("V1600765004 - ReDoS via SOURCE_BUCKETS", () => {
  const OLD_ENV = process.env;
  const imageRequest = new ImageRequest(new S3Client(), new SecretProvider(new SecretsManagerClient()));

  // Thumbor path payload from the finding
  const thumborPayload = "a".repeat(25) + "!";

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.spyOn(console, "info").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  const runThumborRequest = (maliciousBucket: string) => {
    process.env.SOURCE_BUCKETS = `valid-bucket, ${maliciousBucket}`;
    const event = { path: `/s3:${maliciousBucket}/s3:${thumborPayload}/image.jpg` };

    const start = Date.now();
    const bucket = imageRequest.parseImageBucket(event, RequestTypes.THUMBOR);
    const key = imageRequest.parseImageKey(event, RequestTypes.THUMBOR, bucket);
    const elapsedMs = Date.now() - start;

    process.stdout.write(
      `\n  [${maliciousBucket}] bucket=${JSON.stringify(bucket)} key=${JSON.stringify(key)} elapsed=${elapsedMs}ms\n`
    );
    return { bucket, elapsedMs };
  };

  it.each(["(a|a?)$", "(a|a?)+$"])(
    "Should not select the injected bucket %p and should complete within 1s",
    (maliciousBucket) => {
      const { bucket, elapsedMs } = runThumborRequest(maliciousBucket);

      expect(elapsedMs).toBeLessThan(1000);
      // Invalid bucket is filtered out, so no s3: tag matches and the first valid bucket is used as the default
      expect(bucket).toEqual("valid-bucket");
    }
  );
});
