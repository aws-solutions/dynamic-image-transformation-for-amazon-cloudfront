// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Mapping,
  MappingCreate,
  MappingUpdate,
  Origin,
  OriginCreate,
  OriginUpdate,
  TransformationPolicy,
  TransformationPolicyCreate,
  TransformationPolicyUpdate,
} from "../../data-models";
import { DBEntityType, DBMapping, DBOrigin, DBTransformationPolicy } from "../interfaces";

// Mock AWS SDK v3 DynamoDB Document client
export const mockDynamoDBCommands = {
  get: jest.fn(),
  put: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  scan: jest.fn(),
  query: jest.fn(),
};

jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: jest.fn((command) => {
          if (command instanceof actual.GetCommand) {
            return mockDynamoDBCommands.get(command.input);
          } else if (command instanceof actual.PutCommand) {
            return mockDynamoDBCommands.put(command.input);
          } else if (command instanceof actual.UpdateCommand) {
            return mockDynamoDBCommands.update(command.input);
          } else if (command instanceof actual.DeleteCommand) {
            return mockDynamoDBCommands.delete(command.input);
          } else if (command instanceof actual.ScanCommand) {
            return mockDynamoDBCommands.scan(command.input);
          } else if (command instanceof actual.QueryCommand) {
            return mockDynamoDBCommands.query(command.input);
          }
          throw new Error(`Unimplemented DynamoDB command: ${command.constructor.name}`);
        }),
      })),
    },
    GetCommand: actual.GetCommand,
    PutCommand: actual.PutCommand,
    UpdateCommand: actual.UpdateCommand,
    DeleteCommand: actual.DeleteCommand,
    ScanCommand: actual.ScanCommand,
    QueryCommand: actual.QueryCommand,
  };
});

export const mockUUIDV4 = "550e8400-e29b-41d4-a716-446655440000"; // valid UUIDv4
export const mockUUIDV4_2 = "550e8400-e29b-41d4-a716-446655440001";

// Origin mocks
export const mockOriginDDB: DBOrigin = {
  PK: mockUUIDV4,
  GSI1PK: DBEntityType.ORIGIN,
  GSI1SK: "example-origin",
  CreatedAt: "2024-01-01T00:00:00.000Z",
  UpdatedAt: "2024-01-01T00:00:00.000Z",
  Data: {
    originName: "example-origin",
    originDomain: "example.com",
    originPath: "/images",
    originHeaders: { "x-api-key": "test-key" },
  },
};

export const mockOrigin: Origin = {
  originId: mockUUIDV4,
  originName: "example-origin",
  originDomain: "example.com",
  originPath: "/images",
  originHeaders: { "x-api-key": "test-key" },
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

export const mockOriginCreateRequest: OriginCreate = {
  originName: "example-origin",
  originDomain: "example.com",
  originPath: "/images",
  originHeaders: { "x-api-key": "test-key" },
};

export const mockOriginUpdateRequest: OriginUpdate = {
  originName: "updated-origin",
  originDomain: "updated.com",
  originPath: "/updated-images",
};

// TransformationPolicy mocks
export const mockTransformationPolicyDDB: DBTransformationPolicy = {
  PK: mockUUIDV4,
  GSI1PK: DBEntityType.POLICY,
  GSI1SK: "thumbnail-policy",
  CreatedAt: "2024-01-01T00:00:00.000Z",
  UpdatedAt: "2024-01-01T00:00:00.000Z",
  Data: {
    policyName: "thumbnail-policy",
    policyJSON: JSON.stringify({
      transformations: [{ transformation: "resize", value: { width: 100, height: 100, fit: "cover" } }],
    }),
    description: "Generate thumbnail images",
    isDefault: false,
  },
};

export const mockTransformationPolicy: TransformationPolicy = {
  policyId: mockUUIDV4,
  policyName: "thumbnail-policy",
  policyJSON: {
    transformations: [{ transformation: "resize", value: { width: 100, height: 100, fit: "cover" } }],
  },
  description: "Generate thumbnail images",
  isDefault: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

export const mockTransformationPolicyCreateRequest: TransformationPolicyCreate = {
  policyName: "thumbnail-policy",
  policyJSON: {
    transformations: [{ transformation: "resize", value: { width: 100, height: 100, fit: "cover" } }],
  },
  description: "Generate thumbnail images",
  isDefault: false,
};

export const mockTransformationPolicyUpdateRequest: TransformationPolicyUpdate = {
  policyName: "updated-thumbnail-policy",
  description: "Updated thumbnail generation",
};

// Path Mapping mocks
export const mockPathMappingDDB: DBMapping = {
  PK: mockUUIDV4,
  GSI1PK: DBEntityType.PATH_MAPPING,
  GSI1SK: "/api/images/*",
  GSI2PK: `ORIGIN#${mockUUIDV4}`,
  GSI3PK: `POLICY#${mockUUIDV4}`,
  CreatedAt: "2024-01-01T00:00:00.000Z",
  UpdatedAt: "2024-01-01T00:00:00.000Z",
  Data: {
    mappingName: "API Images Mapping",
    description: "Maps API image requests",
    originId: mockUUIDV4,
    policyId: mockUUIDV4,
  },
};

export const mockPathMapping: Mapping = {
  mappingId: mockUUIDV4,
  mappingName: "API Images Mapping",
  description: "Maps API image requests",
  pathPattern: "/api/images/*",
  originId: mockUUIDV4,
  policyId: mockUUIDV4,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

export const mockPathMappingCreateRequest: MappingCreate = {
  mappingName: "API Images Mapping",
  description: "Maps API image requests",
  pathPattern: "/api/images/*",
  originId: mockUUIDV4,
  policyId: mockUUIDV4,
};

export const mockPathMappingUpdateRequest: MappingUpdate = {
  mappingName: "Updated API Mapping",
  pathPattern: "/api/updated/*",
  originId: mockUUIDV4_2,
  policyId: mockUUIDV4_2,
};

// Host-header mapping mocks
export const mockHostHeaderMappingDDB: DBMapping = {
  PK: mockUUIDV4,
  GSI1PK: DBEntityType.HOST_HEADER_MAPPING,
  GSI1SK: "*.example.com",
  GSI2PK: `ORIGIN#${mockUUIDV4}`,
  GSI3PK: `POLICY#${mockUUIDV4}`,
  CreatedAt: "2024-01-01T00:00:00.000Z",
  UpdatedAt: "2024-01-01T00:00:00.000Z",
  Data: {
    mappingName: "Example Domain Mapping",
    description: "Maps example.com subdomains",
    originId: mockUUIDV4,
    policyId: mockUUIDV4,
  },
};

export const mockHostHeaderMapping: Mapping = {
  mappingId: mockUUIDV4,
  mappingName: "Example Domain Mapping",
  description: "Maps example.com subdomains",
  hostHeaderPattern: "*.example.com",
  originId: mockUUIDV4,
  policyId: mockUUIDV4,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

export const mockHostHeaderMappingCreateRequest: MappingCreate = {
  mappingName: "Example Domain Mapping",
  description: "Maps example.com subdomains",
  hostHeaderPattern: "*.example.com",
  originId: mockUUIDV4,
  policyId: mockUUIDV4,
};

export const mockHostHeaderMappingUpdateRequest: MappingUpdate = {
  mappingName: "Updated Domain Mapping",
  hostHeaderPattern: "*.updated.com",
  originId: mockUUIDV4_2,
  policyId: mockUUIDV4_2,
};
