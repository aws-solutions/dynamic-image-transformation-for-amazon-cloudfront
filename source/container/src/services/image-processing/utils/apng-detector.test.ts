// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp from 'sharp';
import { isApng } from './apng-detector';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function makeChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); // CRC content unused by detector
  return Buffer.concat([length, typeBuf, data, crc]);
}

describe('isApng', () => {
  it('returns true when acTL chunk appears before IDAT', () => {
    const ihdr = makeChunk('IHDR', Buffer.alloc(13));
    const actl = makeChunk('acTL', Buffer.alloc(8));
    const idat = makeChunk('IDAT', Buffer.alloc(16));
    const apng = Buffer.concat([PNG_SIG, ihdr, actl, idat]);

    expect(isApng(apng)).toBe(true);
  });

  it('returns false when IDAT appears before acTL (still PNG)', () => {
    const ihdr = makeChunk('IHDR', Buffer.alloc(13));
    const idat = makeChunk('IDAT', Buffer.alloc(16));
    const stillPng = Buffer.concat([PNG_SIG, ihdr, idat]);

    expect(isApng(stillPng)).toBe(false);
  });

  it('returns false for a real Sharp-generated still PNG', async () => {
    const realPng = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
    }).png().toBuffer();

    expect(isApng(realPng)).toBe(false);
  });

  it('returns false when buffer is not a PNG', () => {
    expect(isApng(Buffer.from('not a png'))).toBe(false);
  });

  it('returns false when buffer is too small to contain signature', () => {
    expect(isApng(Buffer.from([0x89, 0x50]))).toBe(false);
  });

  it('returns false when chunk length would overflow scan window', () => {
    const ihdr = makeChunk('IHDR', Buffer.alloc(13));
    // Forge a chunk whose declared length exceeds the buffer
    const malformed = Buffer.concat([
      PNG_SIG,
      ihdr,
      Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]), // length = 4 GB
      Buffer.from('XXXX', 'ascii'),
    ]);

    expect(isApng(malformed)).toBe(false);
  });
});
