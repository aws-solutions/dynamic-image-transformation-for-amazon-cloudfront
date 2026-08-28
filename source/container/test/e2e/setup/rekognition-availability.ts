// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Static map of Amazon Rekognition API availability by AWS region, used to gate
// e2e scenarios that depend on Rekognition (smart-crop, content moderation) so
// they skip — rather than fail — in regions where the required API is not offered.
//
// Source: https://docs.aws.amazon.com/general/latest/gr/rekognition.html
//   - Endpoint table: regions where the Rekognition service exists at all.
//   - "Canada (Central) Region" section: ca-central-1 offers only the face /
//     collection operations (DetectFaces et al.) — NOT DetectLabels /
//     DetectModerationLabels / DetectText.
// Verified 2026-06-16 via live DetectFaces / DetectLabels / DetectModerationLabels
// probes against each region (DITPipeline deployment-test account 943457993768).
//
// Encoding is exceptions-only: a region supports every API we use UNLESS it is
// listed below. New commercial regions default to "fully supported", which is
// correct for the overwhelming majority and keeps this list small. If AWS later
// adds moderation to a partial region (or launches a region without Rekognition),
// update the sets below — a stale entry surfaces as a loud skip or a pointed test
// failure, never a silent gap.

// The Rekognition Detect* operations exercised by the container e2e suite.
export type RekognitionApi = 'DetectFaces' | 'DetectLabels' | 'DetectModerationLabels' | 'DetectText';

// Regions with NO Rekognition endpoint at all (SDK cannot resolve an endpoint).
const REGIONS_WITHOUT_REKOGNITION = new Set<string>(['ap-northeast-3', 'eu-west-3', 'eu-north-1']);

// Regions where Rekognition exists but offers only a subset of operations.
// Value = the set of APIs that ARE available there.
const PARTIAL_REGION_SUPPORT: Record<string, ReadonlySet<RekognitionApi>> = {
  // Canada (Central): face / collection operations only.
  'ca-central-1': new Set<RekognitionApi>(['DetectFaces'])
};

/**
 * Returns true if the given Rekognition API is available in the given region.
 * Defaults to true (fully supported) for any region not explicitly listed as
 * unsupported or partial above.
 */
export function isApiSupported(api: RekognitionApi, region: string): boolean {
  if (REGIONS_WITHOUT_REKOGNITION.has(region)) {
    return false;
  }

  const partial = PARTIAL_REGION_SUPPORT[region];
  if (partial) {
    return partial.has(api);
  }

  return true;
}
