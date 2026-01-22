// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { createHmac } from "crypto";
import https from "https";
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

  // Replace file extension with .avif (matching Rails style_path interpolation)
  const dotIndex = filename.lastIndexOf(".");
  const baseFilename = dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
  const avifFilename = `${baseFilename}.avif`;

  return `${basePath}/${style}/${avifFilename}`;
}

/**
 * Checks if AVIF exists in S3 cache.
 *
 * @param bucket The S3 bucket
 * @param cacheKey The S3 key for the cached AVIF
 * @returns Buffer with AVIF data if found, null otherwise
 */
export async function getAvifFromS3Cache(bucket: string, cacheKey: string): Promise<Buffer | null> {
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
 * @param bucket The S3 bucket
 * @param cacheKey The S3 key for the cached AVIF
 * @param avifBuffer The AVIF data to store
 */
export async function storeAvifToS3Cache(bucket: string, cacheKey: string, avifBuffer: Buffer): Promise<void> {
  await s3Client
    .putObject({
      Bucket: bucket,
      Key: cacheKey,
      Body: avifBuffer,
      ContentType: "image/avif",
      CacheControl: "max-age=31536000,public",
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
  const acceptHeader = event.headers?.Accept || event.headers?.accept;
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
  const hostHeader = event.headers?.Host || event.headers?.host;
  const host = cloudfrontDomain || hostHeader;

  if (!host) {
    throw new Error("CLOUDFRONT_DOMAIN environment variable is required for progressive loading");
  }

  const bucket = process.env.SOURCE_BUCKETS?.split(",")[0];
  const cacheKey = getAvifCacheKey(payload);

  console.info(`Progressive loading: domain=${host}, checking S3 cache bucket=${bucket} key=${cacheKey}`);

  // Step 1: Check S3 cache first (only if we have a valid cache key)
  if (bucket && cacheKey) {
    const cachedAvif = await getAvifFromS3Cache(bucket, cacheKey);
    if (cachedAvif) {
      console.info(`S3 cache HIT, returning ${cachedAvif.length} bytes AVIF`);
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

  console.info("S3 cache MISS, returning 302 + triggering async warming");

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

  // Step 4: Trigger async warming via Lambda self-invoke
  await triggerAsyncWarmingOrchestrator(host, event.path, event.queryStringParameters?.signature, acceptHeader);

  // Step 5: Return 302 redirect to JPEG
  // Use "private" so CloudFront doesn't cache 302 (allows warming request to reach Lambda).
  // Browser caches for 15s to reduce repeated requests from same user during encoding.
  return {
    statusCode: StatusCodes.REDIRECT,
    isBase64Encoded: false,
    headers: {
      Location: jpegUrl,
      "Cache-Control": "private, max-age=15",
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

/**
 * Triggers an async warming request via Lambda self-invoke.
 * The orchestrator Lambda will make the HTTP request to CloudFront and wait for completion,
 * ensuring the AVIF is generated and cached before the Lambda terminates.
 *
 * @param host The CloudFront hostname
 * @param path The original request path (with AVIF payload)
 * @param originalSignature The original request signature (if any)
 * @param acceptHeader The Accept header from the original request (for cache key matching)
 */
async function triggerAsyncWarmingOrchestrator(
  host: string,
  path: string,
  originalSignature?: string,
  acceptHeader?: string
): Promise<void> {
  // AWS_LAMBDA_FUNCTION_NAME is automatically provided by Lambda runtime
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (!functionName) {
    console.error("AWS_LAMBDA_FUNCTION_NAME not set, skipping async warming");
    return;
  }

  const warmingUrl = originalSignature
    ? `https://${host}${path}?signature=${originalSignature}`
    : `https://${host}${path}`;

  console.info(`Invoking async warming orchestrator for: ${warmingUrl} (Accept: ${acceptHeader || "not set"})`);

  try {
    await lambdaClient
      .invoke({
        FunctionName: functionName,
        InvocationType: "Event", // Async invocation - returns immediately
        Payload: JSON.stringify({ _warmOrchestrator: { url: warmingUrl, acceptHeader } }),
      })
      .promise();

    console.info("Async warming orchestrator invoked successfully");
  } catch (err) {
    console.error("Failed to invoke warming orchestrator:", err.message);
  }
}

/**
 * Executes a warming request to CloudFront and waits for completion.
 * Called by the orchestrator Lambda (async self-invoke).
 * This ensures the AVIF is generated and cached.
 *
 * @param config The warming request configuration with the URL to fetch and optional Accept header
 * @returns A simple success/error response
 */
export async function executeWarmingRequest(config: { url: string; acceptHeader?: string }): Promise<ImageHandlerExecutionResult> {
  console.info(`Warming orchestrator: fetching ${config.url} (Accept: ${config.acceptHeader || "not set"})`);

  // Make request WITH x-bw-warm header to generate and cache the AVIF
  // Note: We only make one request. A second request without x-bw-warm would
  // trigger progressive loading again and cause cascading timeouts.
  return await makeWarmingHttpRequest(config.url, config.acceptHeader, true);
}

/**
 * Makes an HTTP request to CloudFront for cache warming.
 */
async function makeWarmingHttpRequest(
  url: string,
  acceptHeader?: string,
  includeWarmHeader: boolean = true
): Promise<ImageHandlerExecutionResult> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);

    // Build headers
    const headers: Record<string, string> = {};
    if (includeWarmHeader) {
      headers["x-bw-warm"] = "1";
    }
    if (acceptHeader) {
      headers["accept"] = acceptHeader;
    }

    // Log exact headers being sent for debugging
    console.info(`Warming request headers: ${JSON.stringify(headers)}`);

    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers,
        timeout: 30000, // 30 second timeout
      },
      (res) => {
        // Log key response headers for debugging cache behavior
        const xCache = res.headers?.["x-cache"] || "N/A";
        const contentType = res.headers?.["content-type"] || "N/A";
        console.info(`Warming request completed with status: ${res.statusCode}, x-cache: ${xCache}, content-type: ${contentType}`);
        res.resume(); // Consume response data
        resolve({
          statusCode: StatusCodes.OK,
          isBase64Encoded: false,
          headers: {},
          body: JSON.stringify({ warmed: true, status: res.statusCode }),
        });
      }
    );

    req.on("error", (err) => {
      console.error("Warming request failed:", err.message);
      resolve({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        isBase64Encoded: false,
        headers: {},
        body: JSON.stringify({ error: err.message }),
      });
    });

    req.on("timeout", () => {
      console.error("Warming request timed out");
      req.destroy();
      resolve({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        isBase64Encoded: false,
        headers: {},
        body: JSON.stringify({ error: "timeout" }),
      });
    });

    req.end();
  });
}

/**
 * Checks if the current request is a warming request.
 *
 * @param event The Lambda event
 * @returns True if the x-bw-warm header is set to "1"
 */
export function isWarmingRequest(event: ImageHandlerEvent): boolean {
  const warmHeader = event.headers?.["x-bw-warm"] || event.headers?.["X-Bw-Warm"];
  return warmHeader === "1";
}
