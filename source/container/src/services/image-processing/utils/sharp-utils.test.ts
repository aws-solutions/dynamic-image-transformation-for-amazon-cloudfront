// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SharpUtils } from './sharp-utils';
import { ImageProcessingError } from '../types';

describe('SharpUtils', () => {
  describe('isAllowedTransformation', () => {
    it.each([
      'flatten', 'blur', 'resize', 'convolve', 'extract', 'normalize',
      'flip', 'flop', 'greyscale', 'grayscale', 'tint', 'rotate',
      'sharpen', 'toFormat', 'composite'
    ])('should allow %s transformation', (type) => {
      expect(SharpUtils.isAllowedTransformation(type)).toBe(true);
    });

    it('should reject unknown transformation', () => {
      expect(SharpUtils.isAllowedTransformation('unknown')).toBe(false);
    });
  });

  describe('convertImageFormatType', () => {
    it.each([
      ['jpg', 'jpeg'],
      ['jpeg', 'jpeg'],
      ['JPG', 'jpeg'],
      ['png', 'png'],
      ['webp', 'webp'],
      ['tiff', 'tiff'],
      ['heif', 'heif'],
      ['raw', 'raw'],
      ['gif', 'gif'],
      ['avif', 'avif'],
    ])('should convert %s to %s', (input, expected) => {
      expect(SharpUtils.convertImageFormatType(input)).toBe(expected);
    });

    it('should throw for unsupported format', () => {
      expect(() => SharpUtils.convertImageFormatType('bmp')).toThrow(ImageProcessingError);
      expect(() => SharpUtils.convertImageFormatType('bmp')).toThrow('not supported');
    });
  });

  describe('shouldSkipForAnimation', () => {
    it.each(['rotate', 'smart_crop', 'round_crop', 'content_moderation'])(
      'should skip %s for animations', (type) => {
        expect(SharpUtils.shouldSkipForAnimation(type, true)).toBe(true);
      }
    );

    it('should not skip allowed transformations for animations', () => {
      expect(SharpUtils.shouldSkipForAnimation('resize', true)).toBe(false);
    });

    it('should not skip any transformation for non-animations', () => {
      expect(SharpUtils.shouldSkipForAnimation('rotate', false)).toBe(false);
    });
  });

  describe('getDefaultSharpOptions', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return default options', () => {
      const options = SharpUtils.getDefaultSharpOptions();
      expect(options.failOn).toBe('none');
      expect(options.animated).toBe(false);
      expect(options.sequentialRead).toBe(true);
    });

    it('should use SHARP_SIZE_LIMIT from env when valid', () => {
      process.env = { ...originalEnv, SHARP_SIZE_LIMIT: '5000' };
      const options = SharpUtils.getDefaultSharpOptions();
      expect(options.limitInputPixels).toBe(5000);
    });

    it('should handle empty SHARP_SIZE_LIMIT', () => {
      process.env = { ...originalEnv, SHARP_SIZE_LIMIT: '' };
      const options = SharpUtils.getDefaultSharpOptions();
      expect(options.limitInputPixels).toBe(true);
    });
  });
});
