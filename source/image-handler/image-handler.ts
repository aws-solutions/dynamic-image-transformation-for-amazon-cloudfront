// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Rekognition from "aws-sdk/clients/rekognition";
import S3 from "aws-sdk/clients/s3";
import sharp, { FormatEnum, OverlayOptions, ResizeOptions } from "sharp";

import {
  BoundingBox,
  BoxSize,
  ContentTypes,
  ImageEdits,
  ImageFitTypes,
  ImageFormatTypes,
  ImageHandlerError,
  ImageRequestInfo,
  RekognitionCompatibleImage,
  StatusCodes,
} from "./lib";

export class ImageHandler {
  private readonly LAMBDA_PAYLOAD_LIMIT = 6 * 1024 * 1024;

  constructor(private readonly s3Client: S3, private readonly rekognitionClient: Rekognition) {}

  /**
   * Creates a Sharp object from Buffer
   * @param originalImage An image buffer.
   * @param edits The edits to be applied to an image
   * @param options Additional sharp options to be applied
   * @returns A Sharp image object
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  private async instantiateSharpImage(originalImage: Buffer, edits: ImageEdits, options: Object): Promise<sharp.Sharp> {
    let image: sharp.Sharp = null;

    if (edits.rotate !== undefined && edits.rotate === null) {
      image = sharp(originalImage, options);
    } else {
      const metadata = await sharp(originalImage, options).metadata();
      image = metadata.orientation
        ? sharp(originalImage, options).withMetadata({ orientation: metadata.orientation })
        : sharp(originalImage, options).withMetadata();
    }

    return image;
  }

  /**
   * Modify an image's output format if specified.
   * Applies format-specific quality settings from edits.
   * Supports both old (quality) and new (q) format for quality values.
   * @param modifiedImage the image object.
   * @param imageRequestInfo the image request
   * @returns A Sharp image object
   */
  private modifyImageOutput(modifiedImage: sharp.Sharp, imageRequestInfo: ImageRequestInfo): sharp.Sharp {
    const modifiedOutputImage = modifiedImage;
    const edits = imageRequestInfo.edits || {};

    // modify if specified
    if (imageRequestInfo.outputFormat !== undefined) {
      switch (imageRequestInfo.outputFormat) {
        case ImageFormatTypes.AVIF:
          // Support both old (quality) and new (q) format
          const avifQuality = edits.avif?.q ?? edits.avif?.quality ?? 70;
          modifiedOutputImage.avif({ quality: avifQuality });
          break;

        case ImageFormatTypes.JPEG:
        case ImageFormatTypes.JPG:
          const jpegQuality = edits.jpeg?.q ?? edits.jpeg?.quality ?? 80;
          modifiedOutputImage.jpeg({ quality: jpegQuality });
          break;

        case ImageFormatTypes.PNG:
          const pngQuality = edits.png?.q ?? edits.png?.quality;
          if (pngQuality !== undefined) {
            modifiedOutputImage.png({ quality: pngQuality });
          } else {
            modifiedOutputImage.toFormat("png");
          }
          break;

        case ImageFormatTypes.WEBP:
          const webpOptions: any = {};
          const webpQuality = edits.webp?.q ?? edits.webp?.quality;
          if (webpQuality !== undefined) {
            webpOptions.quality = webpQuality;
          }
          if (typeof imageRequestInfo.effort !== "undefined") {
            webpOptions.effort = imageRequestInfo.effort;
          }
          if (Object.keys(webpOptions).length > 0) {
            modifiedOutputImage.webp(webpOptions);
          } else {
            modifiedOutputImage.toFormat("webp");
          }
          break;

        default:
          modifiedOutputImage.toFormat(ImageHandler.convertImageFormatType(imageRequestInfo.outputFormat));
      }
    }

    return modifiedOutputImage;
  }

