// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
  writeGetObjectResponse: jest.fn(),
};

jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    S3Client: jest.fn(() => ({
      send: jest.fn((command) => {
        if (command instanceof actual.HeadObjectCommand) {
          return mockS3Commands.headObject(command.input);
        } else if (command instanceof actual.GetObjectCommand) {
          return mockS3Commands.getObject(command.input);
        } else if (command instanceof actual.PutObjectCommand) {
          return mockS3Commands.putObject(command.input);
        } else if (command instanceof actual.HeadBucketCommand) {
          return mockS3Commands.headBucket(command.input);
        } else if (command instanceof actual.CreateBucketCommand) {
          return mockS3Commands.createBucket(command.input);
        } else if (command instanceof actual.PutBucketEncryptionCommand) {
          return mockS3Commands.putBucketEncryption(command.input);
        } else if (command instanceof actual.PutBucketPolicyCommand) {
          return mockS3Commands.putBucketPolicy(command.input);
        } else if (command instanceof actual.WriteGetObjectResponseCommand) {
          return mockS3Commands.writeGetObjectResponse(command.input);
        } else if (command instanceof actual.CopyObjectCommand) {
          return mockS3Commands.copyObject(command.input);
        }
        throw new Error(`Unimplemented S3 command: ${command.constructor.name}`);
      }),
    })),
    HeadObjectCommand: actual.HeadObjectCommand,
    GetObjectCommand: actual.GetObjectCommand,
    PutObjectCommand: actual.PutObjectCommand,
    HeadBucketCommand: actual.HeadBucketCommand,
    CreateBucketCommand: actual.CreateBucketCommand,
    PutBucketEncryptionCommand: actual.PutBucketEncryptionCommand,
    PutBucketPolicyCommand: actual.PutBucketPolicyCommand,
    WriteGetObjectResponseCommand: actual.WriteGetObjectResponseCommand,
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
          return mockSecretsManagerCommands.getSecretValue(command.input);
        }
        throw new Error(`Unimplemented SecretsManager command: ${command.constructor.name}`);
      }),
    })),
    GetSecretValueCommand: actual.GetSecretValueCommand,
  };
});

// Mock AWS SDK v3 Rekognition client
export const mockRekognitionCommands = {
  detectFaces: jest.fn(),
  detectModerationLabels: jest.fn(),
};

jest.mock("@aws-sdk/client-rekognition", () => {
  const actual = jest.requireActual("@aws-sdk/client-rekognition");
  return {
    RekognitionClient: jest.fn(() => ({
      send: jest.fn((command) => {
        if (command instanceof actual.DetectFacesCommand) {
          return mockRekognitionCommands.detectFaces(command.input);
        } else if (command instanceof actual.DetectModerationLabelsCommand) {
          return mockRekognitionCommands.detectModerationLabels(command.input);
        }
        throw new Error(`Unimplemented Rekognition command: ${command.constructor.name}`);
      }),
    })),
    DetectFacesCommand: actual.DetectFacesCommand,
    DetectModerationLabelsCommand: actual.DetectModerationLabelsCommand,
  };
});

export const consoleInfoSpy = jest.spyOn(console, "info");

export const mockContext = {
  getRemainingTimeInMillis: jest.fn(),
};
