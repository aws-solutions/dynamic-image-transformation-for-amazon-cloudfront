// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Size limits on request-input containers (CVE-2023-54404): an oversized container must fail with
 * one bounded issue instead of one issue per element.
 */

import {
  validateTransformationPolicy,
  validateTransformationPolicyCreate,
  validateTransformationPolicyUpdate,
  transformationSchemas,
  outputSchemas,
} from "../transformation-policy";

const N = 100_000;
const create = (policyJSON: unknown) =>
  validateTransformationPolicyCreate({ policyName: "Limits", policyJSON, isDefault: false });
const issueJSON = (result: { error?: { issues: unknown[] } }) =>
  JSON.stringify(result.error?.issues ?? []);
const messages = (result: { error?: { issues: unknown[] } }) => issueJSON(result);
const codeCount = (result: { error?: { issues: unknown[] } }) => (issueJSON(result).match(/"code"/g) ?? []).length;

const smartCrop = (priorities: unknown[]) => ({ faces: true, priorities });
const moderation = (moderationLabels: unknown[]) => ({ moderationLabels });
const qualityRows = (n: number, row: unknown = [1, 2, 80]) => [80, ...Array.from({ length: n }, () => row)];
const withCondition = (value: unknown[]) => ({
  transformations: [{ transformation: "grayscale", value: true, condition: { field: "dit-device", value } }],
});

describe("Request container limits", () => {
  describe("smartCrop.priorities (max 2)", () => {
    it("accepts 2 priorities", () => {
      expect(transformationSchemas.smartCrop.safeParse(smartCrop(["aspectRatio", "padding"])).success).toBe(true);
    });
    it("rejects 3 priorities with the limit message", () => {
      const r = transformationSchemas.smartCrop.safeParse(smartCrop(["aspectRatio", "padding", "padding"]));
      expect(r.success).toBe(false);
      expect(messages(r)).toContain("At most 2 priorities");
    });
    it("reports the over-limit priorities as a union issue at the top level", () => {
      const r = transformationSchemas.smartCrop.safeParse(smartCrop(["aspectRatio", "padding", "padding"]));
      expect(r.error?.issues[0].code).toBe("invalid_union");
    });
    it("bounds the issues for 100,000 invalid priorities", () => {
      const r = transformationSchemas.smartCrop.safeParse(smartCrop(Array.from({ length: N }, () => "x")));
      expect(r.success).toBe(false);
      expect(issueJSON(r).length).toBeLessThan(10_000);
    });
  });

  describe("contentModeration.moderationLabels (max 100 labels of at most 100 characters)", () => {
    it("accepts 100 labels of 100 characters", () => {
      const labels = Array.from({ length: 100 }, () => "a".repeat(100));
      expect(transformationSchemas.contentModeration.safeParse(moderation(labels)).success).toBe(true);
    });
    it("rejects 101 labels with the limit message", () => {
      const r = transformationSchemas.contentModeration.safeParse(moderation(Array.from({ length: 101 }, () => "a")));
      expect(r.success).toBe(false);
      expect(messages(r)).toContain("At most 100 moderation labels");
    });
    it("rejects a 101-character label with the limit message", () => {
      const r = transformationSchemas.contentModeration.safeParse(moderation(["a".repeat(101)]));
      expect(r.success).toBe(false);
      expect(messages(r)).toContain("Moderation label too long (max 100 characters)");
    });
    it("bounds the issues for 100,000 invalid labels", () => {
      const r = transformationSchemas.contentModeration.safeParse(moderation(Array.from({ length: N }, () => 1)));
      expect(r.success).toBe(false);
      expect(issueJSON(r).length).toBeLessThan(10_000);
    });
  });

  describe("autosize widths (max 20)", () => {
    it("accepts 20 widths and the admin UI's 7 defaults", () => {
      expect(outputSchemas.autosize.safeParse(Array.from({ length: 20 }, (_, i) => i + 1)).success).toBe(true);
      expect(outputSchemas.autosize.safeParse([320, 480, 768, 1024, 1200, 1440, 1920]).success).toBe(true);
    });
    it("rejects 21 widths with the limit message", () => {
      const r = outputSchemas.autosize.safeParse(Array.from({ length: 21 }, (_, i) => i + 1));
      expect(r.success).toBe(false);
      expect(messages(r)).toContain("At most 20 autosize widths");
    });
    it("bounds the issues for 100,000 invalid widths", () => {
      const r = outputSchemas.autosize.safeParse(Array.from({ length: N }, () => -1));
      expect(r.success).toBe(false);
      expect(issueJSON(r).length).toBeLessThan(10_000);
    });
  });

  describe("quality DPR rows (max 20)", () => {
    it("accepts 20 rows and the admin UI's single default value", () => {
      expect(outputSchemas.quality.safeParse(qualityRows(20)).success).toBe(true);
      expect(outputSchemas.quality.safeParse([80]).success).toBe(true);
      expect(outputSchemas.quality.parse([80, [1, 2, 70]])).toEqual([80, [1, 2, 70]]);
    });
    it("rejects 21 rows with the limit message", () => {
      const r = outputSchemas.quality.safeParse(qualityRows(21));
      expect(r.success).toBe(false);
      expect(messages(r)).toContain("At most 20 quality DPR rows");
    });
    it("bounds the issues for 100,000 invalid rows", () => {
      const r = outputSchemas.quality.safeParse(qualityRows(N, "x"));
      expect(r.success).toBe(false);
      expect(issueJSON(r).length).toBeLessThan(10_000);
    });
    it("reports an invalid row within the limit at the row's path", () => {
      const value = qualityRows(20);
      value[5] = [1, 2, 101];
      const r = outputSchemas.quality.safeParse(value);
      expect(r.success).toBe(false);
      expect(r.error?.issues[0].path).toEqual([5, 2]);
    });
    it("reports invalid_type for a non-array", () => {
      const r = outputSchemas.quality.safeParse("80");
      expect(r.success).toBe(false);
      expect(r.error?.issues).toHaveLength(1);
      expect(r.error?.issues[0].code).toBe("invalid_type");
    });
  });

  describe("condition value list (max 50)", () => {
    it("accepts 50 values", () => {
      expect(create(withCondition(Array.from({ length: 50 }, (_, i) => `v${i}`))).success).toBe(true);
    });
    it("rejects 51 values with the limit message", () => {
      const r = create(withCondition(Array.from({ length: 51 }, (_, i) => `v${i}`)));
      expect(r.success).toBe(false);
      expect(messages(r)).toContain("At most 50 condition values");
    });
    it("reports the over-limit condition list as a union issue at the top level", () => {
      const r = create(withCondition(Array.from({ length: 51 }, (_, i) => `v${i}`)));
      expect(r.error?.issues[0].code).toBe("invalid_union");
    });
    it("rejects 51 invalid values without one issue per value", () => {
      const r = create(withCondition(Array.from({ length: 51 }, () => ({}))));
      expect(r.success).toBe(false);
      expect(codeCount(r)).toBeLessThan(10);
    });
  });

  describe("policy outputs (max 3)", () => {
    const outputs = [
      { type: "quality", value: [80] },
      { type: "format", value: "auto" },
      { type: "autosize", value: [320] },
    ];
    it("accepts the three output types", () => {
      expect(create({ outputs }).success).toBe(true);
    });
    it("rejects 4 outputs with the limit message", () => {
      const r = create({ outputs: [...outputs, { type: "format", value: "webp" }] });
      expect(r.success).toBe(false);
      expect(messages(r)).toContain("At most 3 output optimizations");
    });
    it("rejects 4 invalid outputs without one issue per output", () => {
      const r = create({ outputs: Array.from({ length: 4 }, () => ({})) });
      expect(r.success).toBe(false);
      expect(codeCount(r)).toBeLessThan(4);
    });
  });
});

