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
    expect(result.headers["dit-accept"]?.value).toEqual("image/webp");
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
    expect(result.headers["dit-accept"]).toBeUndefined(); // Wildcards are ignored
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
    expect(result.headers["dit-accept"]?.value).toEqual("image/webp");
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
            "sec-ch-viewport-width": { value: "1366" },
            "sec-ch-dpr": { value: testCase.input },
          },
        },
      };

      const result = await handler(event);
      expect(result.headers["dit-viewport-width"]?.value).toBe("1440");
      expect(result.headers["dit-dpr"]?.value).toBe(testCase.expected);
    }
  });

  describe("Multi-tier detection (DIT 8.1)", () => {
    const req = (headers: Record<string, string>): CloudFrontEvent => ({
      request: {
        headers: Object.fromEntries(
          Object.entries(headers).map(([k, v]) => [k, { value: v }])
        ),
      },
    });

    // Tier 1
    test("T1 match: sec-ch-width + sec-ch-dpr → snapped width and dpr", async () => {
      const result = await handler(req({ host: "x.com", "sec-ch-width": "800", "sec-ch-dpr": "2" }));
      expect(result.headers["dit-viewport-width"]?.value).toBe("1024");
      expect(result.headers["dit-dpr"]?.value).toBe("2");
    });

    test("T1 reject: sec-ch-width > 7680 → falls through to T5, no dit-viewport-width", async () => {
      const result = await handler(req({ host: "x.com", "sec-ch-width": "8000" }));
      expect(result.headers["dit-viewport-width"]).toBeUndefined();
    });

    // Tier 2
    test("T2 match: sec-ch-viewport-width only → snapped width", async () => {
      const result = await handler(req({ host: "x.com", "sec-ch-viewport-width": "375" }));
      expect(result.headers["dit-viewport-width"]?.value).toBe("480");
    });

    test("T2 match with DPR: sec-ch-viewport-width + sec-ch-dpr", async () => {
      const result = await handler(req({ host: "x.com", "sec-ch-viewport-width": "375", "sec-ch-dpr": "2" }));
      expect(result.headers["dit-viewport-width"]?.value).toBe("480");
      expect(result.headers["dit-dpr"]?.value).toBe("2");
    });

    test("T2 reject: sec-ch-viewport-width > 7680 → no dit-viewport-width", async () => {
      const result = await handler(req({ host: "x.com", "sec-ch-viewport-width": "8000" }));
      expect(result.headers["dit-viewport-width"]).toBeUndefined();
    });

    // Tier 4
    test("T4 mobile: cloudfront-is-mobile-viewer → 480 / dpr 2", async () => {
      const result = await handler(req({ host: "x.com", "cloudfront-is-mobile-viewer": "true" }));
      expect(result.headers["dit-viewport-width"]?.value).toBe("480");
      expect(result.headers["dit-dpr"]?.value).toBe("2");
    });

    test("T4 smarttv: cloudfront-is-smarttv-viewer → 1920 / dpr 1", async () => {
      const result = await handler(req({ host: "x.com", "cloudfront-is-smarttv-viewer": "true" }));
      expect(result.headers["dit-viewport-width"]?.value).toBe("1920");
      expect(result.headers["dit-dpr"]?.value).toBe("1");
    });

    test("T4 desktop: cloudfront-is-desktop-viewer → 1440 / dpr 2", async () => {
      const result = await handler(req({ host: "x.com", "cloudfront-is-desktop-viewer": "true" }));
      expect(result.headers["dit-viewport-width"]?.value).toBe("1440");
      expect(result.headers["dit-dpr"]?.value).toBe("2");
    });

    test("T4 priority: mobile + desktop both true → mobile wins (480)", async () => {
      const result = await handler(req({ host: "x.com", "cloudfront-is-mobile-viewer": "true", "cloudfront-is-desktop-viewer": "true" }));
      expect(result.headers["dit-viewport-width"]?.value).toBe("480");
    });

    // Tier 5
    test("T5 fallback: no signals → dit-viewport-width and dit-dpr undefined", async () => {
      const result = await handler(req({ host: "x.com" }));
      expect(result.headers["dit-viewport-width"]).toBeUndefined();
      expect(result.headers["dit-dpr"]).toBeUndefined();
    });

    // Normalization edge cases
    test("normalize: rawWidth=900 snaps up to 1024", async () => {
      const result = await handler(req({ host: "x.com", "sec-ch-viewport-width": "900" }));
      expect(result.headers["dit-viewport-width"]?.value).toBe("1024");
    });

    test("normalize: rawWidth=2000 caps at 1920", async () => {
      const result = await handler(req({ host: "x.com", "sec-ch-viewport-width": "2000" }));
      expect(result.headers["dit-viewport-width"]?.value).toBe("1920");
    });

    test("normalize: rawDpr=3.14 rounds to 3.1", async () => {
      const result = await handler(req({ host: "x.com", "sec-ch-viewport-width": "800", "sec-ch-dpr": "3.14" }));
      expect(result.headers["dit-dpr"]?.value).toBe("3.1");
    });

    test("normalize: rawDpr=6.0 caps at 5", async () => {
      const result = await handler(req({ host: "x.com", "sec-ch-viewport-width": "800", "sec-ch-dpr": "6.0" }));
      expect(result.headers["dit-dpr"]?.value).toBe("5");
    });

    test("normalize: null width (T5) → dit-viewport-width undefined", async () => {
      const result = await handler(req({ host: "x.com" }));
      expect(result.headers["dit-viewport-width"]).toBeUndefined();
    });

    // Fail-open and log behavior
    test("log: exactly one DIT-DETECT log emitted per request", async () => {
      const spy = jest.spyOn(console, "log").mockImplementation(() => {});
      try {
        await handler(req({ host: "x.com", "sec-ch-viewport-width": "375" }));
        const ditCalls = spy.mock.calls.filter(args => String(args[0]).includes("DIT-DETECT"));
        expect(ditCalls).toHaveLength(1);
      } finally {
        spy.mockRestore();
      }
    });

    test("log T5: contains width 'unset' and dpr 'unset'", async () => {
      const spy = jest.spyOn(console, "log").mockImplementation(() => {});
      try {
        await handler(req({ host: "x.com" }));
        const log = spy.mock.calls.find(args => String(args[0]).includes("DIT-DETECT"))?.[0] as string;
        const parsed = JSON.parse(log);
        expect(parsed.width).toBe("unset");
        expect(parsed.dpr).toBe("unset");
      } finally {
        spy.mockRestore();
      }
    });

    test("log T1: contains tier 1 and name 'ClientHintsWidth'", async () => {
      const spy = jest.spyOn(console, "log").mockImplementation(() => {});
      try {
        await handler(req({ host: "x.com", "sec-ch-width": "800", "sec-ch-dpr": "2" }));
        const log = spy.mock.calls.find(args => String(args[0]).includes("DIT-DETECT"))?.[0] as string;
        const parsed = JSON.parse(log);
        expect(parsed.tier).toBe(1);
        expect(parsed.name).toBe("ClientHintsWidth");
      } finally {
        spy.mockRestore();
      }
    });

    test("log T4 mobile: contains tier 4 and name 'CloudFrontDevice'", async () => {
      const spy = jest.spyOn(console, "log").mockImplementation(() => {});
      try {
        await handler(req({ host: "x.com", "cloudfront-is-mobile-viewer": "true" }));
        const log = spy.mock.calls.find(args => String(args[0]).includes("DIT-DETECT"))?.[0] as string;
        const parsed = JSON.parse(log);
        expect(parsed.tier).toBe(4);
        expect(parsed.name).toBe("CloudFrontDevice");
      } finally {
        spy.mockRestore();
      }
    });

    test("log T2: contains tier 2 and name 'ClientHintsViewportWidth'", async () => {
      const spy = jest.spyOn(console, "log").mockImplementation(() => {});
      try {
        await handler(req({ host: "x.com", "sec-ch-viewport-width": "375" }));
        const log = spy.mock.calls.find(args => String(args[0]).includes("DIT-DETECT"))?.[0] as string;
        const parsed = JSON.parse(log);
        expect(parsed.tier).toBe(2);
        expect(parsed.name).toBe("ClientHintsViewportWidth");
      } finally {
        spy.mockRestore();
      }
    });

    test("log T5: name is 'Fallback'", async () => {
      const spy = jest.spyOn(console, "log").mockImplementation(() => {});
      try {
        await handler(req({ host: "x.com" }));
        const log = spy.mock.calls.find(args => String(args[0]).includes("DIT-DETECT"))?.[0] as string;
        const parsed = JSON.parse(log);
        expect(parsed.tier).toBe(5);
        expect(parsed.name).toBe("Fallback");
      } finally {
        spy.mockRestore();
      }
    });

  });

  describe("Client-supplied dit-* header stripping (SSRF / cache-key hardening)", () => {
    test("should strip a client-supplied dit-origin override header", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "example.com" },
            "dit-origin": { value: "https://169.254.169.254/" },
          },
        },
      };

      const result = await handler(event);

      expect(result.headers["dit-origin"]).toBeUndefined();
    });

    test("should strip client-supplied dit-* cache-key headers so they cannot be poisoned", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "example.com" },
            // Client tries to force a cache-key value; detection would otherwise fall through to T5.
            "dit-viewport-width": { value: "9999" },
            "dit-dpr": { value: "9" },
            "dit-host": { value: "attacker.example" },
          },
        },
      };

      const result = await handler(event);

      // dit-host is re-derived from the real Host header; the injected value must not survive.
      expect(result.headers["dit-host"]?.value).toBe("example.com");
      // No detection signal was present, so viewport/dpr must be absent (injected values dropped).
      expect(result.headers["dit-viewport-width"]).toBeUndefined();
      expect(result.headers["dit-dpr"]).toBeUndefined();
    });

    test("should still derive dit-* headers normally when the client sends none", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "example.com" },
            accept: { value: "image/webp,*/*" },
            "sec-ch-viewport-width": { value: "375" },
          },
        },
      };

      const result = await handler(event);

      expect(result.headers["dit-host"]?.value).toBe("example.com");
      expect(result.headers["dit-accept"]?.value).toBe("image/webp");
      expect(result.headers["dit-viewport-width"]?.value).toBe("480");
    });

    test("should not strip non-dit headers or device-simulation (x-dit-sim-*) headers", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "example.com" },
            authorization: { value: "Bearer token123" },
            "x-dit-sim-viewport": { value: "768" },
          },
        },
      };

      const result = await handler(event);

      expect(result.headers["authorization"]?.value).toBe("Bearer token123");
      expect(result.headers["x-dit-sim-viewport"]?.value).toBe("768");
    });
  });

  describe("Accept header normalization", () => {
    test("should select highest priority format from Accept header", async () => {
      const testCases = [
        { input: "image/avif,image/webp,image/png", expected: "image/webp" },
        { input: "image/png,image/jpeg", expected: "image/jpeg" },
        { input: "image/avif,image/heif", expected: "image/avif" },
        { input: "image/gif", expected: "image/gif" },
      ];

      for (const testCase of testCases) {
        const event: CloudFrontEvent = {
          request: {
            headers: {
              host: { value: "test.com" },
              accept: { value: testCase.input },
            },
          },
        };

        const result = await handler(event);
        expect(result.headers["dit-accept"]?.value).toBe(testCase.expected);
      }
    });

    test("should ignore wildcards in Accept header", async () => {
      const testCases = ["*/*", "image/*", "image/*,*/*;q=0.8"];

      for (const input of testCases) {
        const event: CloudFrontEvent = {
          request: {
            headers: {
              host: { value: "test.com" },
              accept: { value: input },
            },
          },
        };

        const result = await handler(event);
        expect(result.headers["dit-accept"]).toBeUndefined();
      }
    });

    test("should strip quality values from Accept header", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "test.com" },
            accept: { value: "image/webp;q=0.9,image/png;q=0.8" },
          },
        },
      };

      const result = await handler(event);
      expect(result.headers["dit-accept"]?.value).toBe("image/webp");
    });

    test("should ignore quality values when selecting format", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "test.com" },
            accept: { value: "image/png;q=1.0,image/webp;q=0.1" },
          },
        },
      };

      const result = await handler(event);
      expect(result.headers["dit-accept"]?.value).toBe("image/webp");
    });

    test("should handle MIME type aliases", async () => {
      const testCases = [
        { input: "image/jpg", expected: "image/jpeg" },
        { input: "image/heic", expected: "image/heif" },
      ];

      for (const testCase of testCases) {
        const event: CloudFrontEvent = {
          request: {
            headers: {
              host: { value: "test.com" },
              accept: { value: testCase.input },
            },
          },
        };

        const result = await handler(event);
        expect(result.headers["dit-accept"]?.value).toBe(testCase.expected);
      }
    });

    test("should skip normalization for an oversized Accept header (> 512 chars)", async () => {
      // Supported format present but past the length cap, so it is not parsed.
      const oversized = "image/png,".repeat(60);
      expect(oversized.length).toBeGreaterThan(512);
      const result = await handler({
        request: { headers: { host: { value: "test.com" }, accept: { value: oversized } } },
      });
      expect(result.headers["dit-accept"]).toBeUndefined();
    });

    test("should only parse the first 20 media types (element cap)", async () => {
      // webp sits at position 21, past the element cap.
      const capped = "a/b,".repeat(20) + "image/webp";
      expect(capped.length).toBeLessThanOrEqual(512);
      const result = await handler({
        request: { headers: { host: { value: "test.com" }, accept: { value: capped } } },
      });
      expect(result.headers["dit-accept"]).toBeUndefined();
    });

    test("should still select a supported format within the caps", async () => {
      // webp sits at position 19, within the element cap.
      const withinCap = "a/b,".repeat(18) + "image/webp";
      const result = await handler({
        request: { headers: { host: { value: "test.com" }, accept: { value: withinCap } } },
      });
      expect(result.headers["dit-accept"]?.value).toBe("image/webp");
    });
  });
});
