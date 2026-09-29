// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp, { Sharp, SharpOptions } from 'sharp';
import { ImageProcessingRequest } from '../../types/image-processing-request';
import { OriginFetcher } from './origin-fetcher';
import { ImageProcessingError } from './types';
import { ErrorMapper } from './utils/error-mapping';
import { TransformationMapper } from './transformation-engine/transformation-mapper';
import { EditApplicator } from './transformation-engine/edit-applicator';

export class ImageProcessorService {
  private static instance: ImageProcessorService;
  private originFetcher: OriginFetcher;

  private constructor() {
    this.originFetcher = new OriginFetcher();
  }

  public static getInstance(): ImageProcessorService {
    if (!ImageProcessorService.instance) {
      ImageProcessorService.instance = new ImageProcessorService();
    }
    return ImageProcessorService.instance;
  }

  public async process(imageRequest: ImageProcessingRequest): Promise<Buffer> {
    const startTime = Date.now();
    if (!imageRequest.timings) imageRequest.timings = {};
    imageRequest.timings.imageProcessing = {};

    try {
      const fetchStart = Date.now();
      const { buffer: imageBuffer, metadata: originMetadata } = await this.originFetcher.fetchImage(
        imageRequest.origin.url,
        imageRequest.origin.headers,
        imageRequest.requestId
      );
      imageRequest.timings.imageProcessing.originFetchMs = Date.now() - fetchStart;

      if (!imageRequest.transformations?.length) {
        imageRequest.response.contentType = imageRequest.sourceImageContentType;
        // SVG passthrough serves raw bytes; harden the response against XSS.
        this.applySvgSafetyHeaders(imageRequest);
        imageRequest.timings.imageProcessing.transformationApplicationMs = 0;
        return imageBuffer;
      }

      if (imageRequest.sourceImageContentType?.includes('svg')) {
        const hasFormatTransformation = imageRequest.transformations.some(t => t.type === 'format');
        const hasRasterizingTransformation = imageRequest.transformations.some(t => t.type !== 'quality' && t.type !== 'format');
        if (!hasFormatTransformation && !hasRasterizingTransformation) {
          imageRequest.response.contentType = imageRequest.sourceImageContentType;
          // SVG passthrough (no format/rasterizing transform): serve raw bytes defensively.
          this.applySvgSafetyHeaders(imageRequest);
          imageRequest.timings.imageProcessing.transformationApplicationMs = 0;
          return imageBuffer;
        }
        if (!hasFormatTransformation) {
          imageRequest.transformations.push({ type: 'format', value: 'png', source: 'auto' });
        }
      }

      // Extract source dimensions to validate auto-resize transformations
      const metadata = await sharp(imageBuffer).metadata();
      this.preventAutoUpscaling(imageRequest, metadata.width);
      
      // We need to map Transformations to Edits before Sharp image instantiation because it influences whether or not we strip or keep metadata
      const imageEdits = await TransformationMapper.mapToImageEdits(imageRequest.transformations);
      
      console.log(JSON.stringify({
        requestId: imageRequest.requestId,
        component: 'TransformationMapper',
        operation: 'edits_mapped',
        editTypes: Object.keys(imageEdits),
        editCount: Object.keys(imageEdits).length
      }));

      // Derive animation from the actual decoded frame count rather than the source content type.
      // This correctly handles any multi-frame source (animated WebP, APNG, etc.), not just GIF.
      const isExpectedToBeAnimated = (metadata.pages ?? 1) > 1;
      const sharpOptions = {
        failOnError: true,
        animated: isExpectedToBeAnimated
      }

      // Instantiate Sharp image with rotation-aware logic
      const image = this.instantiateSharpImage(imageBuffer, imageEdits, sharpOptions);

      await EditApplicator.applyEdits(image, imageEdits, this.originFetcher);
      
      // We need to resolve final image format from the outputted image. Obtaining this formating from image metadata prior to being outputted is unreliable.
      const finalImage = await image.toBuffer({resolveWithObject: true});
      imageRequest.response.contentType = 'image/' + finalImage.info.format;

      const totalImageProcessingMs = Date.now() - startTime;
      imageRequest.timings.imageProcessing.transformationApplicationMs = 
        totalImageProcessingMs - imageRequest.timings.imageProcessing.originFetchMs;

      console.log(JSON.stringify({
        metricType: 'imageTransformation',
        originImageSize: originMetadata.size,
        transformedImageSize: finalImage.data.length,
        originFormat: originMetadata.format || 'unknown',
        transformedFormat: finalImage.info.format,
        transformationTimeMs: totalImageProcessingMs,
        requestId: imageRequest.requestId
      }));

      imageRequest.metrics = {
        preOptimization: {
          width: metadata.width ?? null,
          height: metadata.height ?? null,
          size: imageBuffer.length,
          format: originMetadata.format || 'unknown',
        },
        postOptimization: {
          width: finalImage.info.width,
          height: finalImage.info.height,
          size: finalImage.info.size,
          format: finalImage.info.format,
        },
        compressionRatio: finalImage.info.size > 0 ? Math.round((imageBuffer.length / finalImage.info.size) * 100) / 100 : null,
        timings: {
          originFetchMs: imageRequest.timings.imageProcessing.originFetchMs,
          transformationApplicationMs: imageRequest.timings.imageProcessing.transformationApplicationMs,
          requestResolutionMs: imageRequest.timings.requestResolution?.preflightValidationMs ?? 0,
          transformationResolutionMs: imageRequest.timings.transformationResolution?.durationMs ?? 0,
          totalRequestMs: Date.now() - imageRequest.timestamp,
        },
      };

      return finalImage.data;
    } catch (error) {
      throw ErrorMapper.mapError(error);
    }
  }

