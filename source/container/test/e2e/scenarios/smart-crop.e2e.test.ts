// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { assertImageDimensions, getImageMetadata } from '../helpers/image-assertions';
import { requiresRekognition } from '../helpers/capability-gate';
import { TEST_SMARTCROP_POLICY_ID } from '../setup/test-constants';

// Smart crop here uses face detection (Rekognition DetectFaces). DetectFaces is
// broadly available (including ca-central-1) but absent in regions with no
// Rekognition endpoint — skip there rather than fail.
requiresRekognition('DetectFaces')('Smart Crop E2E', () => {
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN!;

  let faceImageWidth: number;
  let faceImageHeight: number;

  beforeAll(async () => {
    const ref = await fetch(`https://${cloudFrontDomain}/face.jpg`);
    const buffer = Buffer.from(await ref.arrayBuffer());
    const metadata = await getImageMetadata(buffer);
    faceImageWidth = metadata.width!;
    faceImageHeight = metadata.height!;
  });

  test('smartCrop=true on face image produces a cropped result', async () => {
    const response = await fetch(`https://${cloudFrontDomain}/face.jpg?smartCrop=true`);

    expect(response.status).toBe(200);

    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await getImageMetadata(buffer);

    expect(metadata.width! * metadata.height!).toBeLessThan(faceImageWidth * faceImageHeight);
  });

  test('smartCrop with 1:1 aspect ratio produces square output', async () => {
    const response = await fetch(
      `https://${cloudFrontDomain}/face.jpg?smartCrop.faces=true&smartCrop.aspectRatio=1:1`
    );

    expect(response.status).toBe(200);

    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await getImageMetadata(buffer);

    expect(metadata.width).toBe(metadata.height);
  });

  test('smartCrop with 16:9 aspect ratio enforces that ratio', async () => {
    const response = await fetch(
      `https://${cloudFrontDomain}/face.jpg?smartCrop.faces=true&smartCrop.aspectRatio=16:9`
    );

    expect(response.status).toBe(200);

    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await getImageMetadata(buffer);

    const actualRatio = metadata.width! / metadata.height!;
    expect(Math.abs(actualRatio - 16 / 9)).toBeLessThan(0.02);
  });

  test('smartCrop with no detections and fallback=no-crop returns original dimensions', async () => {
    const response = await fetch(
      `https://${cloudFrontDomain}/test-solid.jpg?smartCrop.faces=true&smartCrop.fallback=no-crop`
    );

    expect(response.status).toBe(200);

    const buffer = Buffer.from(await response.arrayBuffer());
    await assertImageDimensions(buffer, 800, 600);
  });

  test('policy-based smart crop produces a cropped result', async () => {
    const response = await fetch(
      `https://${cloudFrontDomain}/face.jpg?policyId=${TEST_SMARTCROP_POLICY_ID}`
    );

    expect(response.status).toBe(200);

    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await getImageMetadata(buffer);

    expect(metadata.width! * metadata.height!).toBeLessThan(faceImageWidth * faceImageHeight);
  });
});
