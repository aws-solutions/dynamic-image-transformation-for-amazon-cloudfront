// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { getAllowedSourceBuckets } from "../../image-request";
import { StatusCodes } from "../../lib";

describe("getAllowedSourceBuckets", () => {
  const OLD_ENV = process.env;

  const noSourceBucketsError = {
    status: StatusCodes.BAD_REQUEST,
    code: "GetAllowedSourceBuckets::NoSourceBuckets",
    message:
      "The SOURCE_BUCKETS variable could not be read. Please check that it is not empty and contains at least one source bucket, or multiple buckets separated by commas. Spaces can be provided between commas and bucket names, these will be automatically parsed out when decoding.",
  };

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("Should pass if the SOURCE_BUCKETS environment variable is not empty and contains valid inputs", () => {
    // Arrange
    process.env.SOURCE_BUCKETS = "allowedBucket001, allowedBucket002";

    // Act
    const result = getAllowedSourceBuckets();

    // Assert
    const expectedResult = ["allowedBucket001", "allowedBucket002"];
    expect(result).toEqual(expectedResult);
  });

  it("Should pass if the SOURCE_BUCKETS environment variable contains bucket names with periods, hyphens, and underscores", () => {
    // Arrange
    process.env.SOURCE_BUCKETS = "my.bucket.name, my-bucket-name, legacy_Bucket_Name";

    // Act
    const result = getAllowedSourceBuckets();

    // Assert
    expect(result).toEqual(["my.bucket.name", "my-bucket-name", "legacy_Bucket_Name"]);
  });

  it("Should ignore empty entries in the SOURCE_BUCKETS environment variable", () => {
    // Arrange
    process.env.SOURCE_BUCKETS = ",allowedBucket001,, allowedBucket002 ,";

    // Act
    const result = getAllowedSourceBuckets();

    // Assert
    expect(result).toEqual(["allowedBucket001", "allowedBucket002"]);
  });

  it("Should throw an error if the SOURCE_BUCKETS environment variable is not set", () => {
    // Arrange
    delete process.env.SOURCE_BUCKETS;

    // Act
    // Assert
    expect(() => getAllowedSourceBuckets()).toThrow(expect.objectContaining(noSourceBucketsError));
  });

  it.each(["", " ", ",", " , ,"])(
    "Should throw an error if the SOURCE_BUCKETS environment variable does not contain any bucket: %p",
    (sourceBuckets) => {
      // Arrange
      process.env.SOURCE_BUCKETS = sourceBuckets;

      // Act
      // Assert
      expect(() => getAllowedSourceBuckets()).toThrow(expect.objectContaining(noSourceBucketsError));
    }
  );

  it.each(["(a|a?)$", "(a+)+", "bucket.*", "bucket/key", "bucket[0-9]", "s3:bucket", "a".repeat(256)])(
    "Should log a warning and exclude an invalid bucket name from SOURCE_BUCKETS: %p",
    (invalidBucket) => {
      // Arrange
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      process.env.SOURCE_BUCKETS = `allowedBucket001, ${invalidBucket}, allowedBucket002`;

      // Act
      const result = getAllowedSourceBuckets();

      // Assert
      expect(result).toEqual(["allowedBucket001", "allowedBucket002"]);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Ignoring invalid bucket name in SOURCE_BUCKETS: ${JSON.stringify(invalidBucket)}`
      );
    }
  );

  it("Should use the first valid bucket as the default when the first entry in SOURCE_BUCKETS is invalid", () => {
    // Arrange
    jest.spyOn(console, "warn").mockImplementation();
    process.env.SOURCE_BUCKETS = "(a|a?)$, allowedBucket001";

    // Act
    const result = getAllowedSourceBuckets();

    // Assert
    expect(result[0]).toEqual("allowedBucket001");
  });

  it("Should throw an error if SOURCE_BUCKETS contains only invalid bucket names", () => {
    // Arrange
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    process.env.SOURCE_BUCKETS = "(a|a?)$, (a+)+";

    // Act
    // Assert
    expect(() => getAllowedSourceBuckets()).toThrow(expect.objectContaining(noSourceBucketsError));
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
  });
});
