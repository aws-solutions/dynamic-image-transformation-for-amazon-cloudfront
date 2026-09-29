// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { applyMergePatch } from "../common/utils";

describe("applyMergePatch", () => {
  it("should update fields with new values", () => {
    const existing = { name: "old", path: "/old" };
    const result = applyMergePatch(existing, { name: "new" });
    expect(result.name).toBe("new");
    expect(result.path).toBe("/old");
  });

  it("should delete fields set to null", () => {
    const existing = { name: "test", path: "/images", headers: { "x-key": "val" } };
    const result = applyMergePatch(existing, { path: null });
    expect(result.name).toBe("test");
    expect(result).not.toHaveProperty("path");
    expect(result.headers).toEqual({ "x-key": "val" });
  });

  it("should preserve fields when patch value is undefined", () => {
    const existing = { name: "test", path: "/images" };
    const result = applyMergePatch(existing, { path: undefined });
    expect(result.path).toBe("/images");
  });

  it("should handle multiple operations in one patch", () => {
    const existing = { name: "old", path: "/old", description: "desc" };
    const result = applyMergePatch(existing, {
      name: "new",        // update
      path: null,         // delete
      description: undefined, // no change
    });
    expect(result.name).toBe("new");
    expect(result).not.toHaveProperty("path");
    expect(result.description).toBe("desc");
  });

  it("should not mutate the original entity", () => {
    const existing = { name: "test", path: "/images" };
    const result = applyMergePatch(existing, { path: null });
    expect(existing.path).toBe("/images");
    expect(result).not.toHaveProperty("path");
  });

  it("should add new fields from the patch", () => {
    const existing = { name: "test" } as Record<string, unknown>;
    const result = applyMergePatch(existing, { path: "/new" });
    expect(result.path).toBe("/new");
  });

  it("should handle an empty patch (no-op)", () => {
    const existing = { name: "test", path: "/images" };
    const result = applyMergePatch(existing, {});
    expect(result).toEqual(existing);
  });

  it("should handle all fields being deleted", () => {
    const existing = { path: "/images", description: "desc" };
    const result = applyMergePatch(existing, { path: null, description: null });
    expect(result).not.toHaveProperty("path");
    expect(result).not.toHaveProperty("description");
  });
});
