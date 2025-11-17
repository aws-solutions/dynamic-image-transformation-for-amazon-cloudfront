// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBTestSetup } from './dynamodb-setup';

beforeAll(async () => {
  DynamoDBTestSetup.initialize();
});

afterAll(async () => {
  // Cleanup can be added here if needed
});