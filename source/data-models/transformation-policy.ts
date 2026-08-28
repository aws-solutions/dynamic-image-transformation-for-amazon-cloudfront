// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

// Caps on smart-crop inputs; keep in sync with the parser mirror in container's smart-crop-parser.ts.
const SMART_CROP_MAX_LABELS = 50;
const SMART_CROP_MAX_LABEL_LENGTH = 100;
const SMART_CROP_MAX_CUSTOM_MODEL_ARN_LENGTH = 1000;
const SMART_CROP_CUSTOM_MODEL_ARN_PATTERN = /^arn:aws:rekognition:[a-z0-9-]+:\d{12}:project\/[^/]+\/version\/[^/]+\/\d+$/;

const policyIdSchema = z.uuid({ version: "v4" });
const policyNameSchema = z
  .string()
  .min(1)
  .max(100)
  .trim()
  .regex(/^[a-zA-Z0-9 _-]+$/, "Only alphanumeric, spaces, underscore, hyphen allowed");
const descriptionSchema = z.string().min(1).max(500).trim();

// https://www.npmjs.com/package/color
const colorSchema = z.union([
  z.tuple([
    z.int().nonnegative().max(255), // r
    z.int().nonnegative().max(255), // g
    z.int().nonnegative().max(255), // b
    z.number().positive().default(1), // alpha
  ]),
  z
    .string()
    .regex(/^[a-zA-Z]+$/)
    .min(3)
    .max(20), // color names
  z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/), // hex with optional alpha
]);

// Accepts integers or percentage strings (e.g., "50p", "-25p") with 1-4 digits followed by 'p'
const positionSchema = z.union([
  z.int(),
  z.string()
    .max(5, "Percentage too long (max 4 digits + p)")
    .regex(/^-?\d{1,4}p$/, "Enter a percentage like 50 or -25p")
]);

// Allows either URLs or domain styled watermark sources
const watermarkUrlSchema = z.string()
  .transform((url) => (url.includes('://') ? url : `https://${url}`))
  .pipe(z.url({
    hostname: z.regexes.domain,
    protocol: /^https?$/,
    error: "Invalid Watermark source domain protocol. Only HTTPS is supported."
  }))

const watermarkTuple = z.tuple([
  watermarkUrlSchema, // source URL, domain must match with one of the Origins on DIT
  z
    .tuple([
      positionSchema, // xOffset
      positionSchema, // yOffset
      z.nullable(z.number().min(0).max(1)).default(null), // alpha (0-1 ratio),
      z.nullable(z.number().min(0).max(1)).default(null), // widthRatio (0-1 ratio),
      z.nullable(z.number().min(0).max(1)).default(null), // heightRatio (0-1 ratio),
    ])
    .refine((data) => {
      const widthRatio = data[3];
      const heightRatio = data[4];
      return (widthRatio !== null) || (heightRatio !== null);
    }, {
      message: "At least widthRatio or heightRatio must be provided",
    }),
]);

