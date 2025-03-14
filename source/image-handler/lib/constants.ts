// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const ALTERNATE_EDIT_ALLOWLIST_ARRAY = [
  "overlayWith",
  "smartCrop",
  "roundCrop",
  "contentModeration",
  "crop",
  "animated",
] as const;

const SHARP_IMAGE_OPERATIONS = {
  CHANNEL_FUNCTIONS: ["removeAlpha", "ensureAlpha", "extractChannel", "joinChannel", "bandbool"] as const,
  COLOR_FUNCTIONS: [
    "tint",
    "greyscale",
    "grayscale",
    "pipelineColourspace",
    "pipelineColorspace",
    "toColourspace",
    "toColorspace",
  ] as const,
  OPERATION_FUNCTIONS: [
    "rotate",
    "flip",
    "flop",
    "affine",
    "sharpen",
    "median",
    "blur",
    "flatten",
    "unflatten",
    "gamma",
    "negate",
    "normalise",
    "normalize",
    "clahe",
    "convolve",
    "threshold",
    "boolean",
    "linear",
    "recomb",
    "modulate",
  ] as const,
  FORMAT_OPERATIONS: ["jpeg", "png", "webp", "gif", "avif", "tiff", "heif", "toFormat"] as const,
  RESIZE_OPERATIONS: ["resize", "extend", "extract", "trim"] as const,
} as const;

export const SHARP_EDIT_ALLOWLIST_ARRAY: string[] = [
  ...SHARP_IMAGE_OPERATIONS.CHANNEL_FUNCTIONS,
  ...SHARP_IMAGE_OPERATIONS.COLOR_FUNCTIONS,
  ...SHARP_IMAGE_OPERATIONS.OPERATION_FUNCTIONS,
  ...SHARP_IMAGE_OPERATIONS.FORMAT_OPERATIONS,
  ...SHARP_IMAGE_OPERATIONS.RESIZE_OPERATIONS,
] as const;

export const HEADER_DENY_LIST = [
  // Exact Matches
  /^authorization$/i,
  /^connection$/i,
  /^server$/i,
  /^transfer-encoding$/i,
  /^referrer-policy$/i,
  /^permissions-policy$/i,
  /^www-authenticate$/i,
  /^proxy-authenticate$/i,
  /^x-api-key$/i,
  /^set-cookie$/i,

  // Security Header Patterns
  /^x-frame-.*$/i,
  /^x-content-.*$/i,
  /^x-xss-.*$/i,
  /^strict-transport-.*$/i,
  /^permissions-.*$/i,

  // AWS Specific Patterns
  /^x-amz-.*$/i,
  /^x-amzn-.*$/i,

  // Access Control Patterns
  /^access-control-.*$/i,

  // Content and Transport Patterns
  /^strict-transport-.*$/i,
  /^cross-origin-.*$/i,
  /^content-.*$/i,
];
