// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ErrorCodes } from "../../common";

const { API_URL, TEST_ACCESS_TOKEN } = process.env;
if (!API_URL || !TEST_ACCESS_TOKEN) {
  throw new Error("API_URL and TEST_ACCESS_TOKEN must be set in environment");
}

describe("API Negative Tests", () => {
  test("[401 Unauthorized] Invalid access token", async () => {
    const response = await fetch(API_URL + "/", {
      headers: {
        Authorization: `Bearer invalidvalue`,
      },
    });

    const responseBody = await response.json();
    expect(response.status).toBe(401);
    expect(responseBody).toEqual({ message: "Unauthorized" });
  });

  test("[404 NotFoundError] Invalid path", async () => {
    const response = await fetch(API_URL + "/invalid-path", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
      },
    });
    const responseBody = await response.json();
    expect(response.status).toBe(404);
    expect(responseBody).toEqual({ errorCode: "NotFoundError", message: "Route does not exist" });
  });

  test("[404 NotFoundError] Non-supported method", async () => {
    const response = await fetch(API_URL + "/origins", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
      },
    });
    const responseBody = await response.json();
    expect(response.status).toBe(404);
    expect(responseBody).toEqual({ errorCode: "NotFoundError", message: "Route does not exist" });
  });

  // Malformed JSON tests
  test("[400 Bad Request] Malformed JSON - POST /policies", async () => {
    const response = await fetch(API_URL + "/policies", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: `{
          "policyName": "Testing integer validation",
          "description": "testing",
          "isDefault": false,
          "policyJSON": {
              "transformations": [
                  {
                      "transformation": "extract",
                      "value": [0123, 100, 800, 600]
                  }
              ],
              "outputs": [
                  {
                      "type": "quality",
                      "value": [85, [1.0, 2.0, 0.8], [2.0, 4.0, 0.6]]
                  },
                  {
                      "type": "format",
                      "value": "auto"
                  }
              ]
          }
      }`,
    });
    const responseBody = await response.json();
    expect(response.status).toBe(415);
    expect(responseBody).toMatchObject({
      errorCode: ErrorCodes.INVALID_JSON,
    });
  });

  test("[400 Bad Request] Malformed JSON - PUT /policies/{id}", async () => {
    const response = await fetch(API_URL + "/policies/test-id", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: '{"unclosed": "bracket"',
    });
    const responseBody = await response.json();
    expect(response.status).toBe(415);
    expect(responseBody).toMatchObject({
      errorCode: ErrorCodes.INVALID_JSON,
    });
  });

  test("[400 Bad Request] Malformed JSON - POST /origins", async () => {
    const response = await fetch(API_URL + "/origins", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: '{"trailing": "comma",}',
    });
    const responseBody = await response.json();
    expect(response.status).toBe(415);
    expect(responseBody).toMatchObject({
      errorCode: ErrorCodes.INVALID_JSON,
    });
  });

  test("[400 Bad Request] Malformed JSON - PUT /origins/{id}", async () => {
    const response = await fetch(API_URL + "/origins/test-id", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: '{missing: "quotes"}',
    });
    const responseBody = await response.json();
    expect(response.status).toBe(415);
    expect(responseBody).toMatchObject({
      errorCode: ErrorCodes.INVALID_JSON,
    });
  });

  test("[400 Bad Request] Malformed JSON - POST /mappings", async () => {
    const response = await fetch(API_URL + "/mappings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: `{
        "mappingName": "Thumbnails Path - " Fuzzing",
        "pathPattern": "/thumbnails",
        "originId": "test-id",
        "policyId": "test-id"
      }`,
    });
    const responseBody = await response.json();
    expect(response.status).toBe(415);
    expect(responseBody).toMatchObject({
      errorCode: ErrorCodes.INVALID_JSON,
    });
  });

  test("[400 Bad Request] Malformed JSON - PUT /mappings/{id}", async () => {
    const response = await fetch(API_URL + "/mappings/test-id", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: '{"extra": "bracket"]}',
    });
    const responseBody = await response.json();
    expect(response.status).toBe(415);
    expect(responseBody).toMatchObject({
      errorCode: ErrorCodes.INVALID_JSON,
    });
  });
});