  /**
   * Main method for processing image requests and outputting modified images.
   * @param imageRequestInfo An image request.
   * @returns Processed and modified image encoded as base64 string.
   */
  async process(imageRequestInfo: ImageRequestInfo): Promise<string> {
    const { originalImage, edits } = imageRequestInfo;
    const options = { failOnError: false, animated: imageRequestInfo.contentType === ContentTypes.GIF };
    let base64EncodedImage = "";

    // Apply edits if specified
    if (edits && Object.keys(edits).length) {
      // convert image to Sharp object
      let image = await this.instantiateSharpImage(originalImage, edits, options);

      // default to non animated if image is a GIF without multiple pages
      if (options.animated) {
        const metadata = await image.metadata();
        if (!metadata.pages || metadata.pages <= 1) {
          options.animated = false;
          image = await this.instantiateSharpImage(originalImage, edits, options);
        }
      }

      // apply image edits
      let modifiedImage = await this.applyEdits(image, edits, options.animated);
      // modify image output if requested
      modifiedImage = this.modifyImageOutput(modifiedImage, imageRequestInfo);
      // convert to base64 encoded string
      const imageBuffer = await modifiedImage.toBuffer();
      base64EncodedImage = imageBuffer.toString("base64");
    } else {
      if (imageRequestInfo.outputFormat !== undefined) {
        // convert image to Sharp and change output format if specified
        const modifiedImage = this.modifyImageOutput(sharp(originalImage, options), imageRequestInfo);
        // convert to base64 encoded string
        const imageBuffer = await modifiedImage.toBuffer();
        base64EncodedImage = imageBuffer.toString("base64");
      } else {
        // no edits or output format changes, convert to base64 encoded image
        base64EncodedImage = originalImage.toString("base64");
      }
    }

    // binary data need to be base64 encoded to pass to the API Gateway proxy https://docs.aws.amazon.com/apigateway/latest/developerguide/lambda-proxy-binary-media.html.
    // checks whether base64 encoded image fits in 6M limit, see https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html.
    if (base64EncodedImage.length > this.LAMBDA_PAYLOAD_LIMIT) {
      throw new ImageHandlerError(
        StatusCodes.REQUEST_TOO_LONG,
        "TooLargeImageException",
        "The converted image is too large to return."
      );
    }

    return base64EncodedImage;
  }

  /**
   * Applies image modifications to the original image based on edits.
   * @param originalImage The original sharp image.
   * @param edits The edits to be made to the original image.
   * @param isAnimation a flag whether the edit applies to `gif` file or not.
   * @returns A modifications to the original image.
   */
  public async applyEdits(originalImage: sharp.Sharp, edits: ImageEdits, isAnimation: boolean): Promise<sharp.Sharp> {
    await this.applyResize(originalImage, edits);

    // Apply the image edits
    for (const edit in edits) {
      if (this.skipEdit(edit, isAnimation)) continue;

      switch (edit) {
        case "overlayWith": {
          await this.applyOverlayWith(originalImage, edits);
          break;
        }
        case "smartCrop": {
          await this.applySmartCrop(originalImage, edits);
          break;
        }
        case "roundCrop": {
          originalImage = await this.applyRoundCrop(originalImage, edits);
          break;
        }
        case "contentModeration": {
          await this.applyContentModeration(originalImage, edits);
          break;
        }
        case "crop": {
          this.applyCrop(originalImage, edits);
          break;
        }
        default: {
          if (edit in originalImage) {
            originalImage[edit](edits[edit]);
          }
        }
      }
    }
    // Return the modified image
    return originalImage;
  }

  /**
   * Applies resize edit.
   * Supports both old format (width, height) and new format (w, h).
   * @param originalImage The original sharp image.
   * @param edits The edits to be made to the original image.
   */
  private async applyResize(originalImage: sharp.Sharp, edits: ImageEdits): Promise<void> {
    if (edits.resize === undefined) {
      edits.resize = {};
      edits.resize.fit = ImageFitTypes.INSIDE;
    } else {
      // Support both old (width/height) and new (w/h) format
      const width = edits.resize.width ?? edits.resize.w;
      const height = edits.resize.height ?? edits.resize.h;

      if (width) edits.resize.width = Math.round(Number(width));
      if (height) edits.resize.height = Math.round(Number(height));

      // Default fit to "inside" if not specified
      if (!edits.resize.fit) edits.resize.fit = ImageFitTypes.INSIDE;

      if (edits.resize.ratio) {
        const ratio = edits.resize.ratio;

        const { width: imgWidth, height: imgHeight } =
          edits.resize.width && edits.resize.height ? edits.resize : await originalImage.metadata();

        edits.resize.width = Math.round(imgWidth * ratio);
        edits.resize.height = Math.round(imgHeight * ratio);
        // Sharp doesn't have such parameter for resize(), we got it from Thumbor mapper.  We don't need to keep this field in the `resize` object
        delete edits.resize.ratio;
      }
    }
  }

