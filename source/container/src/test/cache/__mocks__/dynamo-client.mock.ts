// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

export const mockSend = jest.fn();

export const mockDynamoClient = {
  send: mockSend
} as unknown as jest.Mocked<DynamoDBClient>;

export const createMockDynamoClient = () => {
  mockSend.mockClear();
  return mockDynamoClient;
};

// Helper functions for common mock responses
export const mockGetItemResponse = (item: any) => {
  const marshalledItem = marshall(item);
  mockSend.mockResolvedValue({ Item: marshalledItem });
};

export const mockGetItemResponseOnce = (item: any) => {
  const marshalledItem = marshall(item);
  mockSend.mockResolvedValueOnce({ Item: marshalledItem });
};

export const mockGetItemNotFound = () => {
  mockSend.mockResolvedValueOnce({});
};

export const mockQueryResponse = (items: any[]) => {
  const marshalledItems = items.map(item => marshall(item));
  mockSend.mockResolvedValue({ Items: marshalledItems });
};

export const mockQueryNotFound = () => {
  mockSend.mockResolvedValueOnce({ Items: [] });
};

export const mockPutItemSuccess = () => {
  mockSend.mockResolvedValueOnce({});
};

export const mockDynamoError = (error: Error) => {
  mockSend.mockRejectedValueOnce(error);
};

export const mockAllQueriesEmpty = () => {
  mockSend.mockResolvedValue({ Items: [] });
};

export const mockAllQueriesError = (error: Error) => {
  mockSend.mockRejectedValue(error);
};
