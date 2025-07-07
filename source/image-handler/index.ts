// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import {
  S3Client,
  WriteGetObjectResponseCommand,
  WriteGetObjectResponseCommandInput,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { getOptions } from "../solution-utils/get-options";
import { isNullOrWhiteSpace } from "../solution-utils/helpers";
import { ImageHandler } from "./image-handler";
import { ImageRequest } from "./image-request";
import {
  Headers,
  ImageHandlerError,
  ImageHandlerEvent,
  ImageHandlerExecutionResult,
  S3Event,
  S3GetObjectEvent,
  S3HeadObjectResult,
  RequestTypes,
  StatusCodes,
} from "./lib";
import { SecretProvider } from "./secret-provider";
// eslint-disable-next-line import/no-unresolved
import { Context } from "aws-lambda";

const awsSdkOptions = getOptions();
const s3Client = new S3Client({ ...awsSdkOptions, followRegionRedirects: true });
const rekognitionClient = new RekognitionClient(awsSdkOptions);
const secretsManagerClient = new SecretsManagerClient(awsSdkOptions);
const secretProvider = new SecretProvider(secretsManagerClient);

const LAMBDA_PAYLOAD_LIMIT = 6 * 1024 * 1024;

/**
 * Image handler Lambda handler.
 * @param event The image handler request event.
 * @param context The request context
 * @returns Processed request response.
 */
export async function handler(
  event: ImageHandlerEvent | S3Event,
  context: Context = undefined
): Promise<void | ImageHandlerExecutionResult | S3HeadObjectResult> {
  const { ENABLE_S3_OBJECT_LAMBDA } = process.env;

  const normalizedEvent = normalizeEvent(event, ENABLE_S3_OBJECT_LAMBDA);
  console.info(`Path: ${normalizedEvent.path}`);
  console.info(`QueryParams: ${JSON.stringify(normalizedEvent.queryStringParameters)}`);

  const response = handleRequest(normalizedEvent);
  // If deployment is set to use an API Gateway origin
  if (ENABLE_S3_OBJECT_LAMBDA !== "Yes") {
    return response;
  }

  // Assume request is from Object Lambda
  const { timeoutPromise, timeoutId } = createS3ObjectLambdaTimeout(context);
  const finalResponse = await Promise.race([response, timeoutPromise]);
  clearTimeout(timeoutId);

  const responseHeaders = buildResponseHeaders(finalResponse);

  // Check if getObjectContext is not in event, indicating a HeadObject request
  if (!("getObjectContext" in event)) {
    console.info(`Invalid S3GetObjectEvent, assuming HeadObject request. Status: ${finalResponse.statusCode}`);

    return {
      statusCode: finalResponse.statusCode,
      headers: { ...responseHeaders, "Content-Length": finalResponse.body.length },
    };
  }

  const getObjectEvent = event as S3GetObjectEvent;
  const params = buildWriteResponseParams(getObjectEvent, finalResponse, responseHeaders);
  try {
    await s3Client.send(new WriteGetObjectResponseCommand(params));
  } catch (error) {
    console.error("Error occurred while writing the response to S3 Object Lambda.", error);
    const errorParams = buildErrorResponseParams(
      getObjectEvent,
      new ImageHandlerError(
        StatusCodes.BAD_REQUEST,
        "S3ObjectLambdaWriteError",
        "It was not possible to write the response to S3 Object Lambda."
      )
    );
    await s3Client.send(new WriteGetObjectResponseCommand(errorParams));
  }
}

/**
 * Image handler request handler.
 * @param event The normalized request event.
 * @returns Processed request response.
 */
