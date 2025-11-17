// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const ROUTES = {
  ORIGINS: '/origins',
  ORIGIN_CREATE: '/origins/create',
  ORIGIN_DETAILS: '/origins/:id',
  ORIGIN_EDIT: '/origins/:id/edit',
  MAPPINGS: '/mappings',
  MAPPING_CREATE: '/mappings/create',
  MAPPING_DETAILS: '/mappings/:id',
  MAPPING_EDIT: '/mappings/:id/edit',
  ORIGIN_MAPPINGS: '/origin-mappings',
  ORIGIN_MAPPING_DETAILS: '/origin-mappings/:id',
  ORIGIN_MAPPING_EDIT: '/origin-mappings/:id/edit',
  TRANSFORMATION_POLICIES: '/transformation-policies',
  TRANSFORMATION_POLICY_CREATE: '/transformation-policies/create',
  TRANSFORMATION_POLICY_DETAILS: '/transformation-policies/:id',
  TRANSFORMATION_POLICY_EDIT: '/transformation-policies/:id/edit',
} as const;