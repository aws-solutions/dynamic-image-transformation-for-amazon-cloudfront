// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for transformation policy validation covering real-world scenarios.
 * Validates complete policy objects including transformations and output optimizations.
 */

import { validateTransformationPolicyCreate } from "../transformation-policy";

describe("Transformation Policy Validation", () => {
  describe("Real-world policy scenarios", () => {
    it("should validate policy with all output optimizations enabled", () => {
      const policy = {
        policyName: "Full Optimization Policy",
        description: "Policy with all output optimizations for maximum performance",
        policyJSON: {
          outputs: [
            {
              type: "quality",
              value: [
                80, // default quality
                [1.0, 2.0, 0.7], // 1x-2x DPR: 70% quality
                [2.0, 3.0, 0.9], // 2x-3x DPR: 90% quality
              ],
            },
            {
              type: "format",
              value: "auto",
            },
            {
              type: "autosize",
              value: [320, 640, 768, 1024, 1200],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should validate policy optimized for slow connections", () => {
      const policy = {
        policyName: "Slow Connection Optimized",
        description: "Aggressive compression and smaller sizes for slow networks",
        policyJSON: {
          transformations: [
            {
              transformation: "resize",
              value: { width: 800, withoutEnlargement: true },
            },
            {
              transformation: "stripExif",
              value: true,
            },
            {
              transformation: "stripIcc",
              value: true,
            },
          ],
          outputs: [
            {
              type: "autosize",
              value: [240, 480, 640],
            },
            {
              type: "quality",
              value: [50],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should validate policy with conditional transformations based on device type", () => {
      const policy = {
        policyName: "Device Adaptive Policy",
        description: "Different transformations based on device capabilities",
        policyJSON: {
          transformations: [
            {
              transformation: "resize",
              value: { width: 1920, height: 1080, fit: "inside" },
              condition: { field: "device", value: "desktop" },
            },
            {
              transformation: "resize",
              value: { width: 768, fit: "cover" },
              condition: { field: "device", value: "tablet" },
            },
            {
              transformation: "resize",
              value: { width: 375, fit: "cover" },
              condition: { field: "device", value: "mobile" },
            },
            {
              transformation: "quality",
              value: 90,
              condition: { field: "device", value: "desktop" },
            },
            {
              transformation: "quality",
              value: 75,
              condition: { field: "device", value: "tablet" },
            },
            {
              transformation: "quality",
              value: 60,
              condition: { field: "device", value: "mobile" },
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should validate e-commerce product image policy", () => {
      const policy = {
        policyName: "Ecommerce Product Images",
        description: "Optimized for product catalog with multiple sizes and formats",
        policyJSON: {
          transformations: [
            {
              transformation: "resize",
              value: { width: 800, height: 800, fit: "contain", background: "white" },
            },
            {
              transformation: "sharpen",
              value: { sigma: 1.5, m1: 1, m2: 2, x1: 2, y2: 10, y3: 20 },
            },
            {
              transformation: "stripExif",
              value: true,
            },
          ],
          outputs: [
            {
              type: "autosize",
              value: [150, 300, 600, 800, 1200],
            },
            {
              type: "format",
              value: "auto",
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should validate photo editing workflow policy", () => {
      const policy = {
        policyName: "Photo Editing Workflow",
        description: "Professional photo processing with advanced transformations",
        policyJSON: {
          transformations: [
            {
              transformation: "extract",
              value: [100, 50, 1800, 1200],
            },
            {
              transformation: "convolve",
              value: {
                width: 3,
                height: 3,
                kernel: [-1, -1, -1, -1, 9, -1, -1, -1, -1],
              },
            },
            {
              transformation: "normalize",
              value: true,
            },
            {
              transformation: "tint",
              value: [255, 240, 220, 0.1],
            },
            {
              transformation: "rotate",
              value: 2.5,
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should validate social media content policy", () => {
      const policy = {
        policyName: "Social Media Content",
        description: "Optimized for social media platforms with face detection",
        policyJSON: {
          transformations: [
            {
              transformation: "smartCrop",
              value: { index: 0, padding: 20 },
            },
            {
              transformation: "resize",
              value: { width: 1080, height: 1080, fit: "cover" },
            },
            {
              transformation: "sharpen",
              value: true,
            },
          ],
          outputs: [
            {
              type: "autosize",
              value: [320, 640, 1080],
            },
          ],
        },
        isDefault: true,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should validate accessibility-focused policy", () => {
      const policy = {
        policyName: "Accessibility_Enhanced",
        description: "High contrast and optimized for screen readers",
        policyJSON: {
          transformations: [
            {
              transformation: "resize",
              value: { width: 800, height: 600, fit: "contain", background: "#ffffff" },
            },
            {
              transformation: "normalize",
              value: true,
            },
            {
              transformation: "sharpen",
              value: { sigma: 2.0 },
            }
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should validate minimal transformation policy", () => {
      const policy = {
        policyName: "Minimal Processing",
        description: "Minimal transformations for greyscale",
        policyJSON: {
          transformations: [
            {
              transformation: "greyscale",
              value: true,
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should validate policy with single watermark", () => {
      const policy = {
        policyName: "Single Watermark Policy",
        description: "Policy with single watermark overlay",
        policyJSON: {
          transformations: [
            {
              transformation: "resize",
              value: { width: 800, height: 600, fit: "cover" },
            },
            {
              transformation: "watermark",
              value: ["https://example.com/logo.png", [10, 10, 0.3, 0.3]],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should validate policy with multiple watermarks", () => {
      const policy = {
        policyName: "Multiple Watermarks Policy",
        description: "Policy with multiple watermark overlays",
        policyJSON: {
          transformations: [
            {
              transformation: "resize",
              value: { width: 1200, height: 800, fit: "contain" },
            },
            {
              transformation: "watermark",
              value: [
                ["https://example.com/logo1.png", [5, 5, 0.2, 0.2]],
                ["https://example.com/logo2.png", [100, 100, 0.2, 0.2]],
                ["https://example.com/watermark.png", [50, 200, 0.2, 0.1]]
              ],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });
  });

  describe("Policy validation edge cases", () => {
    it("should fail validation when no transformations provided", () => {
      const policy = {
        policyName: "Invalid Empty Policy",
        policyJSON: {
          transformations: [],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("At least 1 transformation required");
    });

    it("should fail validation when too many transformations provided", () => {
      const transformations = Array.from({ length: 101 }, (_, i) => ({
        transformation: "rotate",
        value: 80 + i,
      }));

      const policy = {
        policyName: "Too Many Transformations",
        policyJSON: {
          transformations,
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("At most 100 transformations supported");
    });

    it("should fail validation for policy exceeding size limit", () => {
      // Create a policy that exceeds 10KB limit in policyJSON
      const policy = {
        policyName: "Large Policy",
        description: "Policy with large JSON that exceeds 10KB",
        policyJSON: {
          transformations: Array.from({ length: 20 }, (_, i) => ({
            transformation: "convolve",
            value: {
              width: 3,
              height: 3,
              kernel: Array.from({ length: 9 }, (_, j) => i * 1000000 + j * 100000 + 123456789),
            },
          })),
          outputs: [
            {
              type: "autosize", 
              value: Array.from({ length: 3000 }, (_, j) => j + 1000000), // 3,000 numbers
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      // policy size JSON.stringify(policy).length
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("Policy too large (max 10KB)");
    });

    it("should fail validation for duplicate output optimizations", () => {
      const policy = {
        policyName: "Duplicate Outputs Policy",
        policyJSON: {
          transformations: [
            {
              transformation: "rotate",
              value: 85,
            },
          ],
          outputs: [
            {
              type: "quality",
              value: [80],
            },
            {
              type: "quality", // Duplicate
              value: [90],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("Each output optimization can only be defined once");
    });

    it("should validate output-only policy without transformations", () => {
      const policy = {
        policyName: "Output Only Policy",
        description: "Policy with only output optimizations",
        policyJSON: {
          outputs: [
            {
              type: "quality",
              value: [80, [1.0, 2.0, 0.7]],
            },
            {
              type: "format",
              value: "auto",
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should fail validation for empty policy with no transformations or outputs", () => {
      const policy = {
        policyName: "Empty Policy",
        policyJSON: {},
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("Policy must have at least one transformation or output optimization");
    });

    it("should fail validation for watermark without width or height ratio", () => {
      const policy = {
        policyName: "Invalid Watermark Policy",
        policyJSON: {
          transformations: [
            {
              transformation: "watermark",
              value: ["https://example.com/logo.png", [10, 10]],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("At least widthRatio or heightRatio must be provided");
    });

    it("should validate policy with mixed transformation types and conditions", () => {
      const policy = {
        policyName: "Complex Mixed Policy",
        description: "Complex policy with various transformation types and conditions",
        policyJSON: {
          transformations: [
            {
              transformation: "resize",
              value: { width: 1200, height: 800, fit: "cover" },
              condition: { field: "viewport", value: ["desktop", "tablet"] },
            },
            {
              transformation: "blur",
              value: 5.5,
              condition: { field: "privacy", value: "true" },
            },
            {
              transformation: "grayscale",
              value: true,
              condition: { field: "theme", value: "monochrome" },
            },
            {
              transformation: "flip",
              value: true,
            },
            {
              transformation: "flop",
              value: true,
            },
            {
              transformation: "flatten",
              value: "#f0f0f0",
            },
          ],
          outputs: [
            {
              type: "quality",
              value: [85, [1.0, 2.0, 0.8], [2.0, 4.0, 0.6]],
            },
            {
              type: "autosize",
              value: [480, 768, 1024, 1440],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });
  });
});
