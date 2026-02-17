// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageFormatTypes } from "./lib";

export interface NormalizedResize {
  w?: number;
  h?: number;
  fit?: string;
  ratio?: number;
}

export interface NormalizedEdits {
  resize?: NormalizedResize;
  avif?: { q?: number; style?: string };
  jpeg?: { q?: number };
  png?: { q?: number };
  webp?: { q?: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface NormalizedPayload {
  bucket?: string;
  efs?: boolean;
  key: string;
  v?: number;
  edits?: NormalizedEdits;
  outputFormat?: ImageFormatTypes;
  effort?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  headers?: Record<string, any>;
}

/**
 * Normalizes a payload from either old or new format to a consistent structure.
 * Supports both old keys (use_efs, bw_original_version, width, height, quality)
 * and new keys (efs, v, w, h, q).
 * @param raw The raw decoded payload from the request
 * @returns Normalized payload with consistent key names
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePayload(raw: any): NormalizedPayload {
  if (!raw) {
    return { key: "" };
  }

  const edits = raw.edits || {};
  const resize = edits.resize;

  const normalizedEdits: NormalizedEdits = { ...edits };

  // Normalize resize
  if (resize) {
    normalizedEdits.resize = {
      w: resize.w ?? resize.width,
      h: resize.h ?? resize.height,
      fit: resize.fit ?? "inside",
      ...(resize.ratio !== undefined && { ratio: resize.ratio }),
    };
  }

  // Normalize format-specific quality settings
  if (edits.avif) {
    normalizedEdits.avif = {
      q: edits.avif.q ?? edits.avif.quality,
      ...(edits.avif.style && { style: edits.avif.style }),
    };
  }
  if (edits.jpeg) {
    normalizedEdits.jpeg = { q: edits.jpeg.q ?? edits.jpeg.quality };
  }
  if (edits.png) {
    normalizedEdits.png = { q: edits.png.q ?? edits.png.quality };
  }
  if (edits.webp) {
    normalizedEdits.webp = { q: edits.webp.q ?? edits.webp.quality };
  }

  return {
    bucket: raw.bucket,
    efs: raw.efs ?? raw.use_efs,
    key: raw.key,
    v: raw.v ?? raw.bw_original_version,
    edits: Object.keys(normalizedEdits).length > 0 ? normalizedEdits : undefined,
    outputFormat: raw.outputFormat,
    effort: raw.effort,
    headers: raw.headers,
  };
}

/**
 * Converts a normalized payload back to the format expected by existing code.
 * This allows gradual migration without breaking existing functionality.
 * @param normalized The normalized payload
 * @returns Payload in the original format expected by ImageRequest
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function denormalizePayload(normalized: NormalizedPayload): Record<string, any> {
  const srcEdits = normalized.edits;
  const edits: Record<string, unknown> = { ...srcEdits };

  // Convert resize back to original format
  if (srcEdits?.resize) {
    edits.resize = {
      width: srcEdits.resize.w,
      height: srcEdits.resize.h,
      fit: srcEdits.resize.fit,
      ...(srcEdits.resize.ratio !== undefined && { ratio: srcEdits.resize.ratio }),
    };
  }

  // Convert quality settings back
  if (srcEdits?.avif) {
    edits.avif = { quality: srcEdits.avif.q };
  }
  if (srcEdits?.jpeg) {
    edits.jpeg = { quality: srcEdits.jpeg.q };
  }
  if (srcEdits?.png) {
    edits.png = { quality: srcEdits.png.q };
  }
  if (srcEdits?.webp) {
    edits.webp = { quality: srcEdits.webp.q };
  }

  return {
    bucket: normalized.bucket,
    use_efs: normalized.efs,
    key: normalized.key,
    bw_original_version: normalized.v,
    edits: Object.keys(edits).length > 0 ? edits : undefined,
    outputFormat: normalized.outputFormat,
    effort: normalized.effort,
    headers: normalized.headers,
  };
}

/**
 * Creates a JPEG-only payload by removing the avif key from edits.
 * Used for the redirect URL in progressive loading.
 * @param payload The normalized payload with both avif and jpeg
 * @returns New payload with only jpeg (no avif)
 */
export function createJpegOnlyPayload(payload: NormalizedPayload): NormalizedPayload {
  const jpegPayload: NormalizedPayload = {
    ...payload,
    edits: { ...payload.edits },
  };

  if (jpegPayload.edits) {
    delete jpegPayload.edits.avif;
  }

  return jpegPayload;
}
