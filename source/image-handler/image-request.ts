// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createHmac } from "crypto";

import {
  ContentTypes,
  DefaultImageRequest,
  Headers,
  ImageEdits,
  ImageFormatTypes,
  ImageHandlerError,
  ImageHandlerEvent,
  ImageRequestInfo,
  RequestTypes,
  StatusCodes,
  HEADER_DENY_LIST,
} from "./lib";
import { SecretProvider } from "./secret-provider";
import { ThumborMapper } from "./thumbor-mapper";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import { QueryParamMapper } from "./query-param-mapper";
dayjs.extend(customParseFormat);
dayjs.extend(utc);

type OriginalImageInfo = Partial<{
  contentType: string;
  expires: string;
  lastModified: string;
  cacheControl: string;
  originalImage: Buffer;
}>;

export class ImageRequest {
  private static readonly DEFAULT_EFFORT = 4;

  constructor(private readonly s3Client: S3Client, private readonly secretProvider: SecretProvider) {}

  /**
   * Determines the output format of an image
   * @param imageRequestInfo Initialized image request information
   * @param event Lambda requrest body
   */
  private determineOutputFormat(imageRequestInfo: ImageRequestInfo, event: ImageHandlerEvent): void {
    const outputFormat = this.getOutputFormat(event, imageRequestInfo.requestType);
    // if webp check reduction effort, if invalid value, use 4 (default in sharp)
    if (outputFormat === ImageFormatTypes.WEBP && imageRequestInfo.requestType === RequestTypes.DEFAULT) {
      const decoded = this.decodeRequest(event);
      if (typeof decoded.effort !== "undefined") {
        const effort = Math.trunc(decoded.effort);
        const isValid = !isNaN(effort) && effort >= 0 && effort <= 6;
        imageRequestInfo.effort = isValid ? effort : ImageRequest.DEFAULT_EFFORT;
      }
    }
    if (imageRequestInfo.edits?.toFormat) {
      imageRequestInfo.outputFormat = imageRequestInfo.edits.toFormat;
    } else if (outputFormat) {
      imageRequestInfo.outputFormat = outputFormat;
    }
  }

  /**
   * Fix quality for Thumbor and Custom request type if outputFormat is different from quality type.
   * @param imageRequestInfo Initialized image request information
   */
  private fixQuality(imageRequestInfo: ImageRequestInfo): void {
    if (imageRequestInfo.outputFormat) {
      const requestType = [RequestTypes.CUSTOM, RequestTypes.THUMBOR];
      const acceptedValues = [
        ImageFormatTypes.JPEG,
        ImageFormatTypes.PNG,
        ImageFormatTypes.WEBP,
        ImageFormatTypes.TIFF,
        ImageFormatTypes.HEIF,
        ImageFormatTypes.GIF,
        ImageFormatTypes.AVIF,
      ];

      imageRequestInfo.contentType = `image/${imageRequestInfo.outputFormat}`;
      if (
        requestType.includes(imageRequestInfo.requestType) &&
        acceptedValues.includes(imageRequestInfo.outputFormat)
      ) {
        const qualityKey = Object.keys(imageRequestInfo.edits).filter((key) =>
          acceptedValues.includes(key as ImageFormatTypes)
        )[0];

        if (qualityKey && qualityKey !== imageRequestInfo.outputFormat) {
          imageRequestInfo.edits[imageRequestInfo.outputFormat] = imageRequestInfo.edits[qualityKey];
          delete imageRequestInfo.edits[qualityKey];
        }
      }
    }
  }

