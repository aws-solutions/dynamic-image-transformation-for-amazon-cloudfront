// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SecretsManager from "aws-sdk/clients/secretsmanager";

import {
  handleProgressiveLoading,
  getAvifCacheKey,
  getAvifFromS3Cache,
  storeAvifToS3Cache,
  clientSupportsAvif,
} from "../progressive-loader";
import { SecretProvider } from "../secret-provider";
import { StatusCodes } from "../lib";

// Mock Lambda client - need to define inside mock to avoid hoisting issues
const mockLambdaInvokePromise = jest.fn().mockResolvedValue({});
const mockLambdaInvoke = jest.fn().mockReturnValue({
  promise: mockLambdaInvokePromise,
});

jest.mock("aws-sdk/clients/lambda", () => {
  return jest.fn().mockImplementation(() => ({
    invoke: (...args: any[]) => mockLambdaInvoke(...args),
  }));
});

// Mock S3 client
const mockS3GetObjectPromise = jest.fn();
const mockS3PutObjectPromise = jest.fn();
const mockS3GetObject = jest.fn().mockReturnValue({ promise: mockS3GetObjectPromise });
const mockS3PutObject = jest.fn().mockReturnValue({ promise: mockS3PutObjectPromise });

jest.mock("aws-sdk/clients/s3", () => {
  return jest.fn().mockImplementation(() => ({
    getObject: (...args: any[]) => mockS3GetObject(...args),
    putObject: (...args: any[]) => mockS3PutObject(...args),
  }));
});

// Mock AWS SDK SecretsManager
jest.mock("aws-sdk/clients/secretsmanager", () => jest.fn(() => ({})));

