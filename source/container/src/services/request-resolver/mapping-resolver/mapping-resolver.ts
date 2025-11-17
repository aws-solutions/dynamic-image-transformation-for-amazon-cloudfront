// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { IMappingResolver, MappingResolutionResult } from './mapping-resolver.interface';
import { PathMappingCache } from '../../cache/domain/path-mapping-cache';
import { HeaderMappingCache } from '../../cache/domain/header-mapping-cache';
import { OriginNotFoundError } from '../errors/origin-not-found.error';
import { ImageProcessingRequest } from '../../../types/image-processing-request';

export class MappingResolver implements IMappingResolver {
  constructor(
    private pathMappingCache: PathMappingCache,
    private headerMappingCache: HeaderMappingCache
  ) {}

  async resolve(req: Request, imageRequest: ImageProcessingRequest): Promise<MappingResolutionResult> {
    const requestPath = req.path || '/';
    const hostHeader = req.get('dit-host');

    const hostMatch = await this.headerMappingCache.findBestMatch(hostHeader).catch(() => null);
    
    let pathMatch = null;
    if (!hostMatch) {
      pathMatch = await this.pathMappingCache.findBestMatch(requestPath).catch(() => null);
    }

    const selectedMapping = hostMatch || pathMatch;
    
    if (!selectedMapping) {
      throw new OriginNotFoundError( "Unable to resolve an origin", 404, `No mapping found for path: ${requestPath} or host: ${hostHeader}`);
    }

    console.log(JSON.stringify({
      requestId: imageRequest.requestId,
      component: 'MappingResolver',
      operation: 'mapping_resolved',
      resolvedBy: hostMatch ? 'header' : 'path',
      mappingType: hostMatch ? 'host' : 'path',
      selectedMappingId: selectedMapping.id,
      policyId: selectedMapping.policyId || null
    }));

    return {
      pathMatch: pathMatch || undefined,
      hostMatch: hostMatch || undefined,
      selectedMapping,
      resolvedBy: hostMatch ? 'host' : 'path'
    };
  }
}