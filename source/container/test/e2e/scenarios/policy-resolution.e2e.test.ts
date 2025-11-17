// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { assertImageDimensions } from '../helpers/image-assertions';
import { TEST_THUMBNAIL_POLICY_ID } from '../setup/test-constants';

describe('Policy Resolution E2E', () => {
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN!;

  test('GET /test.jpg?policy=thumbnail applies DynamoDB policy', async () => {
    const policyId = TEST_THUMBNAIL_POLICY_ID;
    const response = await fetch(`https://${cloudFrontDomain}/test.jpg?policyId=${policyId}`);
    
    expect(response.status).toBe(200);
    const buffer = Buffer.from(await response.arrayBuffer());
    await assertImageDimensions(buffer, 100, 100);
  });

  test('GET /test.jpg?policy=nonexistent returns 404', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/test.jpg?policyId=nonexistent-policy`);
    
    expect(response.status).toBe(404);
  });
});
