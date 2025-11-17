// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export {
  validateMapping,
  validateMappingCreate,
  validateMappingUpdate,
  type Mapping,
  type MappingCreate,
  type MappingUpdate,
} from "./mappings";
export {
  validateOrigin,
  validateOriginCreate,
  validateOriginUpdate,
  type Origin,
  type OriginCreate,
  type OriginUpdate,
} from "./origin";
export {
  type PaginatedMappingResponse,
  type PaginatedOriginResponse,
  type PaginatedPolicyResponse,
} from "./pagination";
export {
  validateTransformationPolicy,
  validateTransformationPolicyCreate,
  validateTransformationPolicyUpdate,
  type TransformationPolicy,
  type TransformationPolicyCreate,
  type TransformationPolicyUpdate,
  transformationSchemas,
  outputSchemas,
} from "./transformation-policy";
