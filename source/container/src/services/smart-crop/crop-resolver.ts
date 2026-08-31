// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NormalizedBoundingBox } from '../rekognition/types';
import { SmartCropInternalError } from './errors';
import { Constraint, CropRegion, GravityConfig, PaddingValue, SatisfactionKey, SolverInput, SolverOutput } from './types';

import { AspectRatioConfig, PaddingConfig } from './types';

export type { AspectRatioConfig, PaddingConfig };

// ─── Utility: computeUnionBBox ──────────────────────────────────────────────────

export const computeUnionBBox = (
  boxes: NormalizedBoundingBox[],
  imageDimensions: { width: number; height: number },
): CropRegion => {
  if (boxes.length === 0) {
    throw new SmartCropInternalError('computeUnionBBox called with empty bounding box array');
  }

  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  for (const box of boxes) {
    const pxLeft = box.left * imageDimensions.width;
    const pxTop = box.top * imageDimensions.height;
    const pxRight = (box.left + box.width) * imageDimensions.width;
    const pxBottom = (box.top + box.height) * imageDimensions.height;
    minLeft = Math.min(minLeft, pxLeft);
    minTop = Math.min(minTop, pxTop);
    maxRight = Math.max(maxRight, pxRight);
    maxBottom = Math.max(maxBottom, pxBottom);
  }

  const left = Math.floor(minLeft);
  const top = Math.floor(minTop);
  return { left, top, width: Math.ceil(maxRight) - left, height: Math.ceil(maxBottom) - top };
};

// ─── Utility: filterDetections ──────────────────────────────────────────────────

export const filterDetections = (boxes: NormalizedBoundingBox[], threshold: number): NormalizedBoundingBox[] =>
  boxes.filter((b) => b.confidence >= threshold);

// ─── Satisfaction checkers (exported for test reuse) ────────────────────────────

export const containsBBox = (crop: CropRegion, bbox: CropRegion): boolean =>
  crop.left <= bbox.left &&
  crop.top <= bbox.top &&
  crop.left + crop.width >= bbox.left + bbox.width &&
  crop.top + crop.height >= bbox.top + bbox.height;

export const matchesRatio = (crop: CropRegion, ar: AspectRatioConfig): boolean =>
  crop.width * ar.h === crop.height * ar.w;

export const paddingSatisfied = (
  crop: CropRegion,
  bbox: CropRegion,
  config: PaddingConfig,
  originalBBox: CropRegion,
): boolean => {
  const req = paddingPx(config, Math.max(originalBBox.width, originalBBox.height));
  const leftC = bbox.left - crop.left;
  const rightC = crop.left + crop.width - (bbox.left + bbox.width);
  const topC = bbox.top - crop.top;
  const bottomC = crop.top + crop.height - (bbox.top + bbox.height);
  // Padding is specified as minimum clearance on the minority axis
  const minClearance = Math.min(leftC, rightC, topC, bottomC);
  return minClearance >= req;
};

// ─── Internal helpers ───────────────────────────────────────────────────────────

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const paddingPx = (pv: PaddingValue, bboxDim: number): number =>
  pv.unit === '%' ? Math.round((bboxDim * pv.value) / 100) : pv.value;

const cloneRegion = (r: CropRegion): CropRegion => ({ left: r.left, top: r.top, width: r.width, height: r.height });

const clampToImage = (r: CropRegion, dims: { width: number; height: number }): CropRegion => {
  let { left, top, width, height } = r;
  if (left < 0) { left = 0; }
  if (top < 0) { top = 0; }
  if (left + width > dims.width) { left = Math.max(0, dims.width - width); }
  if (top + height > dims.height) { top = Math.max(0, dims.height - height); }
  width = Math.min(width, dims.width - left);
  height = Math.min(height, dims.height - top);
  return { left, top, width, height };
};

const roundRegion = (r: CropRegion): CropRegion => {
  const left = Math.floor(r.left);
  const top = Math.floor(r.top);
  return { left, top, width: Math.ceil(r.left + r.width) - left, height: Math.ceil(r.top + r.height) - top };
};

// ─── Constraint applicators ─────────────────────────────────────────────────────

/**
 * Computes a symmetric expansion around a center point, capped to image bounds.
 * Never shifts — the result is always centered on the given center (within ±1px rounding).
 * If the requested halfSize exceeds available room, it is capped to the max symmetric half.
 */
const symmetricExpand = (
  center: number,
  halfSize: number,
  imageSize: number,
): { start: number; size: number } => {
  const maxHalf = Math.min(center, imageSize - center);
  const cappedHalf = Math.min(halfSize, maxHalf);
  const start = Math.round(center - cappedHalf);
  const size = Math.round(cappedHalf * 2);
  return { start, size: Math.min(size, imageSize) };
};