describe("Request container limits crossed with element and sibling rules", () => {
  it("rejects 3 priorities with no detection method with the limit message", () => {
    const r = transformationSchemas.smartCrop.safeParse({ priorities: ["aspectRatio", "padding", "padding"] });
    expect(r.success).toBe(false);
    expect(messages(r)).toContain("At most 2 priorities");
  });
  it("rejects 3 priorities with an invalid one and no detection method with the limit message", () => {
    const r = transformationSchemas.smartCrop.safeParse({ priorities: ["aspectRatio", "gravity", "padding"] });
    expect(r.success).toBe(false);
    expect(messages(r)).toContain("At most 2 priorities");
  });
  it("rejects an invalid priority within the limit with the enum message", () => {
    const r = transformationSchemas.smartCrop.safeParse(smartCrop(["aspectRatio", "gravity"]));
    expect(r.success).toBe(false);
    expect(messages(r)).toContain("Only 'aspectRatio' and 'padding' are configurable priorities");
  });
  it("rejects 3 priorities with an invalid one with the limit message", () => {
    const r = transformationSchemas.smartCrop.safeParse(smartCrop(["aspectRatio", "gravity", "padding"]));
    expect(r.success).toBe(false);
    expect(messages(r)).toContain("At most 2 priorities");
  });
  it("rejects 101 moderation labels that include empty and overlong labels with the limit message", () => {
    const labels = [...Array.from({ length: 99 }, () => "a"), "", "a".repeat(101)];
    const r = transformationSchemas.contentModeration.safeParse(moderation(labels));
    expect(r.success).toBe(false);
    expect(messages(r)).toContain("At most 100 moderation labels");
  });
  it("rejects an empty moderation label within the limit", () => {
    const r = transformationSchemas.contentModeration.safeParse(moderation(["a", ""]));
    expect(r.success).toBe(false);
  });
  it("rejects an invalid autosize width within the limit at the width's path", () => {
    const widths = Array.from({ length: 20 }, (_, i) => i + 1);
    widths[7] = -1;
    const r = outputSchemas.autosize.safeParse(widths);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual([7]);
  });
  it("rejects an empty quality list", () => {
    expect(outputSchemas.quality.safeParse([]).success).toBe(false);
  });
  it("rejects an invalid default quality within the row limit at index 0", () => {
    const r = outputSchemas.quality.safeParse([101, [1, 2, 80]]);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual([0]);
  });
  it("rejects an invalid condition value within the limit", () => {
    const values: unknown[] = Array.from({ length: 50 }, (_, i) => `v${i}`);
    values[10] = {};
    const r = create(withCondition(values));
    expect(r.success).toBe(false);
    expect(messages(r)).not.toContain("At most 50 condition values");
  });
});

