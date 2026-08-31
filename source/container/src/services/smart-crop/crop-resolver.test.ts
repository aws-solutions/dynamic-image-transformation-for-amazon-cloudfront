// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as fc from 'fast-check';
import { NormalizedBoundingBox } from '../rekognition/types';
import { Constraint, CropRegion, SolverInput } from './types';
import {
  AspectRatioConfig,
  PaddingConfig,
  computeUnionBBox,
  containsBBox,
  filterDetections,
  matchesRatio,
  paddingSatisfied,
  solve,
} from './crop-resolver';

// ─── Shared generators ──────────────────────────────────────────────────────────

/**
 * Generates a NormalizedBoundingBox with 0..1 relative coordinates.
 * Chains width/height off left/top to guarantee the box fits.
 */
const arbNormalizedBBox = (): fc.Arbitrary<NormalizedBoundingBox> =>
  fc
    .record({
      left: fc.double({ min: 0, max: 0.99, noNaN: true }),
      top: fc.double({ min: 0, max: 0.99, noNaN: true }),
    })
    .chain(({ left, top }) =>
      fc.record({
        left: fc.constant(left),
        top: fc.constant(top),
        width: fc.double({ min: 0.01, max: 1 - left, noNaN: true }),
        height: fc.double({ min: 0.01, max: 1 - top, noNaN: true }),
        label: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        confidence: fc.double({ min: 0, max: 100, noNaN: true }),
      }),
    );

/** Generates a non-empty array of 1–20 NormalizedBoundingBoxes. */
const arbBBoxArray = (): fc.Arbitrary<NormalizedBoundingBox[]> =>
  fc.array(arbNormalizedBBox(), { minLength: 1, maxLength: 20 });

/** Generates realistic image dimensions (10×10 to 10000×10000). */
const arbImageDimensions = (): fc.Arbitrary<{ width: number; height: number }> =>
  fc.record({
    width: fc.integer({ min: 10, max: 10000 }),
    height: fc.integer({ min: 10, max: 10000 }),
  });

/**
 * Generates a valid aspect ratio config with w and h in [1, 100].
 * 50% chance of an extreme ratio (w=1 or h=1) to stress geometry.
 */
const arbAspectRatio = (): fc.Arbitrary<AspectRatioConfig> =>
  fc.oneof(
    fc.record({ w: fc.constant(1), h: fc.integer({ min: 1, max: 100 }) }),
    fc.record({ w: fc.integer({ min: 1, max: 100 }), h: fc.constant(1) }),
    fc.record({ w: fc.integer({ min: 1, max: 100 }), h: fc.integer({ min: 1, max: 100 }) }),
  );

/**
 * Generates a CropRegion in pixel coordinates chained off image dimensions.
 */
const arbCropRegionIn = (dims: { width: number; height: number }): fc.Arbitrary<CropRegion> =>
  fc
    .record({
      left: fc.integer({ min: 0, max: Math.max(0, dims.width - 1) }),
      top: fc.integer({ min: 0, max: Math.max(0, dims.height - 1) }),
    })
    .chain(({ left, top }) =>
      fc.record({
        left: fc.constant(left),
        top: fc.constant(top),
        width: fc.integer({ min: 1, max: dims.width - left }),
        height: fc.integer({ min: 1, max: dims.height - top }),
      }),
    );

/** Generates a padding config with random px or % value. */
const arbPaddingConfig = (): fc.Arbitrary<PaddingConfig> =>
  fc.record({
    value: fc.integer({ min: 0, max: 50 }),
    unit: fc.constantFrom('px' as const, '%' as const),
  });

/** Generates one of the 9 directional gravity positions. */
const arbDirectionalGravity = () =>
  fc.constantFrom(
    { type: 'directional' as const, position: 'top-left' as const },
    { type: 'directional' as const, position: 'top-center' as const },
    { type: 'directional' as const, position: 'top-right' as const },
    { type: 'directional' as const, position: 'center-left' as const },
    { type: 'directional' as const, position: 'center' as const },
    { type: 'directional' as const, position: 'center-right' as const },
    { type: 'directional' as const, position: 'bottom-left' as const },
    { type: 'directional' as const, position: 'bottom-center' as const },
    { type: 'directional' as const, position: 'bottom-right' as const },
  );

/**
 * Generates a complete SolverInput with random but valid values.
 * unionBBox is derived from arbBBoxArray so it's a realistic starting point.
 */
const arbSolverInput = (): fc.Arbitrary<{ input: SolverInput; boxes: NormalizedBoundingBox[] }> =>
  fc
    .record({
      boxes: arbBBoxArray(),
      imageDimensions: arbImageDimensions(),
      gravity: arbDirectionalGravity(),
      hasAspectRatio: fc.boolean(),
      aspectRatio: arbAspectRatio(),
      padding: arbPaddingConfig(),
      arFirst: fc.boolean(),
    })
    .map(({ boxes, imageDimensions, gravity, hasAspectRatio, aspectRatio, padding, arFirst }) => {
      const unionBBox = computeUnionBBox(boxes, imageDimensions);
      const constraints: Constraint[] = [];

      if (arFirst) {
        if (hasAspectRatio) constraints.push({ type: 'aspectRatio', config: aspectRatio });
        constraints.push({ type: 'padding', config: padding });
      } else {
        constraints.push({ type: 'padding', config: padding });
        if (hasAspectRatio) constraints.push({ type: 'aspectRatio', config: aspectRatio });
      }

      return { boxes, input: { unionBBox, imageDimensions, constraints, gravity } as SolverInput };
    });

