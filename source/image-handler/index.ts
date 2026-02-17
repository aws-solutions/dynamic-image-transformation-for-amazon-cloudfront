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
import { normalizePayload, NormalizedPayload, createJpegOnlyPayload, denormalizePayload } from "./payload-normalizer";
import {
  handleProgressiveLoading,
  getAvifCacheKey,
  storeAvifToS3Cache,
  clientSupportsAvif,
} from "./progressive-loader";
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
  if (event._warmAvif) {
    const { path: warmPath, signature, normalizedPayload: warmPayload } = event._warmAvif;
    try {
      const warmImageRequest = new ImageRequest(s3Client, secretProvider);
      const warmImageHandler = new ImageHandler(s3Client, rekognitionClient);
      const warmEvent = {
        path: warmPath,
        queryStringParameters: signature ? { signature } : undefined,
      } as ImageHandlerEvent;
      const imageRequestInfo = await warmImageRequest.setup(warmEvent);
      const processedRequest = await warmImageHandler.process(imageRequestInfo);
      if (imageRequestInfo.contentType === "image/avif") {
        const cacheKey = getAvifCacheKey(warmPayload);
        if (cacheKey) {
          await storeAvifToS3Cache(cacheKey, Buffer.from(processedRequest, "base64"));
        }
      }
      return {
        statusCode: StatusCodes.OK,
        isBase64Encoded: false,
        headers: {},
        body: JSON.stringify({ warmed: true }),
      };
    } catch (err) {
      console.error("Async AVIF generation failed:", err);
      return { statusCode: StatusCodes.INTERNAL_SERVER_ERROR, isBase64Encoded: false, headers: {}, body: "" };
    }
  }

  const imageRequest = new ImageRequest(s3Client, secretProvider);
  const imageHandler = new ImageHandler(s3Client, rekognitionClient);
  const isAlb = event.requestContext && Object.prototype.hasOwnProperty.call(event.requestContext, "elb");

  const supportsAvif = clientSupportsAvif(event);

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

  if (supportsAvif && normalizedPayload) {
    const hasAvifConfig = !!normalizedPayload.edits?.avif?.style;
    if (hasAvifConfig) {
      return await handleProgressiveLoading(event, normalizedPayload, secretProvider);
    }
  }

  // If client doesn't support AVIF, strip avif config from payload so setup() produces JPEG.
  // Validate signature against the original path first (signature was computed on it),
  // then rewrite path for image processing.
  if (!supportsAvif && normalizedPayload?.edits?.avif) {
    await imageRequest.validateRequestSignature(event);
    event._signatureValidated = true;
    const jpegPayload = createJpegOnlyPayload(normalizedPayload);
    const denormalized = denormalizePayload(jpegPayload);
    event.path = "/" + Buffer.from(JSON.stringify(denormalized)).toString("base64");
  }

  try {
    const imageRequestInfo = await imageRequest.setup(event);
    const processedRequest = await imageHandler.process(imageRequestInfo);

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
