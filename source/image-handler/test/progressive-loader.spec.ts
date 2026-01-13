// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SecretsManager from "aws-sdk/clients/secretsmanager";

import { handleProgressiveLoading, isWarmingRequest, isCacheCheckRequest, executeWarmingRequest } from "../progressive-loader";
import { SecretProvider } from "../secret-provider";
import { StatusCodes } from "../lib";

// Mock https module for executeWarmingRequest tests
const mockRequest = {
  on: jest.fn().mockReturnThis(),
  end: jest.fn(),
  destroy: jest.fn(),
};

jest.mock("https", () => ({
  request: jest.fn((options, callback) => {
    return mockRequest;
  }),
}));

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

// Mock AWS SDK SecretsManager
jest.mock("aws-sdk/clients/secretsmanager", () => jest.fn(() => ({})));

describe("ProgressiveLoader", () => {
  const secretsManager = new SecretsManager();
  const secretProvider = new SecretProvider(secretsManager);

  beforeEach(() => {
    jest.clearAllMocks();
    const https = require("https");
    // Reset mock implementations
    mockRequest.on.mockReturnThis();
    mockLambdaInvoke.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });
    // Default: cache-check returns 204 (cache miss), so handleProgressiveLoading returns 302
    https.request.mockImplementation((options: any, callback: any) => {
      setTimeout(() => {
        callback({ statusCode: 204, headers: {}, resume: jest.fn() });
      }, 0);
      return mockRequest;
    });
    delete process.env.ENABLE_SIGNATURE;
    delete process.env.SECRETS_MANAGER;
    delete process.env.SECRET_KEY;
    delete process.env.CLOUDFRONT_DOMAIN;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  });

  describe("isWarmingRequest", () => {
    it("should return true when x-bw-warm header is '1'", () => {
      const event = {
        path: "/base64payload",
        headers: { "x-bw-warm": "1" },
      };

      expect(isWarmingRequest(event)).toBe(true);
    });

    it("should return true when X-Bw-Warm header is '1' (case variation)", () => {
      const event = {
        path: "/base64payload",
        headers: { "X-Bw-Warm": "1" },
      };

      expect(isWarmingRequest(event)).toBe(true);
    });

    it("should return false when x-bw-warm header is not present", () => {
      const event = {
        path: "/base64payload",
        headers: {},
      };

      expect(isWarmingRequest(event)).toBe(false);
    });

    it("should return false when x-bw-warm header is not '1'", () => {
      const event = {
        path: "/base64payload",
        headers: { "x-bw-warm": "0" },
      };

      expect(isWarmingRequest(event)).toBe(false);
    });

    it("should return false when headers is undefined", () => {
      const event = {
        path: "/base64payload",
      };

      expect(isWarmingRequest(event)).toBe(false);
    });
  });

  describe("isCacheCheckRequest", () => {
    it("should return true when x-bw-cache-check header is '1'", () => {
      const event = {
        path: "/base64payload",
        headers: { "x-bw-cache-check": "1" },
      };

      expect(isCacheCheckRequest(event)).toBe(true);
    });

    it("should return true when X-Bw-Cache-Check header is '1' (case variation)", () => {
      const event = {
        path: "/base64payload",
        headers: { "X-Bw-Cache-Check": "1" },
      };

      expect(isCacheCheckRequest(event)).toBe(true);
    });

    it("should return false when x-bw-cache-check header is not present", () => {
      const event = {
        path: "/base64payload",
        headers: {},
      };

      expect(isCacheCheckRequest(event)).toBe(false);
    });

    it("should return false when x-bw-cache-check header is not '1'", () => {
      const event = {
        path: "/base64payload",
        headers: { "x-bw-cache-check": "0" },
      };

      expect(isCacheCheckRequest(event)).toBe(false);
    });

    it("should return false when headers is undefined", () => {
      const event = {
        path: "/base64payload",
      };

      expect(isCacheCheckRequest(event)).toBe(false);
    });
  });

  describe("handleProgressiveLoading", () => {
    it("should return 302 redirect to JPEG URL when cache-check misses", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";

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
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      const result = await handleProgressiveLoading(event, payload, secretProvider);

      expect(result.statusCode).toBe(StatusCodes.REDIRECT);
      expect(result.isBase64Encoded).toBe(false);
      // Should use CLOUDFRONT_DOMAIN, not the API Gateway host
      expect(result.headers?.Location).toContain("https://d1234.cloudfront.net/");
      // private so CloudFront doesn't cache; browser caches 15s
      expect(result.headers?.["Cache-Control"]).toBe("private, max-age=15");
    });

    it("should proxy AVIF directly when cache-check hits Origin Shield", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      const https = require("https");

      // Mock a fake AVIF binary (just some bytes for testing)
      const fakeAvifData = Buffer.from([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);

      // Simulate cache HIT: return 200 with AVIF content
      https.request.mockImplementation((options: any, callback: any) => {
        setTimeout(() => {
          const mockRes = {
            statusCode: 200,
            headers: { "content-type": "image/avif", "x-cache": "Hit from cloudfront" },
            on: jest.fn((event, handler) => {
              if (event === "data") {
                setTimeout(() => handler(fakeAvifData), 0);
              } else if (event === "end") {
                setTimeout(() => handler(), 10);
              }
              return mockRes;
            }),
            resume: jest.fn(),
          };
          callback(mockRes);
        }, 0);
        return mockRequest;
      });

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
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      const result = await handleProgressiveLoading(event, payload, secretProvider);

      // Should return 200 with proxied AVIF
      expect(result.statusCode).toBe(StatusCodes.OK);
      expect(result.isBase64Encoded).toBe(true);
      expect(result.headers?.["Content-Type"]).toBe("image/avif");
      expect(result.headers?.["Cache-Control"]).toBe("max-age=31536000,public");
      // Body should be base64 encoded AVIF
      expect(result.body).toBe(fakeAvifData.toString("base64"));
    });

    it("should generate JPEG URL without avif in edits", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";

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
          avif: { q: 70 },
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
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      await expect(handleProgressiveLoading(event, payload, secretProvider)).rejects.toThrow(
        "CLOUDFRONT_DOMAIN environment variable is required for progressive loading"
      );
    });

    it("should fallback to Host header if CLOUDFRONT_DOMAIN not set", async () => {
      // No CLOUDFRONT_DOMAIN set
      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "fallback-host.cloudfront.net",
        },
      };

      const payload = {
        bucket: "test-bucket",
        key: "item_images/test.jpg",
        edits: {
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      const result = await handleProgressiveLoading(event, payload, secretProvider);

      expect(result.headers?.Location).toContain("https://fallback-host.cloudfront.net/");
    });

    it("should trigger async warming orchestrator via Lambda invoke", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AWS_LAMBDA_FUNCTION_NAME = "ImageHandler";

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
        },
      };

      const payload = {
        key: "test.jpg",
        edits: {
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      await handleProgressiveLoading(event, payload, secretProvider);

      expect(mockLambdaInvoke).toHaveBeenCalledWith({
        FunctionName: "ImageHandler",
        InvocationType: "Event",
        Payload: JSON.stringify({
          _warmOrchestrator: {
            url: "https://d1234.cloudfront.net/originalBase64Payload",
            acceptHeader: undefined,
          },
        }),
      });
    });

    it("should include Accept header in warming orchestrator payload", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AWS_LAMBDA_FUNCTION_NAME = "ImageHandler";

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
          Accept: "image/avif,image/webp,image/*,*/*",
        },
      };

      const payload = {
        key: "test.jpg",
        edits: {
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      await handleProgressiveLoading(event, payload, secretProvider);

      expect(mockLambdaInvoke).toHaveBeenCalledWith({
        FunctionName: "ImageHandler",
        InvocationType: "Event",
        Payload: JSON.stringify({
          _warmOrchestrator: {
            url: "https://d1234.cloudfront.net/originalBase64Payload",
            acceptHeader: "image/avif,image/webp,image/*,*/*",
          },
        }),
      });
    });

    it("should include signature in warming orchestrator payload when present", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AWS_LAMBDA_FUNCTION_NAME = "ImageHandler";

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
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      await handleProgressiveLoading(event, payload, secretProvider);

      expect(mockLambdaInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: JSON.stringify({
            _warmOrchestrator: {
              url: "https://d1234.cloudfront.net/originalBase64Payload?signature=abc123",
              acceptHeader: undefined,
            },
          }),
        })
      );
    });

    it("should not invoke Lambda when AWS_LAMBDA_FUNCTION_NAME is not set", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      // AWS_LAMBDA_FUNCTION_NAME is not set

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
        },
      };

      const payload = {
        key: "test.jpg",
        edits: {
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      await handleProgressiveLoading(event, payload, secretProvider);

      expect(mockLambdaInvoke).not.toHaveBeenCalled();
    });
  });

  describe("executeWarmingRequest", () => {
    it("should make one HTTP request with x-bw-warm header", async () => {
      const https = require("https");

      // Mock the response callback
      https.request.mockImplementation((options: any, callback: any) => {
        // Simulate successful response asynchronously
        setTimeout(() => {
          callback({ statusCode: 200, headers: { "x-cache": "Miss from cloudfront", "content-type": "image/avif" }, resume: jest.fn() });
        }, 0);
        return mockRequest;
      });

      const result = await executeWarmingRequest({
        url: "https://d1234.cloudfront.net/some/path?signature=abc",
      });

      // Only one request is made (with x-bw-warm) to avoid cascading timeouts
      expect(https.request).toHaveBeenCalledTimes(1);

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: "d1234.cloudfront.net",
          path: "/some/path?signature=abc",
          method: "GET",
          headers: expect.objectContaining({ "x-bw-warm": "1" }),
        }),
        expect.any(Function)
      );

      expect(result.statusCode).toBe(StatusCodes.OK);
    });

    it("should include Accept header in HTTP request when provided", async () => {
      const https = require("https");

      https.request.mockImplementation((options: any, callback: any) => {
        setTimeout(() => {
          callback({ statusCode: 200, headers: { "x-cache": "Miss from cloudfront", "content-type": "image/avif" }, resume: jest.fn() });
        }, 0);
        return mockRequest;
      });

      const result = await executeWarmingRequest({
        url: "https://d1234.cloudfront.net/some/path",
        acceptHeader: "image/avif,image/webp,image/*,*/*",
      });

      // Only one request is made now (with x-bw-warm) to avoid cascading timeouts
      expect(https.request).toHaveBeenCalledTimes(1);

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: "d1234.cloudfront.net",
          path: "/some/path",
          method: "GET",
          headers: { "x-bw-warm": "1", accept: "image/avif,image/webp,image/*,*/*" },
        }),
        expect.any(Function)
      );

      expect(result.statusCode).toBe(StatusCodes.OK);
    });
  });
});
