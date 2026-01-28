// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  normalizePayload,
  denormalizePayload,
  createJpegOnlyPayload,
} from "../payload-normalizer";

describe("PayloadNormalizer", () => {
  describe("normalizePayload", () => {
    it("should normalize old format payload to new format", () => {
      const oldPayload = {
        bucket: "test-bucket",
        use_efs: true,
        key: "item_images/test.jpg",
        bw_original_version: 1754662535,
        edits: {
          resize: { width: 750, height: 473, fit: "inside" },
          avif: { quality: 70 },
        },
      };

      const normalized = normalizePayload(oldPayload);

      expect(normalized.bucket).toBe("test-bucket");
      expect(normalized.efs).toBe(true);
      expect(normalized.key).toBe("item_images/test.jpg");
      expect(normalized.v).toBe(1754662535);
      expect(normalized.edits?.resize?.w).toBe(750);
      expect(normalized.edits?.resize?.h).toBe(473);
      expect(normalized.edits?.resize?.fit).toBe("inside");
      expect(normalized.edits?.avif?.q).toBe(70);
    });

    it("should handle new format payload (passthrough)", () => {
      const newPayload = {
        bucket: "test-bucket",
        efs: true,
        key: "item_images/test.jpg",
        v: 1754662535,
        edits: {
          resize: { w: 750, h: 473 },
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      const normalized = normalizePayload(newPayload);

      expect(normalized.bucket).toBe("test-bucket");
      expect(normalized.efs).toBe(true);
      expect(normalized.key).toBe("item_images/test.jpg");
      expect(normalized.v).toBe(1754662535);
      expect(normalized.edits?.resize?.w).toBe(750);
      expect(normalized.edits?.resize?.h).toBe(473);
      expect(normalized.edits?.resize?.fit).toBe("inside"); // default
      expect(normalized.edits?.avif?.q).toBe(70);
      expect(normalized.edits?.jpeg?.q).toBe(85);
    });

    it("should default resize.fit to 'inside' when not specified", () => {
      const payload = {
        bucket: "test-bucket",
        key: "test.jpg",
        edits: {
          resize: { w: 100, h: 100 },
        },
      };

      const normalized = normalizePayload(payload);

      expect(normalized.edits?.resize?.fit).toBe("inside");
    });

    it("should handle mixed format payload", () => {
      const mixedPayload = {
        bucket: "test-bucket",
        use_efs: false, // old
        efs: true, // new (should take precedence)
        key: "item_images/test.jpg",
        v: 1234567890, // new (should take precedence)
        bw_original_version: 9876543210, // old
        edits: {
          resize: { width: 500, w: 600, height: 400 }, // mixed
          avif: { quality: 80 }, // old
        },
      };

      const normalized = normalizePayload(mixedPayload);

      // New format takes precedence
      expect(normalized.efs).toBe(true);
      expect(normalized.v).toBe(1234567890);
      // For resize, new format (w) takes precedence over old (width)
      expect(normalized.edits?.resize?.w).toBe(600);
      expect(normalized.edits?.resize?.h).toBe(400);
      expect(normalized.edits?.avif?.q).toBe(80);
    });

    it("should handle empty payload", () => {
      const normalized = normalizePayload({});

      expect(normalized.key).toBe(undefined);
      expect(normalized.efs).toBe(undefined);
      expect(normalized.edits).toBe(undefined);
    });

    it("should handle null payload", () => {
      const normalized = normalizePayload(null);

      expect(normalized.key).toBe("");
    });

    it("should normalize all quality formats", () => {
      const payload = {
        key: "test.jpg",
        edits: {
          avif: { quality: 70 },
          jpeg: { quality: 80 },
          png: { quality: 90 },
          webp: { quality: 85 },
        },
      };

      const normalized = normalizePayload(payload);

      expect(normalized.edits?.avif?.q).toBe(70);
      expect(normalized.edits?.jpeg?.q).toBe(80);
      expect(normalized.edits?.png?.q).toBe(90);
      expect(normalized.edits?.webp?.q).toBe(85);
    });
  });

  describe("denormalizePayload", () => {
    it("should convert normalized payload back to original format", () => {
      const normalized = {
        bucket: "test-bucket",
        efs: true,
        key: "item_images/test.jpg",
        v: 1754662535,
        edits: {
          resize: { w: 750, h: 473, fit: "inside" },
          avif: { q: 70 },
        },
      };

      const denormalized = denormalizePayload(normalized);

      expect(denormalized.bucket).toBe("test-bucket");
      expect(denormalized.use_efs).toBe(true);
      expect(denormalized.key).toBe("item_images/test.jpg");
      expect(denormalized.bw_original_version).toBe(1754662535);
      expect(denormalized.edits?.resize?.width).toBe(750);
      expect(denormalized.edits?.resize?.height).toBe(473);
      expect(denormalized.edits?.resize?.fit).toBe("inside");
      expect(denormalized.edits?.avif?.quality).toBe(70);
    });
  });

  describe("createJpegOnlyPayload", () => {
    it("should remove avif from edits and keep jpeg", () => {
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

      const jpegOnly = createJpegOnlyPayload(payload);

      expect(jpegOnly.bucket).toBe("test-bucket");
      expect(jpegOnly.efs).toBe(true);
      expect(jpegOnly.key).toBe("item_images/test.jpg");
      expect(jpegOnly.edits?.resize).toEqual({ w: 750, h: 473, fit: "inside" });
      expect(jpegOnly.edits?.avif).toBeUndefined();
      expect(jpegOnly.edits?.jpeg?.q).toBe(85);
    });

    it("should not modify the original payload", () => {
      const payload = {
        key: "test.jpg",
        edits: {
          avif: { q: 70 },
          jpeg: { q: 85 },
        },
      };

      createJpegOnlyPayload(payload);

      // Original should still have avif
      expect(payload.edits?.avif).toBeDefined();
    });
  });
});
