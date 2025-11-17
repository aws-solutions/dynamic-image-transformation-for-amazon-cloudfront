// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Method } from "@middy/http-router";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { Handler as LambdaHandler } from "aws-lambda/handler";
import { translateConfig } from "./common";
import { MappingService, OriginService, TransformationPolicyService } from "./services";

const table = process.env.CONFIG_TABLE_NAME;
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), translateConfig);

// Initialize all services
const policyService = new TransformationPolicyService(table, ddbDocClient);
const originService = new OriginService(table, ddbDocClient);
const mappingService = new MappingService(table, ddbDocClient);

// Routes as defined in api spec
export const routes: {
  method: Method;
  path: string;
  handler: LambdaHandler;
}[] = [
  // Transformation Policies
  {
    method: "GET",
    path: "/policies",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const nextToken = event.queryStringParameters?.nextToken;
      const result = await policyService.list(nextToken);
      return { statusCode: 200, body: JSON.stringify(result), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "POST",
    path: "/policies",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const policy = await policyService.create(event.body || {});
      return { statusCode: 201, body: JSON.stringify(policy), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "GET",
    path: "/policies/{policyId}",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const policy = await policyService.get(event.pathParameters?.policyId);
      return { statusCode: 200, body: JSON.stringify(policy), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "PUT",
    path: "/policies/{policyId}",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const policy = await policyService.update(event.pathParameters?.policyId, event.body || {});
      return { statusCode: 200, body: JSON.stringify(policy), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "DELETE",
    path: "/policies/{policyId}",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      await policyService.delete(event.pathParameters?.policyId);
      return { statusCode: 204, body: "" };
    },
  },

  // Origins
  {
    method: "GET",
    path: "/origins",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const nextToken = event.queryStringParameters?.nextToken;
      const result = await originService.list(nextToken);
      return { statusCode: 200, body: JSON.stringify(result), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "POST",
    path: "/origins",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const origin = await originService.create(event.body || {});
      return { statusCode: 201, body: JSON.stringify(origin), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "GET",
    path: "/origins/{originId}",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const origin = await originService.get(event.pathParameters?.originId);
      return { statusCode: 200, body: JSON.stringify(origin), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "PUT",
    path: "/origins/{originId}",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const origin = await originService.update(event.pathParameters?.originId, event.body || {});
      return { statusCode: 200, body: JSON.stringify(origin), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "DELETE",
    path: "/origins/{originId}",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      await originService.delete(event.pathParameters?.originId);
      return { statusCode: 204, body: "" };
    },
  },

  // Mappings
  {
    method: "GET",
    path: "/mappings",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const nextToken = event.queryStringParameters?.nextToken;
      const result = await mappingService.list(nextToken);
      return { statusCode: 200, body: JSON.stringify(result), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "POST",
    path: "/mappings",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const mapping = await mappingService.create(event.body || {});
      return { statusCode: 201, body: JSON.stringify(mapping), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "GET",
    path: "/mappings/{mappingId}",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const mapping = await mappingService.get(event.pathParameters?.mappingId);
      return { statusCode: 200, body: JSON.stringify(mapping), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "PUT",
    path: "/mappings/{mappingId}",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const mapping = await mappingService.update(event.pathParameters?.mappingId, event.body || {});
      return { statusCode: 200, body: JSON.stringify(mapping), headers: { "Content-Type": "application/json" } };
    },
  },
  {
    method: "DELETE",
    path: "/mappings/{mappingId}",
    handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      await mappingService.delete(event.pathParameters?.mappingId);
      return { statusCode: 204, body: "" };
    },
  },
];
