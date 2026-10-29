// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Mapping, Origin, TransformationPolicy } from "../../../data-models";
import { ErrorCodes } from "../../common";
import { mockOriginCreateRequest, mockTransformationPolicyCreateRequest } from "../mocks";
import { createAuthHeaders, uniqueSuffix, withUniqueOriginName, withUniquePolicyName } from "./utils";

const { API_URL, TEST_ACCESS_TOKEN } = process.env;
if (!API_URL || !TEST_ACCESS_TOKEN) {
  throw new Error("API_URL and TEST_ACCESS_TOKEN must be set in environment");
}

const request = (method: string, path: string, body?: unknown) =>
  fetch(API_URL + path, {
    method,
    headers: createAuthHeaders(TEST_ACCESS_TOKEN),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// The uniqueness check reads the GSI1 list partitions, which lag the base table, so wait until the
// list endpoint (also GSI1) shows the item. GET /{id} reads the base table and could pass too early.
async function waitUntilListed(path: string, matches: (item: any) => boolean, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let nextToken: string | undefined;
    do {
      const response = await request("GET", path + (nextToken ? `?nextToken=${nextToken}` : ""));
      const body = (await response.json()) as { items: any[]; nextToken?: string };
      if (body.items.some(matches)) return;
      nextToken = body.nextToken;
    } while (nextToken);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Item not listed at ${path} within ${timeoutMs} ms`);
}

async function expectDuplicateRejected(response: Response, message: string) {
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ errorCode: ErrorCodes.INVALID_FIELD_VALUE, message });
}

describe("Duplicate rejection", () => {
  let origin: Origin;
  const cleanup: string[] = [];

  beforeAll(async () => {
    origin = (await (
      await request("POST", "/origins", withUniqueOriginName(mockOriginCreateRequest))
    ).json()) as Origin;
  });

  afterAll(async () => {
    for (const path of cleanup.reverse()) await request("DELETE", path);
    await request("DELETE", `/origins/${origin.originId}`);
  });

  test("origin names compare case-insensitively", async () => {
    const first = withUniqueOriginName(mockOriginCreateRequest);
    const created = (await (await request("POST", "/origins", first)).json()) as Origin;
    cleanup.push(`/origins/${created.originId}`);
    await waitUntilListed("/origins", (item: Origin) => item.originId === created.originId);

    const duplicateName = first.originName.toUpperCase();
    const response = await request("POST", "/origins", { ...first, originName: duplicateName });

    await expectDuplicateRejected(response, `An origin named "${duplicateName}" already exists`);
  }, 60000);

  test("policy names compare case-insensitively", async () => {
    const first = withUniquePolicyName(mockTransformationPolicyCreateRequest);
    const created = (await (await request("POST", "/policies", first)).json()) as TransformationPolicy;
    cleanup.push(`/policies/${created.policyId}`);
    await waitUntilListed("/policies", (item: TransformationPolicy) => item.policyId === created.policyId);

    const duplicateName = first.policyName.toUpperCase();
    const response = await request("POST", "/policies", { ...first, policyName: duplicateName });

    await expectDuplicateRejected(response, `A policy named "${duplicateName}" already exists`);
  }, 60000);

  test("path patterns ignore case and a trailing slash", async () => {
    const suffix = uniqueSuffix();
    const created = (await (
      await request("POST", "/mappings", {
        mappingName: `dup path ${suffix}`,
        pathPattern: `/dup-${suffix}/images`,
        originId: origin.originId,
      })
    ).json()) as Mapping;
    cleanup.push(`/mappings/${created.mappingId}`);
    await waitUntilListed("/mappings", (item: Mapping) => item.mappingId === created.mappingId);

    const duplicatePattern = `/DUP-${suffix}/Images/`;
    const response = await request("POST", "/mappings", {
      mappingName: `dup path other ${suffix}`,
      pathPattern: duplicatePattern,
      originId: origin.originId,
    });

    await expectDuplicateRejected(response, `A path mapping with pattern "${duplicatePattern}" already exists`);
  }, 60000);

  test("host patterns compare case-insensitively", async () => {
    const suffix = uniqueSuffix();
    const created = (await (
      await request("POST", "/mappings", {
        mappingName: `dup host ${suffix}`,
        hostHeaderPattern: `dup-${suffix}.example.com`,
        originId: origin.originId,
      })
    ).json()) as Mapping;
    cleanup.push(`/mappings/${created.mappingId}`);
    await waitUntilListed("/mappings", (item: Mapping) => item.mappingId === created.mappingId);

    const duplicatePattern = `DUP-${suffix}.Example.com`;
    const response = await request("POST", "/mappings", {
      mappingName: `dup host other ${suffix}`,
      hostHeaderPattern: duplicatePattern,
      originId: origin.originId,
    });

    await expectDuplicateRejected(response, `A host header mapping with pattern "${duplicatePattern}" already exists`);
  }, 60000);

  test("mapping names are unique across path and host mappings", async () => {
    const suffix = uniqueSuffix();
    const created = (await (
      await request("POST", "/mappings", {
        mappingName: `dup name ${suffix}`,
        pathPattern: `/dup-name-${suffix}/*`,
        originId: origin.originId,
      })
    ).json()) as Mapping;
    cleanup.push(`/mappings/${created.mappingId}`);
    await waitUntilListed("/mappings", (item: Mapping) => item.mappingId === created.mappingId);

    const duplicateName = `DUP NAME ${suffix}`;
    const response = await request("POST", "/mappings", {
      mappingName: duplicateName,
      hostHeaderPattern: `dup-name-${suffix}.example.com`,
      originId: origin.originId,
    });

    await expectDuplicateRejected(response, `A mapping named "${duplicateName}" already exists`);
  }, 60000);
});