const applyAspectRatio = (
  region: CropRegion,
  config: AspectRatioConfig,
  unionBBox: CropRegion,
  imageDimensions: { width: number; height: number },
): CropRegion => {
  const cx = region.left + region.width / 2;
  const cy = region.top + region.height / 2;

  // gcd/step snapping: produce ratio-exact dimension pairs by construction
  const g = gcd(config.w, config.h);
  const stepW = config.w / g;
  const stepH = config.h / g;

  // Available symmetric half-extents from center (floored to integers)
  const maxHalfW = Math.floor(Math.min(cx, imageDimensions.width - cx));
  const maxHalfH = Math.floor(Math.min(cy, imageDimensions.height - cy));

  // Max multiplier that fits within image bounds
  const maxN = Math.min(Math.floor((maxHalfW * 2) / stepW), Math.floor((maxHalfH * 2) / stepH));

  // Min multiplier that covers the current region (expand-only: never shrink below prior constraints)
  const minN = Math.max(Math.ceil(region.width / stepW), Math.ceil(region.height / stepH));

  if (maxN >= minN) {
    // Exact ratio achievable — use largest fitting multiplier
    const finalW = maxN * stepW;
    const finalH = maxN * stepH;
    const hResult = symmetricExpand(cx, finalW / 2, imageDimensions.width);
    const vResult = symmetricExpand(cy, finalH / 2, imageDimensions.height);
    return { left: hResult.start, top: vResult.start, width: hResult.size, height: vResult.size };
  }

  // Can't achieve exact ratio — expand deficient axis as far as bounds allow
  const currentRatio = region.width / region.height;
  const targetRatio = config.w / config.h;
  let finalW: number;
  let finalH: number;

  if (currentRatio < targetRatio) {
    finalW = Math.min(maxHalfW * 2, imageDimensions.width);
    finalH = region.height;
    if (finalW < region.width) finalW = region.width;
  } else {
    finalW = region.width;
    finalH = Math.min(maxHalfH * 2, imageDimensions.height);
    if (finalH < region.height) finalH = region.height;
  }

  const hResult = symmetricExpand(cx, finalW / 2, imageDimensions.width);
  const vResult = symmetricExpand(cy, finalH / 2, imageDimensions.height);
  return { left: hResult.start, top: vResult.start, width: hResult.size, height: vResult.size };
};

/**
 * Binary search for the largest minorPad in [1, upperBound] where computeTotals fits.
 * Handles the case where both from-minor and from-major candidates fail due to
 * Math.round overshoot in computeTotals — the round-trip is lossy by up to 1px.
 */
