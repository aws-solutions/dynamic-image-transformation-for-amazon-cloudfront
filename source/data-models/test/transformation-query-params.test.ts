// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Tests demonstrate how transformation schemas work with URL query strings in Express server.
 * Uses qs library for parsing and query-types middleware for automatic type conversion.
 * Same zod schemas validate both transformation policies and URL query parameters.
 */

import * as qs from "qs";
import { transformationSchemas } from "../transformation-policy";
const queryTypes = require("./query-types");

const TEST_URLS = {
  // Boolean transformations
  grayscale: "https://example.com/image.jpg?grayscale=true",
  grayscaleEmpty: "https://example.com/image.jpg?grayscale",
  animated: "https://example.com/image.gif?animated=false",

  // Numeric transformations
  blur: "https://example.com/image.jpg?blur=50",
  quality: "https://example.com/image.jpg?quality=85",
  rotate: "https://example.com/image.jpg?rotate=90",

  // Object transformations - bracket notation
  resize: "https://example.com/image.jpg?resize[width]=800&resize[height]=600&resize[fit]=cover",
  extract: "https://example.com/image.jpg?extract[]=10&extract[]=20&extract[]=300&extract[]=200",
  smartCrop: "https://example.com/image.jpg?smartCrop[index]=2&smartCrop[padding]=10",

  // Object transformations - dot notation
  resizeDot: "https://example.com/image.jpg?resize.width=800&resize.height=600&resize.fit=cover",
  extractDot: "https://example.com/image.jpg?extract=[10,20,300,200]",
  smartCropDot: "https://example.com/image.jpg?smartCrop.index=2&smartCrop.padding=10",
  convolveDot:
    "https://example.com/image.jpg?convolve.width=3&convolve.height=3&convolve.kernel=[1,0,-1,1,0,-1,1,0,-1]",

  // Default value testing - minimal required params
  extractMinimal: "https://example.com/image.jpg?extract=[0,0,300,200]",
  resizeMinimal: "https://example.com/image.jpg?resize.width=400",
  smartCropMinimal: "https://example.com/image.jpg?smartCrop.index=1",

  // Array transformations
  convolve:
    "https://example.com/image.jpg?convolve[width]=3&convolve[height]=3&convolve[kernel][]=1&convolve[kernel][]=0&convolve[kernel][]=-1&convolve[kernel][]=1&convolve[kernel][]=0&convolve[kernel][]=-1&convolve[kernel][]=1&convolve[kernel][]=0&convolve[kernel][]=-1",
  resizeBackground:
    "https://example.com/image.jpg?resize[width]=400&resize[background][]=255&resize[background][]=128&resize[background][]=0&resize[background][]=0.8",
  resizeBackgroundSimpleArray: "https://example.com/image.jpg?resize.width=400&resize.background=[255,128,0,0.8]",

  // Color transformations
  tintColor: "https://example.com/image.jpg?tint=red",
  tintHex: "https://example.com/image.jpg?tint=%23ff0000",
  flattenColor: "https://example.com/image.jpg?flatten=white",

  // Enum transformations
  format: "https://example.com/image.jpg?format=webp",

  // Union transformations
  sharpenBoolean: "https://example.com/image.jpg?sharpen=true",
  sharpenBooleanEmpty: "https://example.com/image.jpg?sharpen",

  // Complex examples
  complex: "https://example.com/image.jpg?resize[width]=800&resize[height]=600&quality=90&format=webp&grayscale=true",
  complexDot: "https://example.com/image.jpg?resize.width=800&resize.height=600&quality=90&format=webp&grayscale=true",
  mixedNotation: "https://example.com/image.jpg?resize.width=800&resize.height=600&extract=[50,100,400,300]&quality=85",
  mixedSameTransform: "https://example.com/image.jpg?resize.width=800&resize[height]=600&resize[fit]=cover",
  fullTransform:
    "https://example.com/image.jpg?resize.width=1200&resize.height=800&resize.fit=cover&quality=85&format=webp&blur=5&rotate=90&stripExif=true",
  photoEdit: "https://example.com/photo.jpg?extract=[50,100,800,600]&grayscale&format=jpeg&quality=95",

  // Watermark transformations
  watermarkSingle: 'https://example.com/image.jpg?watermark=["https://example.com/logo.png",[10,10,0.8,0.3,0.3]]',
  watermarkMultiple:
    'https://example.com/image.jpg?watermark=[["https://example.com/logo1.png",[10,10,0.8,0.3,0.3]],["https://example.com/logo2.png",[100,100,0.5,0.2,0.2]]]',
} as const;

