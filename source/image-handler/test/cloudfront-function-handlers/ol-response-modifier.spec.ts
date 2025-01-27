// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { handler } from "../../cloudfront-function-handlers/ol-response-modifier";

describe("index", () => {
  test("should set response statusCode if x-amz-meta-statuscode header is present and status is between 400 and 599", () => {
    // Mock event with a response having x-amz-meta-statuscode header
    const event = {
      response: {
        headers: {
          "x-amz-meta-statuscode": {
            value: "500",
          },
        },
        statusCode: 200,
      },
    };

    // Call the handler
    const result = handler(event);

    // Check if statusCode is updated
    expect(result.statusCode).toBe(500);
  });

  test("should not set response statusCode if x-amz-meta-statuscode header is not present", () => {
    // Mock event with a response without x-amz-meta-statuscode header
    const event = {
      response: {
        headers: {},
        statusCode: 200,
      },
    };

    // Call the handler
    const result = handler(event);

    // Check if statusCode remains the same
    expect(result.statusCode).toBe(200);
  });

  test("should not set response statusCode if x-amz-meta-statuscode header value is not a valid number", () => {
    // Mock event with a response having a non-numeric x-amz-meta-statuscode value
    const event = {
      response: {
        headers: {
          "x-amz-meta-statuscode": {
            value: "not-a-number",
          },
        },
        statusCode: 200,
      },
    };

    // Call the handler
    const result = handler(event);

    // Check if statusCode remains the same
    expect(result.statusCode).toBe(200);
  });

  test("should not set response statusCode if x-amz-meta-statuscode header value is not an error", () => {
    // Mock event with a response having a successful statusCode
    const event = {
      response: {
        headers: {
          "x-amz-meta-statuscode": {
            value: "204",
          },
        },
        statusCode: 200,
      },
    };

    // Call the handler
    const result = handler(event);

    // Check if statusCode remains the same
    expect(result.statusCode).toBe(200);
  });
});