  /**
   *
   * @param editSize the specified size
   * @param imageSize the size of the image
   * @param overlaySize the size of the overlay
   * @returns the calculated size
   */
  private calcOverlaySizeOption = (editSize: string | undefined, imageSize: number, overlaySize: number): number => {
    let resultSize = NaN;

    if (editSize !== undefined) {
      // if ends with p, it is a percentage
      if (editSize.endsWith("p")) {
        resultSize = parseInt(editSize.replace("p", ""));
        resultSize = Math.floor(
          resultSize < 0 ? imageSize + (imageSize * resultSize) / 100 - overlaySize : (imageSize * resultSize) / 100
        );
      } else {
        resultSize = parseInt(editSize);
        if (resultSize < 0) {
          resultSize = imageSize + resultSize - overlaySize;
        }
      }
    }

    return resultSize;
  };

  /**
   * Applies overlay edit.
   * @param originalImage The original sharp image.
   * @param edits The edits to be made to the original image.
   */
  private async applyOverlayWith(originalImage: sharp.Sharp, edits: ImageEdits): Promise<void> {
    let imageMetadata: sharp.Metadata = await originalImage.metadata();

    if (edits.resize) {
      const imageBuffer = await originalImage.toBuffer();
      const resizeOptions: ResizeOptions = edits.resize;

      imageMetadata = await sharp(imageBuffer).resize(resizeOptions).metadata();
    }

    const { bucket, key, wRatio, hRatio, alpha, options } = edits.overlayWith;
    const overlay = await this.getOverlayImage(bucket, key, wRatio, hRatio, alpha, imageMetadata);
    const overlayMetadata = await sharp(overlay).metadata();
    const overlayOption: OverlayOptions = { ...options, input: overlay };

    if (options) {
      const { left: leftOption, top: topOption } = options;

      const left = this.calcOverlaySizeOption(leftOption, imageMetadata.width, overlayMetadata.width);
      if (!isNaN(left)) overlayOption.left = left;

      const top = this.calcOverlaySizeOption(topOption, imageMetadata.height, overlayMetadata.height);
      if (!isNaN(top)) overlayOption.top = top;
    }

    originalImage.composite([overlayOption]);
  }

  /**
   * Applies smart crop edit.
   * @param originalImage The original sharp image.
   * @param edits The edits to be made to the original image.
   */
  private async applySmartCrop(originalImage: sharp.Sharp, edits: ImageEdits): Promise<void> {
    // smart crop can be boolean or object
    if (edits.smartCrop === true || typeof edits.smartCrop === "object") {
      const { faceIndex, padding } =
        typeof edits.smartCrop === "object"
          ? edits.smartCrop
          : {
              faceIndex: undefined,
              padding: undefined,
            };
      const { imageBuffer, format } = await this.getRekognitionCompatibleImage(originalImage);
      const boundingBox = await this.getBoundingBox(imageBuffer.data, faceIndex ?? 0);
      const cropArea = this.getCropArea(boundingBox, padding ?? 0, imageBuffer.info);
      try {
        originalImage.extract(cropArea);
        // convert image back to previous format
        if (format !== imageBuffer.info.format) {
          originalImage.toFormat(format);
        }
      } catch (error) {
        throw new ImageHandlerError(
          StatusCodes.BAD_REQUEST,
          "SmartCrop::PaddingOutOfBounds",
          "The padding value you provided exceeds the boundaries of the original image. Please try choosing a smaller value or applying padding via Sharp for greater specificity."
        );
      }
    }
  }

  /**
   * Determines if the edits specified contain a valid roundCrop item
   * @param edits The edits speficed
   * @returns boolean
   */
  private hasRoundCrop(edits: ImageEdits): boolean {
    return edits.roundCrop === true || typeof edits.roundCrop === "object";
  }

  /**
   * @param param Value of corner to check
   * @returns Boolean identifying whether roundCrop parameters are valid
   */
  private validRoundCropParam(param: number) {
    return param && param >= 0;
  }

