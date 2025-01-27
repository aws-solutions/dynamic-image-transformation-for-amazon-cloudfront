// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LambdaContext } from "../lib";

export const mockAwsEc2 = {
  describeRegions: jest.fn(),
};

jest.mock("aws-sdk/clients/ec2", () => jest.fn(() => ({ ...mockAwsEc2 })));

export const mockAwsS3 = {
  headObject: jest.fn(),
  copyObject: jest.fn(),
  getObject: jest.fn(),
  putObject: jest.fn(),
  headBucket: jest.fn(),
  createBucket: jest.fn(),
  putBucketEncryption: jest.fn(),
  putBucketPolicy: jest.fn(),
  putBucketTagging: jest.fn(),
  putBucketVersioning: jest.fn(),
};

jest.mock("aws-sdk/clients/s3", () => jest.fn(() => ({ ...mockAwsS3 })));

export const mockAwsSecretManager = {
  getSecretValue: jest.fn(),
};

jest.mock("aws-sdk/clients/secretsmanager", () => jest.fn(() => ({ ...mockAwsSecretManager })));

export const mockCloudFormation = {
  describeStackResources: jest.fn(),
};

jest.mock("aws-sdk/clients/cloudformation", () => jest.fn(() => ({ ...mockCloudFormation })));

export const mockCloudFront = {
  getDistribution: jest.fn(),
};

jest.mock("aws-sdk/clients/cloudfront", () => jest.fn(() => ({ ...mockCloudFront })));

export const mockServiceCatalogAppRegistry = {
  getApplication: jest.fn(),
};

jest.mock("aws-sdk/clients/servicecatalogappregistry", () => jest.fn(() => ({ ...mockServiceCatalogAppRegistry })));

export const mockAxios = {
  put: jest.fn(),
  post: jest.fn(),
};

jest.mock("axios", () => ({
  put: mockAxios.put,
  post: mockAxios.post,
}));

jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }));

const mockTimeStamp = new Date();
export const mockISOTimeStamp = mockTimeStamp.toISOString();

jest.mock("moment", () => {
  const originalMoment = jest.requireActual("moment");
  const mockMoment = (date: string | undefined) => originalMoment(mockTimeStamp);
  mockMoment.utc = () => ({
    format: () => mockISOTimeStamp,
  });
  return mockMoment;
});

export const consoleInfoSpy = jest.spyOn(console, "info");
export const consoleErrorSpy = jest.spyOn(console, "error");

export const mockContext: LambdaContext = {
  logStreamName: "mock-stream",
};
