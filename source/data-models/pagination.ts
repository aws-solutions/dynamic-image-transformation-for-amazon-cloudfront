// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Origin } from "./origin";
import type { Mapping } from "./mappings";
import type { TransformationPolicy } from "./transformation-policy";


// Generic paginated response type
export type PaginatedResponse<T> = {
  items: T[];
  nextToken?: string;
};

export type PaginatedOriginResponse = PaginatedResponse<Origin>;
export type PaginatedMappingResponse = PaginatedResponse<Mapping>;
export type PaginatedPolicyResponse = PaginatedResponse<TransformationPolicy>;