  /**
   * Applies round crop edit.
   * @param originalImage The original sharp image.
   * @param edits The edits to be made to the original image.
   */
  private async applyRoundCrop(originalImage: sharp.Sharp, edits: ImageEdits): Promise<sharp.Sharp> {
    // round crop can be boolean or object
    if (this.hasRoundCrop(edits)) {
      const { top, left, rx, ry } =
        typeof edits.roundCrop === "object"
          ? edits.roundCrop
          : {
              top: undefined,
              left: undefined,
              rx: undefined,
              ry: undefined,
            };
      const imageBuffer = await originalImage.toBuffer({ resolveWithObject: true });
      const width = imageBuffer.info.width;
      const height = imageBuffer.info.height;

      // check for parameters, if not provided, set to defaults
      const radiusX = this.validRoundCropParam(rx) ? rx : Math.min(width, height) / 2;
      const radiusY = this.validRoundCropParam(ry) ? ry : Math.min(width, height) / 2;
      const topOffset = this.validRoundCropParam(top) ? top : height / 2;
      const leftOffset = this.validRoundCropParam(left) ? left : width / 2;

      const ellipse = Buffer.from(
        `<svg viewBox="0 0 ${width} ${height}"> <ellipse cx="${leftOffset}" cy="${topOffset}" rx="${radiusX}" ry="${radiusY}" /></svg>`
      );
      const overlayOptions: OverlayOptions[] = [{ input: ellipse, blend: "dest-in" }];

      // Need to break out into another sharp pipeline to allow for resize after composite
      const data = await originalImage.composite(overlayOptions).toBuffer();
      return sharp(data).withMetadata().trim();
    }

    return originalImage;
  }

  /**
   * Blurs the image provided if there is inappropriate content
   * @param originalImage the original image
   * @param blur the amount to blur
   * @param moderationLabels the labels identifying specific content to blur
   * @param foundContentLabels the labels identifying inappropriate content found
   */
  private blurImage(
    originalImage: sharp.Sharp,
    blur: number | undefined,
    moderationLabels: string[],
    foundContentLabels: Rekognition.DetectModerationLabelsResponse
  ): void {
    const blurValue = blur !== undefined ? Math.ceil(blur) : 50;

    if (blurValue >= 0.3 && blurValue <= 1000) {
      if (moderationLabels) {
        for (const moderationLabel of foundContentLabels.ModerationLabels) {
          if (moderationLabels.includes(moderationLabel.Name)) {
            originalImage.blur(blurValue);
            break;
          }
        }
      } else if (foundContentLabels.ModerationLabels.length) {
        originalImage.blur(blurValue);
      }
    }
  }

  /**
   *
   * @param originalImage The original sharp image.
   * @param edits The edits to be made to the original image.
   */
  private async applyContentModeration(originalImage: sharp.Sharp, edits: ImageEdits): Promise<void> {
    // content moderation can be boolean or object
    if (edits.contentModeration === true || typeof edits.contentModeration === "object") {
      const { minConfidence, blur, moderationLabels } =
        typeof edits.contentModeration === "object"
          ? edits.contentModeration
          : {
              minConfidence: undefined,
              blur: undefined,
              moderationLabels: undefined,
            };
      const { imageBuffer, format } = await this.getRekognitionCompatibleImage(originalImage);
      const inappropriateContent = await this.detectInappropriateContent(imageBuffer.data, minConfidence);

      this.blurImage(originalImage, blur, moderationLabels, inappropriateContent);
      // convert image back to previous format
      if (format !== imageBuffer.info.format) {
        originalImage.toFormat(format);
      }
    }
  }

  /**
   * Applies crop edit.
   * @param originalImage The original sharp image.
   * @param edits The edits to be made to the original image.
   */
  private applyCrop(originalImage: sharp.Sharp, edits: ImageEdits): void {
    try {
      originalImage.extract(edits.crop);
    } catch (error) {
      throw new ImageHandlerError(
        StatusCodes.BAD_REQUEST,
        "Crop::AreaOutOfBounds",
        "The cropping area you provided exceeds the boundaries of the original image. Please try choosing a correct cropping value."
      );
    }
  }

  /**
   * Checks whether an edit needs to be skipped or not.
   * @param edit the current edit.
   * @param isAnimation a flag whether the edit applies to `gif` file or not.
   * @returns whether the edit needs to be skipped or not.
   */
  private skipEdit(edit: string, isAnimation: boolean): boolean {
    return isAnimation && ["rotate", "smartCrop", "roundCrop", "contentModeration"].includes(edit);
  }

