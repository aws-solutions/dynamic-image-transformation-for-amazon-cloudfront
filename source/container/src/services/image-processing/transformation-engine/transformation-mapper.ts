// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Transformation } from '../../../types/transformation';
import { ImageEdits } from '../interfaces';
import { SharpUtils } from '../utils/sharp-utils';
import Color from "color";
import ColorName from "color-name";

export class TransformationMapper {
  // Certain Transformations are not 1:1 with the format Sharp expects as input. 
  // This class is responsible for massaging Transformation[] -> ImageEdits
  static async mapToImageEdits(transformations: Transformation[]): Promise<ImageEdits> {
    const edits: ImageEdits = {};

    for (const transformation of transformations) {
      switch (transformation.type) {
        case 'flatten':
          this.mapFlatten(edits, transformation);
          break;
        case 'extract':
          this.mapCrop(edits, transformation);
          break;
        case 'format':
          this.mapFormat(edits, transformation);
          break;
        case 'watermark':
          this.mapWatermark(edits, transformation);
          break;
        case "stripExif":
          edits.stripExif = true;
          break;
        case "stripIcc": 
          edits.stripIcc = true;
          break;
        default:
          this.mapGeneric(edits, transformation);
      }
    }
    return edits;
  }

  private static mapFormat(edits: ImageEdits, transformation: Transformation): void {
    const format = SharpUtils.convertImageFormatType(transformation.value);
    edits.toFormat = format;
  }

  private static mapCrop(edits: ImageEdits, transformation: Transformation): void {
    if (Array.isArray(transformation.value) && transformation.value.length == 4) {
      const [leftTopX, leftTopY, rightBottomX, rightBottomY] = transformation.value;
      edits.extract = {
        left: leftTopX,
        top: leftTopY,
        width: rightBottomX - leftTopX,
        height: rightBottomY - leftTopY,
      }
    }
  }

  private static parseColor(value: string | number[]): string | { r: number; g: number; b: number; alpha?: number } {
    if (typeof value === 'string') {
      const color = !ColorName[value] ? `#${value}` : value;
      return Color(color).object();
    }
    
    if (Array.isArray(value)) {
      const [r, g, b, a] = value;
      return a !== undefined ? { r, g, b, alpha: a } : { r, g, b };
    }
    
    return value;
  }

  private static mapWatermark(edits: ImageEdits, transformation: Transformation): void {
    const [ source, offSetArray ] = transformation.value;

    edits.composite = {
      source,
      offSetArray
    };
  }

  private static mapFlatten(edits: ImageEdits, transformation: Transformation): void {
    edits.flatten = { background: this.parseColor(transformation.value) };
  }

  private static mapGeneric(edits: ImageEdits, transformation: Transformation): void {
    edits[transformation.type] = transformation.value;
  }
}