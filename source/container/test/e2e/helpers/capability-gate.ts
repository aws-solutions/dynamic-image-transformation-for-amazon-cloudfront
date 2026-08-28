// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { isApiSupported, RekognitionApi } from '../setup/rekognition-availability';

// Region under test. CURRENT_STACK_REGION is injected by the Hydra run definition
// (and by `test:e2e` locally); fall back to STACK_REGION / AWS_REGION for safety.
const TEST_REGION = process.env.CURRENT_STACK_REGION || process.env.STACK_REGION || process.env.AWS_REGION || '';

/**
 * Returns `describe` when every required Rekognition API is available in the test
 * region, or `describe.skip` (with the reason appended to the suite name) when one
 * or more are unavailable. This lets a scenario declare its Rekognition dependency
 * in a single line and skip cleanly — never silently — in regions that lack the API.
 *
 * Usage:
 *   requiresRekognition('DetectModerationLabels')('Content Moderation E2E', () => { ... });
 */
export function requiresRekognition(...apis: RekognitionApi[]): jest.Describe {
  const missing = apis.filter((api) => !isApiSupported(api, TEST_REGION));

  if (missing.length === 0) {
    return describe;
  }

  const reason = `skipped: ${missing.join(', ')} unavailable in ${TEST_REGION || 'unknown region'}`;
  const gated = ((name: string, fn: () => void) => {
    // eslint-disable-next-line jest/no-disabled-tests
    return describe.skip(`${name} [${reason}]`, fn);
  }) as jest.Describe;

  // Preserve describe.only/.each shape for type compatibility; gated suites never use them.
  gated.skip = describe.skip;
  gated.only = describe.skip;
  gated.each = describe.skip.each as jest.Describe['each'];

  return gated;
}
