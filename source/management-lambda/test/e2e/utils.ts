// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