  private preventAutoUpscaling(imageRequest: ImageProcessingRequest, sourceWidth: number): void {
    if (!imageRequest.transformations?.length || !sourceWidth) return;
    imageRequest.transformations = imageRequest.transformations.filter(t => {
      console.log(t);
      if (t.type === 'resize' && t.source === 'auto' && t.value?.width > sourceWidth) {
        console.log(JSON.stringify({
          requestId: imageRequest.requestId,
          component: 'ImageProcessor',
          operation: 'auto_upscale_prevented',
          sourceWidth,
          requestedWidth: t.value.width
        }));
        return false;
      }
      return true;
    });
  }

  // SVG passthrough serves attacker-controllable bytes as image/svg+xml; force attachment + a locked-down
  // CSP so it can't execute script via top-level navigation (<img> embedding still works).
  private applySvgSafetyHeaders(imageRequest: ImageProcessingRequest): void {
    const contentType = imageRequest.response.contentType ?? imageRequest.sourceImageContentType;
    if (!contentType?.includes('svg')) return;
    if (!imageRequest.response.headers) imageRequest.response.headers = {};
    imageRequest.response.headers['Content-Disposition'] = 'attachment';
    imageRequest.response.headers['Content-Security-Policy'] = "default-src 'none'; sandbox";
  }

  private instantiateSharpImage(imageBuffer: Buffer, imageEdits: any, options?: any): Sharp {
    // LIMIT_INPUT_PIXELS is set per deployment size by the CDK (50 MP on the 2 GB tier, 100 MP on
    // the 4 GB tiers) as a decode-memory guard. The fallback matches the smallest tier so an
    // unset/invalid value fails safe rather than reverting to an effectively unlimited ceiling.
    const parsedLimit = parseInt(process.env.LIMIT_INPUT_PIXELS || '', 10);
    const limitInputPixels = Number.isNaN(parsedLimit) ? 50000000 : parsedLimit;
    const sharpOptions: SharpOptions = { limitInputPixels, ...options };
    // Default behavior of DIT is to keep all Metadata. Sharp by default converts the ICC to sRGB. Must chain keepIcc and keepMetadata to prevent this.
    let returnInstance = sharp(imageBuffer, sharpOptions).keepIccProfile().keepMetadata();
    try {
      if(imageEdits.stripExif === true){
        // Removes all EXIF, by inserting the Software EXIF tag. Atleast 1 field is required to use Sharp.withExif(). Leaves ICC untouched.
        returnInstance.keepIccProfile().withExif({
          IFD0: {
            Software: 'Dynamic Image Transformation for Amazon CloudFront'
          }
        });
      } 
      if (imageEdits.stripIcc === true) {
      // Strips ICC by defaulting to sRGB color space, while keeping EXIF untouched. Allows strip_exif and strip_icc to be used in combination with eachother.
        returnInstance
          .keepExif() // Keep EXIF
          .withIccProfile('srgb'); // Force standard sRGB instead of original ICC
      }
      return returnInstance;
    } catch (error) {
      throw new ImageProcessingError(
        500,
        'InstantiationError',
        'Input image could not be instantiated. Please choose a valid image.',
        error.message
      );
    }
  }
}