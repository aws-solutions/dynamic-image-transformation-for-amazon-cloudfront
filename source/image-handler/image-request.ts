// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fsPromises from "fs/promises";
import fs from "fs";
import S3 from "aws-sdk/clients/s3";
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
} from "./lib";
import { SecretProvider } from "./secret-provider";
import { ThumborMapper } from "./thumbor-mapper";

type OriginalImageInfo = Partial<{
  contentType: string;
  expires: string;
  lastModified: string;
  cacheControl: string;
  originalImage: Buffer;
}>;

export class ImageRequest {
  private static readonly DEFAULT_EFFORT = 4;

  constructor(private readonly s3Client: S3, private readonly secretProvider: SecretProvider) {}

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

    if (imageRequestInfo.edits?.avif) {
      imageRequestInfo.outputFormat = ImageFormatTypes.AVIF;
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

      let imageRequestInfo: ImageRequestInfo = <ImageRequestInfo>{};

      imageRequestInfo.requestType = this.parseRequestType(event);
      imageRequestInfo.bucket = this.parseImageBucket(event, imageRequestInfo.requestType);
      imageRequestInfo.key = this.parseImageKey(event, imageRequestInfo.requestType);
      imageRequestInfo.useEfs = this.parseImageUseEfs(event, imageRequestInfo.requestType);
      imageRequestInfo.edits = this.parseImageEdits(event, imageRequestInfo.requestType);

      const originalImage = await this.getOriginalImage(
        imageRequestInfo.bucket,
        imageRequestInfo.key,
        imageRequestInfo.useEfs
      );
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
   * @param useEfs Should it get image from EFS or from S3 bucket.
   * @returns The original image or an error.
   */
  public async getOriginalImage(bucket: string, key: string, useEfs: boolean = false): Promise<OriginalImageInfo> {
    try {
      const result: OriginalImageInfo = {};

      // BW_CHANGE: get image from EFS if requested so
      let originalImage: any = {};
      let imageBuffer;
      if (useEfs) {
        const filePath = `/mnt/bw_images/${key}`;
        try {
          imageBuffer = await fsPromises.readFile(filePath);
        } catch (err) {
          if (!fs.existsSync(filePath)) {
            const notFoundError: any = new Error("File not found");
            notFoundError.code = "NoSuchKey";
            throw notFoundError;
          } else {
            throw err;
          }
        }
      } else {
        const imageLocation = { Bucket: bucket, Key: key };
        originalImage = await this.s3Client.getObject(imageLocation).promise();
        imageBuffer = Buffer.from(originalImage.Body as Uint8Array);
      }

      if (originalImage.ContentType) {
        // If using default S3 ContentType infer from hex headers
        if (["binary/octet-stream", "application/octet-stream"].includes(originalImage.ContentType)) {
          result.contentType = this.inferImageType(imageBuffer);
        } else {
          result.contentType = originalImage.ContentType;
        }
      } else {
        result.contentType = this.inferImageType(imageBuffer);
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
      let status = StatusCodes.INTERNAL_SERVER_ERROR;
      let message = error.message;
      if (error.code === "NoSuchKey") {
        status = StatusCodes.NOT_FOUND;
        message = `The image ${key} does not exist or the request may not be base64 encoded properly.`;
      }
      throw new ImageHandlerError(status, error.code, message);
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
        const sourceBuckets = this.getAllowedSourceBuckets();

        if (sourceBuckets.includes(request.bucket) || new RegExp("^" + sourceBuckets[0] + "$").exec(request.bucket)) {
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
        const sourceBuckets = this.getAllowedSourceBuckets();
        return sourceBuckets[0];
      }
    } else if (requestType === RequestTypes.THUMBOR || requestType === RequestTypes.CUSTOM) {
      // Use the default image source bucket env var
      const sourceBuckets = this.getAllowedSourceBuckets();
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
   * Parses if we should use EFS storage or S3 storage
   * Supports both old format (use_efs) and new format (efs)
   * @param event Lambda request body.
   * @param requestType Image handler request type.
   * @returns boolean.
   */
  public parseImageUseEfs(event: ImageHandlerEvent, requestType: RequestTypes): boolean {
    if (requestType === RequestTypes.DEFAULT) {
      const decoded = this.decodeRequest(event);
      // Support both old (use_efs) and new (efs) format
      return decoded.efs ?? decoded.use_efs ?? false;
    } else if (requestType === RequestTypes.THUMBOR || requestType === RequestTypes.CUSTOM) {
      return false;
    } else {
      throw new ImageHandlerError(
        StatusCodes.NOT_FOUND,
        "ImageBucket::CannotFindUseEfs",
        "Request type not supported."
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
   * Parses the name of the appropriate Amazon S3 key corresponding to the original image.
   * @param event Lambda request body.
   * @param requestType Type of the request.
   * @returns The name of the appropriate Amazon S3 key.
   */
  public parseImageKey(event: ImageHandlerEvent, requestType: RequestTypes): string {
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
    const matchThumbor2 = /((.(?!(\.[^.\\/]+$)))*$)/i; // NOSONAR
    const matchThumbor3 = /.*(\.jpg$|\.jpeg$|.\.png$|\.webp$|\.tiff$|\.tif$|\.svg$|\.gif$)/i; // NOSONAR
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
        "The type of request you are making could not be processed. Please ensure that your original image is of a supported file type (jpg, png, tiff, webp, svg, gif) and that your image request is provided in the correct syntax. Refer to the documentation for additional guidance on forming image requests."
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
        return headers;
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
   * Returns a formatted image source bucket allowed list as specified in the SOURCE_BUCKETS environment variable of the image handler Lambda function.
   * Provides error handling for missing/invalid values.
   * @returns A formatted image source bucket.
   */
  public getAllowedSourceBuckets(): string[] {
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
    const imageSignature = imageBuffer.subarray(0, 4).toString("hex").toUpperCase();
    switch (imageSignature) {
      case "89504E47":
        return ContentTypes.PNG;
      case "FFD8FFDB":
      case "FFD8FFE0":
      case "FFD8FFED":
      case "FFD8FFEE":
      case "FFD8FFE1":
      case "FFD8FFE2":
        return ContentTypes.JPEG;
      case "52494646":
        return ContentTypes.WEBP;
      case "49492A00":
      case "4D4D002A":
        return ContentTypes.TIFF;
      case "47494638":
        return ContentTypes.GIF;
      default:
        throw new ImageHandlerError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "RequestTypeError",
          "The file does not have an extension and the file type could not be inferred. Please ensure that your original image is of a supported file type (jpg, png, tiff, webp, svg). Refer to the documentation for additional guidance on forming image requests."
        );
    }
  }

  /**
   * Validates the request's signature.
   * @param event Lambda request body.
   * @returns A promise.
   * @throws Throws the error if validation is enabled and the provided signature is invalid.
   */
  async validateRequestSignature(event: ImageHandlerEvent): Promise<void> {
    const { ENABLE_SIGNATURE, SECRETS_MANAGER, SECRET_KEY } = process.env;

    if (event._signatureValidated) return;

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
        const hash = createHmac("sha256", key).update(path).digest("hex");

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
}
