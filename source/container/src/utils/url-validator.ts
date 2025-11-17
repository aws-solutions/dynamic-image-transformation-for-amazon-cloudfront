// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class UrlValidator {
  private static readonly ALLOW_LOCALHOST_HTTP = process.env.NODE_ENV === 'test';

  static validate(url: string): void {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname) {
        throw new Error(`Invalid URL: ${url}`);
      }
      if (parsed.protocol === 'http:') {
        const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
        if (isLocalhost && !this.ALLOW_LOCALHOST_HTTP) {
          throw new Error(`HTTP localhost not allowed in production. URL: ${url}`);
        }
        if (!isLocalhost) {
          throw new Error(`HTTP protocol not allowed. Only HTTPS is supported for security. URL: ${url}`);
        }
      } else if (parsed.protocol !== 'https:') {
        throw new Error(`Unsupported protocol '${parsed.protocol}'. Only HTTPS is supported. URL: ${url}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('protocol')) {
        throw error;
      }
      throw new Error(`Invalid URL: ${url}`);
    }
  }
}