// Transformation value schemas (shared between policy and query params)
export const transformationSchemas = {
  animated: z.boolean(),
  flatten: colorSchema,
  quality: z.int().min(1).max(100),
  format: z.enum(["jpg", "jpeg", "png", "tiff", "webp", "gif", "avif"]), // supported image formats
  blur: z.number().min(0.3).max(1000),
  convolve: z.strictObject({
    width: z.int().positive(),
    height: z.int().positive(),
    kernel: z.array(z.int()).length(9), // kernels are 3x3 array
  }),
  extract: z.tuple([
    z.int().nonnegative(), // left
    z.int().nonnegative(), // top
    z.int().nonnegative(), // width
    z.int().nonnegative(), // height
  ]),
  normalize: z.boolean(),
  flip: z.boolean(),
  flop: z.boolean(),
  grayscale: z.boolean(),
  greyscale: z.boolean(),
  resize: z
    .strictObject({
      width: z.int().min(1).max(4000).optional(),
      height: z.int().min(1).max(4000).optional(),
      fit: z.enum(["cover", "contain", "fill", "inside", "outside"]).optional(),
      background: colorSchema.optional(),
      withoutEnlargement: z.boolean().optional(),
      ratio: z.number().min(0).max(1).optional(),
    })
    .refine((data) => data.width || data.height || data.ratio, {
      message: "At least width or height must be provided",
    }),
  tint: colorSchema,
  rotate: z.union([
    z.number().transform((val) => val % 360),
    z.literal('null'),
    z.null(),
  ]),
  sharpen: z.union([
    z.boolean(), // when used without sigma value, performs a fast, mild sharpen of the output image
    z.strictObject({
      sigma: z.number().min(0.000001).max(10), // sigma is provided, performs a slower, more accurate sharpen
      m1: z.int().default(1),
      m2: z.int().default(2),
      x1: z.int().default(2),
      y2: z.int().default(10),
      y3: z.int().default(20),
    }),
  ]),
  smartCrop: z.union([
    // Legacy formats: smartCrop=true or smartCrop={index, padding}
    z.boolean(),
    z.strictObject({
      index: z.int().min(0).max(15),
      padding: z.int().nonnegative().default(0),
    }),
    // Expanded v8.1 format
    z.strictObject({
      enabled: z.boolean().optional(),
      faces: z.boolean().optional(),
      faceIndex: z.int().min(0).max(15).optional(),
      labels: z.array(z.string().min(1).max(SMART_CROP_MAX_LABEL_LENGTH)).max(SMART_CROP_MAX_LABELS).optional(),
      customModelArn: z
        .string()
        .max(SMART_CROP_MAX_CUSTOM_MODEL_ARN_LENGTH)
        .regex(
          SMART_CROP_CUSTOM_MODEL_ARN_PATTERN,
          "customModelArn must be a valid Rekognition Custom Labels project version ARN",
        )
        .optional(),
      aspectRatio: z.string().regex(/^\d{1,3}:\d{1,3}$/, "Aspect ratio must be w:h (e.g. 16:9)").refine((val) => {
        const [w, h] = val.split(':').map(Number);
        return w >= 1 && w <= 100 && h >= 1 && h <= 100;
      }, "Aspect ratio dimensions must be between 1 and 100").optional(),
      padding: z.union([
        z.int().nonnegative(),
        z.string().regex(/^\d{1,4}(%|px)$/, "Padding must be e.g. 10%, 50px"),
      ]).optional(),
      gravity: z.union([
        z.enum([
          'top-left', 'top-center', 'top-right',
          'center-left', 'center', 'center-right',
          'bottom-left', 'bottom-center', 'bottom-right',
        ]),
        z.string().min(1),
      ]).optional(),
      priorities: z.array(z.enum(['aspectRatio', 'padding'], {
        message: "Only 'aspectRatio' and 'padding' are configurable priorities. targetInclusion and gravity are applied automatically.",
      })).optional(),
      retainText: z.boolean().optional(),
      retainLogo: z.boolean().optional(),
      fallback: z.enum(['cover', 'contain', 'fill', 'inside', 'outside', 'no-crop']).optional(),
      minConfidence: z.number().min(0).max(100).optional(),
    }).refine((data) =>
      data.faces === true ||
      data.faceIndex !== undefined ||
      (data.labels && data.labels.length > 0) ||
      data.customModelArn !== undefined ||
      data.retainText === true ||
      data.retainLogo === true,
      { message: "At least one detection method is required (faces, faceIndex, labels, customModelArn, retainText, or retainLogo)" },
    ),
  ]),
  contentModeration: z.union([
    z.literal(true),
    z.strictObject({
      minConfidence: z.number().min(0).max(100).optional(),
      blur: z.number().min(0.3).max(1000).optional(),
      moderationLabels: z.array(z.string().min(1)).optional(),
    }),
  ]),
  stripExif: z.boolean(),
  stripIcc: z.boolean(),
  watermark: watermarkTuple, // single watermark only
};

const outputSchemas = {
  quality: z
    .tuple([
      transformationSchemas.quality, // default quality, when no client hints found or as static value
    ])
    .rest(
      z.tuple([
        z.number().min(0), // min dpr
        z.number().min(0), // max dpr
        z.int().min(1).max(100), // quality
      ])
    )
    .refine((arr) => arr.length >= 1, "Must have default quality"),
  format: z.enum(["auto", ...transformationSchemas.format.options]),
  autosize: z.array(z.int().positive()).min(1, "Must have at least one element as derivative width to support"),
};

const fallbackSchemas = {
  quality: z.strictObject({ dpr: z.number().min(1.0).max(5.0) }),
  format: z.strictObject({ format: transformationSchemas.format }),
  autosize: z.strictObject({ viewportWidth: z.int().min(320).max(3840) }),
};

const conditionSchema = z.strictObject({
  field: z.string(),
  value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]),
});

