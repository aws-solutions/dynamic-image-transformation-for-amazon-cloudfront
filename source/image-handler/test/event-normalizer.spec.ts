// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { normalizeEvent } from "..";
import { ImageHandlerEvent, S3GetObjectEvent } from "../lib";

describe("normalizeEvent function", () => {
  const imageHandlerEvent: ImageHandlerEvent = {
    path: "/test.jpg",
    queryStringParameters: {
      signature: "testSignature",
      width: "100",
    },
    requestContext: {},
    headers: { Host: "example.com" },
  };

  const s3GetObjectEvent: S3GetObjectEvent = {
    userRequest: {
      url: "https://example.com/image/test.jpg?width=100&ol-signature=testSignature",
      headers: {
        Host: "example.com",
      },
    },
    getObjectContext: {
      outputRoute: "",
      outputToken: "",
    },
  };

  it('should return the event as is when s3_object_lambda_enabled is "No"', () => {
    const result = normalizeEvent(imageHandlerEvent, "No");
    expect(result).toEqual(imageHandlerEvent);
  });

  it('should normalize Object Lambda event when s3_object_lambda_enabled is "Yes"', () => {
    const result = normalizeEvent(s3GetObjectEvent, "Yes");
    expect(result).toEqual(imageHandlerEvent);
  });

  it('should handle Object Lambda event with empty queryStringParameters when s3_object_lambda_enabled is "Yes"', () => {
    const s3GetObjectEvent: S3GetObjectEvent = {
      userRequest: {
        url: "https://example.com/image/test.jpg",
        headers: {
          Host: "example.com",
        },
      },
      getObjectContext: {
        outputRoute: "",
        outputToken: "",
      },
    };
    const result = normalizeEvent(s3GetObjectEvent, "Yes");
    expect(result.queryStringParameters).toEqual({ signature: undefined });
  });

  it("should handle Object Lambda event with s3KeyPath including /image", () => {
    const s3GetObjectEvent: S3GetObjectEvent = {
      userRequest: {
        url: "https://example.com/image/image/test.jpg",
        headers: {
          Host: "example.com",
        },
      },
      getObjectContext: {
        outputRoute: "",
        outputToken: "",
      },
    };
    const result = normalizeEvent(s3GetObjectEvent, "Yes");
    expect(result.path).toEqual("/image/test.jpg");
  });
});
