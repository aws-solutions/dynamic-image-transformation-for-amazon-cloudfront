// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

// Gitignored state file written by the persistent bootstrap (`test:e2e:up`) and
// consumed by the fast iteration loop (`test:e2e`) and explicit teardown (`test:e2e:down`).
// Lets a developer bootstrap once (paying the ECS stabilization wait) then run the
// suite repeatedly without re-seeding, re-waiting, or hand-copying the bucket name.
const STATE_FILE = join(__dirname, '../.e2e-state.json');

export interface E2EState {
  testBucket: string;
  bucketProvided: boolean; // was TEST_BUCKET user-supplied? controls whether teardown deletes it
  region: string;
  stackName: string;
  configTable: string;
  cloudFrontDomain: string;
  testRunId: string;
}

export function writeState(state: E2EState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  console.log(`✓ Wrote E2E bootstrap state: ${STATE_FILE}`);
}

export function readState(): E2EState | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as E2EState;
  } catch (error) {
    console.warn(`⚠ Could not parse ${STATE_FILE}: ${(error as Error).message}`);
    return null;
  }
}

export function clearState(): void {
  if (existsSync(STATE_FILE)) {
    unlinkSync(STATE_FILE);
    console.log(`✓ Cleared E2E bootstrap state`);
  }
}
