// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { marshallOptions } from "@aws-sdk/lib-dynamodb";
import { randomUUID as uuidv4 } from "node:crypto";

/**
 * Generates a unique ID for the resource
 */
export function generateId(): string {
  return uuidv4();
}

const _marshallOptions: marshallOptions = {
  /**
   * Whether to remove undefined values from JS arrays/Sets/objects
   * when marshalling to DynamoDB lists/sets/maps respectively.
   */
  removeUndefinedValues: true,
};

export const translateConfig = { marshallOptions: _marshallOptions };
