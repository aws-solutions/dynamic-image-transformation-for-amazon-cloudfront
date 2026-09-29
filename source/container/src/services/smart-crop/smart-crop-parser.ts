// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SmartCropValidationError } from './errors';
import {
  ConfigurableConstraintType,
  DirectionalPosition,
  FallbackStrategy,
  GravityConfig,
  PaddingValue,
  ParsedSmartCropConfig,
} from './types';

const DIRECTIONAL_POSITIONS: ReadonlySet<string> = new Set<DirectionalPosition>([
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]);

const VALID_CONSTRAINT_TYPES: ReadonlySet<string> = new Set<ConfigurableConstraintType>([
  'aspectRatio', 'padding',
]);

const VALID_FALLBACKS: ReadonlySet<string> = new Set<FallbackStrategy>([
  'cover', 'contain', 'fill', 'inside', 'outside', 'no-crop',
]);

const DEFAULT_PRIORITIES: ConfigurableConstraintType[] = ['aspectRatio', 'padding'];
const DEFAULT_PADDING: PaddingValue = { value: 3, unit: '%' };
const DEFAULT_GRAVITY: GravityConfig = { type: 'directional', position: 'center' };
const DEFAULT_FALLBACK: FallbackStrategy = 'cover';
const DEFAULT_MIN_CONFIDENCE = 80;

// Caps on smart-crop inputs; keep in sync with the zod mirror in data-models/transformation-policy.ts.
const MAX_LABELS = 50;
const MAX_LABEL_LENGTH = 100;
// ARN cap keeps the Rekognition cache sort key (DetectCustomLabels#<arn>) under the 1024-byte DDB limit.
const MAX_CUSTOM_MODEL_ARN_LENGTH = 1000;
const CUSTOM_MODEL_ARN_PATTERN = /^arn:aws:rekognition:[a-z0-9-]+:\d{12}:project\/[^/]+\/version\/[^/]+\/\d+$/;

export class SmartCropParser {
  static parse(params: unknown): ParsedSmartCropConfig {
    if (params === true) {
      return this.applyDefaults({ faces: true });
    }

    if (typeof params !== 'object' || params === null || Array.isArray(params)) {
      throw new SmartCropValidationError('smartCrop must be true or an object');
    }

    const obj = params as Record<string, unknown>;

    // Legacy v8.0 format used { index, padding } for face-only cropping.
    // Distinguish from expanded v8.1 format by checking for `index` (never valid in v8.1,
    // which uses `faceIndex`) or `padding` without any v8.1-only keys present.
    if ('index' in obj || ('padding' in obj && !('faceIndex' in obj) && !('faces' in obj) && !('enabled' in obj) && !('labels' in obj))) {
      return this.parseLegacy(obj);
    }

    return this.parseExpanded(obj);
  }

  private static parseLegacy(obj: Record<string, unknown>): ParsedSmartCropConfig {
    const partial: Partial<ParsedSmartCropConfig> = { faces: true };

    if ('index' in obj) {
      const idx = Number(obj.index);
      this.validateFaceIndex(idx);
      partial.faceIndex = idx;
    }

    if ('padding' in obj) {
      const pad = Number(obj.padding);
      if (!Number.isInteger(pad) || pad < 0) {
        throw new SmartCropValidationError('Legacy padding must be a non-negative integer');
      }
      partial.padding = { value: pad, unit: 'px' };
    }

    return this.applyDefaults(partial);
  }

  private static parseExpanded(obj: Record<string, unknown>): ParsedSmartCropConfig {
    const partial: Partial<ParsedSmartCropConfig> = {};

    partial.faces = obj.faces === true;
    partial.retainText = obj.retainText === true;
    partial.retainLogo = obj.retainLogo === true;

    if (obj.faceIndex !== undefined) {
      const idx = Number(obj.faceIndex);
      this.validateFaceIndex(idx);
      partial.faceIndex = idx;
    }

    if (obj.labels !== undefined) {
      if (
        !Array.isArray(obj.labels) ||
        obj.labels.length > MAX_LABELS ||
        !obj.labels.every((l) => typeof l === 'string' && l.length > 0 && l.length <= MAX_LABEL_LENGTH)
      ) {
        throw new SmartCropValidationError(
          `labels must be an array of at most ${MAX_LABELS} non-empty strings (each at most ${MAX_LABEL_LENGTH} characters)`,
        );
      }
      partial.labels = obj.labels as string[];
    }

    if (obj.customModelArn !== undefined) {
      if (
        typeof obj.customModelArn !== 'string' ||
        obj.customModelArn.length > MAX_CUSTOM_MODEL_ARN_LENGTH ||
        !CUSTOM_MODEL_ARN_PATTERN.test(obj.customModelArn)
      ) {
        throw new SmartCropValidationError(
          'customModelArn must be a valid Rekognition Custom Labels project version ARN',
        );
      }
      partial.customModelArn = obj.customModelArn;
    }

    if (obj.aspectRatio !== undefined) {
      partial.aspectRatio = this.parseAspectRatio(obj.aspectRatio);
    }

    if (obj.padding !== undefined) {
      partial.padding = this.parsePaddingInput(obj.padding);
    }

    if (obj.gravity !== undefined) {
      partial.gravity = this.parseGravity(obj.gravity);
    }

    if (obj.priorities !== undefined) {
      partial.priorities = this.parsePriorities(obj.priorities);
    }

    if (obj.fallback !== undefined) {
      if (typeof obj.fallback !== 'string' || !VALID_FALLBACKS.has(obj.fallback)) {
        throw new SmartCropValidationError(`Invalid fallback: ${obj.fallback}. Must be one of: ${[...VALID_FALLBACKS].join(', ')}`);
      }
      partial.fallback = obj.fallback as FallbackStrategy;
    }

    if (obj.minConfidence !== undefined) {
      const conf = Number(obj.minConfidence);
      if (isNaN(conf) || conf < 0 || conf > 100) {
        throw new SmartCropValidationError('minConfidence must be between 0 and 100');
      }
      partial.minConfidence = conf;
    }

    return this.applyDefaults(partial);
  }

