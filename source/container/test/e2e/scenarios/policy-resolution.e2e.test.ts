// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { assertImageDimensions, assertImageFormat } from '../helpers/image-assertions';
import {
  TEST_THUMBNAIL_POLICY_ID,
  TEST_FORMAT_FALLBACK_POLICY_ID,
  TEST_QUALITY_FALLBACK_POLICY_ID,
  TEST_NO_FALLBACK_POLICY_ID,
} from '../setup/test-constants';

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

  describe('Fallback behavior', () => {
    // Cache-bust parameter to avoid CloudFront serving stale responses from prior test runs
    const cb = `_t=${Date.now()}`;

    test('format fallback applies when dit-accept header is absent', async () => {
      // Policy: format=auto + fallback.format=jpeg
      // No accept/dit-accept header → fallback activates → image converted to jpeg
      const response = await fetch(
        `https://${cloudFrontDomain}/test.png?policyId=${TEST_FORMAT_FALLBACK_POLICY_ID}&${cb}`
      );

      expect(response.status).toBe(200);
      const buffer = Buffer.from(await response.arrayBuffer());
      await assertImageFormat(buffer, 'jpeg');
    });

    test('no format conversion when format=auto and no fallback and dit-accept absent', async () => {
      // Policy: format=auto with NO fallback field
      // No accept/dit-accept header → no fallback → source format preserved (png stays png)
      const response = await fetch(
        `https://${cloudFrontDomain}/test.png?policyId=${TEST_NO_FALLBACK_POLICY_ID}&${cb}`
      );

      expect(response.status).toBe(200);
      const buffer = Buffer.from(await response.arrayBuffer());
      await assertImageFormat(buffer, 'png');
    });

    test('quality fallback applies when dit-dpr header is absent', async () => {
      // Policy: quality=[90,[1,2,90],[2,3,80]] + fallback.dpr=2.5
      // No sec-ch-dpr/dit-dpr header → fallback DPR 2.5 used → maps to quality tier [2,3,80] → quality=80
      // We verify the request succeeds (quality is not directly observable in metadata,
      // container logs validate the output quality { type: 'quality', value: 80, source: 'auto' })
      const response = await fetch(
        `https://${cloudFrontDomain}/test.jpg?policyId=${TEST_QUALITY_FALLBACK_POLICY_ID}&${cb}`
      );

      expect(response.status).toBe(200);
    });

    // eslint-disable-next-line jest/no-disabled-tests
    test.skip('autosize fallback cannot be tested through CloudFront', () => {
      // The CloudFront Function (dit-header-normalization) always sets dit-viewport-width
      // via its Tier 4 device-detection waterfall (cloudfront-is-mobile/tablet/desktop-viewer).
      // This means the container always receives dit-viewport-width, so fallback.viewportWidth
      // is never exercised in requests routed through CloudFront.
      // The ALB is internal-only, so direct container access is not possible from E2E tests.
      // Coverage: unit tests in auto-optimizer.test.ts validate the fallback path.
      // Coverage: management-lambda E2E validates schema acceptance and persistence.
    });
  });
});
