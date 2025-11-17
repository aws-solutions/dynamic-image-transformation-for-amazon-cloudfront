// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class PolicyNotFoundError extends Error {
  public readonly statusCode = 404;
  public readonly errorType = 'POLICY_NOT_FOUND';
  public readonly verboseDescription: string;

  constructor(message: string) {
    super(message);
    this.name = 'PolicyNotFoundError';
    this.verboseDescription = `The requested transformation policy could not be found. ${message}`;
  }
}