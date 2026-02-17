// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { createHmac } from "crypto";
import Lambda from "aws-sdk/clients/lambda";
import S3 from "aws-sdk/clients/s3";

import { getOptions } from "../solution-utils/get-options";
import { ImageHandlerEvent, ImageHandlerExecutionResult, StatusCodes } from "./lib";
import { NormalizedPayload, createJpegOnlyPayload, denormalizePayload } from "./payload-normalizer";
import { SecretProvider } from "./secret-provider";

const awsSdkOptions = getOptions();
const lambdaClient = new Lambda(awsSdkOptions);
const s3Client = new S3(awsSdkOptions);

/**
 * Generates an S3 cache key for AVIF matching Rails Paperclip path structure.
 * This produces the same path that Rails would use if "resize on the fly" is disabled.
 *
 * Example:
 * - Input key: "item_images/assets/2/000/076/056/original/3-1.jpg"
 * - Style: "sm" (passed in payload)
 * - Output: "item_images/assets/2/000/076/056/sm/3-1.avif"
 *
 * The style name (xs, sm, lg, xl) must be provided in the payload by Rails.
 *
 * @param payload The normalized payload containing key and style
 * @returns The S3 key for the cached AVIF, or null if style is missing
 */
export function getAvifCacheKey(payload: NormalizedPayload): string | null {
  const key = payload.key;
  const style = payload.edits?.avif?.style;

  // Style is required for AVIF caching
  if (!style) {
    console.warn("AVIF style not provided in payload, skipping S3 cache");
    return null;
  }

  // Parse original path: "base/path/style/filename.ext"
  const lastSlashIndex = key.lastIndexOf("/");
  const dirPath = key.substring(0, lastSlashIndex); // "item_images/assets/2/000/076/056/original"
  const filename = key.substring(lastSlashIndex + 1); // "3-1.jpg"

  // Remove the current style folder from dirPath (e.g., "original")
  const secondLastSlashIndex = dirPath.lastIndexOf("/");
  const basePath = dirPath.substring(0, secondLastSlashIndex); // "item_images/assets/2/000/076/056"

  // Replace file extension with .avif, including version to bust cache on image updates
  const dotIndex = filename.lastIndexOf(".");
  const baseFilename = dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
  const version = payload.v;
  const avifFilename = version ? `${baseFilename}_v${version}.avif` : `${baseFilename}.avif`;

  return `${basePath}/${style}/${avifFilename}`;
}

/**
 * Gets the AVIF cache bucket from environment.
 * @returns The bucket name or undefined if not configured
 */
function getAvifCacheBucket(): string | undefined {
  return process.env.AVIF_CACHE_BUCKET;
}

/**
 * Checks if AVIF exists in S3 cache.
 *
 * @param cacheKey The S3 key for the cached AVIF
 * @returns Buffer with AVIF data if found, null otherwise
 */
export async function getAvifFromS3Cache(cacheKey: string): Promise<Buffer | null> {
  const bucket = getAvifCacheBucket();
  if (!bucket) return null;

  try {
    const result = await s3Client
      .getObject({
        Bucket: bucket,
        Key: cacheKey,
      })
      .promise();
    return Buffer.from(result.Body as Uint8Array);
  } catch (err: any) {
    if (err.code === "NoSuchKey") return null;
    console.error("S3 cache read error:", err);
    return null; // Fail open - continue to generate
  }
}

/**
 * Stores AVIF to S3 cache.
 *
 * @param cacheKey The S3 key for the cached AVIF
 * @param avifBuffer The AVIF data to store
 */
export async function storeAvifToS3Cache(cacheKey: string, avifBuffer: Buffer): Promise<void> {
  const bucket = getAvifCacheBucket();
  if (!bucket) {
    console.warn("AVIF_CACHE_BUCKET not set, skipping S3 cache storage");
    return;
  }

  await s3Client
    .putObject({
      Bucket: bucket,
      Key: cacheKey,
      Body: avifBuffer,
      ContentType: "image/avif",
      CacheControl: "max-age=31536000,public",
      StorageClass: "ONEZONE_IA",
    })
    .promise();
}

/**
 * Handles progressive loading for AVIF images.
 *
 * When a request for AVIF reaches Lambda:
 * 1. Check S3 for cached AVIF - if found, return it (200 OK)
 * 2. If not found, return 302 redirect to JPEG and trigger async warming
 * 3. Async warming generates AVIF and stores it to S3 for future requests
 *
 * @param event The Lambda event
 * @param payload The normalized payload
 * @param secretProvider The secret provider for signature generation
 * @returns 200 with AVIF if cached, or 302 redirect to JPEG URL
 */
