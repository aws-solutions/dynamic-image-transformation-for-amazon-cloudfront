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