  /**
   * Initializer function for creating a new image request, used by the image handler to perform image modifications.
   * @param event Lambda request body.
   * @returns Initialized image request information.
   */
  public async setup(event: ImageHandlerEvent): Promise<ImageRequestInfo> {
    try {
      await this.validateRequestSignature(event);
      const secondsToExpiry = this.validateRequestExpires(event);

      let imageRequestInfo: ImageRequestInfo = <ImageRequestInfo>{};
      imageRequestInfo.secondsToExpiry = secondsToExpiry;

      imageRequestInfo.requestType = this.parseRequestType(event);
      imageRequestInfo.bucket = this.parseImageBucket(event, imageRequestInfo.requestType);
      imageRequestInfo.key = this.parseImageKey(event, imageRequestInfo.requestType, imageRequestInfo.bucket);
      imageRequestInfo.edits = this.parseImageEdits(event, imageRequestInfo.requestType);
      imageRequestInfo.edits = this.parseQueryParamEdits(event, imageRequestInfo.edits);

      const originalImage = await this.getOriginalImage(imageRequestInfo.bucket, imageRequestInfo.key);
      imageRequestInfo = { ...imageRequestInfo, ...originalImage };

      imageRequestInfo.headers = this.parseImageHeaders(event, imageRequestInfo.requestType);

      // If the original image is SVG file and it has any edits but no output format, change the format to PNG.
      if (
        imageRequestInfo.contentType === ContentTypes.SVG &&
        imageRequestInfo.edits &&
        Object.keys(imageRequestInfo.edits).length > 0 &&
        !imageRequestInfo.edits.toFormat
      ) {
        imageRequestInfo.outputFormat = ImageFormatTypes.PNG;
      }

      /* Decide the output format of the image.
       * 1) If the format is provided, the output format is the provided format.
       * 2) If headers contain "Accept: image/webp", the output format is webp.
       * 3) Use the default image format for the rest of cases.
       */
      if (
        imageRequestInfo.contentType !== ContentTypes.SVG ||
        imageRequestInfo.edits.toFormat ||
        imageRequestInfo.outputFormat
      ) {
        this.determineOutputFormat(imageRequestInfo, event);
      }

      // Fix quality for Thumbor and Custom request type if outputFormat is different from quality type.
      this.fixQuality(imageRequestInfo);

      return imageRequestInfo;
    } catch (error) {
      console.error(error);

      throw error;
    }
  }

