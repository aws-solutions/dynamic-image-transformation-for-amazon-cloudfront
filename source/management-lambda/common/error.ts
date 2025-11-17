// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Error codes that can be shared with frontend for specific error handling
 */
export const ErrorCodes = {
  // Bad Request (400) errors
  BAD_REQUEST: "BAD_REQUEST",
  INVALID_JSON: "INVALID_JSON",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FIELD_VALUE: "INVALID_FIELD_VALUE",

  // Not Found (404) errors
  NOT_FOUND: "NOT_FOUND",
  POLICY_NOT_FOUND: "POLICY_NOT_FOUND",
  ORIGIN_NOT_FOUND: "ORIGIN_NOT_FOUND",

  // Too Many Requests (429) errors
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",

  // Server (500) errors
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Base error class for management API errors
 * Provides structured error responses for API Gateway
 */
export class ManagementApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: ErrorCode,
    public readonly message: string
  ) {
    super();
  }

  /**
   * Convert error to API Gateway response format
   */
  toApiResponse() {
    return {
      statusCode: this.statusCode,
      body: JSON.stringify({
        errorCode: this.errorCode,
        message: this.message,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends ManagementApiError {
  constructor(message: string, errorCode: ErrorCode = ErrorCodes.BAD_REQUEST) {
    super(400, errorCode, message);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends ManagementApiError {
  constructor(message: string, errorCode: ErrorCode = ErrorCodes.NOT_FOUND) {
    super(404, errorCode, message);
  }
}

/**
 * Malformed JSON Error (415)
 */
export class MalformedJsonError extends ManagementApiError {
  constructor(message: string = "Invalid or malformed JSON was provided") {
    super(415, ErrorCodes.INVALID_JSON, message);
  }
}

/**
 * Too Many Requests Error (429)
 */
export class TooManyRequestsError extends ManagementApiError {
  constructor(message: string = "Too many requests") {
    super(429, ErrorCodes.TOO_MANY_REQUESTS, message);
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends ManagementApiError {
  constructor(message: string = "Internal server error", errorCode: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR) {
    super(500, errorCode, message);
  }
}
