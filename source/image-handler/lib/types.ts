// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StatusCodes } from "./enums";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Headers = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ImageEdits = Record<string, any>;

export class ImageHandlerError extends Error {
  // prettier-ignore
  constructor(public readonly status: StatusCodes, public readonly code: string, public readonly message: string) {
    super();
  }
}
