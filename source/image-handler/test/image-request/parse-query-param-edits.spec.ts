// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageRequest } from "../../image-request";
import { ImageHandlerEvent } from "../../lib";

describe("parseImageEdits", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("should parse rotate and width parameters from query string into image edits object", () => {
    // Arrange
    const event: ImageHandlerEvent = {
      queryStringParameters: {
        rotate: "90",
        width: "100",
        flip: "true",
        flop: "0",
      },
    };

    // Act
    const imageRequest = new ImageRequest(undefined, undefined);
    const result = imageRequest.parseQueryParamEdits(event, undefined);

    // Assert
    const expectedResult = { rotate: 90, resize: { width: 100 }, flip: true, flop: false };
    expect(result).toEqual(expectedResult);
  });
});