describe("Policy size pre-check (10 KB before parsing)", () => {
  const SIZE_MESSAGE = "Policy too large (max 10KB)";
  const len = (v: unknown) => JSON.stringify(v).length;
  // Pads a condition field so a policy of `count` copies of `entry` lands near `target` characters.
  const padded = (entry: Record<string, unknown>, count: number, target: number) => {
    const base = { transformations: Array.from({ length: count }, () => ({ ...entry, condition: { field: "", value: "v" } })) };
    const per = Math.floor((target - len(base)) / count);
    const policy = { transformations: base.transformations.map((t) => ({ ...t, condition: { field: "f".repeat(per), value: "v" } })) };
    return policy;
  };
  const composite = {
    transformations: Array.from({ length: 100 }, () => ({
      transformation: "contentModeration",
      value: { moderationLabels: Array.from({ length: 100 }, () => 1) },
      condition: { field: "h", value: Array.from({ length: 50 }, () => ({})) },
    })),
  };
  const entity = (policyJSON: unknown) =>
    validateTransformationPolicy({
      policyId: "550e8400-e29b-41d4-a716-446655440000",
      policyName: "Limits",
      policyJSON,
      isDefault: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

  it("rejects the composite worst case with exactly the size issue", () => {
    expect(len(composite)).toBeGreaterThan(10_000);
    for (const r of [create(composite), validateTransformationPolicyUpdate({ policyJSON: composite })]) {
      expect(r.success).toBe(false);
      expect(r.error?.issues).toHaveLength(1);
      expect(r.error?.issues[0].message).toBe(SIZE_MESSAGE);
    }
  });

  it("accepts a valid policy just under 10 KB", () => {
    const policy = padded({ transformation: "grayscale", value: true }, 50, 9_900);
    expect(len(policy)).toBeGreaterThan(9_800);
    expect(len(policy)).toBeLessThanOrEqual(10_000);
    expect(create(policy).success).toBe(true);
  });

  it("still rejects a policy whose defaults grow it past 10 KB", () => {
    const policy = padded({ transformation: "sharpen", value: { sigma: 1 } }, 60, 9_950);
    expect(len(policy)).toBeLessThanOrEqual(10_000);
    const r = create(policy);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toContain(SIZE_MESSAGE);
  });

  it("rejects a policy over 10 KB whose rotate values would shrink it under 10 KB", () => {
    const policy = padded({ transformation: "rotate", value: 3600 }, 100, 10_100);
    expect(len(policy)).toBeGreaterThan(10_000);
    expect(len(JSON.parse(JSON.stringify(policy).replace(/"value":3600/g, '"value":0')))).toBeLessThanOrEqual(10_000);
    const r = create(policy);
    expect(r.success).toBe(false);
    expect(r.error?.issues).toHaveLength(1);
    expect(r.error?.issues[0].message).toBe(SIZE_MESSAGE);
  });

  it("accepts an update without policyJSON", () => {
    expect(validateTransformationPolicyUpdate({ policyName: "Renamed" }).success).toBe(true);
  });

  it("bounds the issues of the largest invalid policy that fits under 10 KB", () => {
    const worst = {
      transformations: Array.from({ length: 18 }, () => ({
        transformation: "contentModeration",
        value: { moderationLabels: Array.from({ length: 99 }, () => []) },
        condition: { field: "h", value: Array.from({ length: 50 }, () => ({})) },
      })),
    };
    expect(len(worst)).toBeLessThanOrEqual(10_000);
    const r = create(worst);
    expect(r.success).toBe(false);
    expect(issueJSON(r).length).toBeLessThan(1_000_000);
  });

  it.each([["a string", "policy"], ["null", null]])("reports invalid_type for %s on create", (_, value) => {
    const r = create(value);
    expect(r.success).toBe(false);
    expect(r.error?.issues).toHaveLength(1);
    expect(r.error?.issues[0].code).toBe("invalid_type");
  });

  describe.each([
    ["create", create],
    ["update", (policyJSON: unknown) => validateTransformationPolicyUpdate({ policyJSON })],
    ["entity", entity],
  ])("unmeasurable policyJSON on %s", (_, validate) => {
    it("returns a failed result for a BigInt instead of throwing", () => {
      const r = validate({ transformations: [{ transformation: "rotate", value: BigInt(90) }] });
      expect(r.success).toBe(false);
    });
    it("returns invalid_type for a function instead of throwing", () => {
      const r = validate(() => undefined);
      expect(r.success).toBe(false);
      expect(r.error?.issues[0].code).toBe("invalid_type");
    });
  });
});
