// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const { API_URL, TEST_ACCESS_TOKEN } = process.env;
if (!API_URL || !TEST_ACCESS_TOKEN) {
  throw new Error("API_URL and TEST_ACCESS_TOKEN must be set in environment");
}

describe("API Throttling Tests", () => {
  test("[429 Too Many Requests] Trigger throttling", async () => {
    const requests = Array.from({ length: 500 }, () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);

      return fetch(API_URL + "/policies", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        },
        signal: controller.signal, // to avoid hanging connections, drop request after 3s
      });
    });

    const results = await Promise.allSettled(requests);
    const throttledResponses = results
      .filter(
        (result): result is PromiseFulfilledResult<Response> =>
          result.status === "fulfilled" && result.value.status === 429
      )
      .map((result) => result.value);

    // Log API Gateway request IDs for debugging, same request ID can be looked up in CW Logs
    throttledResponses.forEach((response, index) => {
      const requestId = response.headers.get("x-amz-apigw-id");
      console.log(`Throttled Request ${index + 1}: Status ${response.status}, x-amz-apigw-id: ${requestId}`);
    });

    expect(throttledResponses.length).toBeGreaterThan(0);
  }, 30000);
});
