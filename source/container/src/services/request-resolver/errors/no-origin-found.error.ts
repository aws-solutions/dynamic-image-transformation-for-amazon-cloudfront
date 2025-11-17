// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class NoOriginFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoOriginFoundError';
  }
}