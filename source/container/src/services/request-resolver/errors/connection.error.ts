// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class ConnectionError extends Error {
  public readonly title: string;
  public readonly verboseDescription: string;
  public readonly statusCode: number;
  public readonly errorType: string;

  constructor(title: string, verboseDescription?: string, statusCode = 400, errorType = 'CONNECTION_ERROR') {
    super(title);
    this.name = 'ConnectionError';
    this.title = title;
    this.verboseDescription = verboseDescription || title;
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}