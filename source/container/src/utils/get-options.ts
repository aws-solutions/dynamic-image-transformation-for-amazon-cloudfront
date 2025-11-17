// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * If the SOLUTION_ID and SOLUTION_VERSION environment variables are set, this will return
 * an object with a custom user agent string. Otherwise, the object returned will be empty.
 * @param options The current options.
 * @returns Either object with `customUserAgent` string or an empty object.
 */
export function getOptions(options: Record<string, unknown> = {}): Record<string, unknown> {
  const { SOLUTION_ID, SOLUTION_VERSION } = process.env;
  if (SOLUTION_ID && SOLUTION_VERSION) {
    if (SOLUTION_ID.trim() !== "" && SOLUTION_VERSION.trim() !== "") {
      options.customUserAgent = `AwsSolution/${SOLUTION_ID}/${SOLUTION_VERSION}`;
    }
  }

  return options;
}