// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { b64DecoderMiddleware } from "./b64-decoder";
import { extractUrlTransformations } from "../services/transformation-resolver/extraction/transformation-extractor";
import { Request } from "express";

const encode = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString("base64url");

describe("b64DecoderMiddleware", () => {
  const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
  const mockNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockReq = (url: string, query: Record<string, any> = {}) =>
    ({ url, path: url.split("?")[0], query, headers: {} } as any);

  describe("successful B64 decoding", () => {
    it("should rewrite req.url from decoded path", () => {
      const payload = encode({ path: "/photos/cat.jpg" });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.url).toBe("/photos/cat.jpg");
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should flatten edits into req.query", () => {
      const payload = encode({
        path: "/photos/cat.jpg",
        edits: { resize: { width: 300, height: 200 }, format: "webp" },
      });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.url).toBe("/photos/cat.jpg");
      expect(req.query).toEqual({ "resize.width": 300, "resize.height": 200, format: "webp" });
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should set policyId on req.query when present", () => {
      const payload = encode({ path: "/img/dog.png", policyId: "my-policy" });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.url).toBe("/img/dog.png");
      expect(req.query.policyId).toBe("my-policy");
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should set x-dit-b64 header on successful decode", () => {
      const payload = encode({ path: "/photos/cat.jpg", edits: { format: "webp" } });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.headers["x-dit-b64"]).toBe("true");
    });

    it("should handle path-only payload with no edits", () => {
      const payload = encode({ path: "/images/test.jpg" });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.url).toBe("/images/test.jpg");
      expect(req.query).toEqual({});
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should handle policyId + edits together", () => {
      const payload = encode({
        path: "/a/b.jpg",
        policyId: "p1",
        edits: { quality: 80 },
      });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.url).toBe("/a/b.jpg");
      expect(req.query).toEqual({ policyId: "p1", quality: 80 });
    });

    it("should decode correctly when URL has a query string appended", () => {
      const payload = encode({ path: "/photos/cat.jpg", edits: { format: "webp" } });
      const req = createMockReq(`/${payload}?extra=param`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.url).toBe("/photos/cat.jpg");
      expect(req.query).toEqual({ format: "webp" });
      expect(req.headers["x-dit-b64"]).toBe("true");
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should handle paths with unicode characters", () => {
      const payload = encode({ path: "/images/😀.jpg" });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.url).toBe("/images/😀.jpg");
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe("fall-through for non-B64 paths", () => {
    it("should pass through normal image paths unchanged", () => {
      const req = createMockReq("/photos/cat.jpg", { resize: { width: 100 } });

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.url).toBe("/photos/cat.jpg");
      expect(req.query).toEqual({ resize: { width: 100 } });
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should pass through valid base64url that is not JSON", () => {
      // "hello world" base64url-encoded is not valid JSON
      const notJson = Buffer.from("hello world").toString("base64url");
      const req = createMockReq(`/${notJson}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.url).toBe(`/${notJson}`);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should not set x-dit-b64 header on non-B64 paths", () => {
      const req = createMockReq("/photos/cat.jpg");

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.headers["x-dit-b64"]).toBeUndefined();
    });

    it("should clear a spoofed x-dit-b64 header on fall-through", () => {
      const req = createMockReq("/photos/cat.jpg");
      req.headers["x-dit-b64"] = "true";

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.headers["x-dit-b64"]).toBeUndefined();
    });

    it("should preserve existing req.query when falling through", () => {
      const req = createMockReq("/normal/path.jpg", { format: "webp" });

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.query).toEqual({ format: "webp" });
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe("400 errors for invalid B64 payloads", () => {
    it("should return 400 when JSON is not an object (array)", () => {
      const payload = encode([1, 2, 3]);
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("JSON object") })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 when JSON is not an object (string)", () => {
      const payload = encode("just a string");
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 when JSON is not an object (null)", () => {
      const payload = encode(null);
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 when path field is missing", () => {
      const payload = encode({ edits: { resize: { width: 300 } } });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('"path"') }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 when path is not a string", () => {
      const payload = encode({ path: 123 });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('"path"') }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 when path does not start with /", () => {
      const payload = encode({ path: "images/cat.jpg" });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('start with') })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 when path contains traversal sequences", () => {
      const payload = encode({ path: "/images/../etc/passwd" });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("traversal") })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 for path with backslash traversal", () => {
      const payload = encode({ path: "/images\\..\\secrets" });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 when path contains a query string character", () => {
      const payload = encode({ path: "/images/cat.jpg?format=png" });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("?") })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 when path contains a fragment character", () => {
      const payload = encode({ path: "/images/cat.jpg#section" });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("#") })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should skip __proto__ keys in edits", () => {
      const json = '{"path":"/img/a.jpg","edits":{"__proto__":{"isAdmin":true},"format":"webp"}}';
      const req = createMockReq(`/${Buffer.from(json).toString("base64url")}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.query).toEqual({ format: "webp" });
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should skip constructor and prototype keys in nested edits", () => {
      const payload = encode({
        path: "/img/a.jpg",
        edits: { resize: { width: 300, constructor: "bad", prototype: "bad" } },
      });
      const req = createMockReq(`/${payload}`);

      b64DecoderMiddleware()(req, mockRes, mockNext);

      expect(req.query).toEqual({ "resize.width": 300 });
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });
});

describe("b64DecoderMiddleware → extractUrlTransformations (deep unit)", () => {
  const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
  const mockNext = jest.fn();

  const decodeAndExtract = (payload: unknown) => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const req = { url: `/${encoded}`, query: {}, headers: {} } as any;
    b64DecoderMiddleware()(req, mockRes, mockNext);
    return extractUrlTransformations(req as Request, "test");
  };

  it("should produce validated transformations from a B64 payload", () => {
    const result = decodeAndExtract({
      path: "/photos/cat.jpg",
      edits: { resize: { width: 300, height: 200 }, format: "webp", quality: 80 },
    });

    expect(result).toHaveLength(3);
    expect(result.map((t) => t.type).sort()).toEqual(["format", "quality", "resize"]);
    expect(result.find((t) => t.type === "resize")?.value).toEqual({ width: 300, height: 200 });
    expect(result.find((t) => t.type === "format")?.value).toBe("webp");
    expect(result.find((t) => t.type === "quality")?.value).toBe(80);
    result.forEach((t) => expect(t.source).toBe("url"));
  });

  it("should silently skip invalid transformation keys in B64 edits", () => {
    const result = decodeAndExtract({
      path: "/img/a.jpg",
      edits: { resize: { width: 300 }, madeUpTransform: "nope" },
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("resize");
  });

  it("should reject schema-invalid values from B64 edits", () => {
    const result = decodeAndExtract({
      path: "/img/a.jpg",
      edits: { quality: 150 }, // exceeds max
    });

    expect(result).toHaveLength(0);
  });

  it("should produce no transformations for path-only B64 payload", () => {
    const result = decodeAndExtract({ path: "/img/a.jpg" });

    expect(result).toHaveLength(0);
  });
});
