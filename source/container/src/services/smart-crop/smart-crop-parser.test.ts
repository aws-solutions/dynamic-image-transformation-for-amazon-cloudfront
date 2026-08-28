// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SmartCropParser } from './smart-crop-parser';
import { SmartCropValidationError } from './errors';
import { ParsedSmartCropConfig } from './types';

const DEFAULTS: Pick<ParsedSmartCropConfig, 'labels' | 'priorities' | 'retainText' | 'retainLogo' | 'fallback' | 'minConfidence'> = {
  labels: [],
  priorities: ['aspectRatio', 'padding'],
  retainText: false,
  retainLogo: false,
  fallback: 'cover',
  minConfidence: 80,
};

const DEFAULT_PADDING = { value: 3, unit: '%' };
const DEFAULT_GRAVITY = { type: 'directional', position: 'center' };

// Valid Rekognition Custom Labels project-version ARN.
const VALID_CUSTOM_MODEL_ARN = 'arn:aws:rekognition:us-east-1:123456789012:project/model/version/model.v1/1700000000000';

describe('SmartCropParser', () => {
  // --- Legacy format: boolean ---
  describe('legacy boolean', () => {
    it('should parse smartCrop=true as face detection with defaults', () => {
      const result = SmartCropParser.parse(true);
      expect(result).toEqual({
        faces: true,
        faceIndex: undefined,
        ...DEFAULTS,
        customModelArn: undefined,
        aspectRatio: undefined,
        padding: DEFAULT_PADDING,
        gravity: DEFAULT_GRAVITY,
      });
    });
  });

  // --- Legacy format: { index, padding } ---
  describe('legacy object', () => {
    it('should parse { index: 2, padding: 10 }', () => {
      const result = SmartCropParser.parse({ index: 2, padding: 10 });
      expect(result.faces).toBe(true);
      expect(result.faceIndex).toBe(2);
      expect(result.padding).toEqual({ value: 10, unit: 'px' });
    });

    it('should parse { index: 0 } with default padding', () => {
      const result = SmartCropParser.parse({ index: 0 });
      expect(result.faces).toBe(true);
      expect(result.faceIndex).toBe(0);
      expect(result.padding).toEqual(DEFAULT_PADDING);
    });

    it('should parse { index: 15 } (max)', () => {
      const result = SmartCropParser.parse({ index: 15 });
      expect(result.faceIndex).toBe(15);
    });

    it('should parse { padding: 0 } with no index', () => {
      const result = SmartCropParser.parse({ padding: 0 });
      expect(result.faces).toBe(true);
      expect(result.faceIndex).toBeUndefined();
      expect(result.padding).toEqual({ value: 0, unit: 'px' });
    });

    it('should reject legacy index out of range', () => {
      expect(() => SmartCropParser.parse({ index: 16 })).toThrow(SmartCropValidationError);
      expect(() => SmartCropParser.parse({ index: -1 })).toThrow(SmartCropValidationError);
    });

    it('should reject legacy negative padding', () => {
      expect(() => SmartCropParser.parse({ padding: -5 })).toThrow(SmartCropValidationError);
    });
  });

  // --- Expanded format ---
  describe('expanded format', () => {
    it('should parse minimal expanded object with defaults', () => {
      const result = SmartCropParser.parse({ faces: true });
      expect(result.faces).toBe(true);
      expect(result.padding).toEqual(DEFAULT_PADDING);
      expect(result.gravity).toEqual(DEFAULT_GRAVITY);
      expect(result.fallback).toBe('cover');
      expect(result.minConfidence).toBe(80);
      expect(result.priorities).toEqual(['aspectRatio', 'padding']);
    });

    it('should parse all expanded fields', () => {
      const result = SmartCropParser.parse({
        faces: true,
        faceIndex: 3,
        labels: ['Person', 'Car'],
        customModelArn: VALID_CUSTOM_MODEL_ARN,
        aspectRatio: '16:9',
        padding: '5%',
        gravity: 'top-left',
        priorities: ['padding', 'aspectRatio'],
        retainText: true,
        retainLogo: true,
        fallback: 'contain',
        minConfidence: 90,
      });
      expect(result.faces).toBe(true);
      expect(result.faceIndex).toBe(3);
      expect(result.labels).toEqual(['Person', 'Car']);
      expect(result.customModelArn).toBe(VALID_CUSTOM_MODEL_ARN);
      expect(result.aspectRatio).toEqual({ w: 16, h: 9 });
      expect(result.padding).toEqual({ value: 5, unit: '%' });
      expect(result.gravity).toEqual({ type: 'directional', position: 'top-left' });
      expect(result.priorities).toEqual(['padding', 'aspectRatio']);
      expect(result.retainText).toBe(true);
      expect(result.retainLogo).toBe(true);
      expect(result.fallback).toBe('contain');
      expect(result.minConfidence).toBe(90);
    });

    it('should default faces/retainText/retainLogo to false when omitted', () => {
      const result = SmartCropParser.parse({ labels: ['Dog'] });
      expect(result.faces).toBe(false);
      expect(result.retainText).toBe(false);
      expect(result.retainLogo).toBe(false);
    });

    it('should parse empty object with all defaults', () => {
      const result = SmartCropParser.parse({});
      expect(result.faces).toBe(false);
      expect(result.labels).toEqual([]);
      expect(result.padding).toEqual(DEFAULT_PADDING);
      expect(result.gravity).toEqual(DEFAULT_GRAVITY);
      expect(result.fallback).toBe('cover');
      expect(result.minConfidence).toBe(80);
    });
  });

  // --- Padding parsing ---
  describe('padding parsing', () => {
    it.each([
      [0, { value: 0, unit: 'px' }],
      [50, { value: 50, unit: 'px' }],
      ['10%', { value: 10, unit: '%' }],
      ['50px', { value: 50, unit: 'px' }],
    ])('should parse padding %s', (input, expected) => {
      expect(SmartCropParser.parsePadding(input)).toEqual(expected);
    });

    it.each([
      -1, 1.5, 'abc', '10', '10em', '', '10%x,20%y', '30pxx,50pxy', '5%x,10pxy', null, undefined, true,
    ])('should reject invalid padding: %s', (input) => {
      expect(() => SmartCropParser.parsePadding(input)).toThrow(SmartCropValidationError);
    });
  });

  // --- Aspect ratio ---
  describe('aspect ratio', () => {
    it.each(['16:9', '1:1', '4:5', '100:1', '1:100'])('should accept valid ratio %s', (ratio) => {
      const result = SmartCropParser.parse({ aspectRatio: ratio });
      const [w, h] = ratio.split(':').map(Number);
      expect(result.aspectRatio).toEqual({ w, h });
    });

    it.each(['0:9', '16:0', '101:9', '16:101', '0:0'])('should reject out-of-range ratio %s', (ratio) => {
      expect(() => SmartCropParser.parse({ aspectRatio: ratio })).toThrow(SmartCropValidationError);
    });

    it.each(['16-9', 'abc', '16', ':9', ''])('should reject malformed ratio %s', (ratio) => {
      expect(() => SmartCropParser.parse({ aspectRatio: ratio })).toThrow(SmartCropValidationError);
    });
  });

  // --- Gravity ---
  describe('gravity', () => {
    it.each([
      'top-left', 'top-center', 'top-right',
      'center-left', 'center', 'center-right',
      'bottom-left', 'bottom-center', 'bottom-right',
    ])('should parse directional gravity: %s', (pos) => {
      const result = SmartCropParser.parse({ gravity: pos });
      expect(result.gravity).toEqual({ type: 'directional', position: pos });
    });

    it('should parse label-based gravity', () => {
      const result = SmartCropParser.parse({ gravity: 'Person' });
      expect(result.gravity).toEqual({ type: 'label', labelName: 'Person' });
    });

    it('should reject empty gravity', () => {
      expect(() => SmartCropParser.parse({ gravity: '' })).toThrow(SmartCropValidationError);
    });
  });

  // --- Priorities ---
  describe('priorities', () => {
    it('should accept valid priority permutations', () => {
      const result = SmartCropParser.parse({ priorities: ['padding', 'aspectRatio'] });
      expect(result.priorities).toEqual(['padding', 'aspectRatio']);
    });

    it('should accept partial priority list', () => {
      const result = SmartCropParser.parse({ priorities: ['aspectRatio'] });
      expect(result.priorities).toEqual(['aspectRatio']);
    });

    it('should reject targetInclusion in priorities', () => {
      expect(() => SmartCropParser.parse({ priorities: ['targetInclusion', 'aspectRatio'] })).toThrow(SmartCropValidationError);
    });

    it('should reject gravity in priorities', () => {
      expect(() => SmartCropParser.parse({ priorities: ['gravity', 'aspectRatio'] })).toThrow(SmartCropValidationError);
    });

    it('should reject invalid constraint type', () => {
      expect(() => SmartCropParser.parse({ priorities: ['invalid'] })).toThrow(SmartCropValidationError);
    });

    it('should reject non-array priorities', () => {
      expect(() => SmartCropParser.parse({ priorities: 'aspectRatio' })).toThrow(SmartCropValidationError);
    });
  });

  // --- Fallback ---
  describe('fallback', () => {
    it.each(['cover', 'contain', 'fill', 'inside', 'outside', 'no-crop'] as const)('should accept fallback: %s', (fb) => {
      const result = SmartCropParser.parse({ fallback: fb });
      expect(result.fallback).toBe(fb);
    });

    it('should reject invalid fallback', () => {
      expect(() => SmartCropParser.parse({ fallback: 'invalid' })).toThrow(SmartCropValidationError);
    });
  });

  // --- Confidence ---
  describe('minConfidence', () => {
    it.each([0, 50, 100])('should accept confidence: %s', (conf) => {
      const result = SmartCropParser.parse({ minConfidence: conf });
      expect(result.minConfidence).toBe(conf);
    });

    it.each([-1, 101, NaN])('should reject confidence: %s', (conf) => {
      expect(() => SmartCropParser.parse({ minConfidence: conf })).toThrow(SmartCropValidationError);
    });
  });

  // --- faceIndex ---
  describe('faceIndex', () => {
    it.each([0, 7, 15])('should accept faceIndex: %s', (idx) => {
      const result = SmartCropParser.parse({ faces: true, faceIndex: idx });
      expect(result.faceIndex).toBe(idx);
    });

    it.each([-1, 16, 1.5])('should reject faceIndex: %s', (idx) => {
      expect(() => SmartCropParser.parse({ faces: true, faceIndex: idx })).toThrow(SmartCropValidationError);
    });
  });

  // --- Labels ---
  describe('labels', () => {
    it('should accept valid labels', () => {
      const result = SmartCropParser.parse({ labels: ['Person', 'Car'] });
      expect(result.labels).toEqual(['Person', 'Car']);
    });

    it('should reject empty string in labels', () => {
      expect(() => SmartCropParser.parse({ labels: [''] })).toThrow(SmartCropValidationError);
    });

    it('should reject non-array labels', () => {
      expect(() => SmartCropParser.parse({ labels: 'Person' })).toThrow(SmartCropValidationError);
    });

    it('should accept labels at the count cap (50)', () => {
      const labels = Array.from({ length: 50 }, (_, i) => `L${i}`);
      expect(SmartCropParser.parse({ labels }).labels).toEqual(labels);
    });

    it('should reject more than 50 labels', () => {
      const labels = Array.from({ length: 51 }, (_, i) => `L${i}`);
      expect(() => SmartCropParser.parse({ labels })).toThrow(SmartCropValidationError);
    });

    it('should reject a label longer than 100 characters', () => {
      expect(() => SmartCropParser.parse({ labels: ['a'.repeat(101)] })).toThrow(SmartCropValidationError);
    });
  });

  // --- customModelArn ---
  describe('customModelArn', () => {
    it('should accept a valid Rekognition Custom Labels ARN', () => {
      expect(SmartCropParser.parse({ customModelArn: VALID_CUSTOM_MODEL_ARN }).customModelArn).toBe(
        VALID_CUSTOM_MODEL_ARN,
      );
    });

    it.each([
      'not-an-arn',
      'arn:aws:rekognition:us-east-1:123:project/model/version/1', // account not 12 digits
      'arn:aws:s3:::my-bucket', // wrong service
      'arn:aws:rekognition:us-east-1:123456789012:project/model', // missing version/timestamp segments
    ])('should reject malformed customModelArn: %s', (arn) => {
      expect(() => SmartCropParser.parse({ customModelArn: arn })).toThrow(SmartCropValidationError);
    });

    it('should reject a customModelArn over the length cap', () => {
      const longArn = `arn:aws:rekognition:us-east-1:123456789012:project/${'x'.repeat(1000)}/version/v/1`;
      expect(() => SmartCropParser.parse({ customModelArn: longArn })).toThrow(SmartCropValidationError);
    });
  });

  // --- Invalid top-level inputs ---
  describe('invalid inputs', () => {
    it.each([false, null, 42, 'string', [1, 2]])('should reject invalid param: %s', (input) => {
      expect(() => SmartCropParser.parse(input)).toThrow(SmartCropValidationError);
    });
  });
});
