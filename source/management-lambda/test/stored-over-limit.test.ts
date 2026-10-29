// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DBEntityType, validateOriginItem, validatePolicyItem } from "../interfaces";

// Request limits apply on write only; items already stored above them must still load.
describe("stored items above the request limits", () => {
  const base = { PK: "550e8400-e29b-41d4-a716-446655440000", CreatedAt: "2024-01-01T00:00:00.000Z" };

  it("loads a stored policy whose lists exceed the request limits", () => {
    const policyJSON = JSON.stringify({
      transformations: [
        { transformation: "smartCrop", value: { faces: true, priorities: ["padding", "padding", "aspectRatio"] } },
        { transformation: "contentModeration", value: { moderationLabels: Array.from({ length: 101 }, (_, i) => `l${i}`) } },
      ],
      outputs: [{ type: "autosize", value: Array.from({ length: 21 }, (_, i) => 100 + i) }],
    });
    const result = validatePolicyItem({
      ...base,
      GSI1PK: DBEntityType.POLICY,
      GSI1SK: "stored-policy",
      Data: { policyName: "stored-policy", policyJSON, isDefault: false },
    });
    expect(result.success).toBe(true);
  });

  it("loads a stored origin with more than 20 headers", () => {
    const originHeaders = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`x-h${i}`, "v"]));
    const result = validateOriginItem({
      ...base,
      GSI1PK: DBEntityType.ORIGIN,
      GSI1SK: "stored-origin",
      Data: { originName: "stored-origin", originDomain: "example.com", originHeaders },
    });
    expect(result.success).toBe(true);
  });
});
