// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class ValidationError extends Error {
  public readonly verboseMessage?: string;

  constructor(message: string, verboseMessage?: string) {
    super(message);
    this.name = 'ValidationError';
    this.verboseMessage = verboseMessage;
  }
}