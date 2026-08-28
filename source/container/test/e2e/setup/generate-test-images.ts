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

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#ff6600"/>
  <circle cx="200" cy="150" r="80" fill="#0066ff"/>
  <text x="200" y="155" text-anchor="middle" font-size="24" fill="white">SVG Test</text>
</svg>`;
  writeFileSync(join(outputDir, 'test.svg'), svg, 'utf-8');

  const frames = [
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
  ];
  const rawFrames = await Promise.all(
    frames.map(bg => sharp({ create: { width: 200, height: 200, channels: 3, background: bg } }).raw().toBuffer())
  );
  const combined = Buffer.concat(rawFrames);
  const animatedGif = await sharp(combined, { raw: { width: 200, height: 600, channels: 3, pageHeight: 200 } } as any)
    .gif({ delay: [500, 500, 500], loop: 0 })
    .toBuffer();
  writeFileSync(join(outputDir, 'test-animated.gif'), animatedGif);

  const solidJpeg = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 128, g: 128, b: 128 } }
  }).jpeg().toBuffer();
  writeFileSync(join(outputDir, 'test-solid.jpg'), solidJpeg);

  console.log('Test images generated successfully');
}
