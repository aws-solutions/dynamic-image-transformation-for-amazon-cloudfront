// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const MAX_SCAN_BYTES = 16384;

/**
 * Returns true if the buffer is an animated PNG (APNG).
 * APNG is detected by the presence of an `acTL` chunk before the first `IDAT` chunk,
 * per the W3C APNG specification (https://www.w3.org/TR/png-3/#11APNG).
 *
 * Sharp/libvips cannot decode APNG animation (issue lovell/sharp#2375), so callers
 * must passthrough the original buffer to preserve animation.
 */
export function isApng(buffer: Buffer): boolean {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return false;
  }

  const scanLimit = Math.min(buffer.length, MAX_SCAN_BYTES);
  let offset = 8;

  while (offset + 12 <= scanLimit) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);

    if (type === 'acTL') return true;
    if (type === 'IDAT') return false;

    const nextOffset = offset + 12 + length;
    if (nextOffset <= offset || nextOffset > scanLimit) return false;
    offset = nextOffset;
  }

  return false;
}
