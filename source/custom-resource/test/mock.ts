// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LambdaContext } from "../lib";

// Mock AWS SDK v3 EC2 client
export const mockEC2Commands = {
  describeRegions: jest.fn(),
};

jest.mock("@aws-sdk/client-ec2", () => {
  const actual = jest.requireActual("@aws-sdk/client-ec2");
  return {
    EC2Client: jest.fn(() => ({
      send: jest.fn((command) => {
        if (command instanceof actual.DescribeRegionsCommand) {
          return mockEC2Commands.describeRegions();
        }
        throw new Error(`Unimplemented command: ${command.constructor.name}`);
      }),
    })),
    DescribeRegionsCommand: actual.DescribeRegionsCommand,
  };
});

// Mock AWS SDK v3 S3 client
export const mockS3Commands = {
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
  getBucketLocation: jest.fn(),
};
jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    S3Client: jest.fn(() => ({
      send: jest.fn((command) => {
        if (command instanceof actual.HeadObjectCommand) {
          return mockS3Commands.headObject(command.input); // access parameters passed to the command
        } else if (command instanceof actual.PutObjectCommand) {
          return mockS3Commands.putObject(command.input);
        } else if (command instanceof actual.HeadBucketCommand) {
          return mockS3Commands.headBucket();
        } else if (command instanceof actual.CreateBucketCommand) {
          return mockS3Commands.createBucket();
        } else if (command instanceof actual.PutBucketEncryptionCommand) {
          return mockS3Commands.putBucketEncryption();
        } else if (command instanceof actual.PutBucketPolicyCommand) {
          return mockS3Commands.putBucketPolicy();
        } else if (command instanceof actual.PutBucketTaggingCommand) {
          return mockS3Commands.putBucketTagging();
        } else if (command instanceof actual.PutBucketVersioningCommand) {
          return mockS3Commands.putBucketVersioning();
        } else if (command instanceof actual.GetBucketLocationCommand) {
          return mockS3Commands.getBucketLocation();
        } else if (command instanceof actual.GetObjectCommand) {
          return mockS3Commands.getObject();
        } else if (command instanceof actual.CopyObjectCommand) {
          return mockS3Commands.copyObject();
        }
        throw new Error(`Unimplemented S3 command: ${command.constructor.name}`);
      }),
    })),
    HeadObjectCommand: actual.HeadObjectCommand,
    PutObjectCommand: actual.PutObjectCommand,
    HeadBucketCommand: actual.HeadBucketCommand,
    CreateBucketCommand: actual.CreateBucketCommand,
    PutBucketEncryptionCommand: actual.PutBucketEncryptionCommand,
    PutBucketPolicyCommand: actual.PutBucketPolicyCommand,
    PutBucketTaggingCommand: actual.PutBucketTaggingCommand,
    PutBucketVersioningCommand: actual.PutBucketVersioningCommand,
    GetBucketLocationCommand: actual.GetBucketLocationCommand,
    GetObjectCommand: actual.GetObjectCommand,
    CopyObjectCommand: actual.CopyObjectCommand,
  };
});

// Mock AWS SDK v3 SecretsManager client
export const mockSecretsManagerCommands = {
  getSecretValue: jest.fn(),
};
jest.mock("@aws-sdk/client-secrets-manager", () => {
  const actual = jest.requireActual("@aws-sdk/client-secrets-manager");
  return {
    SecretsManagerClient: jest.fn(() => ({
      send: jest.fn((command) => {
        if (command instanceof actual.GetSecretValueCommand) {
          return mockSecretsManagerCommands.getSecretValue();
        }
        throw new Error(`Unimplemented SecretsManager command: ${command.constructor.name}`);
      }),
    })),
    GetSecretValueCommand: actual.GetSecretValueCommand,
  };
});

// Mock AWS SDK v3 CloudFormation client
export const mockCloudFormationCommands = {
  describeStackResources: jest.fn(),
};
jest.mock("@aws-sdk/client-cloudformation", () => {
  const actual = jest.requireActual("@aws-sdk/client-cloudformation");
  return {
    CloudFormationClient: jest.fn(() => ({
      send: jest.fn((command) => {
        if (command instanceof actual.DescribeStackResourcesCommand) {
          return mockCloudFormationCommands.describeStackResources();
        }
        throw new Error(`Unimplemented CloudFormation command: ${command.constructor.name}`);
      }),
    })),
    DescribeStackResourcesCommand: actual.DescribeStackResourcesCommand,
  };
});

// Mock AWS SDK v3 CloudFront client
export const mockCloudFrontCommands = {
  getDistribution: jest.fn(),
};
jest.mock("@aws-sdk/client-cloudfront", () => {
  const actual = jest.requireActual("@aws-sdk/client-cloudfront");
  return {
    CloudFrontClient: jest.fn(() => ({
      send: jest.fn((command) => {
        if (command instanceof actual.GetDistributionCommand) {
          return mockCloudFrontCommands.getDistribution();
        }
        throw new Error(`Unimplemented CloudFront command: ${command.constructor.name}`);
      }),
    })),
    GetDistributionCommand: actual.GetDistributionCommand,
  };
});

// Mock AWS SDK v3 ServiceCatalogAppRegistry client
export const mockServiceCatalogAppRegistryCommands = {
  getApplication: jest.fn(),
};
jest.mock("@aws-sdk/client-service-catalog-appregistry", () => {
  const actual = jest.requireActual("@aws-sdk/client-service-catalog-appregistry");
  return {
    ServiceCatalogAppRegistryClient: jest.fn(() => ({
      send: jest.fn((command) => {
        if (command instanceof actual.GetApplicationCommand) {
          return mockServiceCatalogAppRegistryCommands.getApplication();
        }
        throw new Error(`Unimplemented ServiceCatalogAppRegistry command: ${command.constructor.name}`);
      }),
    })),
    GetApplicationCommand: actual.GetApplicationCommand,
  };
});

// Mock axios
export const mockAxios = {
  put: jest.fn().mockImplementation(() => Promise.resolve()),
  post: jest.fn().mockImplementation(() => Promise.resolve()),
};
jest.mock("axios", () => ({
  ...mockAxios,
}));

// Mock uuid
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }));

// Mock timestamp
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

// Console spies
export const consoleInfoSpy = jest.spyOn(console, "info");
export const consoleErrorSpy = jest.spyOn(console, "error");

// Lambda context
export const mockContext: LambdaContext = {
  logStreamName: "mock-stream",
};