describe("ProgressiveLoader", () => {
  const secretsManager = new SecretsManager();
  const secretProvider = new SecretProvider(secretsManager);

  beforeEach(() => {
    jest.clearAllMocks();
    mockLambdaInvoke.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });
    // Default: S3 cache miss
    mockS3GetObjectPromise.mockRejectedValue({ code: "NoSuchKey" });
    mockS3PutObjectPromise.mockResolvedValue({});
    delete process.env.ENABLE_SIGNATURE;
    delete process.env.SECRETS_MANAGER;
    delete process.env.SECRET_KEY;
    delete process.env.CLOUDFRONT_DOMAIN;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.SOURCE_BUCKETS;
    delete process.env.AVIF_CACHE_BUCKET;
  });

  describe("clientSupportsAvif", () => {
    it("should return true when fmt query param is 'avif'", () => {
      const event = {
        path: "/base64payload",
        queryStringParameters: { fmt: "avif" as const },
      };

      expect(clientSupportsAvif(event)).toBe(true);
    });

    it("should return false when fmt query param is 'jpeg'", () => {
      const event = {
        path: "/base64payload",
        queryStringParameters: { fmt: "jpeg" as const },
      };

      expect(clientSupportsAvif(event)).toBe(false);
    });

    it("should prioritize fmt query param over Accept header", () => {
      const event = {
        path: "/base64payload",
        queryStringParameters: { fmt: "jpeg" as const },
        headers: { Accept: "image/avif,image/webp,*/*" },
      };

      expect(clientSupportsAvif(event)).toBe(false);
    });

    it("should return true when Accept header includes image/avif (fallback)", () => {
      const event = {
        path: "/base64payload",
        headers: { Accept: "image/avif,image/webp,image/*,*/*" },
      };

      expect(clientSupportsAvif(event)).toBe(true);
    });

    it("should return true when accept header (lowercase) includes image/avif", () => {
      const event = {
        path: "/base64payload",
        headers: { accept: "image/avif,image/webp,*/*" },
      };

      expect(clientSupportsAvif(event)).toBe(true);
    });

    it("should return false when Accept header does not include image/avif", () => {
      const event = {
        path: "/base64payload",
        headers: { Accept: "image/webp,image/*,*/*" },
      };

      expect(clientSupportsAvif(event)).toBe(false);
    });

    it("should return false when Accept header is empty", () => {
      const event = {
        path: "/base64payload",
        headers: { Accept: "" },
      };

      expect(clientSupportsAvif(event)).toBe(false);
    });

    it("should return false when headers is undefined", () => {
      const event = {
        path: "/base64payload",
      };

      expect(clientSupportsAvif(event)).toBe(false);
    });

    it("should return false when Accept header is missing", () => {
      const event = {
        path: "/base64payload",
        headers: { "Content-Type": "application/json" },
      };

      expect(clientSupportsAvif(event)).toBe(false);
    });
  });

  describe("getAvifCacheKey", () => {
    it("should generate Paperclip-style path using style from payload", () => {
      const payload = {
        key: "item_images/assets/2/000/076/056/original/3-1.jpg",
        edits: {
          resize: { w: 750, h: 473 },
          avif: { q: 70, style: "sm" },
        },
      };

      const cacheKey = getAvifCacheKey(payload);

      expect(cacheKey).toBe("item_images/assets/2/000/076/056/sm/3-1.avif");
    });

    it("should use xs style when provided", () => {
      const payload = {
        key: "item_images/assets/2/000/076/056/original/photo.png",
        edits: {
          resize: { w: 250, h: 157 },
          avif: { q: 70, style: "xs" },
        },
      };

      const cacheKey = getAvifCacheKey(payload);

      expect(cacheKey).toBe("item_images/assets/2/000/076/056/xs/photo.avif");
    });

    it("should use lg style when provided", () => {
      const payload = {
        key: "item_images/assets/2/000/076/056/original/image.jpg",
        edits: {
          resize: { w: 1200, h: 756 },
          avif: { q: 70, style: "lg" },
        },
      };

      const cacheKey = getAvifCacheKey(payload);

      expect(cacheKey).toBe("item_images/assets/2/000/076/056/lg/image.avif");
    });

    it("should use xl style when provided", () => {
      const payload = {
        key: "item_images/assets/5/000/123/456/original/large.jpeg",
        edits: {
          resize: { w: 2000, h: 1260 },
          avif: { q: 70, style: "xl" },
        },
      };

      const cacheKey = getAvifCacheKey(payload);

      expect(cacheKey).toBe("item_images/assets/5/000/123/456/xl/large.avif");
    });

    it("should return null when style is not provided", () => {
      const payload = {
        key: "item_images/assets/2/000/076/056/original/custom.jpg",
        edits: {
          resize: { w: 750, h: 473 },
          avif: { q: 70 },
        },
      };

      const cacheKey = getAvifCacheKey(payload);

      expect(cacheKey).toBeNull();
    });

    it("should generate consistent keys for same payload", () => {
      const payload = {
        key: "item_images/assets/2/000/076/056/original/3-1.jpg",
        edits: {
          resize: { w: 750, h: 473 },
          avif: { q: 70, style: "sm" },
        },
      };

      const key1 = getAvifCacheKey(payload);
      const key2 = getAvifCacheKey(payload);

      expect(key1).toBe(key2);
    });
  });

  describe("getAvifFromS3Cache", () => {
    it("should return buffer on cache hit", async () => {
      process.env.AVIF_CACHE_BUCKET = "avif-cache-bucket";
      const fakeAvifData = Buffer.from([0x00, 0x00, 0x00, 0x1c]);
      mockS3GetObjectPromise.mockResolvedValue({ Body: fakeAvifData });

      const result = await getAvifFromS3Cache("avif_cache/test.avif");

      expect(result).toEqual(fakeAvifData);
      expect(mockS3GetObject).toHaveBeenCalledWith({
        Bucket: "avif-cache-bucket",
        Key: "avif_cache/test.avif",
      });
    });

    it("should return null when AVIF_CACHE_BUCKET is not set", async () => {
      const result = await getAvifFromS3Cache("avif_cache/test.avif");

      expect(result).toBeNull();
      expect(mockS3GetObject).not.toHaveBeenCalled();
    });

    it("should return null on NoSuchKey error (cache miss)", async () => {
      process.env.AVIF_CACHE_BUCKET = "avif-cache-bucket";
      mockS3GetObjectPromise.mockRejectedValue({ code: "NoSuchKey" });

      const result = await getAvifFromS3Cache("avif_cache/test.avif");

      expect(result).toBeNull();
    });

    it("should return null on other S3 errors (fail open)", async () => {
      process.env.AVIF_CACHE_BUCKET = "avif-cache-bucket";
      mockS3GetObjectPromise.mockRejectedValue(new Error("Network error"));

      const result = await getAvifFromS3Cache("avif_cache/test.avif");

      expect(result).toBeNull();
    });
  });

  describe("storeAvifToS3Cache", () => {
    it("should store AVIF to S3 with correct parameters including ONEZONE_IA storage class", async () => {
      process.env.AVIF_CACHE_BUCKET = "avif-cache-bucket";
      const avifBuffer = Buffer.from([0x00, 0x00, 0x00, 0x1c]);
      mockS3PutObjectPromise.mockResolvedValue({});

      await storeAvifToS3Cache("avif_cache/test.avif", avifBuffer);

      expect(mockS3PutObject).toHaveBeenCalledWith({
        Bucket: "avif-cache-bucket",
        Key: "avif_cache/test.avif",
        Body: avifBuffer,
        ContentType: "image/avif",
        CacheControl: "max-age=31536000,public",
        StorageClass: "ONEZONE_IA",
      });
    });

    it("should skip storage when AVIF_CACHE_BUCKET is not set", async () => {
      const avifBuffer = Buffer.from([0x00, 0x00, 0x00, 0x1c]);

      await storeAvifToS3Cache("avif_cache/test.avif", avifBuffer);

      expect(mockS3PutObject).not.toHaveBeenCalled();
    });
  });

  describe("handleProgressiveLoading", () => {
    it("should return 302 redirect to JPEG URL when S3 cache misses", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AVIF_CACHE_BUCKET = "avif-cache-bucket";
      mockS3GetObjectPromise.mockRejectedValue({ code: "NoSuchKey" });

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
        },
      };

      const payload = {
        bucket: "test-bucket",
        efs: true,
        key: "item_images/test.jpg",
        edits: {
          resize: { w: 750, h: 473, fit: "inside" },
          avif: { q: 70, style: "sm" },
          jpeg: { q: 85 },
        },
      };

      const result = await handleProgressiveLoading(event, payload, secretProvider);

      expect(result.statusCode).toBe(StatusCodes.REDIRECT);
      expect(result.isBase64Encoded).toBe(false);
      expect(result.headers?.Location).toContain("https://d1234.cloudfront.net/");
      expect(result.headers?.["Cache-Control"]).toBe("private, max-age=60");
      expect(mockS3GetObject).toHaveBeenCalled();
    });

    it("should return AVIF directly when S3 cache hits", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AVIF_CACHE_BUCKET = "avif-cache-bucket";

      const fakeAvifData = Buffer.from([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
      mockS3GetObjectPromise.mockResolvedValue({ Body: fakeAvifData });

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
          Accept: "image/avif,image/webp,*/*",
        },
      };

      const payload = {
        bucket: "test-bucket",
        key: "item_images/test.jpg",
        edits: {
          resize: { w: 750, h: 473, fit: "inside" },
          avif: { q: 70, style: "sm" },
          jpeg: { q: 85 },
        },
      };

      const result = await handleProgressiveLoading(event, payload, secretProvider);

      expect(result.statusCode).toBe(StatusCodes.OK);
      expect(result.isBase64Encoded).toBe(true);
      expect(result.headers?.["Content-Type"]).toBe("image/avif");
      expect(result.headers?.["Cache-Control"]).toBe("max-age=31536000,public");
      expect(result.body).toBe(fakeAvifData.toString("base64"));
    });

    it("should generate JPEG URL without avif in edits", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AVIF_CACHE_BUCKET = "avif-cache-bucket";
      mockS3GetObjectPromise.mockRejectedValue({ code: "NoSuchKey" });

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
        },
      };

      const payload = {
        bucket: "test-bucket",
        key: "item_images/test.jpg",
        edits: {
          resize: { w: 750, h: 473, fit: "inside" },
          avif: { q: 70, style: "sm" },
          jpeg: { q: 85 },
        },
      };

      const result = await handleProgressiveLoading(event, payload, secretProvider);

      // Decode the JPEG URL payload to verify avif is removed
      const locationUrl = new URL(result.headers?.Location as string);
      const base64Payload = locationUrl.pathname.slice(1);
      const decodedPayload = JSON.parse(Buffer.from(base64Payload, "base64").toString());

      expect(decodedPayload.edits.avif).toBeUndefined();
      expect(decodedPayload.edits.jpeg).toBeDefined();
      expect(decodedPayload.edits.jpeg.quality).toBe(85);
    });

    it("should throw error when CLOUDFRONT_DOMAIN and Host header are missing", async () => {
      const event = {
        path: "/originalBase64Payload",
        headers: {},
      };

      const payload = {
        key: "test.jpg",
        edits: {
          avif: { q: 70, style: "sm" },
          jpeg: { q: 85 },
        },
      };

      await expect(handleProgressiveLoading(event, payload, secretProvider)).rejects.toThrow(
        "CLOUDFRONT_DOMAIN environment variable is required for progressive loading"
      );
    });

    it("should trigger async AVIF generation via Lambda invoke", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AWS_LAMBDA_FUNCTION_NAME = "ImageHandler";
      process.env.AVIF_CACHE_BUCKET = "avif-cache-bucket";
      mockS3GetObjectPromise.mockRejectedValue({ code: "NoSuchKey" });

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
        },
      };

      const payload = {
        key: "test.jpg",
        edits: {
          avif: { q: 70, style: "sm" },
          jpeg: { q: 85 },
        },
      };

      await handleProgressiveLoading(event, payload, secretProvider);

      expect(mockLambdaInvoke).toHaveBeenCalledWith({
        FunctionName: "ImageHandler",
        InvocationType: "Event",
        Payload: JSON.stringify({
          _warmAvif: {
            path: "/originalBase64Payload",
            signature: undefined,
            normalizedPayload: payload,
          },
        }),
      });
    });

    it("should include signature in async AVIF generation payload when present", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AWS_LAMBDA_FUNCTION_NAME = "ImageHandler";
      process.env.AVIF_CACHE_BUCKET = "avif-cache-bucket";
      mockS3GetObjectPromise.mockRejectedValue({ code: "NoSuchKey" });

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
        },
        queryStringParameters: { signature: "abc123" },
      };

      const payload = {
        key: "test.jpg",
        edits: {
          avif: { q: 70, style: "sm" },
          jpeg: { q: 85 },
        },
      };

      await handleProgressiveLoading(event, payload, secretProvider);

      expect(mockLambdaInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: JSON.stringify({
            _warmAvif: {
              path: "/originalBase64Payload",
              signature: "abc123",
              normalizedPayload: payload,
            },
          }),
        })
      );
    });

    it("should not invoke Lambda when AWS_LAMBDA_FUNCTION_NAME is not set", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AVIF_CACHE_BUCKET = "avif-cache-bucket";
      mockS3GetObjectPromise.mockRejectedValue({ code: "NoSuchKey" });

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
        },
      };

      const payload = {
        key: "test.jpg",
        edits: {
          avif: { q: 70, style: "sm" },
          jpeg: { q: 85 },
        },
      };

      await handleProgressiveLoading(event, payload, secretProvider);

      expect(mockLambdaInvoke).not.toHaveBeenCalled();
    });

    it("should still return 302 when AVIF_CACHE_BUCKET is not set (skip S3 cache check)", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      // AVIF_CACHE_BUCKET not set

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
        },
      };

      const payload = {
        key: "test.jpg",
        edits: {
          avif: { q: 70, style: "sm" },
          jpeg: { q: 85 },
        },
      };

      const result = await handleProgressiveLoading(event, payload, secretProvider);

      expect(result.statusCode).toBe(StatusCodes.REDIRECT);
      expect(mockS3GetObject).not.toHaveBeenCalled();
    });
  });

});
