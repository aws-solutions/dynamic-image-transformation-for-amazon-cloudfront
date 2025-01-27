// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { handler } from "../../cloudfront-function-handlers/apig-request-modifier";

describe("index", () => {
  test("should sort values and filter invalid query params", () => {
    const testCases = [
      {
        // Should sort query params
        input: { signature: { value: "value1" }, expires: { value: "value2" }, format: { value: "value3" } },
        expected: "expires=value2&format=value3&signature=value1",
      },
      {
        // Empty inputs are allowed
        input: {},
        expected: "",
      },
      {
        // Should filter invalid params
        input: { key2: { value: "value2" }, format: { value: "value3" } },
        expected: "format=value3",
      },
      {
        // Multi value keys use the last option
        input: {
          signature: { value: "value1" },
          expires: { value: "value2", multiValue: [{ value: "value2" }, { value: "value4" }] },
          format: { value: "value3" },
          key2: { value: "value4" },
        },
        expected: "expires=value4&format=value3&signature=value1",
      },
    ];

    testCases.forEach(({ input, expected }) => {
      const event = { request: { querystring: input, uri: "test.com/" } };
      const result = handler(event);
      expect(result.querystring).toEqual(expected);
    });
  });

  test("should normalize accept header allowing webp images to `image/webp`", () => {
    const event = {
      request: {
        headers: {
          accept: {
            value: "image/webp,other/test",
          },
        },
        statusCode: 200,
      },
    };

    // Call the handler
    const result = handler(event);

    // Ensure only image/webp is left
    expect(result.headers.accept.value).toBe("image/webp");
  });

  test("should not set request accept header if not present", () => {
    const event = {
      request: {
        headers: {},
        statusCode: 200,
      },
    };

    // Call the handler
    const result = handler(event);

    expect(result.headers).toStrictEqual({});
  });

  test("should normalize accept header disallowing webp images to empty string", () => {
    const event = {
      request: {
        headers: {
          accept: {
            value: "image/jpeg,other/test",
          },
        },
        statusCode: 200,
      },
    };

    // Call the handler
    const result = handler(event);

    // Ensure an empty string is left
    expect(result.headers.accept.value).toBe("");
  });
});
