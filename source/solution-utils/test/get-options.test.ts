// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-var-requires */

// Spy on the console messages
const consoleLogSpy = jest.spyOn(console, "log");
const consoleErrorSpy = jest.spyOn(console, "error");

describe("getOptions", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("will return an empty object when environment variables are missing", () => {
    const { getOptions } = require("../get-options");
    expect.assertions(4);

    process.env.SOLUTION_ID = "  "; // whitespace
    expect(getOptions()).toEqual({});

    delete process.env.SOLUTION_ID;
    expect(getOptions()).toEqual({});

    process.env.SOLUTION_ID = "foo";
    process.env.SOLUTION_VERSION = "  "; // whitespace
    expect(getOptions()).toEqual({});

    delete process.env.SOLUTION_VERSION;
    expect(getOptions()).toEqual({});
  });

  it("will return an object with the custom user agent string", () => {
    const { getOptions } = require("../get-options");
    expect.assertions(1);
    expect(getOptions()).toEqual({
      customUserAgent: `AwsSolution/solution-id/solution-version`,
    });
  });
});
