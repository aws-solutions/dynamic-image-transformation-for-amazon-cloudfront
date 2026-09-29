// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { assertImageDimensions, assertImageFormat } from '../helpers/image-assertions';

describe('B64 Request Format E2E', () => {
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN!;

  function encodeB64(payload: object): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  test('B64 resize request returns correctly sized image', async () => {
    const payload = { path: '/test.jpg', edits: { resize: { width: 400 } } };
    const response = await fetch(`https://${cloudFrontDomain}/${encodeB64(payload)}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/jpeg');

    const buffer = Buffer.from(await response.arrayBuffer());
    await assertImageDimensions(buffer, 400);
  });

  test('B64 format conversion returns correct format', async () => {
    const payload = { path: '/test.png', edits: { format: 'webp' } };
    const response = await fetch(`https://${cloudFrontDomain}/${encodeB64(payload)}`);

    expect(response.status).toBe(200);

    const buffer = Buffer.from(await response.arrayBuffer());
    await assertImageFormat(buffer, 'webp');
  });

  test('B64 request produces same result as equivalent query string', async () => {
    const payload = { path: '/test.jpg', edits: { resize: { width: 300, height: 200 } } };
    const b64Response = await fetch(`https://${cloudFrontDomain}/${encodeB64(payload)}`);
    const qsResponse = await fetch(`https://${cloudFrontDomain}/test.jpg?resize.width=300&resize.height=200`);

    expect(b64Response.status).toBe(200);
    expect(qsResponse.status).toBe(200);

    const b64Buffer = Buffer.from(await b64Response.arrayBuffer());
    const qsBuffer = Buffer.from(await qsResponse.arrayBuffer());

    await assertImageDimensions(b64Buffer, 300, 200);
    await assertImageDimensions(qsBuffer, 300, 200);
    await assertImageFormat(b64Buffer, 'jpeg');
    await assertImageFormat(qsBuffer, 'jpeg');
  });
});
