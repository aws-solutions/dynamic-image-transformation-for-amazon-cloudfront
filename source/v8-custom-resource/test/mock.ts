// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { jest } from "@jest/globals";
import { LambdaContext } from "../lib";

// Mock axios
export const mockAxios = {
  put: jest.fn<any>().mockImplementation(() => Promise.resolve()),
  post: jest.fn<any>().mockImplementation(() => Promise.resolve()),
};
jest.mock("axios", () => ({
  ...mockAxios,
}));

// Mock timestamp
const mockTimeStamp = new Date();
export const mockISOTimeStamp = mockTimeStamp.toISOString();

jest.mock("moment", () => {
  const mockMoment: any = (date: string | undefined) => mockTimeStamp;
  mockMoment.utc = () => ({
    format: () => mockISOTimeStamp,
  });
  return mockMoment;
});

// Console spies
export const consoleInfoSpy = jest.spyOn(console, "info");
export const consoleErrorSpy = jest.spyOn(console, "error");

// Lambda context
export const mockContext: LambdaContext = {
  logStreamName: "mock-stream",
};
