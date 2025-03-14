// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { StatusCodes } from "./enums";
import { SHARP_EDIT_ALLOWLIST_ARRAY, ALTERNATE_EDIT_ALLOWLIST_ARRAY } from "./constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Headers = Record<string, any>;

type AllowlistedEdit = (typeof SHARP_EDIT_ALLOWLIST_ARRAY)[number] | (typeof ALTERNATE_EDIT_ALLOWLIST_ARRAY)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ImageEdits = Partial<Record<AllowlistedEdit, any>>;

export class ImageHandlerError extends Error {
  constructor(public readonly status: StatusCodes, public readonly code: string, public readonly message: string) {
    super();
  }
}

export interface ErrorMapping {
  pattern: string;
  statusCode: number;
  errorType: string;
  message: string | ((err: Error) => string);
}
