// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as fs from "fs";
import * as path from "path";

// CloudFront Function types
interface CloudFrontRequest {
  headers: Record<string, { value: string }>;
  uri?: string;
  querystring?: Record<string, { value: string }>;
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
            "sec-ch-dpr": { value: testCase.input },
          },
        },
      };

      const result = await handler(event);
      expect(result.headers["dit-dpr"]?.value).toBe(testCase.expected);
    }
  });

  describe("Accept header normalization", () => {
    test("should fallback to webp for */* with modern Chrome UA", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "test.com" },
            accept: { value: "*/*" },
            "user-agent": { value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      expect(result.headers["dit-accept"]?.value).toBe("image/webp");
    });

    test("should fallback to webp for image/* with modern Safari UA", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "test.com" },
            accept: { value: "image/*,*/*;q=0.8" },
            "user-agent": { value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      expect(result.headers["dit-accept"]?.value).toBe("image/webp");
    });

    test("should NOT set dit-accept for */* with unknown/legacy UA", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "test.com" },
            accept: { value: "*/*" },
            "user-agent": { value: "curl/7.79.1" }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      expect(result.headers["dit-accept"]).toBeUndefined();
    });

    test("should NOT set dit-accept for */* when User-Agent is missing", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "test.com" },
            accept: { value: "*/*" }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      expect(result.headers["dit-accept"]).toBeUndefined();
    });

    test("specific MIME types still win over wildcard fallback", async () => {
      const event: CloudFrontEvent = {
        request: {
          headers: {
            host: { value: "test.com" },
            accept: { value: "image/avif,image/webp,*/*" },
            "user-agent": { value: "Mozilla/5.0 ... Chrome/120.0.0.0 ..." }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      expect(result.headers["dit-accept"]?.value).toBe("image/webp"); // WebP first per post-revert priority
    });
    
    test("should exclude JPEG when source URL is .png (Issue #2 — preserve alpha)", async () => {
      const event: CloudFrontEvent = {
        request: {
          uri: "/cdn-test/media/foo.png",
          headers: {
            host: { value: "test.com" },
            accept: { value: "image/png, image/jpeg, image/gif, image/*" }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      expect(result.headers["dit-accept"]?.value).toBe("image/png");
    });

    test("should exclude JPEG when source URL is .gif", async () => {
      const event: CloudFrontEvent = {
        request: {
          uri: "/foo.gif",
          headers: {
            host: { value: "test.com" },
            accept: { value: "image/jpeg, image/gif" }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      expect(result.headers["dit-accept"]?.value).toBe("image/gif");
    });

    test("should exclude JPEG when source URL is .webp", async () => {
      const event: CloudFrontEvent = {
        request: {
          uri: "/foo.webp",
          headers: {
            host: { value: "test.com" },
            accept: { value: "image/jpeg, image/webp" }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      expect(result.headers["dit-accept"]?.value).toBe("image/webp");
    });

    //test("should still pick AVIF over WebP when source is .png and both accepted (priority preserved)", async () => {
    test("should pick WebP over AVIF when source is .png and both accepted (post-revert priority)", async () => {
      const event: CloudFrontEvent = {
        request: {
          uri: "/foo.png",
          headers: {
            host: { value: "test.com" },
            accept: { value: "image/avif, image/webp, image/jpeg" }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      expect(result.headers["dit-accept"]?.value).toBe("image/webp");

    });

    test("should NOT exclude JPEG when source URL is .jpg (no alpha to lose)", async () => {
      const event: CloudFrontEvent = {
        request: {
          uri: "/foo.jpg",
          headers: {
            host: { value: "test.com" },
            accept: { value: "image/jpeg, image/webp" }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      // webp wins via priority; jpeg not excluded because source is jpg
      expect(result.headers["dit-accept"]?.value).toBe("image/webp");
    });

    test("should handle uppercase PNG extension", async () => {
      const event: CloudFrontEvent = {
        request: {
          uri: "/Foo.PNG",
          headers: {
            host: { value: "test.com" },
            accept: { value: "image/png, image/jpeg" }
          },
          querystring: {}
        }
      };
      const result = await handler(event);
      expect(result.headers["dit-accept"]?.value).toBe("image/png");
    });



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
  });
});