  /**
   * Gets an image to be used as an overlay to the primary image from an Amazon S3 bucket.
   * @param bucket The name of the bucket containing the overlay.
   * @param key The object keyname corresponding to the overlay.
   * @param wRatio The width rate of the overlay image.
   * @param hRatio The height rate of the overlay image.
   * @param alpha The transparency alpha to the overlay.
   * @param sourceImageMetadata The metadata of the source image.
   * @returns An image to be used as an overlay.
   */
  public async getOverlayImage(
    bucket: string,
    key: string,
    wRatio: string,
    hRatio: string,
    alpha: string,
    sourceImageMetadata: sharp.Metadata
  ): Promise<Buffer> {
    const params = { Bucket: bucket, Key: key };
    try {
      const { width, height } = sourceImageMetadata;
      const overlayImage: S3.GetObjectOutput = await this.s3Client.getObject(params).promise();
      const resizeOptions: ResizeOptions = {
        fit: ImageFitTypes.INSIDE,
      };

      // Set width and height of the watermark image based on the ratio
      const zeroToHundred = /^(100|[1-9]?\d)$/;
      if (zeroToHundred.test(wRatio)) {
        resizeOptions.width = Math.floor((width * parseInt(wRatio)) / 100);
      }
      if (zeroToHundred.test(hRatio)) {
        resizeOptions.height = Math.floor((height * parseInt(hRatio)) / 100);
      }

      // If alpha is not within 0-100, the default alpha is 0 (fully opaque).
      const alphaValue = zeroToHundred.test(alpha) ? parseInt(alpha) : 0;
      const imageBuffer = Buffer.isBuffer(overlayImage.Body)
        ? overlayImage.Body
        : Buffer.from(overlayImage.Body as Uint8Array);
      return await sharp(imageBuffer)
        .resize(resizeOptions)
        .composite([
          {
            input: Buffer.from([255, 255, 255, 255 * (1 - alphaValue / 100)]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: "dest-in",
          },
        ])
        .toBuffer();
    } catch (error) {
      throw new ImageHandlerError(
        error.statusCode ? error.statusCode : StatusCodes.INTERNAL_SERVER_ERROR,
        error.code,
        error.message
      );
    }
  }

  /**
   * Calculates the crop area for a smart-cropped image based on the bounding box data returned by Amazon Rekognition, as well as padding options and the image metadata.
   * @param boundingBox The bounding box of the detected face.
   * @param padding Set of options for smart cropping.
   * @param boxSize Sharp image metadata.
   * @returns Calculated crop area for a smart-cropped image.
   */
  public getCropArea(boundingBox: BoundingBox, padding: number, boxSize: BoxSize): BoundingBox {
    // calculate needed options dimensions
    let left = Math.floor(boundingBox.left * boxSize.width - padding);
    let top = Math.floor(boundingBox.top * boxSize.height - padding);
    let extractWidth = Math.floor(boundingBox.width * boxSize.width + padding * 2);
    let extractHeight = Math.floor(boundingBox.height * boxSize.height + padding * 2);

    // check if dimensions fit within image dimensions and re-adjust if necessary
    left = left < 0 ? 0 : left;
    top = top < 0 ? 0 : top;
    const maxWidth = boxSize.width - left;
    const maxHeight = boxSize.height - top;
    extractWidth = extractWidth > maxWidth ? maxWidth : extractWidth;
    extractHeight = extractHeight > maxHeight ? maxHeight : extractHeight;

    // Calculate the smart crop area
    return {
      left,
      top,
      width: extractWidth,
      height: extractHeight,
    };
  }

  /**
   *
   * @param response the response from a Rekognition detectFaces API call
   * @param faceIndex the index number of the face detected
   * @param boundingBox the box bounds
   * @param boundingBox.Height height of bounding box
   * @param boundingBox.Left left side of bounding box
   * @param boundingBox.Top top of bounding box
   * @param boundingBox.Width width of bounding box
   */
  private handleBounds(
    response: Rekognition.DetectFacesResponse,
    faceIndex: number,
    boundingBox: { Height?: number; Left?: number; Top?: number; Width?: number }
  ): void {
    // handle bounds > 1 and < 0
    for (const bound in response.FaceDetails[faceIndex].BoundingBox) {
      if (response.FaceDetails[faceIndex].BoundingBox[bound] < 0) boundingBox[bound] = 0;
      else if (response.FaceDetails[faceIndex].BoundingBox[bound] > 1) boundingBox[bound] = 1;
      else boundingBox[bound] = response.FaceDetails[faceIndex].BoundingBox[bound];
    }

    // handle bounds greater than the size of the image
    if (boundingBox.Left + boundingBox.Width > 1) {
      boundingBox.Width = 1 - boundingBox.Left;
    }
    if (boundingBox.Top + boundingBox.Height > 1) {
      boundingBox.Height = 1 - boundingBox.Top;
    }
  }

  /**
   * Gets the bounding box of the specified face index within an image, if specified.
   * @param imageBuffer The original image.
   * @param faceIndex The zero-based face index value, moving from 0 and up as confidence decreases for detected faces within the image.
   * @returns The bounding box of the specified face index within an image.
   */
  public async getBoundingBox(imageBuffer: Buffer, faceIndex: number): Promise<BoundingBox> {
    const params = { Image: { Bytes: imageBuffer } };

    try {
      const response = await this.rekognitionClient.detectFaces(params).promise();
      if (response.FaceDetails.length <= 0) {
        return { height: 1, left: 0, top: 0, width: 1 };
      }

      const boundingBox: { Height?: number; Left?: number; Top?: number; Width?: number } = {};

      this.handleBounds(response, faceIndex, boundingBox);

      return {
        height: boundingBox.Height,
        left: boundingBox.Left,
        top: boundingBox.Top,
        width: boundingBox.Width,
      };
    } catch (error) {
      console.error(error);

      if (
        error.message === "Cannot read property 'BoundingBox' of undefined" ||
        error.message === "Cannot read properties of undefined (reading 'BoundingBox')"
      ) {
        throw new ImageHandlerError(
          StatusCodes.BAD_REQUEST,
          "SmartCrop::FaceIndexOutOfRange",
          "You have provided a FaceIndex value that exceeds the length of the zero-based detectedFaces array. Please specify a value that is in-range."
        );
      } else {
        throw new ImageHandlerError(
          error.statusCode ? error.statusCode : StatusCodes.INTERNAL_SERVER_ERROR,
          error.code,
          error.message
        );
      }
    }
  }

  /**
   * Detects inappropriate content in an image.
   * @param imageBuffer The original image.
   * @param minConfidence The options to pass to the detectModerationLabels Rekognition function.
   * @returns Detected inappropriate content in an image.
   */
  private async detectInappropriateContent(
    imageBuffer: Buffer,
    minConfidence: number | undefined
  ): Promise<Rekognition.DetectModerationLabelsResponse> {
    try {
      const params = {
        Image: { Bytes: imageBuffer },
        MinConfidence: minConfidence ?? 75,
      };
      return await this.rekognitionClient.detectModerationLabels(params).promise();
    } catch (error) {
      console.error(error);
      throw new ImageHandlerError(
        error.statusCode ? error.statusCode : StatusCodes.INTERNAL_SERVER_ERROR,
        error.code,
        error.message
      );
    }
  }

  /**
   * Converts serverless image handler image format type to 'sharp' format.
   * @param imageFormatType Result output file type.
   * @returns Converted 'sharp' format.
   */
  private static convertImageFormatType(imageFormatType: ImageFormatTypes): keyof FormatEnum {
    switch (imageFormatType) {
      case ImageFormatTypes.JPG:
        return "jpg";
      case ImageFormatTypes.JPEG:
        return "jpeg";
      case ImageFormatTypes.PNG:
        return "png";
      case ImageFormatTypes.WEBP:
        return "webp";
      case ImageFormatTypes.TIFF:
        return "tiff";
      case ImageFormatTypes.HEIF:
        return "heif";
      case ImageFormatTypes.RAW:
        return "raw";
      case ImageFormatTypes.GIF:
        return "gif";
      case ImageFormatTypes.AVIF:
        return "avif";
      default:
        throw new ImageHandlerError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "UnsupportedOutputImageFormatException",
          `Format to ${imageFormatType} not supported`
        );
    }
  }

  /**
   * Converts the image to a rekognition compatible format if current format is not compatible.
   * @param image the image to be modified by rekognition.
   * @returns object containing image buffer data and original image format.
   */
  private async getRekognitionCompatibleImage(image: sharp.Sharp): Promise<RekognitionCompatibleImage> {
    const sharp_image = sharp(await image.toBuffer()); // Reload sharp image to ensure current metadata
    const metadata = await sharp_image.metadata();
    const format = metadata.format;
    let imageBuffer: { data: Buffer; info: sharp.OutputInfo };

    // convert image to png if not jpeg or png
    if (!["jpeg", "png"].includes(format)) {
      imageBuffer = await image.png().toBuffer({ resolveWithObject: true });
    } else {
      imageBuffer = await image.toBuffer({ resolveWithObject: true });
    }

    return { imageBuffer, format };
  }
}
