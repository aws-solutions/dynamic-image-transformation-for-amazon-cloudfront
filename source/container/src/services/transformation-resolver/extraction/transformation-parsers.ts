// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const transformationParsers = {
  // Simple pass-through for nested objects
  resize: (params: any) => params,
  convolve: (params: any) => params,
  sharpen: (params: any) => params,
  smartCrop: (params: any) => params,
  
  // Simple value parsers for flat parameters
  animated: (value: any) => value,
  quality: (value: any) => value,
  format: (value: any) => value === 'jpg' ? 'jpeg' : value,
  blur: (value: any) => value,
  flatten: (value: any) => value,
  extract: (value: any) => value,
  normalize: (value: any) => value,
  flip: (value: any) => value,
  flop: (value: any) => value,
  grayscale: (value: any) => value,
  tint: (value: any) => value,
  rotate: (value: any) => value,
  stripExif: (value: any) => value,
  stripIcc: (value: any) => value,
  watermark: (value: any) => value
};