// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Mapping, Origin, PaginatedPolicyResponse, TransformationPolicy } from "../../../data-models";
import { ErrorCodes } from "../../common";
import {
  mockHostHeaderMappingCreateRequest,
  mockOriginCreateRequest,
  mockTransformationPolicyCreateRequest,
  mockTransformationPolicyUpdateRequest,
} from "../mocks";
import { createAuthHeaders } from "./utils";

const { API_URL, TEST_ACCESS_TOKEN } = process.env;
if (!API_URL || !TEST_ACCESS_TOKEN) {
  throw new Error("API_URL and TEST_ACCESS_TOKEN must be set in environment");
}

describe("Policies API", () => {
  describe("/policies", () => {
    let policies: TransformationPolicy[] = [];

    test("GET policies successfully with list", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = await response.json() as PaginatedPolicyResponse;

      expect(response.status).toBe(200);
      expect(responseBody).toHaveProperty("items");
      expect(Array.isArray(responseBody.items)).toBe(true);
    });

    test("POST create policy successfully", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockTransformationPolicyCreateRequest),
      });
      expect(response.status).toBe(201);
      const responseBody = await response.json();
      expect(responseBody).toMatchObject(mockTransformationPolicyCreateRequest);
      policies.push(responseBody as TransformationPolicy);
    });

    test("GET policies successfully with invalid nextToken", async () => {
      const response = await fetch(API_URL + "/policies?nextToken=invalid", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = (await response.json()) as PaginatedPolicyResponse;

      expect(response.status).toBe(200);
      expect(responseBody).toHaveProperty("items");
      expect(Array.isArray(responseBody.items)).toBe(true);
      expect(responseBody.items).toEqual(
        expect.arrayContaining([expect.objectContaining(mockTransformationPolicyCreateRequest)])
      );
      expect(responseBody.nextToken).toBeUndefined();
    });

    test("GET policies with paginated response", async () => {
      // Create policies with many large transformations to trigger pagination
      const manyPolicies = Array.from({ length: 500 }, (_, i) => ({
        policyName: `Test Policy ${i + 2}`.padEnd(100, "A"), // Max 100 chars as per defined schema
        description: `Large policy for pagination testing with many transformations ${i}`.padEnd(500, "B"), // Max 500 chars
        isDefault: false,
        policyJSON: {
          transformations: Array.from({ length: 50 }, (_, j) => [
            { transformation: "resize", value: { width: 800 + j, height: 600 + j, fit: "cover" } },
            { transformation: "quality", value: 85 },
          ]).flat(),
        },
      }));

      for (const policy of manyPolicies) {
        await fetch(API_URL + "/policies", {
          method: "POST",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
          body: JSON.stringify(policy),
        });
      }

      // Get first page
      const firstPageResponse = await fetch(API_URL + "/policies", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const firstPageBody = (await firstPageResponse.json()) as PaginatedPolicyResponse;

      expect(firstPageResponse.status).toBe(200);
      expect(firstPageBody.items.length).toBeGreaterThan(0);

      const secondPageResponse = await fetch(API_URL + `/policies?nextToken=${firstPageBody.nextToken}`, {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const secondPageBody = (await secondPageResponse.json()) as PaginatedPolicyResponse;

      expect(secondPageResponse.status).toBe(200);
      expect(secondPageBody.items.length).toBeGreaterThan(0);

      // Ensure no duplicate items between pages
      const firstPageIds = firstPageBody.items.map((item: TransformationPolicy) => item.policyId);
      const secondPageIds = secondPageBody.items.map((item: TransformationPolicy) => item.policyId);
      const intersection = firstPageIds.filter((id: string) => secondPageIds.includes(id));
      expect(intersection).toHaveLength(0);
    }, 60000);

    test("GET specified policy successfully", async () => {
      const response = await fetch(API_URL + `/policies/${policies[0].policyId}`, {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(200);
      expect(responseBody).toMatchObject(mockTransformationPolicyCreateRequest);
    });

    test("UPDATE specified policy successfully", async () => {
      // Create policy to use
      const policyCreate = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockTransformationPolicyCreateRequest),
      });
      const policy = (await policyCreate.json()) as TransformationPolicy;

      // Update
      const response = await fetch(API_URL + `/policies/${policy.policyId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockTransformationPolicyUpdateRequest),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(200);
      // match original fields retained with update
      expect(responseBody).toMatchObject({
        ...mockTransformationPolicyCreateRequest,
        ...mockTransformationPolicyUpdateRequest,
      });
    });

    test("DELETE specified policy successfully", async () => {
      const response = await fetch(API_URL + `/policies/${policies[0].policyId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(response.status).toBe(204);
    });

    test("DELETE specified policy ONLY when not referenced in mappings", async () => {
      // create policy
      const policyCreateResponse = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockTransformationPolicyCreateRequest),
      });
      const policyResponseBody = (await policyCreateResponse.json()) as TransformationPolicy;

      // create origin for mapping
      const originCreateResponse = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockOriginCreateRequest),
      });
      const originResponseBody = (await originCreateResponse.json()) as Origin;

      // create mapping
      const mappingCreateResponse = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          ...mockHostHeaderMappingCreateRequest,
          policyId: policyResponseBody.policyId,
          originId: originResponseBody.originId,
        }),
      });

      const deletePolicyResponse = await fetch(API_URL + `/policies/${policyResponseBody.policyId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(deletePolicyResponse.status).toBe(400);
      expect(await deletePolicyResponse.json()).toMatchObject({ errorCode: ErrorCodes.INVALID_FIELD_VALUE });

      const mappingResponseBody = (await mappingCreateResponse.json()) as Mapping;
      await fetch(API_URL + `/mappings/${mappingResponseBody.mappingId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });

      const deletePolicySuccessResponse = await fetch(API_URL + `/policies/${policyResponseBody.policyId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(deletePolicySuccessResponse.status).toBe(204);
    });
  });

  describe("/policies - validation errors (400)", () => {
    test("POST create policy fails with invalid policyJSON", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid-policy",
          policyJSON: "invalid-json-string",
          description: "Invalid policy",
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with invalid transformation", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid-transformation",
          policyJSON: {
            transformations: [{ transformation: "invalid-transform", value: { width: 100 } }],
          },
          description: "Invalid transformation",
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with invalid policy name", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid@policy#name",
          policyJSON: {
            transformations: [{ transformation: "resize", value: { width: 100, height: 100 } }],
          },
          description: "Invalid name",
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with missing required fields", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "incomplete-policy",
        }),
      });
      expect(response.status).toBe(400);
    });

    test("PUT update policy fails with empty request", async () => {
      const response = await fetch(API_URL + "/policies/550e8400-e29b-41d4-a716-446655440000", {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
    });

    test("GET policy fails with invalid UUID", async () => {
      const response = await fetch(API_URL + "/policies/invalid-uuid", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(response.status).toBe(400);
    });
    test("POST create policy fails with invalid resize transformation", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid-resize",
          policyJSON: {
            transformations: [{ transformation: "resize", value: { width: -100 } }],
          },
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with invalid quality value", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid-quality",
          policyJSON: {
            transformations: [{ transformation: "quality", value: 150 }],
          },
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with invalid format value", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid-format",
          policyJSON: {
            transformations: [{ transformation: "format", value: "invalid-format" }],
          },
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with invalid output quality", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid-output-quality",
          policyJSON: {
            outputs: [{ type: "quality", value: [150] }],
          },
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with invalid output format", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid-output-format",
          policyJSON: {
            outputs: [{ type: "format", value: "invalid-format" }],
          },
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with duplicate output types", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "duplicate-outputs",
          policyJSON: {
            outputs: [
              { type: "quality", value: [80] },
              { type: "quality", value: [90] },
            ],
          },
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with empty transformations and outputs", async () => {
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "empty-policy",
          policyJSON: {
            transformations: [],
            outputs: [],
          },
        }),
      });
      expect(response.status).toBe(400);
    });
  });

  describe("/policies - default policy validation", () => {
    test("POST concurrent create default policy requests handle race condition", async () => {
      const createDefaultPolicy = () =>
        fetch(API_URL + "/policies", {
          method: "POST",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
          body: JSON.stringify({
            policyName: `concurrent-default-${Math.floor(Math.random() * 100)}`,
            isDefault: true,
            policyJSON: {
              transformations: [{ transformation: "resize", value: { width: 100, height: 100 } }],
            },
          }),
        });

      const requests = Array.from({ length: 10 }, () => createDefaultPolicy());
      const results = await Promise.allSettled(requests);

      const responses = await Promise.all(
        results
          .filter((result) => result.status === "fulfilled")
          .map(async (result) => ({
            status: result.value.status,
            body: (await result.value.json()) as TransformationPolicy,
          }))
      );

      const successCount = responses.filter((r) => r.status === 201).length;
      const errorCount = responses.filter((r) => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(errorCount).toBeGreaterThan(0);

      // Cleanup
      const defaultPolicy = responses.find((r) => r.status === 201)?.body;
      if (defaultPolicy) {
        await fetch(API_URL + `/policies/${defaultPolicy.policyId}`, {
          method: "DELETE",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        });
      }
    }, 10000);

    test("PUT concurrent update to default policy requests handle race condition", async () => {
      // Create multiple non-default policies
      const createPolicyPromises = Array.from({ length: 10 }, (_, i) =>
        fetch(API_URL + "/policies", {
          method: "POST",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
          body: JSON.stringify({
            policyName: `update-test-${i}`,
            isDefault: false,
            policyJSON: {
              transformations: [{ transformation: "resize", value: { width: 100, height: 100 } }],
            },
          }),
        }).then((res) => res.json() as Promise<TransformationPolicy>)
      );

      const policies = await Promise.all(createPolicyPromises);

      // Concurrent updates to make each policy default
      const updateRequests = policies.map((policy) =>
        fetch(API_URL + `/policies/${policy.policyId}`, {
          method: "PUT",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
          body: JSON.stringify({ isDefault: true }),
        })
      );

      const results = await Promise.allSettled(updateRequests);
      const responses = await Promise.all(
        results
          .filter((result) => result.status === "fulfilled")
          .map(async (result) => ({
            status: result.value.status,
            body: await result.value.json(),
          }))
      );

      const successCount = responses.filter((r) => r.status === 200).length;
      const errorCount = responses.filter((r) => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(errorCount).toBeGreaterThan(0);

      // Cleanup all policies
      await Promise.all(
        policies.map((policy) =>
          fetch(API_URL + `/policies/${policy.policyId}`, {
            method: "DELETE",
            headers: createAuthHeaders(TEST_ACCESS_TOKEN),
          })
        )
      );
    }, 10000);

    test("POST create default policy fails when another default exists", async () => {
      const firstDefaultResponse = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "first-default",
          isDefault: true,
          policyJSON: {
            transformations: [{ transformation: "resize", value: { width: 100, height: 100 } }],
          },
        }),
      });
      expect(firstDefaultResponse.status).toBe(201);
      const defaultPolicy = (await firstDefaultResponse.json()) as TransformationPolicy;

      const secondDefaultResponse = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "second-default",
          isDefault: true,
          policyJSON: {
            transformations: [{ transformation: "quality", value: 80 }],
          },
        }),
      });
      expect(secondDefaultResponse.status).toBe(400);
      expect(await secondDefaultResponse.json()).toMatchObject({ errorCode: ErrorCodes.INVALID_FIELD_VALUE });

      // Cleanup
      await fetch(API_URL + `/policies/${defaultPolicy.policyId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
    });

    test("PUT update policy to default fails when another default exists", async () => {
      const firstDefaultResponse = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "first-default",
          isDefault: true,
          policyJSON: {
            transformations: [{ transformation: "resize", value: { width: 100, height: 100 } }],
          },
        }),
      });
      const firstPolicy = (await firstDefaultResponse.json()) as TransformationPolicy;

      const secondPolicyResponse = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "second-policy",
          isDefault: false,
          policyJSON: {
            transformations: [{ transformation: "quality", value: 80 }],
          },
        }),
      });
      const secondPolicy = (await secondPolicyResponse.json()) as TransformationPolicy;

      const updateResponse = await fetch(API_URL + `/policies/${secondPolicy.policyId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({ isDefault: true }),
      });
      expect(updateResponse.status).toBe(400);
      expect(await updateResponse.json()).toMatchObject({ errorCode: ErrorCodes.INVALID_FIELD_VALUE });

      // retry making second policy default after updating first policy to be non-default
      await fetch(API_URL + `/policies/${firstPolicy.policyId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({ isDefault: false }),
      });
      const updateRetryResponse = await fetch(API_URL + `/policies/${secondPolicy.policyId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({ isDefault: true }),
      });
      expect(updateRetryResponse.status).toBe(200);

      // Cleanup
      await fetch(API_URL + `/policies/${firstPolicy.policyId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      await fetch(API_URL + `/policies/${secondPolicy.policyId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
    });
  });

  describe("/policies - fallback field validation", () => {
    test("POST create policy with all fallback fields succeeds and round-trips", async () => {
      // Verify that a policy with format, quality, and autosize fallback fields is accepted (201)
      // and that GET returns the exact fallback values stored
      const policyBody = {
        policyName: "fallback-roundtrip",
        policyJSON: {
          outputs: [
            { type: "format", value: "auto", fallback: { format: "jpeg" } },
            { type: "quality", value: [80, [1, 2, 90], [2, 3, 85]], fallback: { dpr: 1.5 } },
            { type: "autosize", value: [480, 768, 1024], fallback: { viewportWidth: 768 } },
          ],
        },
      };

      const createResponse = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(policyBody),
      });
      expect(createResponse.status).toBe(201);
      const created = await createResponse.json() as TransformationPolicy;

      // Round-trip: GET the policy and verify fallback values are persisted correctly
      const getResponse = await fetch(API_URL + `/policies/${created.policyId}`, {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(getResponse.status).toBe(200);
      const fetched = await getResponse.json() as TransformationPolicy;
      expect(fetched.policyJSON.outputs).toEqual(policyBody.policyJSON.outputs);

      // Cleanup
      await fetch(API_URL + `/policies/${created.policyId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
    });

    test("POST create policy fails with fallback.dpr out of range (>5.0)", async () => {
      // fallback.dpr max is 5.0 per schema
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid-fallback-dpr",
          policyJSON: {
            outputs: [{ type: "quality", value: [80], fallback: { dpr: 6.0 } }],
          },
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with fallback.viewportWidth out of range (<320)", async () => {
      // fallback.viewportWidth min is 320 per schema
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid-fallback-viewport",
          policyJSON: {
            outputs: [{ type: "autosize", value: [480, 768], fallback: { viewportWidth: 100 } }],
          },
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create policy fails with unsupported fallback.format value", async () => {
      // fallback.format only accepts jpg/jpeg/png/webp/avif/gif/tiff — not "bmp"
      const response = await fetch(API_URL + "/policies", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          policyName: "invalid-fallback-format",
          policyJSON: {
            outputs: [{ type: "format", value: "auto", fallback: { format: "bmp" } }],
          },
        }),
      });
      expect(response.status).toBe(400);
    });
  });
});
