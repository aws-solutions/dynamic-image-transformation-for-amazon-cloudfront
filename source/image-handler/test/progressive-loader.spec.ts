// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SecretsManager from "aws-sdk/clients/secretsmanager";

import { handleProgressiveLoading, isWarmingRequest, executeWarmingRequest } from "../progressive-loader";
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
    // Reset mock implementations
    mockRequest.on.mockReturnThis();
    mockLambdaInvoke.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
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

  describe("handleProgressiveLoading", () => {
    it("should return 302 redirect to JPEG URL for proxied requests (x-bw-proxy: 1)", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
          "x-bw-proxy": "1", // Proxied request triggers 302 + async warming
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
      expect(result.headers?.["Cache-Control"]).toBe("private, max-age=1");
    });

    it("should proxy through local CDN for original requests (no x-bw-proxy header) and return image on cache hit", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      const https = require("https");

      // Mock successful image response (cache hit at IAD)
      const mockImageData = Buffer.from("fake-avif-image-data");
      https.request.mockImplementation((options: any, callback: any) => {
        setTimeout(() => {
          const mockRes = {
            statusCode: 200,
            headers: { "content-type": "image/avif", "x-cache": "Hit from cloudfront" },
            on: jest.fn((event, handler) => {
              if (event === "data") handler(mockImageData);
              if (event === "end") handler();
            }),
          };
          callback(mockRes);
        }, 0);
        return mockRequest;
      });

      const event = {
        path: "/originalBase64Payload",
        headers: { Host: "api-gateway.amazonaws.com" }, // No x-bw-proxy = original request
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

      // Should return the AVIF from IAD cache
      expect(result.statusCode).toBe(StatusCodes.OK);
      expect(result.isBase64Encoded).toBe(true);
      expect(result.headers?.["Content-Type"]).toBe("image/avif");
      expect(result.body).toBe(mockImageData.toString("base64"));

      // Verify proxy request was made with x-bw-proxy FLAG header
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: "d1234.cloudfront.net",
          headers: expect.objectContaining({ "x-bw-proxy": "1" }),
        }),
        expect.any(Function)
      );
    });

    it("should forward 302 redirect from proxy on cache miss (IAD cold)", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      const https = require("https");

      // Mock 302 redirect response (cache miss at IAD)
      https.request.mockImplementation((options: any, callback: any) => {
        setTimeout(() => {
          const mockRes = {
            statusCode: 302,
            headers: { location: "https://d1234.cloudfront.net/jpeg-fallback" },
            on: jest.fn((event, handler) => {
              if (event === "data") handler(Buffer.from(""));
              if (event === "end") handler();
            }),
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
        queryStringParameters: { signature: "abc123" },
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

      // Should forward the 302 redirect (IAD cache miss)
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe("https://d1234.cloudfront.net/jpeg-fallback");

      // Verify proxy request was made with x-bw-proxy FLAG header and signature
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: "d1234.cloudfront.net",
          path: "/originalBase64Payload?signature=abc123",
          method: "GET",
          headers: expect.objectContaining({ "x-bw-proxy": "1" }),
        }),
        expect.any(Function)
      );
    });

    it("should include Accept header in proxy request when provided", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      const https = require("https");

      // Mock successful response
      const mockImageData = Buffer.from("fake-avif-image-data");
      https.request.mockImplementation((options: any, callback: any) => {
        setTimeout(() => {
          const mockRes = {
            statusCode: 200,
            headers: { "content-type": "image/avif" },
            on: jest.fn((event, handler) => {
              if (event === "data") handler(mockImageData);
              if (event === "end") handler();
            }),
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
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      await handleProgressiveLoading(event, payload, secretProvider);

      // Verify Accept header is forwarded in proxy request
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-bw-proxy": "1",
            accept: "image/avif,image/webp,*/*",
          }),
        }),
        expect.any(Function)
      );
    });

    it("should generate JPEG URL without avif in edits (for proxied requests)", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
          "x-bw-proxy": "1", // Proxied request triggers 302 redirect
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

    it("should fallback to Host header if CLOUDFRONT_DOMAIN not set (for proxied requests)", async () => {
      // No CLOUDFRONT_DOMAIN set
      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "fallback-host.cloudfront.net",
          "x-bw-proxy": "1", // Proxied request
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

    it("should trigger async warming orchestrator via Lambda invoke for proxied requests", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AWS_LAMBDA_FUNCTION_NAME = "ImageHandler";

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
          "x-bw-proxy": "1", // Proxied request triggers async warming
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

    it("should include Accept header in warming orchestrator payload (for proxied requests)", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AWS_LAMBDA_FUNCTION_NAME = "ImageHandler";

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
          "x-bw-proxy": "1",
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

    it("should include signature in warming orchestrator payload when present (for proxied requests)", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AWS_LAMBDA_FUNCTION_NAME = "ImageHandler";

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
          "x-bw-proxy": "1",
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

    it("should not invoke Lambda warming for original requests (they proxy first)", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      process.env.AWS_LAMBDA_FUNCTION_NAME = "ImageHandler";
      const https = require("https");

      // Mock successful image response
      const mockImageData = Buffer.from("fake-avif-image-data");
      https.request.mockImplementation((options: any, callback: any) => {
        setTimeout(() => {
          const mockRes = {
            statusCode: 200,
            headers: { "content-type": "image/avif" },
            on: jest.fn((event, handler) => {
              if (event === "data") handler(mockImageData);
              if (event === "end") handler();
            }),
          };
          callback(mockRes);
        }, 0);
        return mockRequest;
      });

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
          // No x-bw-proxy header = original request
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

      // Lambda warming orchestrator should NOT be invoked for original requests (they proxy first)
      expect(mockLambdaInvoke).not.toHaveBeenCalled();
    });

    it("should not invoke Lambda when AWS_LAMBDA_FUNCTION_NAME is not set (for proxied requests)", async () => {
      process.env.CLOUDFRONT_DOMAIN = "d1234.cloudfront.net";
      // AWS_LAMBDA_FUNCTION_NAME is not set

      const event = {
        path: "/originalBase64Payload",
        headers: {
          Host: "api-gateway.amazonaws.com",
          "x-bw-proxy": "1",
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
