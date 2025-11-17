// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { assertImageDimensions } from '../helpers/image-assertions';

describe('S3 Integration E2E', () => {
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN!;

  test('Fetches GIF from S3', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/test.gif?resize.width=350`);
    
    expect(response.status).toBe(200);
    const buffer = Buffer.from(await response.arrayBuffer());
    await assertImageDimensions(buffer, 350);
  });

  test('Non-existent S3 object returns 404', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/nonexistent.jpg`);
    
    expect(response.status).toBe(404);
  });
});
