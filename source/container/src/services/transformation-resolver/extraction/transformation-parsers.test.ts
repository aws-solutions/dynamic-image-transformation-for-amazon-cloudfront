// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { transformationParsers } from './transformation-parsers';

describe('transformationParsers', () => {
  describe('nested object parsers', () => {
    it('should pass through resize object', () => {
      const resizeParams = { width: 800, height: 600, fit: 'cover' };
      expect(transformationParsers.resize(resizeParams)).toEqual(resizeParams);
    });

    it('should pass through convolve object', () => {
      const convolveParams = { width: 3, height: 3, kernel: [1, 0, -1, 1, 0, -1, 1, 0, -1] };
      expect(transformationParsers.convolve(convolveParams)).toEqual(convolveParams);
    });

    it('should pass through sharpen object', () => {
      const sharpenParams = { sigma: 1.5, m1: 1, m2: 2 };
      expect(transformationParsers.sharpen(sharpenParams)).toEqual(sharpenParams);
    });

    it('should pass through smartCrop object', () => {
      const smartCropParams = { faceIndex: 2, padding: 10 };
      expect(transformationParsers.smartCrop(smartCropParams)).toEqual(smartCropParams);
    });
  });

  describe('flat value parsers', () => {
    it('should pass through animated value', () => {
      expect(transformationParsers.animated(true)).toBe(true);
      expect(transformationParsers.animated(false)).toBe(false);
    });

    it('should pass through quality value', () => {
      expect(transformationParsers.quality(85)).toBe(85);
    });

    it('should normalize jpg to jpeg for format', () => {
      expect(transformationParsers.format('jpg')).toBe('jpeg');
      expect(transformationParsers.format('webp')).toBe('webp');
    });

    it('should pass through blur value', () => {
      expect(transformationParsers.blur(5.5)).toBe(5.5);
    });

    it('should pass through flatten value', () => {
      expect(transformationParsers.flatten('#FF0000')).toBe('#FF0000');
    });

    it('should pass through extract value', () => {
      const extractValue = [10, 20, 100, 200];
      expect(transformationParsers.extract(extractValue)).toEqual(extractValue);
    });

    it('should pass through normalize value', () => {
      expect(transformationParsers.normalize(true)).toBe(true);
    });

    it('should pass through flip value', () => {
      expect(transformationParsers.flip(true)).toBe(true);
    });

    it('should pass through flop value', () => {
      expect(transformationParsers.flop(false)).toBe(false);
    });

    it('should pass through grayscale value', () => {
      expect(transformationParsers.grayscale(true)).toBe(true);
    });

    it('should pass through tint value', () => {
      expect(transformationParsers.tint('red')).toBe('red');
    });

    it('should pass through rotate value', () => {
      expect(transformationParsers.rotate(90)).toBe(90);
    });

    it('should pass through stripExif value', () => {
      expect(transformationParsers.stripExif(true)).toBe(true);
    });

    it('should pass through stripIcc value', () => {
      expect(transformationParsers.stripIcc(false)).toBe(false);
    });
  });
});