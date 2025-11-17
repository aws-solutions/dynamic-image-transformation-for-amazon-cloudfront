// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

// Strict validation schemas for user inputs
const mappingIdSchema = z.uuid({ version: "v4" });
const mappingNameSchema = z
  .string()
  .min(1)
  .max(100)
  .trim()
  .regex(/^[a-zA-Z0-9 _-]+$/, "Only alphanumeric, spaces, underscore, hyphen allowed");
const descriptionSchema = z.string().max(500).trim();
const hostHeaderPatternSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(
    /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    "Invalid host pattern - use format: example.com or *.example.com"
  );
const pathPatternSchema = z
  .string()
  .min(1)
  .max(1023)
  .regex(/^\/([a-zA-Z0-9._-]+\/?)*(\*)?$/, "Invalid path pattern - use format: /path or /path/* for wildcards");
const originIdSchema = z.uuid({ version: "v4" });
const policyIdSchema = z.uuid({ version: "v4" });

/**
 * Zod schema for Mapping entity
 * Based on OpenAPI spec components/schemas/Mapping
 */
const MappingSchema = z
  .strictObject({
    mappingId: mappingIdSchema,
    mappingName: mappingNameSchema,
    description: descriptionSchema.optional(),
    hostHeaderPattern: hostHeaderPatternSchema.optional(),
    pathPattern: pathPatternSchema.optional(),
    originId: originIdSchema,
    policyId: policyIdSchema.optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime().optional(),
  })
  .refine((data) => (data.hostHeaderPattern && !data.pathPattern) || (!data.hostHeaderPattern && data.pathPattern), {
    message: "Exactly one of hostHeaderPattern or pathPattern must be provided",
    path: ["hostHeaderPattern", "pathPattern"],
  });

/**
 * Zod schema for mapping create request
 * Based on OpenAPI spec components/schemas/MappingCreate
 */
const MappingCreateSchema = z
  .strictObject({
    mappingName: mappingNameSchema,
    description: descriptionSchema.optional(),
    hostHeaderPattern: hostHeaderPatternSchema.optional(),
    pathPattern: pathPatternSchema.optional(),
    originId: originIdSchema,
    policyId: policyIdSchema.optional(),
  })
  .refine((data) => (data.hostHeaderPattern && !data.pathPattern) || (!data.hostHeaderPattern && data.pathPattern), {
    message: "Exactly one of hostHeaderPattern or pathPattern must be provided",
    path: ["hostHeaderPattern", "pathPattern"],
  });

/**
 * Zod schema for mapping update request
 * Based on OpenAPI spec components/schemas/MappingUpdate
 */
const MappingUpdateSchema = z
  .strictObject({
    mappingName: mappingNameSchema.optional(),
    description: descriptionSchema.optional(),
    hostHeaderPattern: hostHeaderPatternSchema.optional(),
    pathPattern: pathPatternSchema.optional(),
    originId: originIdSchema.optional(),
    policyId: policyIdSchema.optional(),
  })
  .refine(
    (data) => {
      const hasName = data.mappingName !== undefined;
      const hasDescription = data.description !== undefined;
      const hasHost = data.hostHeaderPattern !== undefined;
      const hasPath = data.pathPattern !== undefined;
      const hasOrigin = data.originId !== undefined;
      const hasPolicy = data.policyId !== undefined;

      // Must have at least one field to update
      const hasAnyField = hasName || hasDescription || hasHost || hasPath || hasOrigin || hasPolicy;
      if (!hasAnyField) return false;

      // Cannot have both host and path patterns
      return !(hasHost && hasPath);
    },
    {
      message: "At least one field must be provided for update, and cannot have both hostHeaderPattern and pathPattern",
      path: ["hostHeaderPattern", "pathPattern"],
    }
  );

// Type exports for use with mapping requests for static type checking
export type Mapping = z.infer<typeof MappingSchema>;
export type MappingCreate = z.infer<typeof MappingCreateSchema>;
export type MappingUpdate = z.infer<typeof MappingUpdateSchema>;

// Runtime validators for mapping and create/update requests
export const validateMapping = (item: any) => MappingSchema.safeParse(item);
export const validateMappingCreate = (item: any) => MappingCreateSchema.safeParse(item);
export const validateMappingUpdate = (item: any) => MappingUpdateSchema.safeParse(item);
