import { ImageFormatTypes } from "./lib";

export interface NormalizedResize {
  w?: number;
  h?: number;
  fit?: string;
  ratio?: number;
}

export interface NormalizedEdits {
  resize?: NormalizedResize;
  avif?: { q?: number };
  jpeg?: { q?: number };
  png?: { q?: number };
  webp?: { q?: number };
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
  headers?: Record<string, any>;
}

/**
 * Normalizes a payload from either old or new format to a consistent structure.
 * Supports both old keys (use_efs, bw_original_version, width, height, quality)
 * and new keys (efs, v, w, h, q).
 *
 * @param raw The raw decoded payload from the request
 * @returns Normalized payload with consistent key names
 */
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
    normalizedEdits.avif = { q: edits.avif.q ?? edits.avif.quality };
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
 *
 * @param normalized The normalized payload
 * @returns Payload in the original format expected by ImageRequest
 */
export function denormalizePayload(normalized: NormalizedPayload): any {
  const edits: any = { ...normalized.edits };

  // Convert resize back to original format
  if (edits.resize) {
    edits.resize = {
      width: edits.resize.w,
      height: edits.resize.h,
      fit: edits.resize.fit,
      ...(edits.resize.ratio !== undefined && { ratio: edits.resize.ratio }),
    };
  }

  // Convert quality settings back
  if (edits.avif) {
    edits.avif = { quality: edits.avif.q };
  }
  if (edits.jpeg) {
    edits.jpeg = { quality: edits.jpeg.q };
  }
  if (edits.png) {
    edits.png = { quality: edits.png.q };
  }
  if (edits.webp) {
    edits.webp = { quality: edits.webp.q };
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
 * Checks if the payload has progressive loading enabled.
 * Progressive loading is enabled when both avif and jpeg edits are present.
 *
 * @param payload The normalized payload
 * @returns True if progressive loading is enabled
 */
export function hasProgressiveLoading(payload: NormalizedPayload): boolean {
  return !!(payload.edits?.avif && payload.edits?.jpeg);
}

/**
 * Creates a JPEG-only payload by removing the avif key from edits.
 * Used for the redirect URL in progressive loading.
 *
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