  /**
   * Gets the original image from an Amazon S3 bucket.
   * @param bucket The name of the bucket containing the image.
   * @param key The key name corresponding to the image.
   * @returns The original image or an error.
   */
  public async getOriginalImage(bucket: string, key: string): Promise<OriginalImageInfo> {
    try {
      const result: OriginalImageInfo = {};

      const imageLocation = { Bucket: bucket, Key: key };
      let originalImage;
      try {
        console.info("Getting image from S3:", imageLocation);
        originalImage = await this.s3Client.send(new GetObjectCommand(imageLocation));
      } catch (error) {
        console.error(error);
        throw new ImageHandlerError(
          StatusCodes.NOT_FOUND,
          "NoSuchKey",
          `The image ${key} does not exist or the request may not be base64 encoded properly.`
        );
      }
      const imageBuffer = Buffer.from(await originalImage.Body.transformToByteArray());
      // Infer from hex headers if provided content type is not supported
      if (originalImage.ContentType) {
        result.contentType = Object.values(ContentTypes).includes(originalImage.ContentType)
          ? originalImage.ContentType
          : this.inferImageType(imageBuffer);
      } else {
        result.contentType = "image";
      }

      if (originalImage.Expires) {
        result.expires = new Date(originalImage.Expires).toUTCString();
      }

      if (originalImage.LastModified) {
        result.lastModified = new Date(originalImage.LastModified).toUTCString();
      }

      result.cacheControl = originalImage.CacheControl ?? "max-age=31536000,public";
      result.originalImage = imageBuffer;

      return result;
    } catch (error) {
      console.error(error);
      if (error instanceof ImageHandlerError) throw error;
      throw new ImageHandlerError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "ImageRetrieval::CannotRetrieveImage",
        "Image could not be retrieved from S3."
      );
    }
  }

  /**
   * Parses the name of the appropriate Amazon S3 bucket to source the original image from.
   * @param event Lambda request body.
   * @param requestType Image handler request type.
   * @returns The name of the appropriate Amazon S3 bucket.
   */
  public parseImageBucket(event: ImageHandlerEvent, requestType: RequestTypes): string {
    if (requestType === RequestTypes.DEFAULT) {
      // Decode the image request
      const request = this.decodeRequest(event);

      if (request.bucket !== undefined) {
        // Check the provided bucket against the allowed list
        const sourceBuckets = getAllowedSourceBuckets();

        if (sourceBuckets.includes(request.bucket)) {
          return request.bucket;
        } else {
          throw new ImageHandlerError(
            StatusCodes.FORBIDDEN,
            "ImageBucket::CannotAccessBucket",
            "The bucket you specified could not be accessed. Please check that the bucket is specified in your SOURCE_BUCKETS."
          );
        }
      } else {
        // Try to use the default image source bucket env var
        const sourceBuckets = getAllowedSourceBuckets();
        return sourceBuckets[0];
      }
    } else if (requestType === RequestTypes.THUMBOR || requestType === RequestTypes.CUSTOM) {
      // Use the default image source bucket env var
      const sourceBuckets = getAllowedSourceBuckets();
      // Take the path and split it at "/" to get each "word" in the url as array
      let potentialBucket = event.path
        .split("/")
        .filter((e) => e.startsWith("s3:"))
        .map((e) => e.replace("s3:", ""));
      // filter out all parts that are not a bucket-url
      potentialBucket = potentialBucket.filter((e) => sourceBuckets.includes(e));
      // return the first match
      if (potentialBucket.length > 0) {
        console.info("Bucket override - chosen bucket: ", potentialBucket[0]);
        return potentialBucket[0];
      }
      return sourceBuckets[0];
    } else {
      throw new ImageHandlerError(
        StatusCodes.NOT_FOUND,
        "ImageBucket::CannotFindBucket",
        "The bucket you specified could not be found. Please check the spelling of the bucket name in your request."
      );
    }
  }

  /**
   * Parses the edits to be made to the original image.
   * @param event Lambda request body.
   * @param requestType Image handler request type.
   * @returns The edits to be made to the original image.
   */
  public parseImageEdits(event: ImageHandlerEvent, requestType: RequestTypes): ImageEdits {
    if (requestType === RequestTypes.DEFAULT) {
      const decoded = this.decodeRequest(event);
      return decoded.edits;
    } else if (requestType === RequestTypes.THUMBOR) {
      const thumborMapping = new ThumborMapper();
      return thumborMapping.mapPathToEdits(event.path);
    } else if (requestType === RequestTypes.CUSTOM) {
      const thumborMapping = new ThumborMapper();
      const parsedPath = thumborMapping.parseCustomPath(event.path);
      return thumborMapping.mapPathToEdits(parsedPath);
    } else {
      throw new ImageHandlerError(
        StatusCodes.BAD_REQUEST,
        "ImageEdits::CannotParseEdits",
        "The edits you provided could not be parsed. Please check the syntax of your request and refer to the documentation for additional guidance."
      );
    }
  }

  /**
   * Parses query parameters to generate image edits
   * @param event - Lambda event containing query parameters
   * @param edits - Existing image edits to merge with
   * @returns Combined image edits
   */
  public parseQueryParamEdits(event: ImageHandlerEvent, edits: ImageEdits): ImageEdits {
    if (event.queryStringParameters) {
      const queryParamMapping = new QueryParamMapper();
      const newEdits = queryParamMapping.mapQueryParamsToEdits(event.queryStringParameters);
      if (Object.keys(newEdits).length > 0) {
        console.info(`Query param edits: ${JSON.stringify(newEdits)}`);
        return { ...edits, ...newEdits };
      }
    }
    return edits;
  }

  /**
   * Parses the name of the appropriate Amazon S3 key corresponding to the original image.
   * @param event Lambda request body.
   * @param requestType Type of the request.
   * @param bucket The bucket name if the s3:bucketName tag was provided
   * @returns The name of the appropriate Amazon S3 key.
   */
  public parseImageKey(event: ImageHandlerEvent, requestType: RequestTypes, bucket: string = null): string {
    if (requestType === RequestTypes.DEFAULT) {
      // Decode the image request and return the image key
      const { key } = this.decodeRequest(event);
      return key;
    }

    if (requestType === RequestTypes.THUMBOR || requestType === RequestTypes.CUSTOM) {
      let { path } = event;

      if (requestType === RequestTypes.CUSTOM) {
        const { REWRITE_MATCH_PATTERN, REWRITE_SUBSTITUTION } = process.env;

        if (typeof REWRITE_MATCH_PATTERN === "string") {
          const patternStrings = REWRITE_MATCH_PATTERN.split("/");
          const flags = patternStrings.pop();
          const parsedPatternString = REWRITE_MATCH_PATTERN.slice(1, REWRITE_MATCH_PATTERN.length - 1 - flags.length);
          const regExp = new RegExp(parsedPatternString, flags);

          path = path.replace(regExp, REWRITE_SUBSTITUTION);
        } else {
          path = path.replace(REWRITE_MATCH_PATTERN, REWRITE_SUBSTITUTION);
        }
      }

      return decodeURIComponent(
        path
          .replace(/\/\d+x\d+:\d+x\d+(?=\/)/g, "")
          .replace(/\/\d+x\d+(?=\/)/g, "")
          .replace(/filters:watermark\(.*\)/u, "")
          .replace(/filters:[^/]+/g, "")
          .replace(/\/fit-in(?=\/)/g, "")
          .replace(new RegExp("s3:" + bucket + "/"), "")
          .replace(/^\/+/g, "")
          .replace(/^\/+/, "")
      );
    }

    // Return an error for all other conditions
    throw new ImageHandlerError(
      StatusCodes.NOT_FOUND,
      "ImageEdits::CannotFindImage",
      "The image you specified could not be found. Please check your request syntax as well as the bucket you specified to ensure it exists."
    );
  }

  /**
   * Determines how to handle the request being made based on the URL path prefix to the image request.
   * Categorizes a request as either "image" (uses the Sharp library), "thumbor" (uses Thumbor mapping), or "custom" (uses the rewrite function).
   * @param event Lambda request body.
   * @returns The request type.
   */
  public parseRequestType(event: ImageHandlerEvent): RequestTypes {
    const { path } = event;
    const matchDefault = /^(\/?)([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    const matchThumbor1 = /^(\/?)((fit-in)?|(filters:.+\(.?\))?|(unsafe)?)/i;
    const matchThumbor2 = /^((.(?!(\.[^.\\/]+$)))*$)/i; // NOSONAR
    const matchThumbor3 = /.*(\.jpg$|\.jpeg$|.\.png$|\.webp$|\.tiff$|\.tif$|\.svg$|\.gif$|\.avif$)/i; // NOSONAR
    const { REWRITE_MATCH_PATTERN, REWRITE_SUBSTITUTION } = process.env;
    const definedEnvironmentVariables =
      REWRITE_MATCH_PATTERN !== "" &&
      REWRITE_SUBSTITUTION !== "" &&
      REWRITE_MATCH_PATTERN !== undefined &&
      REWRITE_SUBSTITUTION !== undefined;

    // Check if path is base 64 encoded
    let isBase64Encoded = true;
    try {
      this.decodeRequest(event);
    } catch (error) {
      console.info("Path is not base64 encoded.");
      isBase64Encoded = false;
    }

    if (matchDefault.test(path) && isBase64Encoded) {
      // use sharp
      return RequestTypes.DEFAULT;
    } else if (definedEnvironmentVariables) {
      // use rewrite function then thumbor mappings
      return RequestTypes.CUSTOM;
    } else if (matchThumbor1.test(path) && (matchThumbor2.test(path) || matchThumbor3.test(path))) {
      // use thumbor mappings
      return RequestTypes.THUMBOR;
    } else {
      throw new ImageHandlerError(
        StatusCodes.BAD_REQUEST,
        "RequestTypeError",
        "The type of request you are making could not be processed. Please ensure that your original image is of a supported file type (jpg/jpeg, png, tiff/tif, webp, svg, gif, avif) and that your image request is provided in the correct syntax. Refer to the documentation for additional guidance on forming image requests."
      );
    }
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Parses the headers to be sent with the response.
   * @param event Lambda request body.
   * @param requestType Image handler request type.
   * @returns (optional) The headers to be sent with the response.
   */
  public parseImageHeaders(event: ImageHandlerEvent, requestType: RequestTypes): Headers {
    if (requestType === RequestTypes.DEFAULT) {
      const { headers } = this.decodeRequest(event);
      if (headers) {
        return filterRestrictedHeaders(headers);
      }
    }
  }

  /**
   * Decodes the base64-encoded image request path associated with default image requests.
   * Provides error handling for invalid or undefined path values.
   * @param event Lambda request body.
   * @returns The decoded from base-64 image request.
   */
  public decodeRequest(event: ImageHandlerEvent): DefaultImageRequest {
    const { path } = event;

    if (path) {
      const encoded = path.startsWith("/") ? path.slice(1) : path;
      const toBuffer = Buffer.from(encoded, "base64");
      try {
        // To support European characters, 'ascii' was removed.
        return JSON.parse(toBuffer.toString());
      } catch (error) {
        throw new ImageHandlerError(
          StatusCodes.BAD_REQUEST,
          "DecodeRequest::CannotDecodeRequest",
          "The image request you provided could not be decoded. Please check that your request is base64 encoded properly and refer to the documentation for additional guidance."
        );
      }
    } else {
      throw new ImageHandlerError(
        StatusCodes.BAD_REQUEST,
        "DecodeRequest::CannotReadPath",
        "The URL path you provided could not be read. Please ensure that it is properly formed according to the solution documentation."
      );
    }
  }

  /**
   * Return the output format depending on the accepts headers and request type.
   * @param event Lambda request body.
   * @param requestType The request type.
   * @returns The output format.
   */
  public getOutputFormat(event: ImageHandlerEvent, requestType: RequestTypes = undefined): ImageFormatTypes {
    const { AUTO_WEBP } = process.env;
    const accept = event.headers?.Accept || event.headers?.accept;

    if (AUTO_WEBP === "Yes" && accept && accept.includes(ContentTypes.WEBP)) {
      return ImageFormatTypes.WEBP;
    } else if (requestType === RequestTypes.DEFAULT) {
      const decoded = this.decodeRequest(event);
      return decoded.outputFormat;
    }

    return null;
  }

  /**
   * Return the output format depending on first four hex values of an image file.
   * @param imageBuffer Image buffer.
   * @returns The output format.
   */
  public inferImageType(imageBuffer: Buffer): string {
    const imageSignatures: { [key: string]: string } = {
      "89504E47": ContentTypes.PNG,
      "52494646": ContentTypes.WEBP,
      "49492A00": ContentTypes.TIFF,
      "4D4D002A": ContentTypes.TIFF,
      "47494638": ContentTypes.GIF,
    };
    const imageSignature = imageBuffer.subarray(0, 4).toString("hex").toUpperCase();
    if (imageSignatures[imageSignature]) {
      return imageSignatures[imageSignature];
    }
    if (imageBuffer.subarray(0, 2).toString("hex").toUpperCase() === "FFD8") {
      return ContentTypes.JPEG;
    }
    if (imageBuffer.subarray(4, 12).toString("hex").toUpperCase() === "6674797061766966") {
      // FTYPAVIF (File Type AVIF)
      return ContentTypes.AVIF;
    }
    // SVG does not have an imageSignature we can use here, would require parsing the XML to some degree
    throw new ImageHandlerError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "RequestTypeError",
      "The file does not have an extension and the file type could not be inferred. Please ensure that your original image is of a supported file type (jpg/jpeg, png, tiff, webp, gif, avif). Inferring the image type from hex headers is not available for SVG images. Refer to the documentation for additional guidance on forming image requests."
    );
  }

  /**
   * Creates a query string similar to API Gateway 2.0 payload's $.rawQueryString
   * @param queryStringParameters Request's query parameters
   * @returns URL encoded queryString
   */
  private recreateQueryString(queryStringParameters: ImageHandlerEvent["queryStringParameters"]): string {
    return Object.entries(queryStringParameters)
      .filter(([key]) => key !== "signature")
      .sort()
      .map(([key, value]) => [key, value].join("="))
      .join("&");
  }

  /**
   * Validates the request's signature.
   * @param event Lambda request body.
   * @returns A promise.
   * @throws Throws the error if validation is enabled and the provided signature is invalid.
   */
  private async validateRequestSignature(event: ImageHandlerEvent): Promise<void> {
    const { ENABLE_SIGNATURE, SECRETS_MANAGER, SECRET_KEY } = process.env;

    // Checks signature enabled
    if (ENABLE_SIGNATURE === "Yes") {
      const { path, queryStringParameters } = event;

      if (!queryStringParameters?.signature) {
        throw new ImageHandlerError(
          StatusCodes.BAD_REQUEST,
          "AuthorizationQueryParametersError",
          "Query-string requires the signature parameter."
        );
      }

      try {
        const { signature } = queryStringParameters;
        const secret = JSON.parse(await this.secretProvider.getSecret(SECRETS_MANAGER));
        const key = secret[SECRET_KEY];
        const queryString = this.recreateQueryString(queryStringParameters);
        const stringToSign = queryString !== "" ? [path, queryString].join("?") : path;
        const hash = createHmac("sha256", key).update(stringToSign).digest("hex");

        // Signature should be made with the full path.
        if (signature !== hash) {
          throw new ImageHandlerError(StatusCodes.FORBIDDEN, "SignatureDoesNotMatch", "Signature does not match.");
        }
      } catch (error) {
        if (error.code === "SignatureDoesNotMatch") {
          throw error;
        }

        console.error("Error occurred while checking signature.", error);
        throw new ImageHandlerError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "SignatureValidationFailure",
          "Signature validation failed."
        );
      }
    }
  }

  private validateRequestExpires(event: ImageHandlerEvent): number | undefined {
    try {
      const { queryStringParameters } = event;
      const expires = queryStringParameters?.expires;

      if (expires === undefined) {
        return;
      }
      const expiry = dayjs.utc(expires, "YYYYMMDDTHHmmss[Z]", true);
      const now = dayjs.utc();

      if (!expiry.isValid()) {
        throw new ImageHandlerError(
          StatusCodes.BAD_REQUEST,
          "ImageRequestExpiryFormat",
          "Request has invalid expires value. The expires query param should map to a real date and follow the following format: YYYYMMDDTHHmmssZ (Ex: Jan 2nd, 1970 at 12:03:04PM UTC becomes 19700102T120304Z)."
        );
      }
      if (expiry.isBefore(now)) {
        throw new ImageHandlerError(StatusCodes.BAD_REQUEST, "ImageRequestExpired", "Request has expired.");
      }
      return expiry.diff(now, "seconds");
    } catch (error) {
      if (error.code === "ImageRequestExpired") {
        throw error;
      }
      if (error.code === "ImageRequestExpiryFormat") {
        throw error;
      }
      console.error("Error occurred while checking expiry.", error);
      throw new ImageHandlerError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "ExpiryDateCheckFailure",
        "Expiry date check failed."
      );
    }
  }
}