  static parsePadding(input: unknown): PaddingValue {
    return this.parsePaddingInput(input);
  }

  private static parsePaddingInput(input: unknown): PaddingValue {
    if (typeof input === 'number') {
      if (!Number.isInteger(input) || input < 0) {
        throw new SmartCropValidationError('Numeric padding must be a non-negative integer');
      }
      return { value: input, unit: 'px' };
    }

    if (typeof input !== 'string') {
      throw new SmartCropValidationError('Padding must be a number or string');
    }

    // Single value: "10%" or "50px"
    const singleMatch = input.match(/^(\d{1,4})(px|%)$/);
    if (singleMatch) {
      return { value: Number(singleMatch[1]), unit: singleMatch[2] as 'px' | '%' };
    }

    throw new SmartCropValidationError(`Invalid padding format: ${input}. Use e.g. 10, "10%", "50px"`);
  }

  private static parseAspectRatio(input: unknown): { w: number; h: number } {
    if (typeof input !== 'string') {
      throw new SmartCropValidationError('aspectRatio must be a string in w:h format');
    }
    const match = input.match(/^(\d{1,3}):(\d{1,3})$/);
    if (!match) {
      throw new SmartCropValidationError(`Invalid aspect ratio format: ${input}. Use w:h (e.g. 16:9)`);
    }
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (w < 1 || w > 100 || h < 1 || h > 100) {
      throw new SmartCropValidationError('Aspect ratio dimensions must be between 1 and 100');
    }
    return { w, h };
  }

  private static parseGravity(input: unknown): GravityConfig {
    if (typeof input !== 'string' || input.length === 0) {
      throw new SmartCropValidationError('gravity must be a non-empty string');
    }
    if (DIRECTIONAL_POSITIONS.has(input)) {
      return { type: 'directional', position: input as DirectionalPosition };
    }
    return { type: 'label', labelName: input };
  }

  private static parsePriorities(input: unknown): ConfigurableConstraintType[] {
    if (!Array.isArray(input)) {
      throw new SmartCropValidationError('priorities must be an array');
    }
    const result: ConfigurableConstraintType[] = [];
    for (const item of input) {
      if (!VALID_CONSTRAINT_TYPES.has(item as string)) {
        throw new SmartCropValidationError(`Invalid constraint type: ${item}. Must be one of: ${[...VALID_CONSTRAINT_TYPES].join(', ')}`);
      }
      result.push(item as ConfigurableConstraintType);
    }
    return result;
  }

  private static validateFaceIndex(idx: number): void {
    if (!Number.isInteger(idx) || idx < 0 || idx > 15) {
      throw new SmartCropValidationError('faceIndex must be an integer between 0 and 15');
    }
  }

  private static applyDefaults(partial: Partial<ParsedSmartCropConfig>): ParsedSmartCropConfig {
    return {
      faces: partial.faces ?? false,
      faceIndex: partial.faceIndex,
      labels: partial.labels ?? [],
      customModelArn: partial.customModelArn,
      aspectRatio: partial.aspectRatio,
      padding: partial.padding ?? { ...DEFAULT_PADDING },
      gravity: partial.gravity ?? DEFAULT_GRAVITY,
      priorities: partial.priorities ?? DEFAULT_PRIORITIES,
      retainText: partial.retainText ?? false,
      retainLogo: partial.retainLogo ?? false,
      fallback: partial.fallback ?? DEFAULT_FALLBACK,
      minConfidence: partial.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
    };
  }
}
