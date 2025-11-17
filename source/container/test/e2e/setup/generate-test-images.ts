// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join } from 'path';

export async function generateTestImages() {
  const outputDir = join(__dirname, '../test-images');

  const jpeg = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer();
  writeFileSync(join(outputDir, 'test.jpg'), jpeg);

  const png = await sharp({
    create: { width: 800, height: 600, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } }
  }).png().toBuffer();
  writeFileSync(join(outputDir, 'test.png'), png);

  const gif = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 0, g: 0, b: 255 } }
  }).gif().toBuffer();
  writeFileSync(join(outputDir, 'test.gif'), gif);

  console.log('Test images generated successfully');
}