const findMaxFittingPad = (
  upperBound: number,
  computeTotals: (minPad: number) => { minorTotal: number; majorTotal: number },
  fits: (t: { minorTotal: number; majorTotal: number }) => boolean,
): number => {
  let lo = 1;
  let hi = upperBound;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (fits(computeTotals(mid))) { best = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  return best;
};

/**
 * AR-aware padding. The requested padding is the minimum clearance applied to the
 * minority (shorter) axis of the current region. The majority axis padding is derived
 * so that the padded region preserves the current region's aspect ratio exactly.
 * Padding amounts are computed from the larger dimension of the original union bbox
 * (Req 4.2).
 *
 * If the majority axis doesn't have room for the proportional amount, we work
 * backwards: find the max majority-axis padding that fits, derive the AR-correct
 * total dimensions, and compute the minority padding from that.
 */
const applyPadding = (
  region: CropRegion,
  config: PaddingConfig,
  originalUnionBBox: CropRegion,
  imageDimensions: { width: number; height: number },
  activeAspectRatio?: AspectRatioConfig,
): CropRegion => {
  const req = paddingPx(config, Math.max(originalUnionBBox.width, originalUnionBBox.height));
  if (req === 0 || region.width === 0 || region.height === 0) return cloneRegion(region);

  const cx = region.left + region.width / 2;
  const cy = region.top + region.height / 2;

  const symRoomW = Math.max(
    0, 
    Math.min(cx, imageDimensions.width - cx) - region.width / 2
  );
  const symRoomH = Math.max(
    0, 
    Math.min(cy, imageDimensions.height - cy) - region.height / 2
  );

  // Minority axis = shorter side of the current region. Requested padding is
  // the minimum clearance on that axis. Majority axis gets proportionally more
  // to preserve the region's current aspect ratio.
  const isWidthMinority = region.width <= region.height;
  const minorRoom = isWidthMinority ? symRoomW : symRoomH;
  const majorRoom = isWidthMinority ? symRoomH : symRoomW;
  const minorDim = isWidthMinority ? region.width : region.height;
  const majorDim = isWidthMinority ? region.height : region.width;

  // Derive AR-correct padded dimensions from the current region's pixel ratio.
  // Integer multiply before divide keeps precision within safe-integer range.
  // Returns target total dimensions (not per-side padding) to avoid floor/2 rounding loss.
  const computeTotals = (minPad: number): { minorTotal: number; majorTotal: number } => {
    const minorTotal = minorDim + 2 * minPad;
    if (activeAspectRatio) {
      const arMinor = isWidthMinority ? activeAspectRatio.w : activeAspectRatio.h;
      const arMajor = isWidthMinority ? activeAspectRatio.h : activeAspectRatio.w;
      // Snap to the nearest ratio-exact dimension pair. The minor step that
      // guarantees an integer major is arMinor/gcd. We try floor and ceil,
      // pick whichever is closest to the requested minorTotal while ≥ minorDim.
      const g = gcd(arMinor, arMajor);
      const step = arMinor / g;
      const lo = Math.floor(minorTotal / step) * step;
      const hi = lo + step;
      const snappedMinor = lo >= minorDim && Math.abs(lo - minorTotal) <= Math.abs(hi - minorTotal) ? lo : hi;
      const majorTotal = (snappedMinor * arMajor) / arMinor;
      return { minorTotal: snappedMinor, majorTotal };
    }
    const majorTotal = Math.round((minorTotal * majorDim) / minorDim);
    return { minorTotal, majorTotal };
  };

  let totals = computeTotals(req);
  let minorPadUsed = req;

  // Check if both axes fit within symmetric room
  const minorPadNeeded = (totals.minorTotal - minorDim) / 2;
  const majorPadNeeded = (totals.majorTotal - majorDim) / 2;

  if (minorPadNeeded > minorRoom || majorPadNeeded > majorRoom) {
    // Work backwards from the tighter constraint
    const maxMinorFromMinor = Math.floor(minorRoom);
    const totalsFromMinor = computeTotals(maxMinorFromMinor);

    // Also try: find max major total that fits, derive minor from it
    const maxMajorTotal = majorDim + 2 * Math.floor(majorRoom);
    const minorTotalFromMajor = Math.round((maxMajorTotal * minorDim) / majorDim);
    const minorPadFromMajor = Math.max(0, Math.floor((minorTotalFromMajor - minorDim) / 2));
    const totalsFromMajor = computeTotals(minorPadFromMajor);

    const fits = (t: { minorTotal: number; majorTotal: number }) =>
      (t.minorTotal - minorDim) / 2 <= minorRoom && (t.majorTotal - majorDim) / 2 <= majorRoom;

    if (fits(totalsFromMinor) && fits(totalsFromMajor)) {
      if (maxMinorFromMinor >= minorPadFromMajor) {
        totals = totalsFromMinor; minorPadUsed = maxMinorFromMinor;
      } else {
        totals = totalsFromMajor; minorPadUsed = minorPadFromMajor;
      }
    } else if (fits(totalsFromMinor)) {
      totals = totalsFromMinor; minorPadUsed = maxMinorFromMinor;
    } else if (fits(totalsFromMajor)) {
      totals = totalsFromMajor; minorPadUsed = minorPadFromMajor;
    } else {
      const bestPad = findMaxFittingPad(minorPadFromMajor - 1, computeTotals, fits);
      if (bestPad > 0) {
        totals = computeTotals(bestPad); minorPadUsed = bestPad;
      } else {
        return cloneRegion(region);
      }
    }
  }

  if (minorPadUsed <= 0) return cloneRegion(region);

  const targetW = isWidthMinority ? totals.minorTotal : totals.majorTotal;
  const targetH = isWidthMinority ? totals.majorTotal : totals.minorTotal;

  const hResult = symmetricExpand(cx, targetW / 2, imageDimensions.width);
  const vResult = symmetricExpand(cy, targetH / 2, imageDimensions.height);

  return { left: hResult.start, top: vResult.start, width: hResult.size, height: vResult.size };
};

// ─── Gravity applicator ─────────────────────────────────────────────────────────

const computeGravityShift = (
  region: CropRegion,
  gravity: GravityConfig,
  input: SolverInput,
): { dx: number; dy: number } => {
  const bbox = input.unionBBox;
  let desiredDx = 0;
  let desiredDy = 0;

  if (gravity.type === 'label') {
    const labelBoxes = input.gravityLabelBBoxes;
    if (!labelBoxes || labelBoxes.length === 0) return { dx: 0, dy: 0 };
    const uLeft = Math.min(...labelBoxes.map((b) => b.left));
    const uTop = Math.min(...labelBoxes.map((b) => b.top));
    const uRight = Math.max(...labelBoxes.map((b) => b.left + b.width));
    const uBottom = Math.max(...labelBoxes.map((b) => b.top + b.height));
    const centroidX = (uLeft + uRight) / 2;
    const centroidY = (uTop + uBottom) / 2;
    desiredDx = Math.round(centroidX - (region.left + region.width / 2));
    desiredDy = Math.round(centroidY - (region.top + region.height / 2));
  } else {
    const pos = gravity.position;
    if (pos.endsWith('left')) desiredDx = bbox.left - region.left;
    else if (pos.endsWith('right')) desiredDx = (bbox.left + bbox.width) - (region.left + region.width);
    if (pos.startsWith('top')) desiredDy = bbox.top - region.top;
    else if (pos.startsWith('bottom')) desiredDy = (bbox.top + bbox.height) - (region.top + region.height);
  }

  return { dx: desiredDx, dy: desiredDy };
};

const applyGravity = (
  region: CropRegion,
  gravity: GravityConfig,
  input: SolverInput,
): CropRegion => {
  const bbox = input.unionBBox;
  const dims = input.imageDimensions;
  const { dx: desiredDx, dy: desiredDy } = computeGravityShift(region, gravity, input);

  // Clamp shift to preserve target inclusion + image bounds
  const minDx = Math.max(-region.left, (bbox.left + bbox.width) - (region.left + region.width));
  const maxDx = Math.min(dims.width - region.left - region.width, bbox.left - region.left);
  const minDy = Math.max(-region.top, (bbox.top + bbox.height) - (region.top + region.height));
  const maxDy = Math.min(dims.height - region.top - region.height, bbox.top - region.top);

  const dx = Math.max(minDx, Math.min(maxDx, desiredDx));
  const dy = Math.max(minDy, Math.min(maxDy, desiredDy));

  return { left: region.left + dx, top: region.top + dy, width: region.width, height: region.height };
};

// ─── Main solver ────────────────────────────────────────────────────────────────

export const solve = (input: SolverInput): SolverOutput => {
  let region = cloneRegion(input.unionBBox);
  const satisfaction = new Map<SatisfactionKey, 'full' | 'partial' | 'none'>();

  satisfaction.set('targetInclusion', 'full');

  let activeAspectRatio: AspectRatioConfig | undefined;

  for (const constraint of input.constraints) {
    const candidate = clampToImage(
      roundRegion(
        applyConstraint(region, constraint, input, activeAspectRatio)
      ), input.imageDimensions
    );
    let status: 'full' | 'partial' | 'none';
    if (satisfiesConstraint(candidate, constraint, input)) {
      status = 'full';
    } else {
      const unchanged =
        candidate.left === region.left &&
        candidate.top === region.top &&
        candidate.width === region.width &&
        candidate.height === region.height;
      status = unchanged ? 'none' : 'partial';
    }
    satisfaction.set(constraint.type, status);
    region = candidate;

    if (constraint.type === 'aspectRatio' && status === 'full') {
      activeAspectRatio = constraint.config;
    }
  }

  // Apply gravity last
  const preGravityRegion = cloneRegion(region);
  const { dx: desiredDx, dy: desiredDy } = computeGravityShift(region, input.gravity, input);
  region = applyGravity(region, input.gravity, input);
  region = clampToImage(region, input.imageDimensions);

  // Compute gravity satisfaction
  const actualDx = region.left - preGravityRegion.left;
  const actualDy = region.top - preGravityRegion.top;
  if (desiredDx === 0 && desiredDy === 0) {
    satisfaction.set('gravity', 'full');
  } else if (actualDx === 0 && actualDy === 0) {
    satisfaction.set('gravity', 'none');
  } else if (actualDx === desiredDx && actualDy === desiredDy) {
    satisfaction.set('gravity', 'full');
  } else {
    satisfaction.set('gravity', 'partial');
  }

  return { cropRegion: region, constraintSatisfaction: satisfaction };
};

const satisfiesConstraint = (region: CropRegion, constraint: Constraint, input: SolverInput): boolean => {
  if (constraint.type === 'aspectRatio') return matchesRatio(region, constraint.config);
  return paddingSatisfied(region, input.unionBBox, constraint.config, input.unionBBox);
};

const applyConstraint = (
  region: CropRegion,
  constraint: Constraint,
  input: SolverInput,
  activeAspectRatio?: AspectRatioConfig,
): CropRegion => {
  if (constraint.type === 'aspectRatio') {
    return applyAspectRatio(region, constraint.config, input.unionBBox, input.imageDimensions);
  }
  return applyPadding(region, constraint.config, input.unionBBox, input.imageDimensions, activeAspectRatio);
};
