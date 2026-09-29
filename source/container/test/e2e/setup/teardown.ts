// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Standalone entrypoint for `npm run test:e2e:down`.
// Cleans up resources left behind by a persistent bootstrap (`test:e2e:up`):
// clears seeded DDB data, deletes the auto-created bucket (preserving user-provided
// buckets), and removes .e2e-state.json. Reads everything from the state file.

import { runTeardown } from './global-teardown';
import { readState } from './e2e-state';

const main = async (): Promise<void> => {
  if (!readState()) {
    console.log('No bootstrap state found (.e2e-state.json). Nothing to tear down.');
    return;
  }

  console.log('Tearing down bootstrapped E2E environment...');
  await runTeardown();
  console.log('✓ Teardown complete.');
};

main().catch(error => {
  console.error('Teardown failed:', error);
  process.exit(1);
});
