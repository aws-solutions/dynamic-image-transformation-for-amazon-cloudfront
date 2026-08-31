// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Standalone entrypoint for `npm run test:e2e:up`.
// Performs a full setup — create bucket, seed DDB, pay the DDB-stream + ECS
// stabilization wait ONCE — and persists the result to .e2e-state.json so that
// subsequent `npm run test:e2e` runs (SKIP_SETUP=true) skip seeding, the wait, and
// teardown entirely. Never tears down: clean up explicitly with `test:e2e:down`.

import { runSetup } from './global-setup';
import { readState } from './e2e-state';

const main = async (): Promise<void> => {
  const existing = readState();
  if (existing && !existing.bucketProvided) {
    // Overwriting state is fine, but an auto-created bucket from a prior bootstrap
    // won't be tracked anymore — note it so it can be cleaned up manually if needed.
    console.log(
      `ℹ Overwriting previous bootstrap state. Prior auto-created bucket "${existing.testBucket}" ` +
        'will no longer be tracked — delete it manually if it is still around.'
    );
  }

  console.log('Bootstrapping E2E environment (this pays the one-time ECS stabilization wait)...');
  const state = await runSetup({ seed: true, persist: true });
  console.log('\n✓ Bootstrap complete. You can now iterate with:');
  console.log('    npm run test:e2e');
  console.log(`\n  Bucket:     ${state.testBucket}`);
  console.log(`  CloudFront: ${state.cloudFrontDomain}`);
  console.log('\n  When finished, clean up with: npm run test:e2e:down');
};

main().catch(error => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
