// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { assertImageDimensions, assertImageFormat } from '../helpers/image-assertions';

describe('Basic Transformations E2E', () => {
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN!;

  test('GET /test.jpg?resize.width=400 returns resized image', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/test.jpg?resize.width=400`);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/jpeg');
    
    const buffer = Buffer.from(await response.arrayBuffer());
    await assertImageDimensions(buffer, 400);
  });

  test('GET /test.png?resize.width=300&resize.height=200 returns resized PNG', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/test.png?resize.width=300&resize.height=200`);
    
    expect(response.status).toBe(200);
    const buffer = Buffer.from(await response.arrayBuffer());
    await assertImageDimensions(buffer, 300, 200);
    await assertImageFormat(buffer, 'png');
  });

  test('GET /test.jpg?format=webp converts format', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/test.jpg?format=webp`);
    
    expect(response.status).toBe(200);
    const buffer = Buffer.from(await response.arrayBuffer());
    await assertImageFormat(buffer, 'webp');
  });

  test('GET /test.jpg?resize.width=500&quality=50 applies quality', async () => {
    const highQualityResponse = await fetch(`https://${cloudFrontDomain}/test.jpg?resize.width=500&quality=100`);
    const lowQualityResponse = await fetch(`https://${cloudFrontDomain}/test.jpg?resize.width=500&quality=50`);
    
    expect(highQualityResponse.status).toBe(200);
    expect(lowQualityResponse.status).toBe(200);
    
    const highQualityBuffer = Buffer.from(await highQualityResponse.arrayBuffer());
    const lowQualityBuffer = Buffer.from(await lowQualityResponse.arrayBuffer());
    
    await assertImageDimensions(lowQualityBuffer, 500);
    expect(lowQualityBuffer.length).toBeLessThan(highQualityBuffer.length);
  });
});
