// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Mapping, MappingCreate, Origin, PaginatedMappingResponse, TransformationPolicy } from "../../../data-models";
import { ErrorCodes } from "../../common";
import {
  mockOriginCreateRequest,
  mockPathMappingCreateRequest,
  mockPathMappingUpdateRequest,
  mockTransformationPolicyCreateRequest,
} from "../mocks";
import { createAuthHeaders } from "./utils";

const mockUUIDv4 = "550e8400-e29b-41d4-a716-446655440000"; // valida UUIDv4
const { API_URL, TEST_ACCESS_TOKEN } = process.env;
if (!API_URL || !TEST_ACCESS_TOKEN) {
  throw new Error("API_URL and TEST_ACCESS_TOKEN must be set in environment");
}

describe("Mappings API", () => {
  describe("/mappings", () => {
    let mappings: Mapping[] = [];

    test("GET mappings successfully with empty list", async () => {
      const response = await fetch(API_URL + "/mappings", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ items: [] });
    });

    test("POST create mapping fails if the origin does not exist", async () => {
      const response = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({ ...mockPathMappingCreateRequest, originId: mockUUIDv4, policyId: mockUUIDv4 }),
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        errorCode: ErrorCodes.ORIGIN_NOT_FOUND,
      });
    });

    test("POST create mapping fails if the policy does not exist", async () => {
      // create origin
      const createOriginResponse = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockOriginCreateRequest),
      });
      const origin = (await createOriginResponse.json()) as Origin;

      const response = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({ ...mockPathMappingCreateRequest, originId: origin.originId, policyId: mockUUIDv4 }),
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        errorCode: ErrorCodes.POLICY_NOT_FOUND,
      });
    });

    test("POST create mapping fails when originId references a policy entity", async () => {
      // create policy
      const createPolicyResponse = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockTransformationPolicyCreateRequest),
      });
      const policy = (await createPolicyResponse.json()) as TransformationPolicy;

      // try to create mapping using policy ID as origin ID
      const response = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({ ...mockPathMappingCreateRequest, originId: policy.policyId }),
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        errorCode: ErrorCodes.ORIGIN_NOT_FOUND,
      });
    });

    test("POST create mapping fails when policyId references an origin entity", async () => {
      // create origin
      const createOriginResponse = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockOriginCreateRequest),
      });
      const origin = (await createOriginResponse.json()) as Origin;

      // try to create mapping using origin ID as policy ID
      const response = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({ ...mockPathMappingCreateRequest, originId: origin.originId, policyId: origin.originId }),
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        errorCode: ErrorCodes.POLICY_NOT_FOUND,
      });
    });

    test("POST create mapping successfully ONLY if the origin and policy exists", async () => {
      // create origin
      const createOriginResponse = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockOriginCreateRequest),
      });
      const origin = (await createOriginResponse.json()) as Origin;

      // create policy
      const createPolicyResponse = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockTransformationPolicyCreateRequest),
      });
      const policy = (await createPolicyResponse.json()) as TransformationPolicy;

      const createMappingResponse = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({ ...mockPathMappingCreateRequest, originId: origin.originId, policyId: policy.policyId }),
      });
      const responseBody = await createMappingResponse.json();
      expect(createMappingResponse.status).toBe(201);
      expect(responseBody).toMatchObject({
        ...mockPathMappingCreateRequest,
        originId: origin.originId,
        policyId: policy.policyId,
      });
      mappings.push(responseBody as Mapping); // for subsequent tests
    });

    test("GET mappings with invalid nextToken, fetches first page", async () => {
      const response = await fetch(API_URL + "/mappings?nextToken=invalid", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = (await response.json()) as PaginatedMappingResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(responseBody.items)).toBe(true);
      expect(responseBody.items.length).toBeGreaterThan(0);
      expect(responseBody.nextToken).toBeUndefined();
    });

    test("GET mappings returns created mapping, no additional pages in response", async () => {
      const response = await fetch(API_URL + "/mappings", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = (await response.json()) as PaginatedMappingResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(responseBody.items)).toBe(true);
      expect(responseBody.nextToken).toBeUndefined();
    });

    test("GET mappings with paginated response", async () => {
      const startTime = Date.now();

      // Create origin and policy first
      const createOriginResponse = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockOriginCreateRequest),
      });
      const origin = (await createOriginResponse.json()) as Origin;

      const createPolicyResponse = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockTransformationPolicyCreateRequest),
      });
      const policy = (await createPolicyResponse.json()) as TransformationPolicy;

      // Create many mappings to trigger pagination - mix of path and host header mappings
      // Pagination only triggered on path mappings
      const pathMappings: MappingCreate[] = Array.from({ length: 750 }, (_, i) => ({
        mappingName: `Test Path Mapping ${i + 2}`.padEnd(100, "A"),
        description: `Large path mapping for pagination testing ${i}`.padEnd(500, "B"),
        pathPattern: `/test/path/${i + 2}/`.padEnd(1000, "x") + "*", // Max 1000 chars to stay under GSI limit
        originId: origin.originId,
        policyId: policy.policyId,
      }));

      const hostMappings: MappingCreate[] = Array.from({ length: 500 }, (_, i) => ({
        mappingName: `Test Host Mapping ${i + 2}`.padEnd(100, "C"),
        description: `Large host mapping for pagination testing ${i}`.padEnd(500, "D"),
        hostHeaderPattern: `${"x".repeat(60)}.${("test" + i).padEnd(60, "y")}.${("host" + i).padEnd(60, "z")}.com`, // Multiple segments under 63 chars each
        originId: origin.originId,
        policyId: policy.policyId,
      }));

      const allMappings = [...pathMappings, ...hostMappings];

      await Promise.all(
        allMappings.map((mapping) =>
          fetch(API_URL + "/mappings", {
            method: "POST",
            headers: createAuthHeaders(TEST_ACCESS_TOKEN),
            body: JSON.stringify(mapping),
          })
        )
      );

      // Get first page
      const firstPageResponse = await fetch(API_URL + "/mappings", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const firstPageBody = (await firstPageResponse.json()) as PaginatedMappingResponse;

      expect(firstPageResponse.status).toBe(200);
      expect(firstPageBody.items.length).toBeGreaterThan(0);

      const secondPageResponse = await fetch(API_URL + `/mappings?nextToken=${firstPageBody.nextToken}`, {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const secondPageBody = (await secondPageResponse.json()) as PaginatedMappingResponse;

      expect(secondPageResponse.status).toBe(200);
      expect(secondPageBody.items.length).toBeGreaterThan(0);

      // Ensure no duplicate items between pages
      const firstPageIds = firstPageBody.items.map((item: Mapping) => item.mappingId);
      const secondPageIds = secondPageBody.items.map((item: Mapping) => item.mappingId);
      const intersection = firstPageIds.filter((id: string) => secondPageIds.includes(id));
      expect(intersection).toHaveLength(0);
      expect(secondPageBody.nextToken).toBeUndefined();

      // Add few more host header mappings and trigger paginated response on that too
      const newHostMappings: MappingCreate[] = Array.from({ length: 50 }, (_, i) => ({
        mappingName: `Test Host Mapping ${i + 2}`.padEnd(100, "C"),
        description: `Large host mapping for pagination testing ${i}`.padEnd(500, "D"),
        hostHeaderPattern: `${"x".repeat(60)}.${("test" + i).padEnd(60, "y")}.${("host" + i).padEnd(60, "z")}.com`, // Multiple segments under 63 chars each
        originId: origin.originId,
        policyId: policy.policyId,
      }));

      await Promise.all(
        newHostMappings.map((mapping) =>
          fetch(API_URL + "/mappings", {
            method: "POST",
            headers: createAuthHeaders(TEST_ACCESS_TOKEN),
            body: JSON.stringify(mapping),
          })
        )
      );

      // Get first page again
      const newFirstPageResponse = await fetch(API_URL + "/mappings", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });

      const newFirstPageBody = (await newFirstPageResponse.json()) as PaginatedMappingResponse;

      // Next token will now have composite next tokens for both mappings
      const newSecondPageResponse = await fetch(API_URL + `/mappings?nextToken=${newFirstPageBody.nextToken}`, {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });

      const newSecondPageBody = (await newSecondPageResponse.json()) as PaginatedMappingResponse;

      // Ensure no duplicate items between pages
      const newFirstPageIds = newFirstPageBody.items.map((item: Mapping) => item.mappingId);
      const newSecondPageIds = newSecondPageBody.items.map((item: Mapping) => item.mappingId);
      const newIntersection = newFirstPageIds.filter((id: string) => newSecondPageIds.includes(id));
      expect(newIntersection).toHaveLength(0);
      expect(secondPageBody.nextToken).toBeUndefined();
    }, 10000);

    test("GET specified mapping successfully", async () => {
      if (mappings.length === 0) {
        throw new Error("No mappings found");
      }

      const getResponse = await fetch(API_URL + `/mappings/${mappings[0].mappingId}`, {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(getResponse.status).toBe(200);
    });

    test("GET fail for invalid id", async () => {
      const response = await fetch(API_URL + "/mappings/random-id", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody).toMatchObject({ errorCode: ErrorCodes.INVALID_FIELD_VALUE });
    });

    test("GET fail if the specified mapping does not exist", async () => {
      const response = await fetch(API_URL + `/mappings/${mockUUIDv4}`, {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(404);
      expect(responseBody).toMatchObject({ errorCode: ErrorCodes.NOT_FOUND });
    });

    test("UPDATE specified mapping successfully when origin and policy exists", async () => {
      if (mappings.length === 0) {
        throw new Error("No mappings found");
      }

      const response = await fetch(API_URL + `/mappings/${mappings[0].mappingId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          ...mockPathMappingUpdateRequest,
          originId: mappings[0].originId,
          policyId: mappings[0].policyId,
        }),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(200);
      expect((responseBody as Mapping).pathPattern).toBe(mockPathMappingUpdateRequest.pathPattern);
    });

    test("UPDATE specified mapping fails if origin does not exist", async () => {
      if (mappings.length === 0) {
        throw new Error("No mappings found");
      }

      const response = await fetch(API_URL + `/mappings/${mappings[0].mappingId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({ ...mockPathMappingUpdateRequest, originId: mockUUIDv4, policyId: mockUUIDv4 }),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(404);
      expect(responseBody).toMatchObject({ errorCode: ErrorCodes.ORIGIN_NOT_FOUND });
    });

    test("UPDATE specified mapping fails if policy does not exist", async () => {
      if (mappings.length === 0) {
        throw new Error("No mappings found");
      }

      const response = await fetch(API_URL + `/mappings/${mappings[0].mappingId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          ...mockPathMappingUpdateRequest,
          originId: mappings[0].originId,
          policyId: mockUUIDv4,
        }),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(404);
      expect(responseBody).toMatchObject({ errorCode: ErrorCodes.POLICY_NOT_FOUND });
    });

    test("UPDATE specified mapping fails when originId references a policy entity", async () => {
      if (mappings.length === 0) {
        throw new Error("No mappings found");
      }

      // try to update mapping using policy ID as origin ID
      const response = await fetch(API_URL + `/mappings/${mappings[0].mappingId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          ...mockPathMappingUpdateRequest,
          originId: mappings[0].policyId,
          policyId: mappings[0].policyId,
        }),
      });

      const responseBody = await response.json();
      expect(response.status).toBe(404);
      expect(responseBody).toMatchObject({ errorCode: ErrorCodes.ORIGIN_NOT_FOUND });
    });

    test("UPDATE specified mapping fails when policyId references an origin entity", async () => {
      if (mappings.length === 0) {
        throw new Error("No mappings found");
      }

      // try to update mapping using origin ID as policy ID
      const response = await fetch(API_URL + `/mappings/${mappings[0].mappingId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          ...mockPathMappingUpdateRequest,
          originId: mappings[0].originId,
          policyId: mappings[0].originId,
        }),
      });

      const responseBody = await response.json();
      expect(response.status).toBe(404);
      expect(responseBody).toMatchObject({ errorCode: ErrorCodes.POLICY_NOT_FOUND });
    });

    test("DELETE specified mapping successfully", async () => {
      if (mappings.length === 0) {
        throw new Error("No mappings found");
      }

      const deleteResponse = await fetch(API_URL + `/mappings/${mappings[0].mappingId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(deleteResponse.status).toBe(204);
    });

    test("DELETE fail if specified mapping does not exist", async () => {
      const deleteResponse = await fetch(API_URL + `/mappings/${mockUUIDv4}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(deleteResponse.status).toBe(404);
    });
  });

  describe("Validation errors (400)", () => {
    test("POST create mapping fails with invalid UUID format", async () => {
      const response = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          mappingName: "Test Mapping",
          pathPattern: "/api/*",
          originId: "invalid-uuid",
          policyId: mockUUIDv4,
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create mapping fails with both hostHeaderPattern and pathPattern", async () => {
      const response = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          mappingName: "Test Mapping",
          hostHeaderPattern: "api.example.com",
          pathPattern: "/api/*",
          originId: mockUUIDv4,
          policyId: mockUUIDv4,
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create mapping fails with neither hostHeaderPattern nor pathPattern", async () => {
      const response = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          mappingName: "Test Mapping",
          originId: mockUUIDv4,
          policyId: mockUUIDv4,
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create mapping fails with invalid host pattern", async () => {
      const response = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          mappingName: "Test Mapping",
          hostHeaderPattern: "invalid..host",
          originId: mockUUIDv4,
          policyId: mockUUIDv4,
        }),
      });
      expect(response.status).toBe(400);
    });

    test("PUT update mapping fails with both patterns", async () => {
      const response = await fetch(API_URL + `/mappings/${mockUUIDv4}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          hostHeaderPattern: "api.example.com",
          pathPattern: "/api/*",
        }),
      });
      expect(response.status).toBe(400);
    });

    test("PUT update mapping fails with empty request", async () => {
      const response = await fetch(API_URL + `/mappings/${mockUUIDv4}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
    });

    test("POST create mapping fails with path pattern exceeding 1023 chars", async () => {
      const tooLongPath = "/" + "a".repeat(1021) + "/*";
      const response = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          mappingName: "Long Path Test",
          pathPattern: tooLongPath,
          originId: mockUUIDv4,
        }),
      });
      expect(tooLongPath.length).toBe(1024);
      expect(response.status).toBe(400);
    });

    test("POST create mapping succeeds with path pattern at max length (1023 chars)", async () => {
      const maxLengthPath = "/" + "a".repeat(1020) + "/*";

      // Create origin first
      const originResponse = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          originName: "Test Origin for Long Path",
          originDomain: "example.com",
        }),
      });
      const origin = (await originResponse.json()) as Origin;

      const response = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          mappingName: "Max Length Path Test",
          pathPattern: maxLengthPath,
          originId: origin.originId,
        }),
      });
      expect(maxLengthPath.length).toBe(1023);
      expect(response.status).toBe(201);

      // Cleanup
      const mapping = (await response.json()) as Mapping;
      await fetch(API_URL + `/mappings/${mapping.mappingId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      await fetch(API_URL + `/origins/${origin.originId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
    });

    test("PUT update mapping fails when changing mapping type", async () => {
      // Create a path mapping first
      const createOriginResponse = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockOriginCreateRequest),
      });
      const origin = (await createOriginResponse.json()) as Origin;

      const createMappingResponse = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          mappingName: "Test Path Mapping",
          pathPattern: "/test/*",
          originId: origin.originId,
        }),
      });
      const pathMapping = (await createMappingResponse.json()) as Mapping;

      // Try to update path mapping with host header pattern
      const updateResponse = await fetch(API_URL + `/mappings/${pathMapping.mappingId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          hostHeaderPattern: "*.example.com",
        }),
      });

      const responseBody = await updateResponse.json();
      expect(updateResponse.status).toBe(400);
      expect(responseBody).toMatchObject({
        errorCode: ErrorCodes.BAD_REQUEST,
      });
    });
  });
});