async function handleRequest(event: ImageHandlerEvent): Promise<ImageHandlerExecutionResult> {
  const { ENABLE_S3_OBJECT_LAMBDA } = process.env;

  const imageRequest = new ImageRequest(s3Client, secretProvider);
  const imageHandler = new ImageHandler(s3Client, rekognitionClient);
  const isAlb = event.requestContext && Object.prototype.hasOwnProperty.call(event.requestContext, "elb");
  try {
    const imageRequestInfo = await imageRequest.setup(event);
    console.info(imageRequestInfo);

    let processedRequest: Buffer | string = await imageHandler.process(imageRequestInfo);

    if (ENABLE_S3_OBJECT_LAMBDA !== "Yes") {
      processedRequest = processedRequest.toString("base64");

      // binary data need to be base64 encoded to pass to the API Gateway proxy https://docs.aws.amazon.com/apigateway/latest/developerguide/lambda-proxy-binary-media.html.
      // checks whether base64 encoded image fits in 6M limit, see https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html.
      if (processedRequest.length > LAMBDA_PAYLOAD_LIMIT) {
        throw new ImageHandlerError(
          StatusCodes.REQUEST_TOO_LONG,
          "TooLargeImageException",
          "The converted image is too large to return."
        );
      }
    }

    let headers: Headers = {};
    // Define headers that can be overwritten
    headers["Cache-Control"] = imageRequestInfo.cacheControl;

    // Apply the custom headers
    if (imageRequestInfo.headers) {
      headers = { ...headers, ...imageRequestInfo.headers };
    }
    // If expires query param is included, override max caching age
    if (imageRequestInfo.secondsToExpiry !== undefined) {
      headers["Cache-Control"] = "max-age=" + imageRequestInfo.secondsToExpiry + ",public";
    }

    headers = { ...headers, ...getResponseHeaders(false, isAlb) };
    headers["Content-Type"] = imageRequestInfo.contentType;
    headers["Expires"] = imageRequestInfo.expires;
    headers["Last-Modified"] = imageRequestInfo.lastModified;

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
        return await handleDefaultFallbackImage(imageRequest, event, isAlb, error);
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
 * Builds error response parameters for S3 Object Lambda WriteGetObjectResponse.
 * Takes an error event and constructs a response with appropriate status code,
 * error body, and cache control settings.
 * @param getObjectEvent - The S3 GetObject event containing output route and token
 * @param error - The ImageHandlerError containing status code and error details
 * @returns WriteGetObjectResponseRequest - Parameters for error response including:
 *   - RequestRoute: Output route from the event context
 *   - RequestToken: Output token from the event context
 *   - Body: Error message body
 *   - Metadata: Contains the error status code
 *   - CacheControl: Set to "max-age-10,public" for error responses
 */
function buildErrorResponseParams(getObjectEvent, error: ImageHandlerError) {
  const { statusCode, body } = getErrorResponse(error);
  const params: WriteGetObjectResponseCommandInput = {
    RequestRoute: getObjectEvent.getObjectContext.outputRoute,
    RequestToken: getObjectEvent.getObjectContext.outputToken,
    Body: body,
    Metadata: {
      StatusCode: JSON.stringify(statusCode),
    },
    CacheControl: "max-age-10,public",
  };
  return params;
}

/**
 * Processes and sanitizes response headers for the image handler.
 * Filters out undefined header values, URI encodes remaining values,
 * and sets appropriate Cache-Control headers based on response status code.
 * @param finalResponse - The execution result
 * @returns Record<string, string> - Processed headers with encoded values and cache settings
 *
 * Cache-Control rules:
 * - 4xx errors: max-age=10,public
 * - 5xx errors: max-age=600,public
 */
function buildResponseHeaders(finalResponse: ImageHandlerExecutionResult): Record<string, string> {
  const filteredHeaders = Object.entries(finalResponse.headers).filter(([_, value]) => value !== undefined);
  let responseHeaders = Object.fromEntries(filteredHeaders);

  responseHeaders = Object.fromEntries(
    Object.entries(responseHeaders).map(([key, value]) => [key, encodeURI(value).replace(/%20/g, " ")])
  );
  if (finalResponse.statusCode >= 400 && finalResponse.statusCode <= 499) {
    responseHeaders["Cache-Control"] = "max-age=10,public";
  }
  if (finalResponse.statusCode >= 500 && finalResponse.statusCode < 599) {
    responseHeaders["Cache-Control"] = "max-age=600,public";
  }
  return responseHeaders;
}

/**
 * Builds parameters for S3 Object Lambda's WriteGetObjectResponse operation.
 * Processes response headers and metadata, handling Cache-Control separately
 * and encoding remaining headers as metadata.
 * @param getObjectEvent - The S3 GetObject event containing output route and token
 * @param finalResponse - The execution result containing response body and status code
 * @param responseHeaders - Key-value pairs of response headers to be processed
 * @returns WriteGetObjectResponseRequest parameters including body, routing info, and metadata
 */
function buildWriteResponseParams(
  getObjectEvent: S3GetObjectEvent,
  finalResponse: ImageHandlerExecutionResult,
  responseHeaders: { [k: string]: string }
): WriteGetObjectResponseCommandInput {
  const params: WriteGetObjectResponseCommandInput = {
    Body: finalResponse.body,
    RequestRoute: getObjectEvent.getObjectContext.outputRoute,
    RequestToken: getObjectEvent.getObjectContext.outputToken,
  };

  if (responseHeaders["Cache-Control"]) {
    params.CacheControl = responseHeaders["Cache-Control"];
    delete responseHeaders["Cache-Control"];
  }

  params.Metadata = {
    StatusCode: JSON.stringify(finalResponse.statusCode),
    ...responseHeaders,
  };
  return params;
}

/**
 * Retrieve the default fallback image and construct the ImageHandlerExecutionResult
 * @param imageRequest The ImageRequest object
 * @param event The Lambda Event object
 * @param isAlb Whether we're behind an ALB
 * @param error The error that resulted in us getting the fallback image
 * @returns Processed request response for fallback image
 * @
 */
export async function handleDefaultFallbackImage(
  imageRequest: ImageRequest,
  event: ImageHandlerEvent,
  isAlb: boolean,
  error
): Promise<ImageHandlerExecutionResult> {
  const { DEFAULT_FALLBACK_IMAGE_BUCKET, DEFAULT_FALLBACK_IMAGE_KEY, ENABLE_S3_OBJECT_LAMBDA } = process.env;
  const defaultFallbackImage = await s3Client.send(
    new GetObjectCommand({
      Bucket: DEFAULT_FALLBACK_IMAGE_BUCKET,
      Key: DEFAULT_FALLBACK_IMAGE_KEY,
    })
  );

  const headers = getResponseHeaders(false, isAlb);
  headers["Content-Type"] = defaultFallbackImage.ContentType;
  headers["Last-Modified"] = defaultFallbackImage.LastModified;
  try {
    headers["Cache-Control"] = imageRequest.parseImageHeaders(event, RequestTypes.DEFAULT)?.["Cache-Control"];
  } catch {}

  // Prioritize Cache-Control header attached to the fallback image followed by Cache-Control header provided in request, followed by the default
  headers["Cache-Control"] = defaultFallbackImage.CacheControl ?? headers["Cache-Control"] ?? "max-age=31536000,public";

  return {
    statusCode: error.status ? error.status : StatusCodes.INTERNAL_SERVER_ERROR,
    isBase64Encoded: true,
    headers,
    body:
      ENABLE_S3_OBJECT_LAMBDA === "Yes"
        ? Buffer.from(await defaultFallbackImage.Body.transformToByteArray())
        : await defaultFallbackImage.Body.transformToString("base64"),
  };
}

/**
 * Creates a timeout promise to write a graceful response if S3 Object Lambda processing won't finish in time
 * @param context The Image Handler request context
 * @returns A promise that resolves with the ImageHandlerExecutionResult to write to the response, as well as the timeoutID to allow for cancellation.
 */
function createS3ObjectLambdaTimeout(
  context: Context
  // eslint-disable-next-line no-undef
): { timeoutPromise: Promise<ImageHandlerExecutionResult>; timeoutId: NodeJS.Timeout } {
  let timeoutId;
  const timeoutPromise = new Promise<ImageHandlerExecutionResult>((resolve) => {
    timeoutId = setTimeout(() => {
      const error = new ImageHandlerError(StatusCodes.TIMEOUT, "TimeoutException", "Image processing timed out.");
      const { statusCode, body } = getErrorResponse(error);
      // Call writeGetObjectResponse when the timeout is approaching
      resolve({
        statusCode,
        isBase64Encoded: false,
        headers: getResponseHeaders(true),
        body,
      });
    }, Math.max(context.getRemainingTimeInMillis() - 1000, 0)); // 30 seconds in milliseconds
  });
  return { timeoutPromise, timeoutId };
}

/**
 * Generates a normalized event usable by the event handler regardless of which infrastructure is being used(RestAPI or S3 Object Lambda).
 * @param event The RestAPI event (ImageHandlerEvent) or S3 Object Lambda event (S3GetObjectEvent).
 * @param s3ObjectLambdaEnabled Whether we're using the S3 Object Lambda or RestAPI infrastructure.
 * @returns Normalized ImageHandlerEvent object
 */
export function normalizeEvent(event: ImageHandlerEvent | S3Event, s3ObjectLambdaEnabled: string): ImageHandlerEvent {
  if (s3ObjectLambdaEnabled === "Yes") {
    const { userRequest } = event as S3Event;
    const fullPath = userRequest.url.split(userRequest.headers.Host)[1];
    const [pathString, queryParamsString] = fullPath.split("?");

    // S3 Object Lambda blocks certain query params including `signature` and `expires`, we use ol- as a prefix to overcome this.
    const queryParams = extractObjectLambdaQueryParams(queryParamsString);
    return {
      // URLs from S3 Object Lambda include the origin path
      path: pathString.split("/image").slice(1).join("/image"),
      queryStringParameters: queryParams,
      requestContext: {},
      headers: userRequest.headers,
    };
  }
  return event as ImageHandlerEvent;
}

/**
 * Extracts 'ol-' prefixed query parameters from the query string. The `ol-` prefix is used to overcome
 * S3 Object Lambda restrictions on what query parameters can be sent.
 * @param queryString The querystring attached to the end of the initial URL
 * @returns A dictionary of query params
 */
function extractObjectLambdaQueryParams(queryString: string | undefined): { [key: string]: string } {
  const results = {};
  if (queryString === undefined) {
    return results;
  }

  for (const [key, value] of new URLSearchParams(queryString).entries()) {
    results[key.slice(0, 3).replace("ol-", "") + key.slice(3)] = value;
  }
  return results;
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
    headers["Access-Control-Allow-Credentials"] = "true";
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
  return {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    body: JSON.stringify({
      message: "Internal error. Please contact the system administrator.",
      code: "InternalError",
      status: StatusCodes.INTERNAL_SERVER_ERROR,
    }),
  };
}
