// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { getErrorResponse } from "../../index";
import { StatusCodes } from "../../lib";

describe("getErrorResponse", () => {
  it("should return an error response with the provided status code and error message", () => {
    const error = { status: 404, message: "Not Found" };
    const result = getErrorResponse(error);

    expect(result).toEqual({
      statusCode: 404,
      body: JSON.stringify(error),
    });
  });

  it('should handle "Image to composite must have same dimensions or smaller" error', () => {
    const error = { message: "Image to composite must have same dimensions or smaller" };
    const result = getErrorResponse(error);

    expect(result).toEqual({
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({
        message: "Image to overlay must have same dimensions or smaller",
        code: "BadRequest",
        status: StatusCodes.BAD_REQUEST,
      }),
    });
  });

  it("should handle other errors and return INTERNAL_SERVER_ERROR", () => {
    const error = { message: "Some other error" };
    const result = getErrorResponse(error);

    expect(result).toEqual({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({
        message: "Internal error. Please contact the system administrator.",
        code: "InternalError",
        status: StatusCodes.INTERNAL_SERVER_ERROR,
      }),
    });
  });
});