export async function handleProgressiveLoading(
  event: ImageHandlerEvent,
  payload: NormalizedPayload,
  secretProvider: SecretProvider
): Promise<ImageHandlerExecutionResult> {
  const host = process.env.CLOUDFRONT_DOMAIN;

  if (!host) {
    throw new Error("CLOUDFRONT_DOMAIN environment variable is required for progressive loading");
  }

  const cacheKey = getAvifCacheKey(payload);

  // Step 1: Check S3 cache first (only if we have a valid cache key and bucket)
  if (cacheKey) {
    const cachedAvif = await getAvifFromS3Cache(cacheKey);
    if (cachedAvif) {
      return {
        statusCode: StatusCodes.OK,
        isBase64Encoded: true,
        headers: {
          "Content-Type": "image/avif",
          "Cache-Control": "max-age=31536000,public",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: cachedAvif.toString("base64"),
      };
    }
  }

  // Step 2: Build JPEG URL (same payload without avif key)
  const jpegPayload = createJpegOnlyPayload(payload);
  const jpegPayloadDenormalized = denormalizePayload(jpegPayload);
  const jpegPath = "/" + Buffer.from(JSON.stringify(jpegPayloadDenormalized)).toString("base64");

  // Step 3: Generate signature for JPEG URL (if signatures enabled)
  let jpegUrl = `https://${host}${jpegPath}`;
  if (process.env.ENABLE_SIGNATURE === "Yes") {
    const signature = await generateSignature(jpegPath, secretProvider);
    jpegUrl += `?signature=${signature}`;
  }

  // Step 4: Trigger async AVIF generation via Lambda self-invoke
  await triggerAsyncAvifGeneration(event.path, payload, event.queryStringParameters?.signature);

  // Step 5: Return 302 redirect to JPEG
  // Use "private" so CloudFront doesn't cache 302 (allows next request to reach Lambda).
  // Browser caches for 60s to reduce repeated requests while AVIF is being generated.
  return {
    statusCode: StatusCodes.REDIRECT,
    isBase64Encoded: false,
    headers: {
      Location: jpegUrl,
      "Cache-Control": "private, max-age=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
    body: "",
  };
}

/**
 * Generates an HMAC-SHA256 signature for a path.
 *
 * @param path The URL path to sign
 * @param secretProvider The secret provider
 * @returns The hex-encoded signature
 */
async function generateSignature(path: string, secretProvider: SecretProvider): Promise<string> {
  const { SECRETS_MANAGER, SECRET_KEY } = process.env;

  if (!SECRETS_MANAGER || !SECRET_KEY) {
    throw new Error("SECRETS_MANAGER and SECRET_KEY environment variables are required for signature generation");
  }

  const secret = JSON.parse(await secretProvider.getSecret(SECRETS_MANAGER));
  const key = secret[SECRET_KEY];
  return createHmac("sha256", key).update(path).digest("hex");
}

async function triggerAsyncAvifGeneration(path: string, payload: NormalizedPayload, signature?: string): Promise<void> {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (!functionName) {
    console.error("AWS_LAMBDA_FUNCTION_NAME not set, skipping async AVIF generation");
    return;
  }

  try {
    await lambdaClient
      .invoke({
        FunctionName: functionName,
        InvocationType: "Event",
        Payload: JSON.stringify({
          _warmAvif: { path, signature, normalizedPayload: payload },
        }),
      })
      .promise();
  } catch (err) {
    console.error("Failed to invoke async AVIF generation:", err.message);
  }
}

/**
 * Checks if the client supports AVIF based on CloudFront Function's normalized fmt query param.
 * Falls back to Accept header for direct Lambda invocation.
 *
 * @param event The Lambda event
 * @returns True if fmt=avif or Accept header includes image/avif
 */
export function clientSupportsAvif(event: ImageHandlerEvent): boolean {
  // Check CloudFront Function's normalized format param first
  const fmt = event.queryStringParameters?.fmt;
  if (fmt) {
    return fmt === "avif";
  }
  // Fallback to Accept header (for direct Lambda invocation)
  const acceptHeader = event.headers?.Accept || event.headers?.accept || "";
  return acceptHeader.includes("image/avif");
}