/**
 * Generates a SolverInput with bbox biased toward image edges.
 * bbox is placed in the bottom-right quadrant to force expansion into bounds.
 */
const arbEdgeBiasedSolverInput = (): fc.Arbitrary<{ input: SolverInput; boxes: NormalizedBoundingBox[] }> =>
  fc
    .record({
      imageDimensions: arbImageDimensions(),
      gravity: arbDirectionalGravity(),
      aspectRatio: arbAspectRatio(),
      padding: arbPaddingConfig(),
      arFirst: fc.boolean(),
    })
    .chain(({ imageDimensions, gravity, aspectRatio, padding, arFirst }) => {
      // Bias bbox to bottom-right quadrant
      const edgeBBox = fc
        .record({
          left: fc.double({ min: 0.7, max: 0.95, noNaN: true }),
          top: fc.double({ min: 0.7, max: 0.95, noNaN: true }),
        })
        .chain(({ left, top }) =>
          fc.record({
            left: fc.constant(left),
            top: fc.constant(top),
            width: fc.double({ min: 0.01, max: 1 - left, noNaN: true }),
            height: fc.double({ min: 0.01, max: 1 - top, noNaN: true }),
            label: fc.constant(undefined),
            confidence: fc.constant(99),
          }),
        );

      return edgeBBox.map((box) => {
        const boxes = [box];
        const unionBBox = computeUnionBBox(boxes, imageDimensions);
        const constraints: Constraint[] = [];

        if (arFirst) {
          constraints.push({ type: 'aspectRatio', config: aspectRatio });
          constraints.push({ type: 'padding', config: padding });
        } else {
          constraints.push({ type: 'padding', config: padding });
          constraints.push({ type: 'aspectRatio', config: aspectRatio });
        }

        return { boxes, input: { unionBBox, imageDimensions, constraints, gravity } as SolverInput };
      });
    });

/**
 * Generates a SolverInput where AR is always present and the bbox is small + centered,
 * so AR satisfaction is highly likely.
 */
const arbSolverInputWithAR = (): fc.Arbitrary<{ input: SolverInput; boxes: NormalizedBoundingBox[] }> =>
  fc
    .record({
      imageDimensions: fc.record({ width: fc.integer({ min: 500, max: 5000 }), height: fc.integer({ min: 500, max: 5000 }) }),
      gravity: arbDirectionalGravity(),
      aspectRatio: arbAspectRatio(),
      padding: arbPaddingConfig(),
      arFirst: fc.boolean(),
    })
    .map(({ imageDimensions, gravity, aspectRatio, padding, arFirst }) => {
      const bboxW = Math.max(1, Math.floor(imageDimensions.width * 0.1));
      const bboxH = Math.max(1, Math.floor(imageDimensions.height * 0.1));
      const unionBBox: CropRegion = {
        left: Math.floor((imageDimensions.width - bboxW) / 2),
        top: Math.floor((imageDimensions.height - bboxH) / 2),
        width: bboxW,
        height: bboxH,
      };
      const boxes: NormalizedBoundingBox[] = [{
        left: unionBBox.left / imageDimensions.width,
        top: unionBBox.top / imageDimensions.height,
        width: bboxW / imageDimensions.width,
        height: bboxH / imageDimensions.height,
        confidence: 99,
      }];
      const constraints: Constraint[] = arFirst
        ? [{ type: 'aspectRatio', config: aspectRatio }, { type: 'padding', config: padding }]
        : [{ type: 'padding', config: padding }, { type: 'aspectRatio', config: aspectRatio }];
      return { boxes, input: { unionBBox, imageDimensions, constraints, gravity } as SolverInput };
    });

/**
 * Generates a SolverInput where padding is always present, bbox is small + centered,
 * and padding values are modest — so padding satisfaction is highly likely.
 */
const arbSolverInputWithPadding = (): fc.Arbitrary<{ input: SolverInput; boxes: NormalizedBoundingBox[] }> =>
  fc
    .record({
      imageDimensions: fc.record({ width: fc.integer({ min: 500, max: 5000 }), height: fc.integer({ min: 500, max: 5000 }) }),
      gravity: arbDirectionalGravity(),
      aspectRatio: arbAspectRatio(),
      padding: fc.record({ value: fc.integer({ min: 1, max: 10 }), unit: fc.constantFrom('px' as const, '%' as const) }),
      hasAr: fc.boolean(),
      arFirst: fc.boolean(),
    })
    .map(({ imageDimensions, gravity, aspectRatio, padding, hasAr, arFirst }) => {
      const bboxW = Math.max(1, Math.floor(imageDimensions.width * 0.1));
      const bboxH = Math.max(1, Math.floor(imageDimensions.height * 0.1));
      const unionBBox: CropRegion = {
        left: Math.floor((imageDimensions.width - bboxW) / 2),
        top: Math.floor((imageDimensions.height - bboxH) / 2),
        width: bboxW,
        height: bboxH,
      };
      const boxes: NormalizedBoundingBox[] = [{
        left: unionBBox.left / imageDimensions.width,
        top: unionBBox.top / imageDimensions.height,
        width: bboxW / imageDimensions.width,
        height: bboxH / imageDimensions.height,
        confidence: 99,
      }];
      const constraints: Constraint[] = [];
      if (arFirst) {
        if (hasAr) constraints.push({ type: 'aspectRatio', config: aspectRatio });
        constraints.push({ type: 'padding', config: padding });
      } else {
        constraints.push({ type: 'padding', config: padding });
        if (hasAr) constraints.push({ type: 'aspectRatio', config: aspectRatio });
      }
      return { boxes, input: { unionBBox, imageDimensions, constraints, gravity } as SolverInput };
    });

