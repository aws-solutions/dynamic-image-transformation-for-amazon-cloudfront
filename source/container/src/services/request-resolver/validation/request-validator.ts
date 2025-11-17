// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { ValidationError } from '../errors/validation.error';

export class RequestValidator {
  private readonly MAX_PATH_LENGTH = 2048;
  private readonly MAX_HOST_LENGTH = 253;

  validateRequest(req: Request): void {
    if (!req) {
      throw new ValidationError('Request object is required');
    }

    const path = req.path || '/';
    const host = req.get('host') || req.get('Host') || '';

    if (!this.validatePath(path)) {
      throw new ValidationError(`Invalid request path: ${path}`);
    }

    if (host && !this.validateHostHeader(host)) {
      throw new ValidationError(`Invalid host header: ${host}`);
    }
  }

  validatePath(path: string): boolean {
    if (!path || typeof path !== 'string') {
      return false;
    }

    if (path.length === 0 || path.length > this.MAX_PATH_LENGTH) {
      return false;
    }

    if (!path.startsWith('/')) {
      return false;
    }

    // Check for invalid characters
    const invalidChars = /[\x00-\x1f\x7f]/;
    return !invalidChars.test(path);
  }

  validateHostHeader(host: string): boolean {
    if (!host || typeof host !== 'string') {
      return false;
    }

    if (host.length === 0 || host.length > this.MAX_HOST_LENGTH) {
      return false;
    }

    // Validates hostname format: alphanumeric start/end, hyphens allowed in middle (max 63 chars per label),
    // multiple labels separated by dots, optional port (1-5 digits)
    const hostPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*(:[0-9]{1,5})?$/;
    return hostPattern.test(host);
  }
}