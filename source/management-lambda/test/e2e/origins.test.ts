// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Mapping, Origin, PaginatedOriginResponse } from "../../../data-models";
import { ErrorCodes } from "../../common";
import {
  mockOriginCreateRequest,
  mockOriginCreateRequestRedacted,
  mockOriginUpdateRequest,
  mockPathMappingCreateRequest,
} from "../mocks";
import { createAuthHeaders } from "./utils";
import { DynamoDBClient } from "./dynamodb-client";

const { API_URL, TEST_ACCESS_TOKEN, TABLE_NAME, CURRENT_STACK_REGION } = process.env;
if (!API_URL || !TEST_ACCESS_TOKEN) {
  throw new Error("API_URL and TEST_ACCESS_TOKEN must be set in environment");
}

describe("Origins API", () => {
  describe("/origins", () => {
    let origins: Origin[] = [];

    test("GET origins successfully with empty list", async () => {
      const response = await fetch(API_URL + "/origins", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = (await response.json()) as PaginatedOriginResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(responseBody.items)).toBe(true);
    });

    test("GET origins successfully with invalid nextToken", async () => {
      const response = await fetch(API_URL + "/origins?nextToken=invalid", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = (await response.json()) as PaginatedOriginResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(responseBody.items)).toBe(true);
    });

    test("POST create origin successfully", async () => {
      const response = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockOriginCreateRequest),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(201);
      // originHeaders values are write-only — the response echoes the names with redacted values.
      expect(responseBody).toMatchObject(mockOriginCreateRequestRedacted);
      origins.push(responseBody as Origin);
    });

    test("GET origins returns created origin, no additional pages in response", async () => {
      const response = await fetch(API_URL + "/origins", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = (await response.json()) as PaginatedOriginResponse;

      expect(response.status).toBe(200);
      expect(responseBody.items.pop()).toMatchObject(mockOriginCreateRequestRedacted);
      expect(responseBody.nextToken).toBeUndefined();
    });

    test("GET origins with paginated response", async () => {
      // Create origins with maximum allowed header size to trigger pagination (DynamoDB 1MB limit)
      const manyOrigins = Array.from({ length: 500 }, (_, i) => ({
        ...mockOriginCreateRequest,
        originName: `Test Origin ${i + 2}`,
        originDomain: `example${i + 2}.com`,
        originHeaders: {
          "X-Large-Header": "A".repeat(1000), // Max allowed header value (1000 chars)
          "X-Test-Header": "B".repeat(1000), // Another max size header
        },
      }));

      for (const origin of manyOrigins) {
        await fetch(API_URL + "/origins", {
          method: "POST",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
          body: JSON.stringify(origin),
        });
      }

      // Get first page
      const firstPageResponse = await fetch(API_URL + "/origins", {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const firstPageBody = (await firstPageResponse.json()) as PaginatedOriginResponse;

      expect(firstPageResponse.status).toBe(200);
      expect(firstPageBody.items.length).toBeGreaterThan(0);
      expect(firstPageBody.nextToken).toBeDefined();

      // Get second page
      const secondPageResponse = await fetch(API_URL + `/origins?nextToken=${firstPageBody.nextToken}`, {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const secondPageBody = (await secondPageResponse.json()) as PaginatedOriginResponse;

      expect(secondPageResponse.status).toBe(200);
      expect(secondPageBody.items.length).toBeGreaterThan(0);

      // Ensure no duplicate items between pages
      const firstPageIds = firstPageBody.items.map((item: Origin) => item.originId);
      const secondPageIds = secondPageBody.items.map((item: Origin) => item.originId);
      const intersection = firstPageIds.filter((id: string) => secondPageIds.includes(id));
      expect(intersection).toHaveLength(0);
    }, 60000);

    test("GET specified origin successfully", async () => {
      const response = await fetch(API_URL + `/origins/${origins[0].originId}`, {
        method: "GET",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(200);
      expect(responseBody).toMatchObject(mockOriginCreateRequestRedacted);
    });

    test("UPDATE specified origin successfully", async () => {
      const response = await fetch(API_URL + `/origins/${origins[0].originId}`, {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockOriginUpdateRequest),
      });
      const responseBody = await response.json();
      expect(response.status).toBe(200);
      expect(responseBody).toMatchObject(mockOriginUpdateRequest);
    });

    // originHeaders values are write-only: accepted on create/update, never returned. Verified here
    // against real infrastructure because unit tests mock DynamoDB — only a live table can prove what
    // is actually persisted, and the response body deliberately cannot show it.
    describe("originHeaders are write-only end to end", () => {
      const ddb = () => {
        if (!TABLE_NAME || !CURRENT_STACK_REGION) {
          throw new Error("TABLE_NAME and CURRENT_STACK_REGION must be set for write-only header tests");
        }
        return new DynamoDBClient(CURRENT_STACK_REGION, TABLE_NAME);
      };

      const createOrigin = async (body: Record<string, unknown>) => {
        const response = await fetch(API_URL + "/origins", {
          method: "POST",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
          body: JSON.stringify(body),
        });
        expect(response.status).toBe(201);
        return (await response.json()) as Origin;
      };

      test("stores the real value while never returning it", async () => {
        const created = await createOrigin({
          ...mockOriginCreateRequest,
          originName: "write-only-store",
          originHeaders: { "x-api-key": "real-secret-value" },
        });

        // The response is redacted...
        expect(created.originHeaders).toEqual({ "x-api-key": "***REDACTED***" });
        // ...but DynamoDB holds the real credential, so the container can still use it.
        expect(await ddb().getStoredOriginHeaders(created.originId)).toEqual({ "x-api-key": "real-secret-value" });

        await fetch(API_URL + `/origins/${created.originId}`, {
          method: "DELETE",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        });
      });

      // The regression that matters: the admin UI hydrates its edit form from the API response, so an
      // update that omits originHeaders must leave the stored credential byte-identical.
      test("preserves the stored credential when an update omits originHeaders", async () => {
        const created = await createOrigin({
          ...mockOriginCreateRequest,
          originName: "write-only-preserve",
          originHeaders: { "x-api-key": "must-survive-rename" },
        });

        const updateResponse = await fetch(API_URL + `/origins/${created.originId}`, {
          method: "PUT",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
          body: JSON.stringify({ originName: "write-only-renamed" }),
        });
        expect(updateResponse.status).toBe(200);

        const stored = await ddb().getStoredOriginHeaders(created.originId);
        expect(stored).toEqual({ "x-api-key": "must-survive-rename" });
        expect(JSON.stringify(stored)).not.toContain("REDACTED");

        await fetch(API_URL + `/origins/${created.originId}`, {
          method: "DELETE",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        });
      });

      test("replaces the stored credential when an update supplies originHeaders", async () => {
        const created = await createOrigin({
          ...mockOriginCreateRequest,
          originName: "write-only-rotate",
          originHeaders: { "x-api-key": "old-key" },
        });

        await fetch(API_URL + `/origins/${created.originId}`, {
          method: "PUT",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
          body: JSON.stringify({ originHeaders: { "x-api-key": "rotated-key" } }),
        });

        expect(await ddb().getStoredOriginHeaders(created.originId)).toEqual({ "x-api-key": "rotated-key" });

        await fetch(API_URL + `/origins/${created.originId}`, {
          method: "DELETE",
          headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        });
      });
    });

    test("DELETE specified origin successfully", async () => {
      const response = await fetch(API_URL + `/origins/${origins[0].originId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(response.status).toBe(204);
    });

    test("DELETE specified origin ONLY when not referenced in mappings", async () => {
      const originCreateResponse = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify(mockOriginCreateRequest),
      });
      const originResponseBody = (await originCreateResponse.json()) as Origin;

      const mappingCreateResponse = await fetch(API_URL + "/mappings", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          mappingName: mockPathMappingCreateRequest.mappingName,
          pathPattern: mockPathMappingCreateRequest.pathPattern,
          originId: originResponseBody.originId,
        }),
      });

      const deleteOriginResponse = await fetch(API_URL + `/origins/${originResponseBody.originId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(deleteOriginResponse.status).toBe(400);
      expect(await deleteOriginResponse.json()).toMatchObject({ errorCode: ErrorCodes.INVALID_FIELD_VALUE });

      const mappingResponseBody = (await mappingCreateResponse.json()) as Mapping;
      await fetch(API_URL + `/mappings/${mappingResponseBody.mappingId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });

      const deleteOriginSuccessResponse = await fetch(API_URL + `/origins/${originResponseBody.originId}`, {
        method: "DELETE",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
      });
      expect(deleteOriginSuccessResponse.status).toBe(204);
    });
  });

  describe("/origins - validation errors (400)", () => {
    test("POST create origin fails with invalid field", async () => {
      const response = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          originName: "Test Origin",
          originDomain: "example.com",
          originId: "invalid-uuid",
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create origin fails with invalid domain", async () => {
      const response = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          originName: "Test Origin",
          originDomain: "invalid..domain",
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create origin fails with invalid origin name", async () => {
      const response = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          originName: "invalid@name",
          originDomain: "example.com",
        }),
      });
      expect(response.status).toBe(400);
    });

    test("POST create origin fails with file path", async () => {
      const response = await fetch(API_URL + "/origins", {
        method: "POST",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({
          originName: "Test Origin",
          originDomain: "example.com",
          originPath: "/path.json",
        }),
      });
      expect(response.status).toBe(400);
    });

    test("PUT update origin fails with empty request", async () => {
      const response = await fetch(API_URL + "/origins/550e8400-e29b-41d4-a716-446655440000", {
        method: "PUT",
        headers: createAuthHeaders(TEST_ACCESS_TOKEN),
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
    });
  });
});
