// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class OriginNotFoundError extends Error {
  public readonly statusCode: number;
  public readonly verboseMessage?: string;

  constructor(message: string, statusCode: number = 404, verboseMessage?: string) {
    super(message);
    this.name = 'OriginNotFoundError';
    this.statusCode = statusCode;
    this.verboseMessage = verboseMessage;
  }
}