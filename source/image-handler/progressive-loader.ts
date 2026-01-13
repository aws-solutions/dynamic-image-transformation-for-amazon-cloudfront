// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { createHmac } from "crypto";
import https from "https";
import Lambda from "aws-sdk/clients/lambda";

import { getOptions } from "../solution-utils/get-options";
import { ImageHandlerEvent, ImageHandlerExecutionResult, StatusCodes } from "./lib";
import { NormalizedPayload, createJpegOnlyPayload, denormalizePayload } from "./payload-normalizer";
import { SecretProvider } from "./secret-provider";

const awsSdkOptions = getOptions();
const lambdaClient = new Lambda(awsSdkOptions);

/**
 * Handles progressive loading for AVIF images.
 *
 * When a request for AVIF reaches Lambda (Origin Shield miss), we:
 * 1. Return 302 redirect to JPEG for immediate response
 * 2. Trigger async warming to generate and cache AVIF at Origin Shield
 *
 * The 302 is cached for 5 seconds to reduce thundering herd during warming.
 * After warming completes (~7-10s), subsequent requests get AVIF from Origin Shield.
 *
 * @param event The Lambda event
 * @param payload The normalized payload
 * @param secretProvider The secret provider for signature generation
 * @returns A 302 redirect to JPEG URL
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

  console.info(`Progressive loading: domain=${host}, checking Origin Shield cache first`);

  // 1. Check if Origin Shield already has the AVIF cached
  // This works around CloudFront cache partitioning where browser requests don't hit
  // cache populated by Lambda warming requests. Lambda→CloudFront requests DO hit the cache.
  const cachedAvif = await checkOriginShieldCache(
    host,
    event.path,
    event.queryStringParameters?.signature,
    acceptHeader
  );

  if (cachedAvif) {
    console.info(`Progressive loading: cache HIT, proxying ${cachedAvif.length} bytes AVIF to browser`);
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

  console.info("Progressive loading: cache MISS, returning 302 + triggering async warming");

  // 2. Build JPEG URL (same payload without avif key)
  const jpegPayload = createJpegOnlyPayload(payload);
  const jpegPayloadDenormalized = denormalizePayload(jpegPayload);
  const jpegPath = "/" + Buffer.from(JSON.stringify(jpegPayloadDenormalized)).toString("base64");

  // 3. Generate signature for JPEG URL (if signatures enabled)
  let jpegUrl = `https://${host}${jpegPath}`;
  if (process.env.ENABLE_SIGNATURE === "Yes") {
    const signature = await generateSignature(jpegPath, secretProvider);
    jpegUrl += `?signature=${signature}`;
  }

  // 4. Trigger async warming via Lambda self-invoke
  await triggerAsyncWarmingOrchestrator(host, event.path, event.queryStringParameters?.signature, acceptHeader);

  // 5. Return 302 redirect to JPEG
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

/**
 * Checks if the current request is a cache-check request.
 * Cache-check requests are used to probe Origin Shield cache before returning 302.
 *
 * @param event The Lambda event
 * @returns True if the x-bw-cache-check header is set to "1"
 */
export function isCacheCheckRequest(event: ImageHandlerEvent): boolean {
  const cacheCheckHeader = event.headers?.["x-bw-cache-check"] || event.headers?.["X-Bw-Cache-Check"];
  return cacheCheckHeader === "1";
}

/**
 * Checks Origin Shield cache for a cached AVIF response.
 * Makes a synchronous request to CloudFront with x-bw-cache-check header.
 * If Origin Shield has the AVIF cached, returns the binary data.
 * If cache miss (Lambda returns 204), returns null.
 *
 * @param host The CloudFront hostname
 * @param path The request path
 * @param signature The request signature (if any)
 * @param acceptHeader The Accept header to send
 * @returns Buffer with AVIF data if cache hit, null if cache miss
 */
async function checkOriginShieldCache(
  host: string,
  path: string,
  signature?: string,
  acceptHeader?: string
): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const fullPath = signature ? `${path}?signature=${signature}` : path;

    console.info(`Cache-check: probing Origin Shield for ${host}${fullPath}`);

    const req = https.request(
      {
        hostname: host,
        path: fullPath,
        method: "GET",
        headers: {
          "x-bw-cache-check": "1",
          accept: acceptHeader || "image/avif,image/webp,*/*",
        },
        timeout: 5000, // 5 second timeout - fail fast to 302
      },
      (res) => {
        const xCache = res.headers?.["x-cache"] || "N/A";
        const contentType = res.headers?.["content-type"] || "N/A";
        console.info(`Cache-check response: status=${res.statusCode}, x-cache=${xCache}, content-type=${contentType}`);

        // Only accept 200 with AVIF content-type as cache hit
        if (res.statusCode === 200 && contentType.includes("image/avif")) {
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            console.info(`Cache-check HIT: received ${Buffer.concat(chunks).length} bytes`);
            resolve(Buffer.concat(chunks));
          });
        } else {
          // Cache miss (204) or unexpected response
          res.resume();
          console.info("Cache-check MISS: Origin Shield does not have cached AVIF");
          resolve(null);
        }
      }
    );

    req.on("error", (err) => {
      console.error("Cache-check request failed:", err.message);
      resolve(null);
    });

    req.on("timeout", () => {
      console.error("Cache-check request timed out");
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}
