// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from "node:crypto";

export function loadEnvironment() {
  const region = process.env.CURRENT_STACK_REGION;
  const stackName = process.env.CURRENT_STACK_NAME;
  if (!region) throw new Error("Required Environment variable CURRENT_STACK_REGION missing");
  if (!stackName) throw new Error("Required Environment variable CURRENT_STACK_NAME missing");
  return { region, stackName };
}

export function createAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

let uniqueCounter = 0;

// Jest gives each test file a fresh module registry, so the counter alone repeats across files and processes.
const runEntropy = randomUUID().slice(0, 8);

// The API rejects duplicate names and patterns, and every e2e file shares one table, so fixtures get a fresh suffix per create.
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${runEntropy}-${(uniqueCounter++).toString(36)}`;
}

export function withUniqueOriginName<T extends { originName: string }>(request: T): T {
  return { ...request, originName: `${request.originName}-${uniqueSuffix()}` };
}

export function withUniquePolicyName<T extends { policyName: string }>(request: T): T {
  return { ...request, policyName: `${request.policyName}-${uniqueSuffix()}` };
}

export function withUniqueMappingKeys<
  T extends { mappingName: string; pathPattern?: string; hostHeaderPattern?: string }
>(request: T): T {
  const suffix = uniqueSuffix();
  return {
    ...request,
    mappingName: `${request.mappingName} ${suffix}`,
    ...(request.pathPattern && { pathPattern: request.pathPattern.replace(/^\//, `/${suffix}/`) }),
    ...(request.hostHeaderPattern && {
      hostHeaderPattern: request.hostHeaderPattern.replace(/^(\*\.)?/, `$1${suffix}.`),
    }),
  };
}
