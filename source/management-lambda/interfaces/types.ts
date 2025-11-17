// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";
import {
  Mapping,
  MappingCreate,
  MappingUpdate,
  Origin,
  OriginCreate,
  OriginUpdate,
  TransformationPolicy,
  TransformationPolicyCreate,
  TransformationPolicyUpdate,
} from "../../data-models";

/**
 * Zod schemas to generate type definitions for static type checking and runtime validators on DynamoDB items
 * Supported entity types for DDB items - [Origin, Transformation Policy, Mapping (path mapping or host-header mapping)]
 */

/**
 * Entity type enum
 */
export enum DBEntityType {
  ORIGIN = "ORIGIN",
  POLICY = "POLICY",
  PATH_MAPPING = "PATH_MAPPING",
  HOST_HEADER_MAPPING = "HOST_HEADER_MAPPING",
}

/**
 * Generic db entity schema
 */
const GenericDBSchema = z.strictObject({
  /**
   * Unique identifier for the entity. Also, the primary key
   * eg. originId, policyId, path or host-header pattern
   * Support access patterns to get item by ids
   */
  PK: z.string(),
  /**
   * Global Secondary Index partition key
   * This identifies entity type
   * Supports access pattern to query all entities of a kind
   */
  GSI1PK: z.enum(DBEntityType),
  /**
   * Global Secondary Index sort key
   * Supports sorting on names, path patterns and host-header patterns
   */
  GSI1SK: z.string(),
  /**
   * Create time
   */
  CreatedAt: z.iso.datetime(),
  /**
   * Update time
   */
  UpdatedAt: z.iso.datetime().optional(),
});

/**
 * Origin entity schema
 * Origins are used for image fetches
 */
const OriginDBSchema = GenericDBSchema.extend({
  Data: z.strictObject({
    /**
     * Name of the origin
     */
    originName: z.string(),
    /**
     * DNS domain name of the origin
     * eg. example.com
     */
    originDomain: z.string().regex(/^([a-zA-Z0-9](?:(?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6})$/),
    /**
     * Optional path to append when making request to the origin
     * eg. /images
     */
    originPath: z.string().optional(),
    /**
     * Optional headers to send when making request to the origin
     * eg. { 'x-api-key': '1234567890' }
     */
    originHeaders: z.record(z.string(), z.string()).optional(),
  }),
});

/**
 * Transformation policy schema
 * Policy encapsulates transformations to apply
 */
const TransformationPolicyDBSchema = GenericDBSchema.extend({
  Data: z.strictObject({
    /**
     * Name of the policy
     * eg. Thumbnail
     */
    policyName: z.string(),
    /**
     * JSON string of the policy
     * eg. { "width": 100, "height": 100, "fit": "cover" }
     */
    policyJSON: z.json(),
    /**
     * Description of the policy
     */
    description: z.string().optional(),
    /**
     * Flag to indicate if this is the default policy
     * Only one policy can be set to default in DIT
     */
    isDefault: z.boolean(),
  }),
  /**
   * GSI-2 partition key
   * "DEFAULT_POLICY" only when this is the default policy
   * Supports access pattern for getItem() on "DEFAULT_POLICY"
   */
  GSI2PK: z.string().optional(),
});

/**
 * Mapping entity schema
 * Maps path patterns or host-header patterns to origins, defining how requests are routed
 * Can optionally identify transformation policy to apply
 */
const MappingDBSchema = GenericDBSchema.extend({
  Data: z.strictObject({
    /**
     * Name of the mapping
     */
    mappingName: z.string(),
    /**
     * Description of the mapping
     */
    description: z.string().optional(),
    /**
     * Origin Id to map to
     */
    originId: z.string(),
    /**
     * Policy Id for the policy to apply
     */
    policyId: z.string().optional(),
  }),
  /**
   * GSI-2 partition key
   * Identifies mapped origin
   * Supports query on getting mappings for the specified origin id
   */
  GSI2PK: z.string(),
  /**
   * GSI-3 partition key
   * Identifies mapped policy
   * Supports query on getting mappings for the specified policy id
   */
  GSI3PK: z.string().optional(),
});

// Type exports for use with ddb items
export type DBOrigin = z.infer<typeof OriginDBSchema>;
export type DBTransformationPolicy = z.infer<typeof TransformationPolicyDBSchema>;
export type DBMapping = z.infer<typeof MappingDBSchema>;

// Runtime data validators
export const validateOriginItem = (item: any) => OriginDBSchema.safeParse(item);
export const validatePolicyItem = (item: any) => TransformationPolicyDBSchema.safeParse(item);
export const validateMappingItem = (item: any) => MappingDBSchema.safeParse(item);

// All allowed types with dynamodb items and request/response objects
export type AllowedDBEntities = DBOrigin | DBTransformationPolicy | DBMapping;
export type AllowedDataModelEntities = TransformationPolicy | Origin | Mapping;
export type AllowedRequestTypes =
  | OriginCreate
  | OriginUpdate
  | TransformationPolicyCreate
  | TransformationPolicyUpdate
  | MappingCreate
  | MappingUpdate;
