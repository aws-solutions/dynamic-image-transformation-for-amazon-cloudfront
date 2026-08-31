// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Single source of truth for moderation config + defaults, shared by the moderation service and
// the transformation limiter without pulling in the sharp/rekognition-heavy service.
export interface ContentModerationConfig {
  minConfidence: number;
  blur: number;
  moderationLabels: string[];
}

export const CONTENT_MODERATION_DEFAULTS: ContentModerationConfig = {
  minConfidence: 75,
  blur: 50,
  moderationLabels: [],
};

// Resolve a contentModeration value (true | Partial<config>) to a full config.
export function resolveModerationConfig(value: true | Partial<ContentModerationConfig>): ContentModerationConfig {
  if (value === true) return { ...CONTENT_MODERATION_DEFAULTS };
  return {
    minConfidence: value.minConfidence ?? CONTENT_MODERATION_DEFAULTS.minConfidence,
    blur: value.blur ?? CONTENT_MODERATION_DEFAULTS.blur,
    moderationLabels: value.moderationLabels ?? CONTENT_MODERATION_DEFAULTS.moderationLabels,
  };
}
