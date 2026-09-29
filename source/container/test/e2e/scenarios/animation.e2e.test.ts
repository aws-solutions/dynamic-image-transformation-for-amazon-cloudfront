// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { getImageMetadata, assertImageFormat } from '../helpers/image-assertions';
import { TEST_AUTO_FORMAT_POLICY_ID } from '../setup/test-constants';

describe('Animation Preservation E2E', () => {
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN!;

  test('animated GIF is not converted to non-animation format by auto-optimization', async () => {
    const response = await fetch(
      `https://${cloudFrontDomain}/test-animated.gif?policyId=${TEST_AUTO_FORMAT_POLICY_ID}`,
      { headers: { 'dit-accept': 'image/jpeg' } }
    );

    expect(response.status).toBe(200);

    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await getImageMetadata(buffer);

    expect(metadata.format).toBe('gif');
    expect(metadata.pages).toBeGreaterThan(1);
  });

  test('animated GIF can be converted to WebP (animation-capable format)', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/test-animated.gif?format=webp`);

    expect(response.status).toBe(200);

    const buffer = Buffer.from(await response.arrayBuffer());
    await assertImageFormat(buffer, 'webp');

    const metadata = await getImageMetadata(buffer);
    expect(metadata.pages).toBeGreaterThan(1);
  });
});
