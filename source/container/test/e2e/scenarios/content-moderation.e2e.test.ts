// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { assertImageIsBlurred, getImageStats } from '../helpers/image-assertions';
import { requiresRekognition } from '../helpers/capability-gate';
import { TEST_MODERATION_POLICY_ID } from '../setup/test-constants';

// Content moderation depends on Rekognition DetectModerationLabels, which is not
// available in every deployment region (e.g. ca-central-1, and regions with no
// Rekognition endpoint). Skip — rather than fail — where the API is unavailable.
requiresRekognition('DetectModerationLabels')('Content Moderation E2E', () => {
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN!;

  test('moderation-triggering image is blurred with aggressive settings', async () => {
    const moderatedResponse = await fetch(
      `https://${cloudFrontDomain}/moderation.png?contentModeration.blur=200&contentModeration.minConfidence=30`
    );
    const referenceResponse = await fetch(`https://${cloudFrontDomain}/moderation.png?resize.width=800`);

    expect(moderatedResponse.status).toBe(200);
    expect(referenceResponse.status).toBe(200);

    const moderatedBuffer = Buffer.from(await moderatedResponse.arrayBuffer());
    const referenceBuffer = Buffer.from(await referenceResponse.arrayBuffer());

    await assertImageIsBlurred(moderatedBuffer, referenceBuffer);
  });

  test('safe image is not blurred by content moderation', async () => {
    const moderatedResponse = await fetch(
      `https://${cloudFrontDomain}/face.jpg?contentModeration=true`
    );
    const referenceResponse = await fetch(`https://${cloudFrontDomain}/face.jpg?resize.width=800`);

    expect(moderatedResponse.status).toBe(200);
    expect(referenceResponse.status).toBe(200);

    const moderatedBuffer = Buffer.from(await moderatedResponse.arrayBuffer());
    const referenceBuffer = Buffer.from(await referenceResponse.arrayBuffer());

    const moderatedStats = await getImageStats(moderatedBuffer);
    const referenceStats = await getImageStats(referenceBuffer);

    const moderatedAvgStdev = moderatedStats.channels.reduce((s, c) => s + c.stdev, 0) / moderatedStats.channels.length;
    const referenceAvgStdev = referenceStats.channels.reduce((s, c) => s + c.stdev, 0) / referenceStats.channels.length;

    // Safe image should retain most detail — 0.5 allows for JPEG/resize artifacts while detecting heavy blur
    expect(moderatedAvgStdev).toBeGreaterThan(referenceAvgStdev * 0.5);
  });

  test('policy-based content moderation blurs moderation-triggering image', async () => {
    const moderatedResponse = await fetch(
      `https://${cloudFrontDomain}/moderation.png?policyId=${TEST_MODERATION_POLICY_ID}`
    );
    const referenceResponse = await fetch(`https://${cloudFrontDomain}/moderation.png?resize.width=800`);

    expect(moderatedResponse.status).toBe(200);
    expect(referenceResponse.status).toBe(200);

    const moderatedBuffer = Buffer.from(await moderatedResponse.arrayBuffer());
    const referenceBuffer = Buffer.from(await referenceResponse.arrayBuffer());

    await assertImageIsBlurred(moderatedBuffer, referenceBuffer);
  });
});
