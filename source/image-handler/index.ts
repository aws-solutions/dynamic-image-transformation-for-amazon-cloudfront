// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Rekognition from "aws-sdk/clients/rekognition";
import S3 from "aws-sdk/clients/s3";
import SecretsManager from "aws-sdk/clients/secretsmanager";

import { getOptions } from "../solution-utils/get-options";
import { isNullOrWhiteSpace } from "../solution-utils/helpers";
import { ImageHandler } from "./image-handler";
import { ImageRequest } from "./image-request";
import { Headers, ImageHandlerEvent, ImageHandlerExecutionResult, StatusCodes } from "./lib";
import { normalizePayload, NormalizedPayload } from "./payload-normalizer";
import { handleProgressiveLoading, isWarmingRequest, executeWarmingRequest, getAvifCacheKey, storeAvifToS3Cache, clientSupportsAvif } from "./progressive-loader";
import { SecretProvider } from "./secret-provider";

const awsSdkOptions = getOptions();
const s3Client = new S3(awsSdkOptions);
const rekognitionClient = new Rekognition(awsSdkOptions);
const secretsManagerClient = new SecretsManager(awsSdkOptions);
const secretProvider = new SecretProvider(secretsManagerClient);

/**
 * Image handler Lambda handler.
 * @param event The image handler request event.
 * @returns Processed request response.
 */
export async function handler(event: ImageHandlerEvent): Promise<ImageHandlerExecutionResult> {
  console.info("Received event:", JSON.stringify(event, null, 2));

  // Branch 1: Orchestrator mode - async invocation to make HTTP request to CloudFront and wait
  // This ensures the warming request completes before Lambda terminates
  if (event._warmOrchestrator) {
    console.info("Orchestrator mode detected, executing warming request");
    return await executeWarmingRequest(event._warmOrchestrator);
  }

  const imageRequest = new ImageRequest(s3Client, secretProvider);
  const imageHandler = new ImageHandler(s3Client, rekognitionClient);
  const isAlb = event.requestContext && Object.prototype.hasOwnProperty.call(event.requestContext, "elb");

  // Check for progressive loading based on Accept header (AVIF support)
  // Progressive loading redirects to JPEG immediately and warms AVIF cache in background
  const isWarmReq = isWarmingRequest(event);
  const supportsAvif = clientSupportsAvif(event);
  console.info(`Progressive loading check: isWarmingRequest=${isWarmReq}, supportsAvif=${supportsAvif}`);

  // Decode payload once - used for both progressive loading check and S3 cache key
  let normalizedPayload: NormalizedPayload | null = null;
  try {
    const rawPayload = tryDecodePayload(event.path);
    if (rawPayload) {
      normalizedPayload = normalizePayload(rawPayload);
    }
  } catch {
    // Payload decode failed - will continue without it
  }

  // Progressive AVIF loading: browser supports AVIF, has style config, not a warming request
  if (supportsAvif && !isWarmReq && normalizedPayload) {
    const hasAvifConfig = !!normalizedPayload.edits?.avif?.style;
    console.info(
      `Progressive loading check: hasAvifConfig=${hasAvifConfig}, ` +
      `edits=${JSON.stringify(normalizedPayload.edits)}`
    );
    if (hasAvifConfig) {
      console.info("AVIF-capable browser detected with style config, checking S3 cache");
      return await handleProgressiveLoading(event, normalizedPayload, secretProvider);
    }
  } else if (!normalizedPayload) {
    console.info("Progressive loading check: could not decode payload (not base64 JSON)");
  } else if (isWarmReq) {
    console.info("Warming request detected, skipping progressive loading redirect (will generate AVIF)");
  }

  try {
    const imageRequestInfo = await imageRequest.setup(event);
    console.info(imageRequestInfo);

    const processedRequest = await imageHandler.process(imageRequestInfo);

    // Store AVIF to S3 cache if this is a warming request
    if (isWarmReq && imageRequestInfo.contentType === "image/avif" && normalizedPayload) {
      const cacheKey = getAvifCacheKey(normalizedPayload);
      if (cacheKey) {
        console.info(`Warming request: storing AVIF to S3 cache key=${cacheKey}`);
        try {
          await storeAvifToS3Cache(cacheKey, Buffer.from(processedRequest, "base64"));
          console.info(`Successfully cached AVIF to S3: ${cacheKey}`);
        } catch (err) {
          console.error("Failed to cache AVIF to S3:", err);
        }
      }
    }

    let headers = getResponseHeaders(false, isAlb);
    headers["Content-Type"] = imageRequestInfo.contentType;
    // eslint-disable-next-line dot-notation
    headers["Expires"] = imageRequestInfo.expires;
    headers["Last-Modified"] = imageRequestInfo.lastModified;
    headers["Cache-Control"] = imageRequestInfo.cacheControl;

    // Apply the custom headers overwriting any that may need overwriting
    if (imageRequestInfo.headers) {
      headers = { ...headers, ...imageRequestInfo.headers };
    }

    return {
      statusCode: StatusCodes.OK,
      isBase64Encoded: true,
      headers,
      body: processedRequest,
    };
  } catch (error) {
    console.error(error);

    // Default fallback image
    const { ENABLE_DEFAULT_FALLBACK_IMAGE, DEFAULT_FALLBACK_IMAGE_BUCKET, DEFAULT_FALLBACK_IMAGE_KEY } = process.env;
    if (
      ENABLE_DEFAULT_FALLBACK_IMAGE === "Yes" &&
      !isNullOrWhiteSpace(DEFAULT_FALLBACK_IMAGE_BUCKET) &&
      !isNullOrWhiteSpace(DEFAULT_FALLBACK_IMAGE_KEY)
    ) {
      try {
        const defaultFallbackImage = await s3Client
          .getObject({
            Bucket: DEFAULT_FALLBACK_IMAGE_BUCKET,
            Key: DEFAULT_FALLBACK_IMAGE_KEY,
          })
          .promise();

        const headers = getResponseHeaders(false, isAlb);
        headers["Content-Type"] = defaultFallbackImage.ContentType;
        headers["Last-Modified"] = defaultFallbackImage.LastModified;
        headers["Cache-Control"] = "max-age=31536000,public";

        return {
          statusCode: error.status ? error.status : StatusCodes.INTERNAL_SERVER_ERROR,
          isBase64Encoded: true,
          headers,
          body: defaultFallbackImage.Body.toString("base64"),
        };
      } catch (error) {
        console.error("Error occurred while getting the default fallback image.", error);
      }
    }

    const { statusCode, body } = getErrorResponse(error);
    return {
      statusCode,
      isBase64Encoded: false,
      headers: getResponseHeaders(true, isAlb),
      body,
    };
  }
}

