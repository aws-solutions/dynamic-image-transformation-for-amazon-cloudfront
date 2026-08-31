// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { assertImageDimensions, assertImageFormat } from '../helpers/image-assertions';

describe('SVG Handling E2E', () => {
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN!;

  test('SVG without transformations is passed through as SVG', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/test.svg`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/svg+xml');

    const text = await response.text();
    expect(text).toContain('<svg');
    expect(text).toContain('xmlns');
  });

  test('SVG with resize is rasterized to PNG', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/test.svg?resize.width=100`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');

    const buffer = Buffer.from(await response.arrayBuffer());
    await assertImageFormat(buffer, 'png');
    await assertImageDimensions(buffer, 100);
  });
});
