// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for transformation policy validation covering real-world scenarios.
 * Validates complete policy objects including transformations and output optimizations.
 */

import { validateTransformationPolicyCreate, transformationSchemas } from "../transformation-policy";

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
                [1.0, 2.0, 70], // 1x-2x DPR: 70% quality
                [2.0, 3.0, 90], // 2x-3x DPR: 90% quality
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
              value: [80, [1.0, 2.0, 70]],
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
              value: ["https://example.com/logo.png", [10, 10, null, null, null]],
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
              value: [85, [1.0, 2.0, 80], [2.0, 4.0, 60]],
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

  describe("Quality Output Schema - Integer Validation", () => {
    it("should accept integer quality values (1-100) for DPR rules", () => {
      const policy = {
        policyName: "Integer Quality Policy",
        description: "Policy with integer quality values for DPR optimization",
        policyJSON: {
          outputs: [
            {
              type: "quality",
              value: [80, [1, 1.5, 60], [2, 999, 90]],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should reject decimal quality values (0-1) for DPR rules", () => {
      const policy = {
        policyName: "Decimal Quality Policy",
        description: "Policy with decimal quality values (old format)",
        policyJSON: {
          outputs: [
            {
              type: "quality",
              value: [80, [1, 1.5, 0.6], [2, 999, 0.9]],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("Invalid input: expected int, received number");
    });

    it("should reject quality values outside 1-100 range", () => {
      const policy = {
        policyName: "Invalid Range Quality Policy",
        policyJSON: {
          outputs: [
            {
              type: "quality",
              value: [80, [1, 1.5, 150], [2, 999, 0]],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(false);
    });

    it("should accept edge case quality values (1 and 100)", () => {
      const policy = {
        policyName: "Edge Case Quality Policy",
        policyJSON: {
          outputs: [
            {
              type: "quality",
              value: [50, [1, 1.5, 1], [2, 999, 100]], // Min: 1, Max: 100
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });

    it("should accept default quality only (no DPR rules)", () => {
      const policy = {
        policyName: "Default Quality Only Policy",
        policyJSON: {
          outputs: [
            {
              type: "quality",
              value: [75],
            },
          ],
        },
        isDefault: false,
      };

      const result = validateTransformationPolicyCreate(policy);
      expect(result.success).toBe(true);
    });
  });

  describe("smartCrop schema", () => {
    const parse = (value: unknown) => transformationSchemas.smartCrop.safeParse(value);

    // Valid Rekognition Custom Labels project-version ARN.
    const VALID_CUSTOM_MODEL_ARN =
      "arn:aws:rekognition:us-east-1:123456789012:project/model/version/model.v1/1700000000000";

    // Schema accepts all valid configurations
    describe("valid configurations", () => {
      it("should accept legacy boolean true", () => {
        expect(parse(true).success).toBe(true);
      });

      it("should accept legacy {index, padding} object", () => {
        expect(parse({ index: 5, padding: 20 }).success).toBe(true);
      });

      it("should accept expanded format with faces only", () => {
        expect(parse({ faces: true }).success).toBe(true);
      });

      it("should accept expanded format with all fields", () => {
        expect(parse({
          enabled: true,
          faces: true,
          faceIndex: 3,
          labels: ["Person", "Car"],
          customModelArn: VALID_CUSTOM_MODEL_ARN,
          aspectRatio: "16:9",
          padding: "10%",
          gravity: "top-center",
          priorities: ["aspectRatio", "padding"],
          retainText: true,
          retainLogo: false,
          fallback: "contain",
          minConfidence: 85,
        }).success).toBe(true);
      });

      it("should accept all padding formats", () => {
        expect(parse({ faces: true, padding: 50 }).success).toBe(true);
        expect(parse({ faces: true, padding: "10%" }).success).toBe(true);
        expect(parse({ faces: true, padding: "50px" }).success).toBe(true);
      });

      it("should accept all directional gravity positions", () => {
        const positions = [
          "top-left", "top-center", "top-right",
          "center-left", "center", "center-right",
          "bottom-left", "bottom-center", "bottom-right",
        ];
        for (const pos of positions) {
          expect(parse({ faces: true, gravity: pos }).success).toBe(true);
        }
      });

      it("should accept label-based gravity", () => {
        expect(parse({ faces: true, gravity: "Person" }).success).toBe(true);
      });

      it("should accept all fallback modes", () => {
        for (const mode of ["cover", "contain", "fill", "inside", "outside", "no-crop"]) {
          expect(parse({ faces: true, fallback: mode }).success).toBe(true);
        }
      });

      it("should accept priority list in any valid permutation", () => {
        expect(parse({ faces: true, priorities: ["padding", "aspectRatio"] }).success).toBe(true);
        expect(parse({ faces: true, priorities: ["aspectRatio"] }).success).toBe(true);
      });

      it("should accept boundary values", () => {
        expect(parse({ faceIndex: 0 }).success).toBe(true);
        expect(parse({ faceIndex: 15 }).success).toBe(true);
        expect(parse({ faces: true, minConfidence: 0 }).success).toBe(true);
        expect(parse({ faces: true, minConfidence: 100 }).success).toBe(true);
        expect(parse({ faces: true, aspectRatio: "1:1" }).success).toBe(true);
        expect(parse({ faces: true, aspectRatio: "100:100" }).success).toBe(true);
      });

      it("should reject empty expanded object (no detection methods)", () => {
        const result = parse({});
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("At least one detection method is required");
        }
      });
    });

    // Detection method requirement
    describe("detection method requirement", () => {
      it("should accept when faces is true", () => {
        expect(parse({ faces: true }).success).toBe(true);
      });

      it("should accept when faceIndex is set", () => {
        expect(parse({ faceIndex: 0 }).success).toBe(true);
      });

      it("should accept when labels are provided", () => {
        expect(parse({ labels: ["Person"] }).success).toBe(true);
      });

      it("should accept when customModelArn is set", () => {
        expect(parse({ customModelArn: VALID_CUSTOM_MODEL_ARN }).success).toBe(true);
      });

      it("should accept when retainText is true", () => {
        expect(parse({ retainText: true }).success).toBe(true);
      });

      it("should accept when retainLogo is true", () => {
        expect(parse({ retainLogo: true }).success).toBe(true);
      });

      it("should reject when only non-detection fields are set", () => {
        expect(parse({ aspectRatio: "16:9", padding: "10%", gravity: "center", fallback: "cover" }).success).toBe(false);
      });

      it("should reject when faces is explicitly false with no other detection", () => {
        expect(parse({ faces: false }).success).toBe(false);
      });

      it("should reject when enabled is true but no detection method", () => {
        expect(parse({ enabled: true }).success).toBe(false);
      });
    });

    // Invalid input rejection (smartCrop)
    describe("invalid configurations", () => {
      it("should reject faceIndex outside 0-15", () => {
        expect(parse({ faceIndex: -1 }).success).toBe(false);
        expect(parse({ faceIndex: 16 }).success).toBe(false);
      });

      it("should reject minConfidence outside 0-100", () => {
        expect(parse({ minConfidence: -1 }).success).toBe(false);
        expect(parse({ minConfidence: 101 }).success).toBe(false);
      });

      it("should reject malformed aspect ratio", () => {
        expect(parse({ aspectRatio: "16x9" }).success).toBe(false);
        expect(parse({ aspectRatio: "0:0" }).success).toBe(false);
        expect(parse({ aspectRatio: "1000:1" }).success).toBe(false);
      });

      it("should reject invalid fallback mode", () => {
        expect(parse({ fallback: "stretch" }).success).toBe(false);
      });

      it("should reject invalid constraint type in priorities", () => {
        expect(parse({ priorities: ["zoom"] }).success).toBe(false);
      });

      it("should reject malformed padding strings", () => {
        expect(parse({ padding: "abc" }).success).toBe(false);
        expect(parse({ padding: "10em" }).success).toBe(false);
        expect(parse({ padding: "10%x,20%y" }).success).toBe(false);
        expect(parse({ padding: "30pxx,50pxy" }).success).toBe(false);
      });

      it("should reject unknown fields in expanded format", () => {
        expect(parse({ unknownField: true }).success).toBe(false);
      });

      it("should accept labels at the count cap (50) and reject 51", () => {
        expect(parse({ labels: Array.from({ length: 50 }, (_, i) => `L${i}`) }).success).toBe(true);
        expect(parse({ labels: Array.from({ length: 51 }, (_, i) => `L${i}`) }).success).toBe(false);
      });

      it("should reject a label longer than 100 characters", () => {
        expect(parse({ labels: ["a".repeat(101)] }).success).toBe(false);
      });

      it("should reject a malformed customModelArn", () => {
        expect(parse({ customModelArn: "not-an-arn" }).success).toBe(false);
        // account id not 12 digits
        expect(parse({ customModelArn: "arn:aws:rekognition:us-east-1:123:project/m/version/1" }).success).toBe(false);
        // wrong service
        expect(parse({ customModelArn: "arn:aws:s3:::my-bucket" }).success).toBe(false);
      });

      it("should reject a customModelArn over the length cap", () => {
        const longArn = `arn:aws:rekognition:us-east-1:123456789012:project/${"x".repeat(1000)}/version/v/1`;
        expect(parse({ customModelArn: longArn }).success).toBe(false);
      });
    });
  });

  describe("contentModeration schema", () => {
    const parse = (value: unknown) => transformationSchemas.contentModeration.safeParse(value);

    describe("valid configurations", () => {
      it("should accept boolean true", () => {
        expect(parse(true).success).toBe(true);
      });

      it("should accept empty object (all defaults)", () => {
        expect(parse({}).success).toBe(true);
      });

      it("should accept partial object with minConfidence only", () => {
        expect(parse({ minConfidence: 60 }).success).toBe(true);
      });

      it("should accept partial object with blur only", () => {
        expect(parse({ blur: 100 }).success).toBe(true);
      });

      it("should accept partial object with moderationLabels only", () => {
        expect(parse({ moderationLabels: ["Smoking", "Violence"] }).success).toBe(true);
      });

      it("should accept full object with all fields", () => {
        expect(parse({ minConfidence: 60, blur: 100, moderationLabels: ["Smoking"] }).success).toBe(true);
      });

      it("should accept boundary values for minConfidence", () => {
        expect(parse({ minConfidence: 0 }).success).toBe(true);
        expect(parse({ minConfidence: 100 }).success).toBe(true);
      });

      it("should accept boundary values for blur", () => {
        expect(parse({ blur: 0.3 }).success).toBe(true);
        expect(parse({ blur: 1000 }).success).toBe(true);
      });
    });

    describe("invalid configurations", () => {
      it("should reject boolean false", () => {
        expect(parse(false).success).toBe(false);
      });

      it("should reject minConfidence below 0", () => {
        expect(parse({ minConfidence: -1 }).success).toBe(false);
      });

      it("should reject minConfidence above 100", () => {
        expect(parse({ minConfidence: 101 }).success).toBe(false);
      });

      it("should reject blur below 0.3", () => {
        expect(parse({ blur: 0.2 }).success).toBe(false);
      });

      it("should reject blur above 1000", () => {
        expect(parse({ blur: 1001 }).success).toBe(false);
      });

      it("should reject empty string in moderationLabels", () => {
        expect(parse({ moderationLabels: [""] }).success).toBe(false);
      });

      it("should reject unknown fields (strictObject)", () => {
        expect(parse({ unknownField: true }).success).toBe(false);
      });
    });

    describe("policy-level integration", () => {
      it("should accept contentModeration with boolean true in a policy", () => {
        const result = validateTransformationPolicyCreate({
          policyName: "Moderation Policy",
          policyJSON: {
            transformations: [{ transformation: "contentModeration", value: true }],
          },
        });
        expect(result.success).toBe(true);
      });

      it("should accept contentModeration with config object in a policy", () => {
        const result = validateTransformationPolicyCreate({
          policyName: "Moderation Policy",
          policyJSON: {
            transformations: [{
              transformation: "contentModeration",
              value: { minConfidence: 60, blur: 100, moderationLabels: ["Smoking"] },
            }],
          },
        });
        expect(result.success).toBe(true);
      });

      it("should accept contentModeration coexisting with smartCrop", () => {
        const result = validateTransformationPolicyCreate({
          policyName: "Combined Policy",
          policyJSON: {
            transformations: [
              { transformation: "contentModeration", value: true },
              { transformation: "smartCrop", value: { faces: true } },
            ],
          },
        });
        expect(result.success).toBe(true);
      });

      it("should accept contentModeration with a condition", () => {
        const result = validateTransformationPolicyCreate({
          policyName: "Conditional Moderation",
          policyJSON: {
            transformations: [{
              transformation: "contentModeration",
              value: true,
              condition: { field: "category", value: "user-generated" },
            }],
          },
        });
        expect(result.success).toBe(true);
      });
    });
  });
});
