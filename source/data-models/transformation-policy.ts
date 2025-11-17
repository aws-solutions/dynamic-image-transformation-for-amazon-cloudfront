// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

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
  z.string().regex(/^-?\d{1,4}p$/).max(5)
]);

// Allows either URLs or domain styled watermark sources
const watermarkUrlSchema = z.string().pipe(z.preprocess((url) => {
  return url.includes('://') ? url : `https://${url}`;
}, z.url({
  hostname: z.regexes.domain,
  protocol: /^https?$/,
  error: "Invalid Watermark source domain protocol. Only HTTPS is supported."
})))

const watermarkTuple = z.tuple([
  watermarkUrlSchema, // source URL, domain must match with one of the Origins on DIT
  z
    .tuple([
      positionSchema, // xOffset
      positionSchema, // yOffset
      z.number().min(0).max(1).optional(), // alpha (0-1 ratio)
      z.number().min(0).max(1).optional(), // widthRatio (0-1 ratio)
      z.number().min(0).max(1).optional(), // heightRatio (0-1 ratio)
    ])
    .refine((data) => data[2] !== undefined || data[3] !== undefined, {
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
  rotate: z.number().transform((val) => val % 360),
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
    z.boolean(), // true - 0 indexed face with 0 padding
    z.strictObject({
      index: z.int().min(0).max(15), // zero-based index of detected faces, 15 faces supported
      padding: z.int().nonnegative().default(0), // padding expressed in pixels, applied to all sides
    }),
  ]),
  stripExif: z.boolean(),
  stripIcc: z.boolean(),
  watermark: z.union([
    watermarkTuple, // single watermark
    z.array(watermarkTuple).min(1, "At least one watermark required"), // multiple watermarks
  ]),
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
        z.number().min(0).max(1), // quality
      ])
    )
    .refine((arr) => arr.length >= 1, "Must have default quality"),
  format: z.enum(["auto", ...transformationSchemas.format.options]),
  autosize: z.array(z.int().positive()).min(1, "Must have at least one element as derivative width to support"),
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
          z.strictObject({ type: z.literal("quality"), value: outputSchemas.quality }),
          z.strictObject({ type: z.literal("format"), value: outputSchemas.format }),
          z.strictObject({ type: z.literal("autosize"), value: outputSchemas.autosize }),
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
    description: descriptionSchema.optional(),
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
export { outputSchemas };

// Runtime validators for transformation policy data and create/update requests
export const validateTransformationPolicy = (data: unknown) => TransformationPolicySchema.safeParse(data);
export const validateTransformationPolicyCreate = (data: unknown) => PolicyCreateSchema.safeParse(data);
export const validateTransformationPolicyUpdate = (data: unknown) => PolicyUpdateSchema.safeParse(data);
