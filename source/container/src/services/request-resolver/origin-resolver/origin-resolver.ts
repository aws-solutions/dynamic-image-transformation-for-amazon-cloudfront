// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PathMapping } from '../../cache/domain/path-mapping-cache';
import { HeaderMapping } from '../../cache/domain/header-mapping-cache';
import { OriginCache, OriginConfiguration } from '../../cache/domain/origin-cache';
import { OriginNotFoundError } from '../errors/origin-not-found.error';

export class OriginResolver {
  constructor(
    private originCache: OriginCache
  ) {}

  async resolve(mapping: PathMapping | HeaderMapping): Promise<OriginConfiguration> {
    const origin = await this.originCache.getOrigin(mapping.originId);
    
    if (!origin) {
      throw new OriginNotFoundError(`The Origin specified does not exist`, 404, `Origin ${mapping.originId} not found in cache`);
    }

    // Clone to prevent normalization from modifying the cached instance
    const clonedOrigin = { ...origin };
    this.normalizeOriginDomain(clonedOrigin);
    this.validateOriginConfiguration(clonedOrigin);
    return clonedOrigin;
  }

  private normalizeOriginDomain(origin: OriginConfiguration): void {
    // Matches valid protocol at start of string (e.g., http://, https://, s3://, ftp://)
    const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(origin.originDomain);
    
    if (origin.originDomain && !hasProtocol) {
      origin.originDomain = `https://${origin.originDomain}`;
    }
  }

  private validateOriginConfiguration(origin: OriginConfiguration): void {
    if (!origin.originId || !origin.originName || !origin.originDomain) {
      throw new OriginNotFoundError('Invalid origin configuration', 400, 'Invalid origin configuration - missing required fields');
    }

    // Validate origin domain is a valid URL
    try {
      new URL(origin.originDomain);
    } catch (error) {
      throw new OriginNotFoundError('Invalid origin domain', 400, `${error} Invalid origin domain: ${origin.originDomain}`);
    }
  }
}