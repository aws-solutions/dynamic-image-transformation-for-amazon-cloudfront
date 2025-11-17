// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const TIMEOUTS = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 15000,
  REDIRECT: 30000
} as const;

export const WAITS = {
  DOM_STABILIZE: 2000,
  FORM_LOAD: 5000,
  PAGE_TRANSITION: 1000
} as const;