/**
 * Returns a formatted image source bucket allowed list as specified in the SOURCE_BUCKETS environment variable of the image handler Lambda function.
 * Provides error handling for missing/invalid values.
 * @returns A formatted image source bucket.
 */
export function getAllowedSourceBuckets(): string[] {
  const { SOURCE_BUCKETS } = process.env;

  if (SOURCE_BUCKETS === undefined) {
    throw new ImageHandlerError(
      StatusCodes.BAD_REQUEST,
      "GetAllowedSourceBuckets::NoSourceBuckets",
      "The SOURCE_BUCKETS variable could not be read. Please check that it is not empty and contains at least one source bucket, or multiple buckets separated by commas. Spaces can be provided between commas and bucket names, these will be automatically parsed out when decoding."
    );
  } else {
    return SOURCE_BUCKETS.replace(/\s+/g, "").split(",");
  }
}

/**
 * Filters out headers that match any pattern in the deny list and returns the safe headers
 * @param headers Input headers to filter
 * @returns Safe headers
 */
function filterRestrictedHeaders(headers: Record<string, string>): Headers {
  const safeHeaders: Record<string, string> = {};

  // Process each header using for...of loop
  for (const [header, value] of Object.entries(headers)) {
    const headerLower = header.toLowerCase();

    // If the header matches any pattern in the deny list, log and skip
    if (HEADER_DENY_LIST.some((pattern) => pattern.test(headerLower))) {
      console.warn("Filtered out restricted header:", header);
      continue;
    }

    // Add safe headers
    safeHeaders[header] = value;
  }

  return safeHeaders;
}
