// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as fs from "fs";
import * as path from "path";

// CloudFront Function types
interface CloudFrontRequest {
  headers: Record<string, { value: string }>;
}

interface CloudFrontEvent {
  request: CloudFrontRequest;
}

describe("DIT CloudFront Function", () => {
  let handler: (event: CloudFrontEvent) => Promise<CloudFrontRequest>;

  beforeAll(() => {
    // Load and evaluate the CloudFront function
    const functionCode = fs.readFileSync(path.join(__dirname, "../../functions/dit-header-normalization.js"), "utf8");

    // Extract handler function and make it available globally
    const mockFunctionCode = functionCode.replace("async function handler", "global.handler = async function handler");

    eval(mockFunctionCode);
    handler = (global as any).handler;
  });

  test("should normalize desktop viewport width", async () => {
    const event: CloudFrontEvent = {
      request: {
        headers: {
          host: { value: "example.com" },
          accept: { value: "image/webp,*/*" },
          "sec-ch-viewport-width": { value: "1366" },
          "sec-ch-dpr": { value: "2" },
        },
      },
    };

    const result = await handler(event);

    expect(result.headers["dit-host"]?.value).toEqual(event.request.headers["host"].value);
    expect(result.headers["dit-accept"]?.value).toEqual(event.request.headers["accept"].value);
    expect(result.headers["dit-viewport-width"]?.value).toBe("1440");
    expect(result.headers["dit-dpr"]?.value).toEqual(event.request.headers["sec-ch-dpr"].value);
  });

  test("should normalize mobile viewport width", async () => {
    const event: CloudFrontEvent = {
      request: {
        headers: {
          host: { value: "mobile.example.com" },
          "sec-ch-viewport-width": { value: "375" },
        },
      },
    };

    const result = await handler(event);

    expect(result.headers["dit-host"]?.value).toEqual(event.request.headers["host"].value);
    expect(result.headers["dit-viewport-width"]?.value).toBe("480");
  });

  test("should handle missing viewport header", async () => {
    const event: CloudFrontEvent = {
      request: {
        headers: {
          host: { value: "example.com" },
          accept: { value: "image/*" },
        },
      },
    };

    const result = await handler(event);

    expect(result.headers["dit-host"]?.value).toEqual(event.request.headers["host"].value);
    expect(result.headers["dit-accept"]?.value).toEqual(event.request.headers["accept"].value);
    expect(result.headers["dit-viewport-width"]).toBeUndefined();
  });

  test("should preserve original headers while adding DIT headers", async () => {
    const event: CloudFrontEvent = {
      request: {
        headers: {
          host: { value: "example.com" },
          accept: { value: "image/webp,*/*" },
          "sec-ch-viewport-width": { value: "1366" },
          "sec-ch-dpr": { value: "2" },
          "user-agent": { value: "Mozilla/5.0" },
          authorization: { value: "Bearer token123" },
        },
      },
    };

    const result = await handler(event);

    // Original headers should be preserved
    expect(result.headers["host"]?.value).toEqual(event.request.headers["host"].value);
    expect(result.headers["accept"]?.value).toEqual(event.request.headers["accept"].value);
    expect(result.headers["sec-ch-viewport-width"]?.value).toEqual(
      event.request.headers["sec-ch-viewport-width"].value
    );
    expect(result.headers["sec-ch-dpr"]?.value).toEqual(event.request.headers["sec-ch-dpr"].value);
    expect(result.headers["user-agent"]?.value).toEqual(event.request.headers["user-agent"].value);
    expect(result.headers["authorization"]?.value).toEqual(event.request.headers["authorization"].value);

    // DIT headers should be added
    expect(result.headers["dit-host"]?.value).toEqual(event.request.headers["host"].value);
    expect(result.headers["dit-accept"]?.value).toEqual(event.request.headers["accept"].value);
    expect(result.headers["dit-viewport-width"]?.value).toBe("1440");
    expect(result.headers["dit-dpr"]?.value).toEqual(event.request.headers["sec-ch-dpr"].value);
  });

  test("should handle edge case viewport widths", async () => {
    const testCases = [
      { input: "100", expected: "320" }, // Below smallest
      { input: "320", expected: "320" }, // Exact match
      { input: "400", expected: "480" }, // Between breakpoints
      { input: "2000", expected: "1920" }, // Above largest
    ];

    for (const testCase of testCases) {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "test.com" },
            "sec-ch-viewport-width": { value: testCase.input },
          },
        },
      };

      const result = await handler(event);
      expect(result.headers["dit-viewport-width"]?.value).toBe(testCase.expected);
    }
  });

  test("should normalize DPR values to nearest tenth and cap at 5.0", async () => {
    const testCases = [
      { input: "1.23", expected: "1.2" },
      { input: "2.87", expected: "2.9" },
      { input: "0.14", expected: "0.1" },
      { input: "6.5", expected: "5" },
      { input: "1.0", expected: "1" },
      { input: "5.0", expected: "5" },
    ];

    for (const testCase of testCases) {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "test.com" },
            "sec-ch-dpr": { value: testCase.input },
          },
        },
      };

      const result = await handler(event);
      expect(result.headers["dit-dpr"]?.value).toBe(testCase.expected);
    }
  });
});
