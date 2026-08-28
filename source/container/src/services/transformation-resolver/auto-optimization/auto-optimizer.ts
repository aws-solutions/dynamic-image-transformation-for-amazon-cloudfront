// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { Transformation, TransformationPolicy } from '../../../types/transformation';
import { ImageProcessingRequest } from '../../../types/image-processing-request';

const FORMAT_PRIORITY = ['webp', 'avif', 'jpeg', 'png', 'heif', 'tiff', 'raw', 'gif'];
// TODO, DISCUSS WITH TEAM FOR OPTIMAL FORMAT PRIORITIY LIST
const ANIMATION_CAPABLE_FORMATS = new Set(['webp', 'avif', 'gif']);
const FORMAT_MAPPING: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/avif': 'avif',
  'image/heif': 'heif',
  'image/heic': 'heif',
  'image/tiff': 'tiff',
  'image/raw': 'raw',
  'image/gif': 'gif'
};

export function applyAutoOptimizations(transformations: Transformation[], req: Request, policy?: TransformationPolicy, imageRequest?: ImageProcessingRequest): Transformation[] {
  const optimizations: Transformation[] = [];
  
  const outputs = parseOutputs(policy);
  
  optimizations.push(...getFormatOptimizations(req, outputs.format, imageRequest));
  optimizations.push(...getQualityOptimizations(req, outputs.quality));
  optimizations.push(...getSizeOptimizations(req, outputs.autosize));
  
  return [...transformations, ...optimizations];
}

function parseOutputs(policy?: TransformationPolicy) {
  const outputs = { quality: null, format: null, autosize: null };
  
  if (!policy?.outputs) {
    return outputs;
  }
  
  for (const output of policy.outputs) {
    if (output.type === 'quality') {
      outputs.quality = output;
    } else if (output.type === 'format') {
      outputs.format = output;
    } else if (output.type === 'autosize') {
      outputs.autosize = output;
    }
  }
  
  return outputs;
}

function getFormatOptimizations(req: Request, formatOutput: any, imageRequest?: ImageProcessingRequest): Transformation[] {
  if (!formatOutput) {
    return [];
  }

  const formatConfig = formatOutput.value;
  
  if (formatConfig !== 'auto') {
    return [createOptimizationTransformation('format', formatConfig)];
  }
  
  const accept = req.header('dit-accept') || '';
  console.log('Accept header found as: ', req.header('dit-accept'))
  const compatibleFormats = Object.keys(FORMAT_MAPPING)
    .filter(mimeType => accept.includes(mimeType))
    .map(mimeType => FORMAT_MAPPING[mimeType]);
  
  const selectedFormat = FORMAT_PRIORITY.find(format => compatibleFormats.includes(format))
    ?? formatOutput.fallback?.format
    ?? null;

  if (!selectedFormat) {
    return [];
  }

  // Skip format conversion if source is a GIF and selected format cannot carry animation
  const sourceIsGif = imageRequest?.sourceImageContentType === 'image/gif';
  if (sourceIsGif && !ANIMATION_CAPABLE_FORMATS.has(selectedFormat)) {
    return [];
  }

  // Check if source image format matches selected format to avoid unnecessary transformation
  if (imageRequest?.sourceImageContentType) {
    const sourceFormat = FORMAT_MAPPING[imageRequest.sourceImageContentType];
    if (sourceFormat === selectedFormat) {
      return [];
    }
  }

  return [createOptimizationTransformation('format', selectedFormat)];
}

function getQualityOptimizations(req: Request, qualityOutput: any): Transformation[] {
  const qualityConfig = qualityOutput?.value;
  if (!qualityConfig || !Array.isArray(qualityConfig) || qualityConfig.length === 0) {
    return [];
  }

  const defaultQuality = qualityConfig[0];

  // Static quality only (no DPR ranges)
  if (qualityConfig.length === 1) {
    return [createOptimizationTransformation('quality', defaultQuality)];
  }

  // Trust only the CF-normalized dit-dpr, then the policy fallback. Raw Sec-CH-* aren't in the
  // CloudFront cache key, so honoring them would poison a shared key.
  const dprValue =
    parseDpr(req.header('dit-dpr')) ??
    parseDpr(qualityOutput?.fallback?.dpr?.toString());

  if (dprValue === null) {
    return [createOptimizationTransformation('quality', defaultQuality)];
  }

  const mappings = qualityConfig.slice(1) as [number, number, number][];

  for (const [lowerBound, upperBound, qualityValue] of mappings) {
    if (dprValue >= lowerBound && dprValue < upperBound) {
      return [createOptimizationTransformation('quality', qualityValue)];
    }
  }

  return [createOptimizationTransformation('quality', defaultQuality)];
}

function getSizeOptimizations(req: Request, autosizeOutput: any): Transformation[] {
  const autosizeConfig = autosizeOutput?.value;
  if (!autosizeConfig || !Array.isArray(autosizeConfig) || autosizeConfig.length === 0) {
    return [];
  }

  // dit-viewport-width is already CF-normalized; use it directly. Don't read raw Sec-CH-* here —
  // they aren't in the CloudFront cache key, so honoring them would poison a shared key.
  const ditViewportWidth = parseViewportWidth(req.header('dit-viewport-width'));
  if (ditViewportWidth !== null) {
    return [createOptimizationTransformation('resize', { width: ditViewportWidth })];
  }

  // No CF-normalized viewport signal: snap the policy's fallback viewport width instead.
  const fallbackWidth = parseViewportWidth(autosizeOutput?.fallback?.viewportWidth?.toString());
  if (fallbackWidth !== null) {
    return [createOptimizationTransformation('resize', { width: snapToBreakpoint(fallbackWidth, autosizeConfig) })];
  }

  return [];
}

// 8K upper bound, mirroring the CloudFront function's validation. Headers are client-forgeable,
// so an unbounded value could demand an arbitrarily large upscale.
const MAX_VIEWPORT_WIDTH = 7680;

/** Parses a viewport width header/value into a positive integer, or null if absent/invalid. */
function parseViewportWidth(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const vw = parseInt(raw, 10);
  if (isNaN(vw) || vw <= 0 || vw > MAX_VIEWPORT_WIDTH) {
    return null;
  }
  return vw;
}

// 5.0 upper bound, mirroring the CloudFront function's DPR normalization cap.
const MAX_DPR = 5.0;

/** Parses a DPR header/value into a positive number rounded to one decimal (capped at 5.0), or null if absent/invalid. */
function parseDpr(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const dpr = parseFloat(raw);
  if (isNaN(dpr) || dpr <= 0) {
    return null;
  }
  return Math.min(Math.round(dpr * 10) / 10, MAX_DPR);
}

/** Snaps a raw width up to the nearest supported breakpoint (>=), capping at the largest breakpoint. */
function snapToBreakpoint(width: number, breakpoints: number[]): number {
  const sorted = [...breakpoints].sort((a, b) => a - b);
  return sorted.find((bp) => bp >= width) ?? sorted[sorted.length - 1];
}

function createOptimizationTransformation(type: string, value: any): Transformation {
  return {
    type,
    value,
    source: 'auto'
  };
}