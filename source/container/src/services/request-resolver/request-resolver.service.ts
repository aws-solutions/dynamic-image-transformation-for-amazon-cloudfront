// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { MappingResolver } from './mapping-resolver/mapping-resolver';
import { MappingResolutionResult } from './mapping-resolver/mapping-resolver.interface';
import { OriginResolver } from './origin-resolver/origin-resolver';
import { RequestValidator } from './validation/request-validator';
import { ConnectionManager } from './connection-manager/connection-manager';
import { ValidationError } from './errors/validation.error';
import { OriginNotFoundError } from './errors/origin-not-found.error';
import { ConnectionError } from './errors/connection.error';
import { CacheRegistry } from '../cache/cache-registry';
import { OriginConfiguration } from '../cache/domain/origin-cache';
import { ImageProcessingRequest } from '../../types/image-processing-request';
import { UrlBuilder } from './url-builder';



export class RequestResolverService {
  // Singleton instance persists across all HTTP requests in the Node.js process
  private static instance: RequestResolverService;

  constructor(
    private mappingResolver: MappingResolver,
    private originResolver: OriginResolver,
    private requestValidator: RequestValidator,
    private connectionManager: ConnectionManager
  ) {}

  async resolve(req: Request, imageRequest: ImageProcessingRequest): Promise<void> {
    if (!imageRequest.timings) imageRequest.timings = {};
    imageRequest.timings.requestResolution = {};

    try {
      // Step 1: Validate the incoming request
      this.requestValidator.validateRequest(req);

      let originResult: OriginConfiguration;
      let policyId: string | null = null;

      // Step 1.5: Check for custom header override
      const customHeaderName = process.env.CUSTOM_ORIGIN_HEADER;
      
      if (customHeaderName && req.headers[customHeaderName]) {
        const customOriginDomain = req.headers[customHeaderName] as string;
        console.log('Custom header override detected:', customOriginDomain);
        
        // Validate header value is a proper URL
        try {
          new URL(customOriginDomain);
        } catch (error) {
          throw new ValidationError(`Invalid origin override header value`, `Invalid origin override header value. ${customOriginDomain}`);
        }
        
        // Create synthetic OriginConfiguration
        originResult = {
          originId: 'custom-header-override',
          originName: 'Custom Header Override',
          originDomain: customOriginDomain,
          originPath: undefined,
          originHeaders: undefined
        };
      } else {
        // Step 2: Resolve mapping using existing cache services
        const mappingResult = await this.mappingResolver.resolve(req, imageRequest);

        // Step 3: Try to resolve origin configuration (may be null for fallback)
        originResult = await this.originResolver.resolve(mappingResult.selectedMapping);
        policyId = mappingResult.selectedMapping.policyId;
      }

      // Step 4: Build final URL
      let finalUrl = UrlBuilder.buildOriginUrl(req, originResult);
      // TODO: Remove - Local testing http->https rewrite
      finalUrl = finalUrl.replace(/^http:/, 'https:');

      // Step 5: Always validate TLS for the final domain
      await this.connectionManager.validateOriginUrl(finalUrl, imageRequest);
      
      // Step 6: Populate origin information in shared request object
      imageRequest.origin = {
        url: finalUrl,
        headers: originResult?.originHeaders
      };

      imageRequest.policy = policyId ? { id: policyId } : null;
    } catch (error) {
      // Re-throw known errors as-is
      if (error instanceof ValidationError || 
          error instanceof OriginNotFoundError || 
          error instanceof ConnectionError) {
        throw error;
      }
      // Wrap unknown errors
      throw new Error(`Request resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get singleton instance of RequestResolverService
   */
  static getInstance(): RequestResolverService {
    if (!RequestResolverService.instance) {
      const cacheRegistry = CacheRegistry.getInstance();
      
      const requestValidator = new RequestValidator();
      const mappingResolver = new MappingResolver(
        cacheRegistry.getPathMappingCache(),
        cacheRegistry.getHeaderMappingCache()
      );
      const originResolver = new OriginResolver(cacheRegistry.getOriginCache());
      const connectionManager = new ConnectionManager();
      
      RequestResolverService.instance = new RequestResolverService(
        mappingResolver, 
        originResolver, 
        requestValidator,
        connectionManager
      );
    }
    
    return RequestResolverService.instance;
  }
}