// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import middy from "@middy/core";
import cors from "@middy/http-cors";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpRouterHandler from "@middy/http-router";
import httpSecurityHeaders from "@middy/http-security-headers";
import { ThrottlingException } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { InternalServerError, MalformedJsonError, ManagementApiError, TooManyRequestsError, logger } from "./common";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { routes } from "./routes";

// reuse the first connection established with AWS services across lambda invocations
process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1";

// error handler middleware
const errorHandler = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => ({
  onError: async (request) => {
    const error = request.error;

    if (error instanceof ManagementApiError) {
      logger.error("Management API error", { error });
      request.response = error.toApiResponse();
    } else if (error instanceof ThrottlingException) {
      logger.error("DynamoDB throttling error", { error });
      request.response = new TooManyRequestsError().toApiResponse();
    } else if (error && "statusCode" in error && "message" in error) {
      logger.error("Lambda error", { error });
      request.response = {
        statusCode: (error.statusCode as number) || 500,
        body: JSON.stringify({ errorCode: error.name, message: error.message }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    } else {
      logger.error("Internal server error", { error: error?.message || "Unknown error" });
      request.response = new InternalServerError().toApiResponse();
    }

    if (request.response) {
      request.response.headers = {
        ...request.response.headers,
        "Cache-Control": "no-store, no-cache",
      };
    }
  },
});

// Custom middleware to conditionally apply json body parsing
const conditionalJsonBodyParser = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => ({
  before: async (request) => {
    const { httpMethod, body } = request.event;
    if ((httpMethod === "POST" || httpMethod === "PUT") && body) {
      try {
        request.event.body = JSON.parse(body);
      } catch (error) {
        throw new MalformedJsonError();
      }
    }
  },
});

// Add extendedRequestId to logger to map with user request
// https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-logging.html#apigateway-cloudwatch-log-formats
const addRequestId = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => ({
  before: async (request) => {
    logger.appendKeys({ extended_request_id: request.event.requestContext.extendedRequestId });
  },
});

// Add Cache-Control header to all responses to prevent caching of sensitive data
const addCacheControlHeader = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => ({
  after: async (request) => {
    if (request.response) {
      request.response.headers = {
        ...request.response.headers,
        "Cache-Control": "no-store, no-cache",
      };
    }
  },
});

export const handler = middy()
  .use(injectLambdaContext(logger, { resetKeys: true })) // custom keys can persist across invocations, so reset
  .use(addRequestId())
  .use(httpHeaderNormalizer())
  .use(
    cors({
      origin: process.env.CORS_ORIGIN!,
      credentials: true,
      headers: "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    })
  )
  .use(httpSecurityHeaders())
  .use(conditionalJsonBodyParser())
  // Registered after cors: middy runs onError in reverse order, so cors then adds its headers to error responses.
  .use(errorHandler())
  .use(addCacheControlHeader())
  .handler(httpRouterHandler(routes));
