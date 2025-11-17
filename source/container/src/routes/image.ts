// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Router, Request, Response } from 'express';
import { RequestResolverService } from '../services/request-resolver/request-resolver.service';
import { TransformationResolverService } from '../services/transformation-resolver/transformation-resolver.service';
import { ImageProcessorService } from '../services/image-processing/image-processor.service';
import { ImageProcessingRequest } from '../types/image-processing-request';
import { randomUUID } from 'crypto';
import { ValidationError } from '../services/request-resolver/errors/validation.error';
import { OriginNotFoundError } from '../services/request-resolver/errors/origin-not-found.error';
import { ConnectionError } from '../services/request-resolver/errors/connection.error';
import { PolicyNotFoundError } from '../services/transformation-resolver/errors/policy-not-found.error';
import { ImageProcessingError } from '../services/image-processing/types';

const router = Router();

// Headers to exclude from forwarding
const EXCLUDED_HEADERS: string[] = ['host', 'accept'];

// Memory protection limits
const MAX_HEADERS = 50;
const MAX_HEADER_VALUE_LENGTH = 1024;

// Wildcard route handler for all image requests
router.get('*', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let imageRequest: ImageProcessingRequest | undefined;
  
  try {
    // Initialize shared request object
    imageRequest = {
      requestId: randomUUID(),
      timestamp: Date.now(),
      clientHeaders: filterClientHeaders(req.headers),
      response: { headers: {} },
      timings: {}
    };

    console.log(JSON.stringify({
      requestId: imageRequest.requestId,
      component: 'ImageRouter',
      operation: 'request_start',
      path: req.path,
      method: req.method
    }));

    // Step 1: Request Resolution
    const requestResolver = RequestResolverService.getInstance();
    await requestResolver.resolve(req, imageRequest);

    // Step 2: Transformation Resolution
    const transformationResolver = TransformationResolverService.getInstance();
    await transformationResolver.resolve(req, imageRequest);

    // Step 3: Image Processing
    const imageProcessor = ImageProcessorService.getInstance();
    const processedImage = await imageProcessor.process(imageRequest);

    // Send processed image response
    res.set(imageRequest.response.headers);
    res.type(imageRequest.response.contentType || 'image/jpeg');
    res.send(processedImage);

    console.log(JSON.stringify({
      requestId: imageRequest.requestId,
      component: 'ImageRouter',
      operation: 'request_complete',
      duration: Date.now() - startTime,
      statusCode: res.statusCode,
      responseSize: processedImage.length,
      contentType: imageRequest.response.contentType
    }));

    // Emit detailed latency breakdown
    console.log(JSON.stringify({
      metricType: 'request_latencies',
      totalDurationMs: Date.now() - startTime,
      preflightValidationMs: imageRequest.timings?.requestResolution?.preflightValidationMs,
      transformationResolutionMs: imageRequest.timings?.transformationResolution?.durationMs,
      originFetchMs: imageRequest.timings?.imageProcessing?.originFetchMs,
      transformationApplicationMs: imageRequest.timings?.imageProcessing?.transformationApplicationMs,
      requestId: imageRequest.requestId,
    }));
    
  } catch (error) {
    const requestId = imageRequest?.requestId || 'unknown';
    const { statusCode, errorType, clientMessage } = handleError(error, requestId, startTime);
    
    res.status(statusCode).json({
      error: errorType,
      message: clientMessage,
      requestId
    });
  }
});

function handleError(error: unknown, requestId: string, startTime: number) {
  let statusCode = 500;
  let errorType = 'INTERNAL_ERROR';
  let clientMessage = 'An unexpected error occurred while processing your request';
  let verboseInfo: any = {};

  if (!(error instanceof Error)) {
    verboseInfo.unknownError = error;
  } else {
    switch (error.constructor) {
      case ValidationError:
        statusCode = 400;
        errorType = 'VALIDATION_ERROR';
        clientMessage = error.message;
        verboseInfo.verboseMessage = (error as ValidationError).verboseMessage;
        break;

      case OriginNotFoundError:
        statusCode = (error as OriginNotFoundError).statusCode;
        errorType = 'ORIGIN_NOT_FOUND';
        clientMessage = error.message;
        verboseInfo.verboseMessage = (error as OriginNotFoundError).verboseMessage;
        break;

      case ConnectionError:
        statusCode = (error as ConnectionError).statusCode;
        errorType = (error as ConnectionError).errorType;
        clientMessage = (error as ConnectionError).title;
        verboseInfo.verboseDescription = (error as ConnectionError).verboseDescription;
        break;

      case PolicyNotFoundError:
        statusCode = (error as PolicyNotFoundError).statusCode;
        errorType = (error as PolicyNotFoundError).errorType;
        clientMessage = error.message;
        verboseInfo.verboseDescription = (error as PolicyNotFoundError).verboseDescription;
        break;

      case ImageProcessingError:
        statusCode = (error as ImageProcessingError).statusCode;
        errorType = (error as ImageProcessingError).errorType;
        clientMessage = error.message;
        verboseInfo.originalError = (error as ImageProcessingError).originalError?.message;
        verboseInfo.originalStack = (error as ImageProcessingError).originalError?.stack;
        break;

      default:
        verboseInfo.errorMessage = error.message;
        verboseInfo.stack = error.stack;
    }
  }

  console.error(JSON.stringify({
    requestId,
    component: 'ImageRouter',
    operation: 'request_error',
    duration: Date.now() - startTime,
    statusCode,
    errorType,
    clientMessage,
    ...verboseInfo,
    stack: error instanceof Error ? error.stack : undefined
  }));

  return { statusCode, errorType, clientMessage };
}

/**
 * Filters and limits client headers to prevent memory exhaustion attacks
 */
function filterClientHeaders(headers: Record<string, string | string[]>): Record<string, string> {
  const filtered: Record<string, string> = {};
  let headerCount = 0;
  
  for (const [name, value] of Object.entries(headers)) {
    if (headerCount >= MAX_HEADERS) break;
    
    const lowerName = name.toLowerCase();
    if (EXCLUDED_HEADERS.includes(lowerName)) continue;
    
    const stringValue = Array.isArray(value) ? value[0] : value;
    if (stringValue && stringValue.length <= MAX_HEADER_VALUE_LENGTH) {
      filtered[name] = stringValue;
      headerCount++;
    }
  }
  
  return filtered;
}

export default router;
