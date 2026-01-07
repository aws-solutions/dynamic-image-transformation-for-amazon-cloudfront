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
 * Handles progressive loading for AVIF images using proxy-based cache warming.
 *
 * The problem: Lambda warming populates IAD cache, but remote edges (CDG, LHR, etc.)
 * never see the warmed AVIF because they have separate caches.
 *
 * Solution: Lambda proxies ALL cache-miss requests through its local CDN (IAD).
 * - If IAD has cached AVIF, proxy hits it and returns AVIF to original edge
 * - If IAD is cold, Lambda returns 302 + triggers async warming
 * - Either way, the original edge caches whatever Lambda returns
 *
 * Flow (using x-bw-proxy FLAG header):
 * 1. Original request (no FLAG) → Lambda proxies to CloudFront WITH FLAG
 * 2. Proxied request (has FLAG) → Lambda does progressive loading (302 + async warm)
 * 3. Subsequent requests → Cache hit at any edge (no Lambda)
 *
 * @param event The Lambda event
 * @param payload The normalized payload
 * @param secretProvider The secret provider for signature generation
 * @returns A 302 redirect (first hit) or the proxied AVIF response
 */
export async function handleProgressiveLoading(
  event: ImageHandlerEvent,
  payload: NormalizedPayload,
  secretProvider: SecretProvider
): Promise<ImageHandlerExecutionResult> {
  // Get Accept header from original request - needed for cache key matching
  const acceptHeader = event.headers?.Accept || event.headers?.accept;
  // Use CloudFront domain from environment variable for warming requests
  // The Host header contains API Gateway domain, not CloudFront
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
  const hostHeader = event.headers?.Host || event.headers?.host;

  if (!cloudfrontDomain) {
    console.error(
      `CLOUDFRONT_DOMAIN env var is NOT SET. Host header value: "${hostHeader}". ` +
        "Warming requests will fail or go to wrong domain (API Gateway instead of CloudFront). " +
        "Please set CLOUDFRONT_DOMAIN environment variable in your Lambda configuration."
    );
  }

  const host = cloudfrontDomain || hostHeader;

  if (!host) {
    throw new Error("CLOUDFRONT_DOMAIN environment variable is required for progressive loading");
  }

  // Check for proxy FLAG header - indicates this is a proxied request from ourselves
  const isProxiedRequest = event.headers?.["x-bw-proxy"] === "1" || event.headers?.["X-Bw-Proxy"] === "1";

  console.info(
    `Progressive loading: domain=${host} (from ${cloudfrontDomain ? "env" : "header"}), ` +
      `isProxied=${isProxiedRequest}`
  );

  if (!isProxiedRequest) {
    // Original request (no FLAG) - proxy it through our local CDN (IAD)
    // This ensures we hit Origin Shield cache, which may have warmed AVIF
    console.info("Original request detected, proxying through local CDN with FLAG header");
    return await proxyThroughLocalCDN(host, event.path, event.queryStringParameters?.signature, acceptHeader);
  }

  // Proxied request (has FLAG) - do normal progressive loading: 302 + async warming
  console.info("Proxied request detected, doing progressive loading (302 + async warm)");

  // 1. Build JPEG URL (same payload without avif key)
  const jpegPayload = createJpegOnlyPayload(payload);
  const jpegPayloadDenormalized = denormalizePayload(jpegPayload);
  const jpegPath = "/" + Buffer.from(JSON.stringify(jpegPayloadDenormalized)).toString("base64");

  // 2. Generate signature for JPEG URL (if signatures enabled)
  let jpegUrl = `https://${host}${jpegPath}`;
  if (process.env.ENABLE_SIGNATURE === "Yes") {
    const signature = await generateSignature(jpegPath, secretProvider);
    jpegUrl += `?signature=${signature}`;
  }

  // 3. Trigger async warming via Lambda self-invoke (ensures completion before termination)
  await triggerAsyncWarmingOrchestrator(host, event.path, event.queryStringParameters?.signature, acceptHeader);

  // 4. Return 302 redirect to JPEG
  // Use very short max-age (1s) to minimize time users see redirect while allowing
  // CloudFront to "reset" its cache behavior after the 302 expires.
  // The async warming typically completes in 2-3s, so users requesting after that
  // will get the cached AVIF.
  return {
    statusCode: StatusCodes.REDIRECT,
    isBase64Encoded: false,
    headers: {
      Location: jpegUrl,
      "Cache-Control": "private, max-age=1",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
    body: "",
  };
}

/**
 * Proxies a request through the local CDN (Lambda's region, typically IAD).
 * This allows Lambda to check if Origin Shield has a cached AVIF.
 *
 * The FLAG header (x-bw-proxy: 1) tells the receiving Lambda that this is a
 * proxied request and should do progressive loading instead of proxying again.
 *
 * @param host The CloudFront hostname
 * @param path The request path
 * @param signature The request signature (if any)
 * @param acceptHeader The Accept header from the original request
 * @returns The proxied response (either AVIF from cache, or 302 redirect)
 */
async function proxyThroughLocalCDN(
  host: string,
  path: string,
  signature?: string,
  acceptHeader?: string
): Promise<ImageHandlerExecutionResult> {
  const url = signature ? `https://${host}${path}?signature=${signature}` : `https://${host}${path}`;

  console.info(`Proxying request through local CDN with FLAG: ${url}`);

  return new Promise((resolve) => {
    const parsedUrl = new URL(url);

    const headers: Record<string, string> = {
      "x-bw-proxy": "1", // FLAG: marks this as a proxied request
    };
    if (acceptHeader) {
      headers["accept"] = acceptHeader;
    }

    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers,
        timeout: 25000,
      },
      (res) => {
        const chunks: Buffer[] = [];

        res.on("data", (chunk) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const body = Buffer.concat(chunks);
          const contentType = res.headers?.["content-type"] || "image/avif";
          const xCache = res.headers?.["x-cache"] || "N/A";

          console.info(
            `Proxy request completed: status=${res.statusCode}, content-type=${contentType}, ` +
              `x-cache=${xCache}, size=${body.length}`
          );

          // Handle redirect (302) - this means IAD cache was cold, pass redirect to client
          if (res.statusCode === 302 || res.statusCode === 301) {
            const location = res.headers?.["location"];
            console.info(`IAD cache miss, returning redirect to client: ${location}`);
            resolve({
              statusCode: res.statusCode as StatusCodes,
              isBase64Encoded: false,
              headers: {
                Location: location || "",
                "Cache-Control": "private, max-age=1",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
              },
              body: "",
            });
            return;
          }

          // Return the image (AVIF from IAD cache hit)
          // This will be cached by the original edge location
          console.info("IAD cache hit, returning AVIF to be cached at original edge");
          resolve({
            statusCode: StatusCodes.OK,
            isBase64Encoded: true,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000",
              "Access-Control-Allow-Origin": "*",
            },
            body: body.toString("base64"),
          });
        });
      }
    );

    req.on("error", (err) => {
      console.error("Proxy request failed:", err.message);
      resolve({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        isBase64Encoded: false,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: err.message }),
      });
    });

    req.on("timeout", () => {
      console.error("Proxy request timed out");
      req.destroy();
      resolve({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        isBase64Encoded: false,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "timeout" }),
      });
    });

    req.end();
  });
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
        timeout: 25000, // 25 second timeout (Lambda has 29s)
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
