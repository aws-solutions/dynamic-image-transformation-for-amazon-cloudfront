// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp from 'sharp';

export async function assertImageDimensions(
  buffer: Buffer,
  expectedWidth: number,
  expectedHeight?: number
): Promise<void> {
  const metadata = await sharp(buffer).metadata();
  
  expect(metadata.width).toBe(expectedWidth);
  if (expectedHeight !== undefined) {
    expect(metadata.height).toBe(expectedHeight);
  }
}

export async function assertImageFormat(
  buffer: Buffer,
  expectedFormat: string
): Promise<void> {
  const metadata = await sharp(buffer).metadata();
  expect(metadata.format).toBe(expectedFormat);
}

export async function getImageMetadata(buffer: Buffer) {
  return sharp(buffer).metadata();
}

export async function getImageStats(buffer: Buffer) {
  return sharp(buffer).stats();
}

// Empirical: with blur=200 on moderation.png, blurred stdev is ~0.3× reference; 0.7 gives safe margin
const BLUR_STDEV_RATIO_THRESHOLD = 0.7;

export async function assertImageIsBlurred(blurredBuffer: Buffer, referenceBuffer: Buffer): Promise<void> {
  const blurredStats = await sharp(blurredBuffer).stats();
  const refStats = await sharp(referenceBuffer).stats();

  const blurredAvgStdev = blurredStats.channels.reduce((s, c) => s + c.stdev, 0) / blurredStats.channels.length;
  const refAvgStdev = refStats.channels.reduce((s, c) => s + c.stdev, 0) / refStats.channels.length;

  expect(blurredAvgStdev).toBeLessThan(refAvgStdev * BLUR_STDEV_RATIO_THRESHOLD);
}