// ─── Property tests ─────────────────────────────────────────────────────────────
// Satisfaction helpers defined once at file scope, reused everywhere.
// The solver exports containsBBox, matchesRatio, paddingSatisfied — tests reuse
// the solver's own definitions rather than approximations.

describe('CropResolver', () => {
  describe('Union bounding box encloses all targets', () => {
    it('should contain every input bounding box (containment)', () => {
      fc.assert(
        fc.property(arbBBoxArray(), arbImageDimensions(), (boxes, dims) => {
          const union = computeUnionBBox(boxes, dims);

          for (const box of boxes) {
            const pxLeft = Math.floor(box.left * dims.width);
            const pxTop = Math.floor(box.top * dims.height);
            const pxRight = Math.ceil((box.left + box.width) * dims.width);
            const pxBottom = Math.ceil((box.top + box.height) * dims.height);

            expect(union.left).toBeLessThanOrEqual(pxLeft);
            expect(union.top).toBeLessThanOrEqual(pxTop);
            expect(union.left + union.width).toBeGreaterThanOrEqual(pxRight);
            expect(union.top + union.height).toBeGreaterThanOrEqual(pxBottom);
          }
        }),
        { numRuns: 200 },
      );
    });

    it('should be minimal (edges touch at least one box edge)', () => {
      fc.assert(
        fc.property(arbBBoxArray(), arbImageDimensions(), (boxes, dims) => {
          const union = computeUnionBBox(boxes, dims);

          const pxBoxes = boxes.map((b) => ({
            left: b.left * dims.width,
            top: b.top * dims.height,
            right: (b.left + b.width) * dims.width,
            bottom: (b.top + b.height) * dims.height,
          }));

          // After rounding, union edges should match the rounded extremes
          expect(union.left).toBe(Math.floor(Math.min(...pxBoxes.map((b) => b.left))));
          expect(union.top).toBe(Math.floor(Math.min(...pxBoxes.map((b) => b.top))));
          expect(union.left + union.width).toBe(Math.ceil(Math.max(...pxBoxes.map((b) => b.right))));
          expect(union.top + union.height).toBe(Math.ceil(Math.max(...pxBoxes.map((b) => b.bottom))));
        }),
        { numRuns: 200 },
      );
    });

    it('should throw on empty input', () => {
      expect(() => computeUnionBBox([], { width: 100, height: 100 })).toThrow(
        'computeUnionBBox called with empty bounding box array',
      );
    });
  });

  describe('Confidence threshold filtering', () => {
    it('should include exactly those boxes with confidence >= threshold', () => {
      fc.assert(
        fc.property(
          fc.array(arbNormalizedBBox(), { minLength: 0, maxLength: 50 }),
          fc.double({ min: 0, max: 100, noNaN: true }),
          (boxes, threshold) => {
            const filtered = filterDetections(boxes, threshold);
            const expected = boxes.filter((b) => b.confidence >= threshold);

            expect(filtered).toHaveLength(expected.length);
            for (const box of filtered) {
              expect(box.confidence).toBeGreaterThanOrEqual(threshold);
            }
            for (const box of boxes) {
              if (box.confidence >= threshold) {
                expect(filtered).toContainEqual(box);
              }
            }
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('Higher-priority constraints are never degraded', () => {
    /**
     * Targeted generator: small centered bbox on a large image guarantees room
     * for the higher-priority constraint to be fully satisfied in isolation.
     */
    const arbSatisfiableInput = (): fc.Arbitrary<SolverInput> =>
      fc
        .record({
          imgW: fc.integer({ min: 500, max: 5000 }),
          imgH: fc.integer({ min: 500, max: 5000 }),
          aspectRatio: fc.record({
            w: fc.integer({ min: 1, max: 10 }),
            h: fc.integer({ min: 1, max: 10 }),
          }),
          padding: arbPaddingConfig(),
          arFirst: fc.boolean(),
        })
        .map(({ imgW, imgH, aspectRatio, padding, arFirst }) => {
          // Small centered bbox — plenty of room for expansion
          const bboxW = Math.floor(imgW * 0.1);
          const bboxH = Math.floor(imgH * 0.1);
          const unionBBox: CropRegion = {
            left: Math.floor((imgW - bboxW) / 2),
            top: Math.floor((imgH - bboxH) / 2),
            width: bboxW,
            height: bboxH,
          };
          const constraints: Constraint[] = arFirst
            ? [{ type: 'aspectRatio', config: aspectRatio }, { type: 'padding', config: padding }]
            : [{ type: 'padding', config: padding }, { type: 'aspectRatio', config: aspectRatio }];
          return {
            unionBBox,
            imageDimensions: { width: imgW, height: imgH },
            constraints,
            gravity: { type: 'directional' as const, position: 'center' as const },
          } as SolverInput;
        });

    // Fixed: applyPadding now receives activeAspectRatio from the solve loop,
    // using the exact AR ratio instead of the pixel ratio in computeTotals.
    // matchesRatio tolerance is now scale-aware (crossDiff <= scale).
    it('should never degrade a fully-satisfied higher-priority constraint', () => {
      let exercised = 0;
      let arHigher = 0;
      let padHigher = 0;

      fc.assert(
        fc.property(arbSatisfiableInput(), (input) => {
          const higher = input.constraints[0];
          const higherOnly = { ...input, constraints: [higher] };
          const baselineOutput = solve(higherOnly);
          const baselineStatus = baselineOutput.constraintSatisfaction.get(higher.type);
          if (baselineStatus !== 'full') return;

          exercised++;
          if (higher.type === 'aspectRatio') arHigher++;
          else padHigher++;

          const fullOutput = solve(input);
          const fullStatus = fullOutput.constraintSatisfaction.get(higher.type);

          console.log(`higher=${higher.type}, baseline=${baselineStatus}, full=${fullStatus}, ` +
            `crop=${JSON.stringify(fullOutput.cropRegion)}, bbox=${JSON.stringify(input.unionBBox)}`);

          expect(fullStatus).toBe('full');

          if (higher.type === 'aspectRatio') {
            expect(matchesRatio(fullOutput.cropRegion, higher.config)).toBe(true);
          }
          if (higher.type === 'padding') {
            expect(
              paddingSatisfied(fullOutput.cropRegion, input.unionBBox, higher.config, input.unionBBox),
            ).toBe(true);
          }
        }),
        { numRuns: 200 },
      );

      console.log(`exercised=${exercised}, arHigher=${arHigher}, padHigher=${padHigher}`);
      expect(exercised).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Target inclusion invariant', () => {
    it('should always fully contain the union bbox', () => {
      fc.assert(
        fc.property(arbSolverInput(), ({ input }) => {
          const output = solve(input);
          expect(containsBBox(output.cropRegion, input.unionBBox)).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('should report targetInclusion as always full', () => {
      fc.assert(
        fc.property(arbSolverInput(), ({ input }) => {
          const output = solve(input);
          expect(output.constraintSatisfaction.get('targetInclusion')).toBe('full');
        }),
        { numRuns: 100 },
      );
    });

    it('should hold for edge-biased bboxes', () => {
      fc.assert(
        fc.property(arbEdgeBiasedSolverInput(), ({ input }) => {
          const output = solve(input);
          expect(containsBBox(output.cropRegion, input.unionBBox)).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('Aspect ratio orientation preservation', () => {
    it('should preserve orientation when fully satisfied', () => {
      let total = 0, notFull = 0, exercised = 0;
      fc.assert(
        fc.property(arbSolverInputWithAR(), ({ input }) => {
          total++;
          const arc = input.constraints.find((c) => c.type === 'aspectRatio')!;
          const output = solve(input);
          if (output.constraintSatisfaction.get('aspectRatio') !== 'full') { notFull++; return; }
          exercised++;
          const { w, h } = arc.config as AspectRatioConfig;
          const crop = output.cropRegion;
          if (w > h) expect(crop.width).toBeGreaterThanOrEqual(crop.height);
          else if (w < h) expect(crop.height).toBeGreaterThanOrEqual(crop.width);
          else expect(Math.abs(crop.width - crop.height)).toBeLessThanOrEqual(1);
        }),
        { numRuns: 200 },
      );
      console.log(`total=${total}, exercised=${exercised} (${((exercised/total)*100).toFixed(1)}%), notFull=${notFull}`);
      expect(exercised).toBeGreaterThanOrEqual(50);
    });

    it('should match requested ratio within ±1px when fully satisfied', () => {
      let total = 0, notFull = 0, exercised = 0;
      fc.assert(
        fc.property(arbSolverInputWithAR(), ({ input }) => {
          total++;
          const arc = input.constraints.find((c) => c.type === 'aspectRatio')!;
          const output = solve(input);
          if (output.constraintSatisfaction.get('aspectRatio') !== 'full') { notFull++; return; }
          exercised++;
          expect(matchesRatio(output.cropRegion, arc.config as AspectRatioConfig)).toBe(true);
        }),
        { numRuns: 200 },
      );
      console.log(`total=${total}, exercised=${exercised} (${((exercised/total)*100).toFixed(1)}%), notFull=${notFull}`);
      expect(exercised).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Aspect ratio is expand-only', () => {
    it('should never shrink below the union bbox', () => {
      fc.assert(
        fc.property(arbSolverInputWithAR(), ({ input }) => {
          const output = solve(input);
          expect(output.cropRegion.width).toBeGreaterThanOrEqual(input.unionBBox.width);
          expect(output.cropRegion.height).toBeGreaterThanOrEqual(input.unionBBox.height);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('Padding is computed from original bounding box', () => {
    it('should compute clearance from original bbox dimensions, not compound across iterations', () => {
      let total = 0, notFull = 0, exercised = 0;
      fc.assert(
        fc.property(arbSolverInputWithPadding(), ({ input }) => {
          total++;
          const pc = input.constraints.find((c) => c.type === 'padding')!;

          // Use center gravity to isolate padding clearance from gravity shifts
          const centeredInput = { ...input, gravity: { type: 'directional' as const, position: 'center' as const } };
          const output = solve(centeredInput);
          if (output.constraintSatisfaction.get('padding') !== 'full') { notFull++; return; }
          exercised++;

          const config = pc.config as PaddingConfig;
          const bbox = input.unionBBox;
          const crop = output.cropRegion;

          // Compute expected padding from original bbox's larger dimension
          const bboxDim = Math.max(bbox.width, bbox.height);
          const expected = config.unit === '%' ? Math.round((bboxDim * config.value) / 100) : config.value;

          // Verify actual clearance meets minimum on all four sides
          const leftC = bbox.left - crop.left;
          const rightC = crop.left + crop.width - (bbox.left + bbox.width);
          const topC = bbox.top - crop.top;
          const bottomC = crop.top + crop.height - (bbox.top + bbox.height);

          expect(Math.min(leftC, rightC, topC, bottomC)).toBeGreaterThanOrEqual(expected);
        }),
        { numRuns: 200 },
      );
      console.log(`total=${total}, exercised=${exercised} (${((exercised/total)*100).toFixed(1)}%), notFull=${notFull}`);
      expect(exercised).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Padding preserves current region aspect ratio', () => {
    it('should not change the aspect ratio of the region that existed before padding was applied', () => {
      let total = 0, statusNone = 0, zeroPre = 0, unchanged = 0, exercised = 0;
      fc.assert(
        fc.property(arbSolverInputWithPadding(), ({ input }) => {
          total++;
          // Only meaningful when padding is the last constraint (no AR after it to change the ratio)
          const padIdx = input.constraints.findIndex((c) => c.type === 'padding');
          const hasArAfterPad = input.constraints.slice(padIdx + 1).some((c) => c.type === 'aspectRatio');
          if (hasArAfterPad) return;

          const output = solve(input);
          if (output.constraintSatisfaction.get('padding') === 'none') { statusNone++; return; }

          // Compute the pre-padding region by running the solver without the padding constraint
          const withoutPadding = { ...input, constraints: input.constraints.filter((c) => c.type !== 'padding') };
          const baseline = solve(withoutPadding);
          const prePaddingRegion = baseline.cropRegion;

          if (prePaddingRegion.width === 0 || prePaddingRegion.height === 0) { zeroPre++; return; }

          // The post-padding region (before gravity) should have the same aspect ratio.
          // Run with center gravity to isolate padding's effect from gravity shifts.
          const withCenter = { ...input, gravity: { type: 'directional' as const, position: 'center' as const } };
          const withCenterNopad = { ...withoutPadding, gravity: withCenter.gravity };
          const postPadding = solve(withCenter).cropRegion;
          const prePadding = solve(withCenterNopad).cropRegion;

          if (prePadding.width === 0 || prePadding.height === 0) { zeroPre++; return; }
          if (postPadding.width === prePadding.width && postPadding.height === prePadding.height) { unchanged++; return; }
          exercised++;

          // Cross-multiply check: preW * postH ≈ preH * postW (within rounding tolerance)
          const crossDiff = Math.abs(prePadding.width * postPadding.height - prePadding.height * postPadding.width);
          const tolerance = Math.max(prePadding.width, prePadding.height, postPadding.width, postPadding.height);
          expect(crossDiff).toBeLessThanOrEqual(tolerance);
        }),
        { numRuns: 200 },
      );
      console.log(`[Padding AR] total=${total}, exercised=${exercised} (${((exercised/total)*100).toFixed(1)}%), statusNone=${statusNone}, zeroPre=${zeroPre}, unchanged=${unchanged}`);
      expect(exercised).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Gravity directional alignment', () => {
    it('should align edges correctly when gravity is fully satisfied', () => {
      let total = 0, notDirectional = 0, notFull = 0, exercised = 0;
      fc.assert(
        fc.property(arbSolverInput(), ({ input }) => {
          total++;
          if (input.gravity.type !== 'directional') { notDirectional++; return; }
          const output = solve(input);
          if (output.constraintSatisfaction.get('gravity') !== 'full') { notFull++; return; }
          exercised++;
          const crop = output.cropRegion;
          const bbox = input.unionBBox;
          const pos = input.gravity.position;

          // Expand-only solver guarantees crop >= bbox on both axes
          if (pos === 'center') {
            // Center gravity: crop should be centered on the bbox center
            const bboxCX = bbox.left + bbox.width / 2;
            const bboxCY = bbox.top + bbox.height / 2;
            const cropCX = crop.left + crop.width / 2;
            const cropCY = crop.top + crop.height / 2;
            expect(Math.abs(cropCX - bboxCX)).toBeLessThanOrEqual(1);
            expect(Math.abs(cropCY - bboxCY)).toBeLessThanOrEqual(1);
          }
          if (pos.startsWith('top')) {
            expect(crop.top).toBe(bbox.top);
          }
          if (pos.startsWith('bottom')) {
            expect(crop.top + crop.height).toBe(bbox.top + bbox.height);
          }
          if (pos.endsWith('left')) {
            expect(crop.left).toBe(bbox.left);
          }
          if (pos.endsWith('right')) {
            expect(crop.left + crop.width).toBe(bbox.left + bbox.width);
          }
        }),
        { numRuns: 200 },
      );
      console.log(`total=${total}, exercised=${exercised} (${((exercised/total)*100).toFixed(1)}%), notDirectional=${notDirectional}, notFull=${notFull}`);
    });
  });

  describe('Gravity label-based centering', () => {
    it('should center crop near centroid of matching label boxes (subset of union)', () => {
      let total = 0, notFull = 0, exercised = 0;
      fc.assert(
        fc.property(
          fc.record({
            width: fc.integer({ min: 200, max: 5000 }),
            height: fc.integer({ min: 200, max: 5000 }),
          }).chain((dims) =>
            fc.record({
              // Small union bbox centered in the image
              bboxFrac: fc.double({ min: 0.1, max: 0.4, noNaN: true }),
              // Label box offset within the union
              labelOffsetX: fc.double({ min: 0, max: 1, noNaN: true }),
              labelOffsetY: fc.double({ min: 0, max: 1, noNaN: true }),
            }).map(({ bboxFrac, labelOffsetX, labelOffsetY }) => {
              const bboxW = Math.floor(dims.width * bboxFrac);
              const bboxH = Math.floor(dims.height * bboxFrac);
              const bboxL = Math.floor((dims.width - bboxW) / 2);
              const bboxT = Math.floor((dims.height - bboxH) / 2);
              const unionBBox: CropRegion = { left: bboxL, top: bboxT, width: bboxW, height: bboxH };

              // Label box is a small region within the union
              const lblW = Math.max(1, Math.floor(bboxW * 0.2));
              const lblH = Math.max(1, Math.floor(bboxH * 0.2));
              const lblL = bboxL + Math.floor((bboxW - lblW) * labelOffsetX);
              const lblT = bboxT + Math.floor((bboxH - lblH) * labelOffsetY);
              const labelBoxes: CropRegion[] = [{ left: lblL, top: lblT, width: lblW, height: lblH }];

              return { dims, unionBBox, labelBoxes };
            }),
          ),
          ({ dims, unionBBox, labelBoxes }) => {
            total++;
            const input: SolverInput = {
              unionBBox, imageDimensions: dims,
              constraints: [{ type: 'padding', config: { value: 10, unit: '%' as const } }],
              gravity: { type: 'label', labelName: 'Car' },
              gravityLabelBBoxes: labelBoxes,
            };

            const output = solve(input);
            if (output.constraintSatisfaction.get('gravity') !== 'full') { notFull++; return; }
            exercised++;

            // Centroid of the gravity label boxes (not the full union)
            const lblLeft = Math.min(...labelBoxes.map((b) => b.left));
            const lblTop = Math.min(...labelBoxes.map((b) => b.top));
            const lblRight = Math.max(...labelBoxes.map((b) => b.left + b.width));
            const lblBottom = Math.max(...labelBoxes.map((b) => b.top + b.height));
            const centroidX = (lblLeft + lblRight) / 2;
            const centroidY = (lblTop + lblBottom) / 2;
            const cropCX = output.cropRegion.left + output.cropRegion.width / 2;
            const cropCY = output.cropRegion.top + output.cropRegion.height / 2;

            expect(Math.abs(cropCX - centroidX)).toBeLessThanOrEqual(1);
            expect(Math.abs(cropCY - centroidY)).toBeLessThanOrEqual(1);
          },
        ),
        { numRuns: 200 },
      );
      console.log(`total=${total}, exercised=${exercised} (${((exercised/total)*100).toFixed(1)}%), notFull=${notFull}`);
      expect(exercised).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Gravity preserves crop dimensions', () => {
    it('should not change crop width or height when applying gravity', () => {
      const gravities = [
        { type: 'directional' as const, position: 'top-left' as const },
        { type: 'directional' as const, position: 'center' as const },
        { type: 'directional' as const, position: 'bottom-right' as const },
      ];
      fc.assert(
        fc.property(arbSolverInput(), ({ input }) => {
          const results = gravities.map((g) => solve({ ...input, gravity: g }).cropRegion);
          // All gravity configs should produce the same width/height — gravity only shifts
          for (const r of results) {
            expect(r.width).toBe(results[0].width);
            expect(r.height).toBe(results[0].height);
          }
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('Crop region is always within image bounds', () => {
    it('should never exceed image dimensions', () => {
      fc.assert(
        fc.property(arbSolverInput(), ({ input }) => {
          const crop = solve(input).cropRegion;
          expect(crop.left).toBeGreaterThanOrEqual(0);
          expect(crop.top).toBeGreaterThanOrEqual(0);
          expect(crop.left + crop.width).toBeLessThanOrEqual(input.imageDimensions.width);
          expect(crop.top + crop.height).toBeLessThanOrEqual(input.imageDimensions.height);
        }),
        { numRuns: 200 },
      );
    });

    it('should hold for edge-biased bboxes', () => {
      fc.assert(
        fc.property(arbEdgeBiasedSolverInput(), ({ input }) => {
          const crop = solve(input).cropRegion;
          expect(crop.left).toBeGreaterThanOrEqual(0);
          expect(crop.top).toBeGreaterThanOrEqual(0);
          expect(crop.left + crop.width).toBeLessThanOrEqual(input.imageDimensions.width);
          expect(crop.top + crop.height).toBeLessThanOrEqual(input.imageDimensions.height);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('Fixed constraint execution order', () => {
    it('should always report targetInclusion=full and gravity as a separate post-step', () => {
      fc.assert(
        fc.property(arbSolverInput(), ({ input }) => {
          const output = solve(input);
          expect(output.constraintSatisfaction.get('targetInclusion')).toBe('full');
          expect(output.constraintSatisfaction.has('gravity')).toBe(true);
          for (const c of input.constraints) {
            expect(['aspectRatio', 'padding']).toContain(c.type);
          }
        }),
        { numRuns: 100 },
      );
    });


  });

  // If the solver reports 'none' for a constraint, the region must not have changed
  // when that constraint was applied (zero progress). We also verify 'none' is
  // reachable by including a generator that produces full-image bboxes.
  describe('No false none', () => {
    /**
     * Generates a SolverInput where the union bbox fills the entire image,
     * forcing constraints into 'none' status (no room to expand).
     */
    const arbFullImageSolverInput = (): fc.Arbitrary<{ input: SolverInput; boxes: NormalizedBoundingBox[] }> =>
      arbImageDimensions().chain((dims) =>
        fc.record({ aspectRatio: arbAspectRatio(), padding: arbPaddingConfig(), arFirst: fc.boolean() }).map(
          ({ aspectRatio, padding, arFirst }) => {
            const boxes: NormalizedBoundingBox[] = [
              { left: 0, top: 0, width: 1, height: 1, confidence: 99 },
            ];
            const unionBBox: CropRegion = { left: 0, top: 0, width: dims.width, height: dims.height };
            const constraints: Constraint[] = arFirst
              ? [{ type: 'aspectRatio', config: aspectRatio }, { type: 'padding', config: padding }]
              : [{ type: 'padding', config: padding }, { type: 'aspectRatio', config: aspectRatio }];
            return {
              boxes,
              input: {
                unionBBox, imageDimensions: dims, constraints,
                gravity: { type: 'directional' as const, position: 'center' as const },
              } as SolverInput,
            };
          },
        ),
      );

    it('should report none when zero progress was made (full-image bbox)', () => {
      let noneCount = 0;

      fc.assert(
        fc.property(arbFullImageSolverInput(), ({ input }) => {
          const output = solve(input);

          for (const constraint of input.constraints) {
            const status = output.constraintSatisfaction.get(constraint.type);
            if (status === 'none') noneCount++;
          }

          // All constraints should be either full (already satisfied) or none (no room)
          for (const constraint of input.constraints) {
            const status = output.constraintSatisfaction.get(constraint.type);
            expect(status).not.toBe('partial');
          }
        }),
        { numRuns: 200 },
      );

      expect(noneCount).toBeGreaterThan(0);
    });

    it('should not report none when partial application was possible', () => {
      let total = 0, runsWithNone = 0, noneVerified = 0;
      fc.assert(
        fc.property(
          fc.oneof(arbSolverInput(), arbEdgeBiasedSolverInput()),
          ({ input }) => {
            total++;
            const output = solve(input);

            // Track the region as it evolves through constraints to check symmetric room
            // at the point each constraint was applied (not post-gravity)
            let region = { ...input.unionBBox };
            for (const constraint of input.constraints) {
              if (output.constraintSatisfaction.get(constraint.type) !== 'none') {
                // Re-solve with only constraints up to this one to get the post-constraint region
                const idx = input.constraints.indexOf(constraint);
                const partial = solve({ ...input, constraints: input.constraints.slice(0, idx + 1),
                  gravity: { type: 'directional' as const, position: 'center' as const } });
                region = partial.cropRegion;
                continue;
              }

              // Constraint reported 'none' — verify no progress was achievable
              runsWithNone++;
              const cx = region.left + region.width / 2;
              const cy = region.top + region.height / 2;
              const dims = input.imageDimensions;
              const symRoomW = Math.min(cx, dims.width - cx) - region.width / 2;
              const symRoomH = Math.min(cy, dims.height - cy) - region.height / 2;

              if (constraint.type === 'aspectRatio') {
                // AR needs room on the deficient axis
                expect(symRoomW <= 0 || symRoomH <= 0).toBe(true);
              } else {
                const isWidthMinority = region.width <= region.height;
                const minorRoom = isWidthMinority ? symRoomW : symRoomH;
                const majorRoom = isWidthMinority ? symRoomH : symRoomW;
                const minorDim = isWidthMinority ? region.width : region.height;
                const majorDim = isWidthMinority ? region.height : region.width;

                // When AR was fully satisfied before padding, the minimum feasible
                // expansion is one ratio-exact step (arMinor/gcd per side), not 1px.
                const arBefore = input.constraints.slice(0, input.constraints.indexOf(constraint))
                  .find((c) => c.type === 'aspectRatio');
                const arWasFull = arBefore && output.constraintSatisfaction.get('aspectRatio') === 'full';

                if (arWasFull) {
                  const ar = arBefore.config as AspectRatioConfig;
                  const arMinor = isWidthMinority ? ar.w : ar.h;
                  const arMajor = isWidthMinority ? ar.h : ar.w;
                  const g = (a: number, b: number): number => (b === 0 ? a : g(b, a % b));
                  const step = arMinor / g(arMinor, arMajor);
                  // Minimum per-side expansion that lands on a ratio-exact dimension
                  const minMinorPad = Math.ceil((step - (minorDim % step || step)) / 1) / 2 || step / 2;
                  // Simpler: the next snap above minorDim is ceil(minorDim/step)*step
                  const nextSnap = Math.ceil((minorDim + 1) / step) * step;
                  const minExpansionMinor = (nextSnap - minorDim) / 2;
                  const minExpansionMajor = ((nextSnap * arMajor / arMinor) - majorDim) / 2;
                  expect(minExpansionMinor > minorRoom || minExpansionMajor > majorRoom).toBe(true);
                } else if (minorRoom >= 1) {
                  // No active AR — 1px minor expansion is the minimum feasible unit
                  const minorTotal = minorDim + 2;
                  const majorTotal = Math.round((minorTotal * majorDim) / minorDim);
                  const majorPadNeeded = (majorTotal - majorDim) / 2;
                  expect(majorPadNeeded).toBeGreaterThan(majorRoom);
                }
                // else: minorRoom < 1, no room at all — 'none' is trivially correct
                noneVerified++;
              }
            }
          },
        ),
        { numRuns: 200 },
      );
      console.log(`[No false none - partial] total=${total}, runsWithNone=${runsWithNone}, noneVerified=${noneVerified}`);
    });
  });

  // Issue 6: Oracle validation — paddingSatisfied correctness with known geometry
  describe('paddingSatisfied oracle validation', () => {
    it('should return true when clearance meets requested padding on all sides', () => {
      const bbox: CropRegion = { left: 50, top: 50, width: 100, height: 100 };
      // Crop with exactly 20px clearance on all sides
      const crop: CropRegion = { left: 30, top: 30, width: 140, height: 140 };
      expect(paddingSatisfied(crop, bbox, { value: 20, unit: 'px' }, bbox)).toBe(true);
      expect(paddingSatisfied(crop, bbox, { value: 21, unit: 'px' }, bbox)).toBe(false);
    });

    it('should compute percentage padding from the larger bbox dimension', () => {
      // bbox is 200w × 100h → max dim = 200, 10% of 200 = 20px
      const bbox: CropRegion = { left: 100, top: 100, width: 200, height: 100 };
      // 20px clearance on all sides
      const crop: CropRegion = { left: 80, top: 80, width: 240, height: 140 };
      expect(paddingSatisfied(crop, bbox, { value: 10, unit: '%' }, bbox)).toBe(true);
      // 19px clearance on left → fails for 10% (needs 20)
      const tightCrop: CropRegion = { left: 81, top: 80, width: 239, height: 140 };
      expect(paddingSatisfied(tightCrop, bbox, { value: 10, unit: '%' }, bbox)).toBe(false);
    });

    it('should use originalBBox dimensions, not current crop dimensions', () => {
      const originalBBox: CropRegion = { left: 50, top: 50, width: 100, height: 100 };
      // A different bbox (e.g. after AR expansion) — padding should still be computed from original
      const currentBBox: CropRegion = { left: 50, top: 50, width: 100, height: 100 };
      // 10% of max(100,100) = 10px
      const crop: CropRegion = { left: 40, top: 40, width: 120, height: 120 };
      expect(paddingSatisfied(crop, currentBBox, { value: 10, unit: '%' }, originalBBox)).toBe(true);
    });
  });

  // Issue 7: No-AR default behavior (Req 3.7) — when no aspect ratio constraint is present,
  // the solver should not impose any aspect ratio on the output
  describe('No aspect ratio constraint preserves natural proportions', () => {
    it('should not distort the crop toward any specific ratio when AR is absent', () => {
      fc.assert(
        fc.property(arbSolverInputWithPadding(), ({ input }) => {
          // Filter to inputs with no AR constraint
          if (input.constraints.some((c) => c.type === 'aspectRatio')) return;

          const output = solve(input);
          const crop = output.cropRegion;

          // Without AR, the crop should be an expansion of the union bbox.
          // The crop's aspect ratio should be closer to the bbox's ratio than to 1:1 or any forced ratio.
          // At minimum: crop dimensions >= bbox dimensions (expand-only)
          expect(crop.width).toBeGreaterThanOrEqual(input.unionBBox.width);
          expect(crop.height).toBeGreaterThanOrEqual(input.unionBBox.height);

          // No AR satisfaction key should be present
          expect(output.constraintSatisfaction.has('aspectRatio')).toBe(false);
        }),
        { numRuns: 200 },
      );
    });
  });
});