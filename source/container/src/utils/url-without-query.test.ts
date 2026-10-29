// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { urlWithoutQuery } from "./url-without-query";

describe("urlWithoutQuery", () => {
  it("drops the query string and keeps protocol, host, port and path", () => {
    expect(urlWithoutQuery("https://origin.example.com:8443/a/b.jpg?X-Amz-Signature=secret")).toBe(
      "https://origin.example.com:8443/a/b.jpg"
    );
  });

  it("keeps an S3 URL's bucket and key", () => {
    expect(urlWithoutQuery("s3://bucket/key.png?versionId=1")).toBe("s3://bucket/key.png");
  });

  it("falls back to splitting on '?' when the URL cannot be parsed", () => {
    expect(urlWithoutQuery("not a url?token=secret")).toBe("not a url");
  });
});