// Policy schema union of above value schemas
const policySchema = z
  .strictObject({
    transformations: z
      .array(
        z.discriminatedUnion("transformation", [
          z.strictObject({
            transformation: z.literal("animated"),
            value: transformationSchemas.animated,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("blur"),
            value: transformationSchemas.blur,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("convolve"),
            value: transformationSchemas.convolve,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("extract"),
            value: transformationSchemas.extract,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("normalize"),
            value: transformationSchemas.normalize,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("normalise"),
            value: transformationSchemas.normalize,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("grayscale"),
            value: transformationSchemas.grayscale,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("greyscale"),
            value: transformationSchemas.grayscale,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("resize"),
            value: transformationSchemas.resize,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("format"),
            value: transformationSchemas.format,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("quality"),
            value: transformationSchemas.quality,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("rotate"),
            value: transformationSchemas.rotate,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("sharpen"),
            value: transformationSchemas.sharpen,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("smartCrop"),
            value: transformationSchemas.smartCrop,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("contentModeration"),
            value: transformationSchemas.contentModeration,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("stripExif"),
            value: transformationSchemas.stripExif,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("stripIcc"),
            value: transformationSchemas.stripIcc,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("flip"),
            value: transformationSchemas.flip,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("flop"),
            value: transformationSchemas.flop,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("tint"),
            value: transformationSchemas.tint,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("flatten"),
            value: transformationSchemas.flatten,
            condition: conditionSchema.optional(),
          }),
          z.strictObject({
            transformation: z.literal("watermark"),
            value: transformationSchemas.watermark,
            condition: conditionSchema.optional(),
          }),
        ])
      )
      .min(1, "At least 1 transformation required")
      .max(100, "At most 100 transformations supported")
      .optional(),
    outputs: z
      .array(
        z.discriminatedUnion("type", [
          z.strictObject({
            type: z.literal("quality"),
            value: outputSchemas.quality,
            fallback: fallbackSchemas.quality.optional(),
          }),
          z.strictObject({
            type: z.literal("format"),
            value: outputSchemas.format,
            fallback: fallbackSchemas.format.optional(),
          }),
          z.strictObject({
            type: z.literal("autosize"),
            value: outputSchemas.autosize,
            fallback: fallbackSchemas.autosize.optional(),
          }),
        ])
      )
      .refine((outputs) => {
        const types = outputs.map((output) => output.type);
        return new Set(types).size === types.length;
      }, "Each output optimization can only be defined once")
      .optional(),
  })
  .refine((val) => {
    const jsonString = JSON.stringify(val);
    return jsonString.length <= 10000;
  }, "Policy too large (max 10KB)")
  .refine(
    (val) => (val.transformations && val.transformations.length > 0) || (val.outputs && val.outputs.length > 0),
    "Policy must have at least one transformation or output optimization"
  );

/**
 * Zod schema for TransformationPolicy entity
 * Based on OpenAPI spec components/schemas/TransformationPolicy
 */
const TransformationPolicySchema = z.strictObject({
  policyId: policyIdSchema,
  policyName: policyNameSchema,
  description: descriptionSchema.optional(),
  policyJSON: policySchema,
  isDefault: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
});

/**
 * Zod schema for creating a new TransformationPolicy
 * Based on OpenAPI spec components/schemas/PolicyCreate
 */
const PolicyCreateSchema = z.strictObject({
  policyName: policyNameSchema,
  description: descriptionSchema.optional(),
  policyJSON: policySchema,
  isDefault: z.boolean().default(false),
});

/**
 * Zod schema for updating an existing TransformationPolicy
 * Based on OpenAPI spec components/schemas/PolicyUpdate
 */
const PolicyUpdateSchema = z
  .strictObject({
    policyName: policyNameSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    policyJSON: policySchema.optional(),
    isDefault: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const hasName = data.policyName !== undefined;
      const hasDescription = data.description !== undefined;
      const hasJSON = data.policyJSON !== undefined;
      const hasDefault = data.isDefault !== undefined;

      // Must have at least one field to update
      return hasName || hasDescription || hasJSON || hasDefault;
    },
    {
      message: "At least one field must be provided for update",
      path: ["policyName", "description", "policyJSON", "isDefault"],
    }
  );

// Type exports for use with transformation policy requests for static type checking
export type TransformationPolicy = z.infer<typeof TransformationPolicySchema>;
export type TransformationPolicyCreate = z.infer<typeof PolicyCreateSchema>;
export type TransformationPolicyUpdate = z.infer<typeof PolicyUpdateSchema>;

// Schema exports for validation
export { outputSchemas, fallbackSchemas };

// Runtime validators for transformation policy data and create/update requests
export const validateTransformationPolicy = (data: unknown) => TransformationPolicySchema.safeParse(data);
export const validateTransformationPolicyCreate = (data: unknown) => PolicyCreateSchema.safeParse(data);
export const validateTransformationPolicyUpdate = (data: unknown) => PolicyUpdateSchema.safeParse(data);