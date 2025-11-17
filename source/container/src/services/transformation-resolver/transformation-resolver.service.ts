// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { ImageProcessingRequest } from '../../types/image-processing-request';
import { Transformation } from '../../types/transformation';
import { PolicyCache } from '../cache/domain/policy-cache';
import { CacheRegistry } from '../cache/cache-registry';
import { extractUrlTransformations } from './extraction/transformation-extractor';
import { evaluateConditionals } from './conditional-evaluation/conditional-evaluator';
import { applyAutoOptimizations } from './auto-optimization/auto-optimizer';
import { enforceLimits, applyPrecedence } from './transformation-limiting/transformation-limiter';
import { PolicyResolver } from './policyResolver/policy-resolver';

export class TransformationResolverService {
  private static instance: TransformationResolverService;
  private policyResolver: PolicyResolver;

  constructor(private policyCache: PolicyCache) {
    this.policyResolver = new PolicyResolver(policyCache);
  }

  async resolve(req: Request, imageRequest: ImageProcessingRequest): Promise<void> {
    const startTime = Date.now();
    if (!imageRequest.timings) imageRequest.timings = {};
    imageRequest.timings.transformationResolution = { startMs: startTime };

    const urlTransformations = extractUrlTransformations(req, imageRequest.requestId);
    const policy = await this.policyResolver.resolvePolicy(req, imageRequest);
    const policyTransformations = policy?.transformations || [];
    const optimizedPolicyTransformations = applyAutoOptimizations(policyTransformations, req, policy, imageRequest);
    const allTransformations = applyPrecedence(urlTransformations, optimizedPolicyTransformations);
    const conditionalTransformations = evaluateConditionals(allTransformations, req);
    const finalTransformations = enforceLimits(conditionalTransformations);
    
    console.log(JSON.stringify({
      requestId: imageRequest.requestId,
      component: 'TransformationResolver',
      operation: 'transformations_finalized',
      urlTransformations: urlTransformations.length,
      policyTransformations: policyTransformations.length,
      finalTransformations: finalTransformations.length,
    }));

    this.logTransformationMetrics(imageRequest.requestId, finalTransformations);
    
    imageRequest.transformations = finalTransformations;

    // Finalize timing
    imageRequest.timings.transformationResolution.endMs = Date.now();
    imageRequest.timings.transformationResolution.durationMs = 
      imageRequest.timings.transformationResolution.endMs - startTime;
  }

  private logTransformationMetrics(requestId: string, transformations: Transformation[]): void {
    const transformationSet = new Set(transformations.map(t => t.type));

    console.log(JSON.stringify({
      metricType: 'transformations',
      requestId,
      finalTransformations: transformations.length,
      t_animated: transformationSet.has('animated'),
      t_blur: transformationSet.has('blur'),
      t_convolve: transformationSet.has('convolve'),
      t_extract: transformationSet.has('extract'),
      t_flatten: transformationSet.has('flatten'),
      t_flip: transformationSet.has('flip'),
      t_flop: transformationSet.has('flop'),
      t_format: transformationSet.has('format'),
      t_grayscale: transformationSet.has('grayscale'),
      t_normalize: transformationSet.has('normalize'),
      t_quality: transformationSet.has('quality'),
      t_resize: transformationSet.has('resize'),
      t_rotate: transformationSet.has('rotate'),
      t_sharpen: transformationSet.has('sharpen'),
      t_smartCrop: transformationSet.has('smartCrop'),
      t_stripExif: transformationSet.has('stripExif'),
      t_stripIcc: transformationSet.has('stripIcc'),
      t_tint: transformationSet.has('tint'),
      t_watermark: transformationSet.has('watermark')
    }));
  }

  static getInstance(): TransformationResolverService {
    if (!TransformationResolverService.instance) {
      const cacheRegistry = CacheRegistry.getInstance();
      TransformationResolverService.instance = new TransformationResolverService(
        cacheRegistry.getPolicyCache()
      );
    }
    return TransformationResolverService.instance;
  }
}