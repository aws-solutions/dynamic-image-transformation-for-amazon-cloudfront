// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DDBDriverImpl } from './ddb-driver';
import { DDBDriver } from './ddb-driver.interface';

/**
 * Singleton DDB Driver Instance
 * Created lazily to allow environment variables to be set during testing
 */
let ddbDriverInstance: DDBDriver | null = null;

export const ddbDriver = {
  get instance(): DDBDriver {
    if (!ddbDriverInstance) {
      ddbDriverInstance = new DDBDriverImpl(
        process.env.DDB_TABLE_NAME!
      );
    }
    return ddbDriverInstance;
  },
  
  // Used in testing to bypass singleton behavior.
  reset(): void {
    ddbDriverInstance = null;
  }
};

export * from './ddb-driver.interface';
export * from './types';