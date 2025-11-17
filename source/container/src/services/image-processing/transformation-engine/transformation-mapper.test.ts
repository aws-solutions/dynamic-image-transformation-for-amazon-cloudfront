// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TransformationMapper } from './transformation-mapper';
import { Transformation } from '../../../types/transformation';

describe('TransformationMapper', () => {
  describe('mapToImageEdits', () => {
    it('should handle resize transformation', async () => {
      const transformations: Transformation[] = [
        { type: 'resize', value: { width: 200, height: 150 }, source: 'url' }
      ];
      
      const edits = await TransformationMapper.mapToImageEdits(transformations);
      
      expect(edits.resize).toEqual({ width: 200, height: 150 });
    });

    it('should handle extract transformation with array coordinates', async () => {
      const transformations: Transformation[] = [
        { type: 'extract', value: [10, 20, 110, 120], source: 'url' }
      ];
      
      const edits = await TransformationMapper.mapToImageEdits(transformations);
      
      expect(edits.extract).toEqual({
        left: 10,
        top: 20,
        width: 100,
        height: 100
      });
    });

    it('should handle format transformation', async () => {
      const transformations: Transformation[] = [
        { type: 'format', value: 'jpeg', source: 'url' }
      ];
      
      const edits = await TransformationMapper.mapToImageEdits(transformations);
      
      expect(edits.toFormat).toBeDefined();
    });

    it('should handle flatten transformation with string color', async () => {
      const transformations: Transformation[] = [
        { type: 'flatten', value: 'white', source: 'url' }
      ];
      
      const edits = await TransformationMapper.mapToImageEdits(transformations);
      
      expect(edits.flatten).toEqual({
        background: { r: 255, g: 255, b: 255 }
      });
    });

    it('should handle flatten transformation with RGB array', async () => {
      const transformations: Transformation[] = [
        { type: 'flatten', value: [255, 0, 0], source: 'url' }
      ];
      
      const edits = await TransformationMapper.mapToImageEdits(transformations);
      
      expect(edits.flatten).toEqual({
        background: { r: 255, g: 0, b: 0 }
      });
    });

    it('should handle stripExif transformation', async () => {
      const transformations: Transformation[] = [
        { type: 'stripExif', value: true, source: 'url' }
      ];
      
      const edits = await TransformationMapper.mapToImageEdits(transformations);
      
      expect(edits.stripExif).toBe(true);
    });

    it('should handle stripIcc transformation', async () => {
      const transformations: Transformation[] = [
        { type: 'stripIcc', value: true, source: 'url' }
      ];
      
      const edits = await TransformationMapper.mapToImageEdits(transformations);
      
      expect(edits.stripIcc).toBe(true);
    });

    it('should handle generic transformation types via generic mapper', async () => {
      const transformations: Transformation[] = [
        { type: 'blur', value: 5, source: 'url' }
      ];
      
      const edits = await TransformationMapper.mapToImageEdits(transformations);
      
      expect(edits.blur).toBe(5);
    });

    it('should skip extract transformation with invalid array length', async () => {
      const transformations: Transformation[] = [
        { type: 'extract', value: [10, 20], source: 'url' }
      ];
      
      const edits = await TransformationMapper.mapToImageEdits(transformations);
      
      expect(edits.extract).toBeUndefined();
    });
  });

  describe('parseColor', () => {
    it('should parse named colors', () => {
      const parseColor = (TransformationMapper as any).parseColor;
      
      const result = parseColor('red');
      
      expect(result).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should parse hex colors without hash', () => {
      const parseColor = (TransformationMapper as any).parseColor;
      
      const result = parseColor('ff0000');
      
      expect(result).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should parse RGB array', () => {
      const parseColor = (TransformationMapper as any).parseColor;
      
      const result = parseColor([128, 64, 32]);
      
      expect(result).toEqual({ r: 128, g: 64, b: 32 });
    });

    it('should parse RGBA array', () => {
      const parseColor = (TransformationMapper as any).parseColor;
      
      const result = parseColor([128, 64, 32, 0.5]);
      
      expect(result).toEqual({ r: 128, g: 64, b: 32, alpha: 0.5 });
    });
  });
});