/**
 * Generates the appropriate set of response headers based on a success or error condition.
 * @param isError Has an error been thrown.
 * @param isAlb Is the request from ALB.
 * @returns Headers.
 */
function getResponseHeaders(isError: boolean = false, isAlb: boolean = false): Headers {
  const { CORS_ENABLED, CORS_ORIGIN } = process.env;
  const corsEnabled = CORS_ENABLED === "Yes";
  const headers: Headers = {
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (!isAlb) {
    headers["Access-Control-Allow-Credentials"] = true;
  }

  if (corsEnabled) {
    headers["Access-Control-Allow-Origin"] = CORS_ORIGIN;
  }

  if (isError) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

/**
 * Determines the appropriate error response values
 * @param error The error object from a try/catch block
 * @returns appropriate status code and body
 */
export function getErrorResponse(error) {
  if (error?.status) {
    return {
      statusCode: error.status,
      body: JSON.stringify(error),
    };
  }
  /**
   * if an image overlay is attempted and the overlaying image has greater dimensions
   * that the base image, sharp will throw an exception and return this string
   */
  if (error?.message === "Image to composite must have same dimensions or smaller") {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({
        /**
         * return a message indicating overlay dimensions is the issue, the caller may not
         * know that the sharp composite function was used
         */
        message: "Image to overlay must have same dimensions or smaller",
        code: "BadRequest",
        status: StatusCodes.BAD_REQUEST,
      }),
    };
  }
  return {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    body: JSON.stringify({
      message: "Internal error. Please contact the system administrator.",
      code: "InternalError",
      status: StatusCodes.INTERNAL_SERVER_ERROR,
    }),
  };
}

/**
 * Attempts to decode a base64 payload from the request path.
 * Returns null if decoding fails (e.g., not a base64 DEFAULT request type).
 * @param path The request path
 * @returns The decoded payload object or null
 */
function tryDecodePayload(path: string): any | null {
  if (!path) {
    return null;
  }

  try {
    const encoded = path.startsWith("/") ? path.slice(1) : path;
    const toBuffer = Buffer.from(encoded, "base64");
    return JSON.parse(toBuffer.toString());
  } catch {
    // Not a valid base64 JSON payload (could be Thumbor or Custom request type)
    return null;
  }
}