describe("Transformation Query Parameters", () => {
  describe("Boolean transformations", () => {
    it("should parse and validate grayscale from URL", () => {
      const parsed = qs.parse(TEST_URLS.grayscale.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.grayscale.safeParse(typed.grayscale);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it("should parse and validate grayscale without value from URL", () => {
      const parsed = qs.parse(TEST_URLS.grayscaleEmpty.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.grayscale.safeParse(typed.grayscale);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it("should parse and validate animated from URL", () => {
      const parsed = qs.parse(TEST_URLS.animated.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.animated.safeParse(typed.animated);
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });

  describe("Numeric transformations", () => {
    it("should parse and validate blur from URL", () => {
      const parsed = qs.parse(TEST_URLS.blur.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.blur.safeParse(typed.blur);
      expect(result.success).toBe(true);
      expect(result.data).toBe(50);
    });

    it("should parse and validate quality from URL", () => {
      const parsed = qs.parse(TEST_URLS.quality.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.quality.safeParse(typed.quality);
      expect(result.success).toBe(true);
      expect(result.data).toBe(85);
    });

    it("should parse and validate rotate from URL", () => {
      const parsed = qs.parse(TEST_URLS.rotate.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.rotate.safeParse(typed.rotate);
      expect(result.success).toBe(true);
      expect(result.data).toBe(90);
    });
  });

  describe("Object transformations - bracket notation", () => {
    it("should parse and validate resize from URL", () => {
      const parsed = qs.parse(TEST_URLS.resize.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.resize.safeParse(typed.resize);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        width: 800,
        height: 600,
        fit: "cover",
      });
    });

    it("should parse and validate extract from URL", () => {
      const parsed = qs.parse(TEST_URLS.extract.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.extract.safeParse(typed.extract);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([10, 20, 300, 200]);
    });

    it("should parse and validate smartCrop object from URL", () => {
      const parsed = qs.parse(TEST_URLS.smartCrop.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.smartCrop.safeParse(typed.smartCrop);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        index: 2,
        padding: 10,
      });
    });
  });

  describe("Object transformations - dot notation", () => {
    it("should parse and validate resize with dot notation from URL", () => {
      const parsed = qs.parse(TEST_URLS.resizeDot.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.resize.safeParse(typed.resize);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        width: 800,
        height: 600,
        fit: "cover",
      });
    });

    it("should parse and validate extract with dot notation from URL", () => {
      const parsed = qs.parse(TEST_URLS.extractDot.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.extract.safeParse(typed.extract);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([10, 20, 300, 200]);
    });

    it("should parse and validate smartCrop with dot notation from URL", () => {
      const parsed = qs.parse(TEST_URLS.smartCropDot.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.smartCrop.safeParse(typed.smartCrop);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        index: 2,
        padding: 10,
      });
    });

    it("should parse and validate convolve with dot notation from URL", () => {
      const parsed = qs.parse(TEST_URLS.convolveDot.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.convolve.safeParse(typed.convolve);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        width: 3,
        height: 3,
        kernel: [1, 0, -1, 1, 0, -1, 1, 0, -1],
      });
    });
  });

  describe("Color transformations", () => {
    it("should parse and validate tint color name from URL", () => {
      const parsed = qs.parse(TEST_URLS.tintColor.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.tint.safeParse(typed.tint);
      expect(result.success).toBe(true);
      expect(result.data).toBe("red");
    });

    it("should parse and validate tint hex color from URL", () => {
      const parsed = qs.parse(TEST_URLS.tintHex.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.tint.safeParse(typed.tint);
      expect(result.success).toBe(true);
      expect(result.data).toBe("#ff0000");
    });

    it("should parse and validate flatten color from URL", () => {
      const parsed = qs.parse(TEST_URLS.flattenColor.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.flatten.safeParse(typed.flatten);
      expect(result.success).toBe(true);
      expect(result.data).toBe("white");
    });
  });

  describe("Default value handling", () => {
    it("should handle extract with minimal values", () => {
      const parsed = qs.parse(TEST_URLS.extractMinimal.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.extract.safeParse(typed.extract);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([0, 0, 300, 200]);
    });

    it("should handle resize with only width provided", () => {
      const parsed = qs.parse(TEST_URLS.resizeMinimal.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.resize.safeParse(typed.resize);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        width: 400,
      });
    });

    it("should apply default padding for smartCrop when not provided", () => {
      const parsed = qs.parse(TEST_URLS.smartCropMinimal.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.smartCrop.safeParse(typed.smartCrop);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        index: 1,
        padding: 0, // default
      });
    });
  });

  describe("Array transformations", () => {
    it("should parse and validate convolve from URL", () => {
      const parsed = qs.parse(TEST_URLS.convolve.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.convolve.safeParse(typed.convolve);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        width: 3,
        height: 3,
        kernel: [1, 0, -1, 1, 0, -1, 1, 0, -1],
      });
    });

    it("should parse and validate resize background color from URL", () => {
      const parsed = qs.parse(TEST_URLS.resizeBackground.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.resize.safeParse(typed.resize);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        width: 400,
        background: [255, 128, 0, 0.8],
      });
    });

    it("should parse and validate resize background from simple array format", () => {
      const parsed = qs.parse(TEST_URLS.resizeBackgroundSimpleArray.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.resize.safeParse(typed.resize);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        width: 400,
        background: [255, 128, 0, 0.8],
      });
    });
  });

  describe("Enum transformations", () => {
    it("should parse and validate format from URL", () => {
      const parsed = qs.parse(TEST_URLS.format.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.format.safeParse(typed.format);
      expect(result.success).toBe(true);
      expect(result.data).toBe("webp");
    });
  });

  describe("Union transformations", () => {
    it("should parse and validate sharpen boolean from URL", () => {
      const parsed = qs.parse(TEST_URLS.sharpenBoolean.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.sharpen.safeParse(typed.sharpen);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it("should parse and validate sharpen boolean without value from URL", () => {
      const parsed = qs.parse(TEST_URLS.sharpenBooleanEmpty.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.sharpen.safeParse(typed.sharpen);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });
  });

  describe("Complex URL examples", () => {
    it("should parse multiple transformations from complex URL with bracket notation", () => {
      const parsed = qs.parse(TEST_URLS.complex.split("?")[1]);
      const typed = queryTypes.parseObject(parsed);

      const resizeResult = transformationSchemas.resize.safeParse(typed.resize);
      const qualityResult = transformationSchemas.quality.safeParse(typed.quality);
      const formatResult = transformationSchemas.format.safeParse(typed.format);
      const grayscaleResult = transformationSchemas.grayscale.safeParse(typed.grayscale);

      expect(resizeResult.success).toBe(true);
      expect(qualityResult.success).toBe(true);
      expect(formatResult.success).toBe(true);
      expect(grayscaleResult.success).toBe(true);

      expect(resizeResult.data).toEqual({ width: 800, height: 600 });
      expect(qualityResult.data).toBe(90);
      expect(formatResult.data).toBe("webp");
      expect(grayscaleResult.data).toBe(true);
    });

    it("should parse multiple transformations from complex URL with dot notation", () => {
      const parsed = qs.parse(TEST_URLS.complexDot.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const resizeResult = transformationSchemas.resize.safeParse(typed.resize);
      const qualityResult = transformationSchemas.quality.safeParse(typed.quality);
      const formatResult = transformationSchemas.format.safeParse(typed.format);
      const grayscaleResult = transformationSchemas.grayscale.safeParse(typed.grayscale);

      expect(resizeResult.success).toBe(true);
      expect(qualityResult.success).toBe(true);
      expect(formatResult.success).toBe(true);
      expect(grayscaleResult.success).toBe(true);

      expect(resizeResult.data).toEqual({ width: 800, height: 600 });
      expect(qualityResult.data).toBe(90);
      expect(formatResult.data).toBe("webp");
      expect(grayscaleResult.data).toBe(true);
    });

    it("should parse mixed dot and bracket notation from URL", () => {
      const parsed = qs.parse(TEST_URLS.mixedNotation.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const resizeResult = transformationSchemas.resize.safeParse(typed.resize);
      const extractResult = transformationSchemas.extract.safeParse(typed.extract);
      const qualityResult = transformationSchemas.quality.safeParse(typed.quality);

      expect(resizeResult.success).toBe(true);
      expect(extractResult.success).toBe(true);
      expect(qualityResult.success).toBe(true);

      expect(resizeResult.data).toEqual({ width: 800, height: 600 });
      expect(extractResult.data).toEqual([50, 100, 400, 300]);
      expect(qualityResult.data).toBe(85);
    });

    it("should parse same transformation with mixed notation properties", () => {
      const parsed = qs.parse(TEST_URLS.mixedSameTransform.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const resizeResult = transformationSchemas.resize.safeParse(typed.resize);

      expect(resizeResult.success).toBe(true);
      expect(resizeResult.data).toEqual({
        width: 800,
        height: 600,
        fit: "cover",
      });
    });

    it("should parse full transformation pipeline from URL", () => {
      const parsed = qs.parse(TEST_URLS.fullTransform.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const resizeResult = transformationSchemas.resize.safeParse(typed.resize);
      const qualityResult = transformationSchemas.quality.safeParse(typed.quality);
      const formatResult = transformationSchemas.format.safeParse(typed.format);
      const blurResult = transformationSchemas.blur.safeParse(typed.blur);
      const rotateResult = transformationSchemas.rotate.safeParse(typed.rotate);
      const stripExifResult = transformationSchemas.stripExif.safeParse(typed.stripExif);

      expect(resizeResult.success).toBe(true);
      expect(qualityResult.success).toBe(true);
      expect(formatResult.success).toBe(true);
      expect(blurResult.success).toBe(true);
      expect(rotateResult.success).toBe(true);
      expect(stripExifResult.success).toBe(true);

      expect(resizeResult.data).toEqual({ width: 1200, height: 800, fit: "cover" });
      expect(qualityResult.data).toBe(85);
      expect(formatResult.data).toBe("webp");
      expect(blurResult.data).toBe(5);
      expect(rotateResult.data).toBe(90);
      expect(stripExifResult.data).toBe(true);
    });

    it("should parse photo editing transformations from URL", () => {
      const parsed = qs.parse(TEST_URLS.photoEdit.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const extractResult = transformationSchemas.extract.safeParse(typed.extract);
      const grayscaleResult = transformationSchemas.grayscale.safeParse(typed.grayscale);
      const formatResult = transformationSchemas.format.safeParse(typed.format);
      const qualityResult = transformationSchemas.quality.safeParse(typed.quality);

      expect(extractResult.success).toBe(true);
      expect(grayscaleResult.success).toBe(true);
      expect(formatResult.success).toBe(true);
      expect(qualityResult.success).toBe(true);

      expect(extractResult.data).toEqual([50, 100, 800, 600]);
      expect(grayscaleResult.data).toBe(true);
      expect(formatResult.data).toBe("jpeg");
      expect(qualityResult.data).toBe(95);
    });
  });

  describe("Watermark transformations", () => {
    it("should parse and validate single watermark from URL", () => {
      const parsed = qs.parse(TEST_URLS.watermarkSingle.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.watermark.safeParse(typed.watermark);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(["https://example.com/logo.png", [10, 10, 0.8, 0.3, 0.3]]);
    });

    it("should parse and validate multiple watermarks from URL", () => {
      const parsed = qs.parse(TEST_URLS.watermarkMultiple.split("?")[1], { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.watermark.safeParse(typed.watermark);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        ["https://example.com/logo1.png", [10, 10, 0.8, 0.3, 0.3]],
        ["https://example.com/logo2.png", [100, 100, 0.5, 0.2, 0.2]],
      ]);
    });
  });

  describe("Validation failures", () => {
    it("should fail validation for blur value greater than upperbound", () => {
      const parsed = qs.parse("blur=2000");
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.blur.safeParse(typed.blur);
      expect(result.success).toBe(false);
    });

    it("should fail validation for quality value greater than upperbound", () => {
      const parsed = qs.parse("quality=150");
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.quality.safeParse(typed.quality);
      expect(result.success).toBe(false);
    });

    it("should fail validation for invalid format", () => {
      const parsed = qs.parse("format=gif");
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.format.safeParse(typed.format);
      expect(result.success).toBe(true);
    });

    it("should fail validation for resize without width, height, or ratio", () => {
      const parsed = qs.parse("resize.fit=cover", { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.resize.safeParse(typed.resize);
      expect(result.success).toBe(false);
    });

    it("should fail validation for negative extract values", () => {
      const parsed = qs.parse("extract=[-10,20,300,200]", { allowDots: true });
      const typed = queryTypes.parseObject(parsed);

      const result = transformationSchemas.extract.safeParse(typed.extract);
      expect(result.success).toBe(false);
    });

    it("should fail validation for watermark without width or height ratio", () => {
      const watermarkData = ["https://example.com/logo.png", [10, 10]];
      
      const result = transformationSchemas.watermark.safeParse(watermarkData);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("At least widthRatio or heightRatio must be provided");
    });
  });
});
