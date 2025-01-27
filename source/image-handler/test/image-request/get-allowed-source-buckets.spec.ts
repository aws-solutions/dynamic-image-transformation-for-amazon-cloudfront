// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { getAllowedSourceBuckets } from "../../image-request";
import { StatusCodes } from "../../lib";

describe("getAllowedSourceBuckets", () => {
  it("Should pass if the SOURCE_BUCKETS environment variable is not empty and contains valid inputs", () => {
    // Arrange
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Act
    const result = getAllowedSourceBuckets();

    // Assert
    const expectedResult = ["allowedBucket001", "allowedBucket002"];
    expect(result).toEqual(expectedResult);
  });

  it("Should throw an error if the SOURCE_BUCKETS environment variable is empty or does not contain valid values", () => {
    // Arrange
    process.env = {};

    // Act
    // Assert
    try {
      getAllowedSourceBuckets();
    } catch (error) {
      expect(error).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        code: "GetAllowedSourceBuckets::NoSourceBuckets",
        message:
          "The SOURCE_BUCKETS variable could not be read. Please check that it is not empty and contains at least one source bucket, or multiple buckets separated by commas. Spaces can be provided between commas and bucket names, these will be automatically parsed out when decoding.",
      });
    }
  });
});
