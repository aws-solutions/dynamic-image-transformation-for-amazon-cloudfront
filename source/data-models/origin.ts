// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

// Strict validation schemas for user inputs
const originIdSchema = z.uuid({ version: "v4" });
const originNameSchema = z
  .string()
  .min(1)
  .max(100)
  .trim() // removes leading and trailing whitespace
  .regex(/^[a-zA-Z0-9 _-]+$/, "Only alphanumeric, spaces, underscore, hyphen allowed");
const originDomainSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/,
    "Invalid domain format"
  );
const originPathSchema = z
  .string()
  .min(2)
  .max(2048)
  .regex(
    /^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*[^.]$/,
    "Path must start with /, be more than just '/', and cannot be a file"
  );
const originHeadersSchema = z.record(
  z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9-]+$/, "Invalid header name"),
  z
    .string()
    .min(1)
    .max(1000)
    .regex(/^[a-zA-Z0-9 ._:;,/=+-]+$/, "Invalid header value")
);

/**
 * Zod schema for Origin entity
 * Based on OpenAPI spec components/schemas/Origin
 */
const OriginSchema = z.strictObject({
  originId: originIdSchema,
  originName: originNameSchema,
  originDomain: originDomainSchema,
  originPath: originPathSchema.optional(),
  originHeaders: originHeadersSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
});

/**
 * Zod schema for origin create request
 * Based on OpenAPI spec components/schemas/OriginCreate
 */
const OriginCreateSchema = z.strictObject({
  originName: originNameSchema,
  originDomain: originDomainSchema,
  originPath: originPathSchema.optional(),
  originHeaders: originHeadersSchema.optional(),
});

/**
 * Zod schema for origin update request
 * Based on OpenAPI spec components/schemas/OriginUpdate
 */
const OriginUpdateSchema = z
  .strictObject({
    originName: originNameSchema.optional(),
    originDomain: originDomainSchema.optional(),
    originPath: originPathSchema.optional(),
    originHeaders: originHeadersSchema.optional(),
  })
  .refine(
    (data) => {
      const hasName = data.originName !== undefined;
      const hasDomain = data.originDomain !== undefined;
      const hasPath = data.originPath !== undefined;
      const hasHeaders = data.originHeaders !== undefined;

      // Must have at least one field to update
      return hasName || hasDomain || hasPath || hasHeaders;
    },
    {
      message: "At least one field must be provided for update",
      path: ["originName", "originDomain", "originPath", "originHeaders"],
    }
  );

// Type exports for use with origin requests for static type checking
export type Origin = z.infer<typeof OriginSchema>;
export type OriginCreate = z.infer<typeof OriginCreateSchema>;
export type OriginUpdate = z.infer<typeof OriginUpdateSchema>;

// Runtime validators for origin data and create/update requests
export const validateOrigin = (item: any) => OriginSchema.safeParse(item);
export const validateOriginCreate = (item: any) => OriginCreateSchema.safeParse(item);
export const validateOriginUpdate = (item: any) => OriginUpdateSchema.safeParse(item);
