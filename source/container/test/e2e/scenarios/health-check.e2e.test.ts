// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0



describe('Health Check E2E', () => {
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN!;

  test('GET /health returns 200', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/health`);
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('HEALTHY');
  });
});
