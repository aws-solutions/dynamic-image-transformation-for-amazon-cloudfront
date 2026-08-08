// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp, { Sharp, SharpOptions } from 'sharp';
import { ImageProcessingRequest } from '../../types/image-processing-request';
import { OriginFetcher } from './origin-fetcher';
import { ImageProcessingError } from './types';
import { ErrorMapper } from './utils/error-mapping';
import { TransformationMapper } from './transformation-engine/transformation-mapper';
import { EditApplicator } from './transformation-engine/edit-applicator';
import { isApng } from './utils/apng-detector';

const ICO_CONTENT_TYPES = new Set([
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/ico',
]);
const BMP_CONTENT_TYPES = new Set([
  'image/bmp',
  'image/x-bmp',
  'image/x-ms-bmp',
]);

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

      const isIcoSource = ICO_CONTENT_TYPES.has(imageRequest.sourceImageContentType);
      const isApngSource = imageRequest.sourceImageContentType === 'image/png' && isApng(imageBuffer);
      const isSvgSource = imageRequest.sourceImageContentType === 'image/svg+xml';
      const isBmpSource = BMP_CONTENT_TYPES.has(imageRequest.sourceImageContentType);

      if (!imageRequest.transformations?.length || isIcoSource || isApngSource || isSvgSource || isBmpSource) {
        imageRequest.response.contentType = imageRequest.sourceImageContentType;
        imageRequest.timings.imageProcessing.transformationApplicationMs = 0;
        return imageBuffer;
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

      const ANIMATED_INPUT_CONTENT_TYPES = new Set(['image/gif', 'image/webp']);
      const isExpectedToBeAnimated = ANIMATED_INPUT_CONTENT_TYPES.has(imageRequest.sourceImageContentType);

      let sharpOptions = {
        failOn: 'warning' as const,
        animated: isExpectedToBeAnimated
      }

      // Instantiate Sharp image with rotation-aware logic
      let image = this.instantiateSharpImage(imageBuffer, imageEdits, sharpOptions);

      // Override animated to false if the resource does not actually have multiple pages / frames
      if (isExpectedToBeAnimated && (!metadata.pages || metadata.pages <= 1)) {
        sharpOptions.animated = false;
        image = await this.instantiateSharpImage(imageBuffer, imageEdits, sharpOptions);
      }

      await EditApplicator.applyEdits(image, imageEdits, this.originFetcher);
      
      // We need to resolve final image format from the outputted image. Obtaining this formating from image metadata prior to being outputted is unreliable.
      const finalImage = await image.toBuffer({resolveWithObject: true});
      // libvips reports AVIF as 'heif' because AVIF is an AV1-compressed HEIF container.
      // Disambiguate by checking the requested format transformation; serve the correct
      // MIME so browsers render rather than download.
      let outputFormat = finalImage.info.format;
      if (outputFormat === 'heif') {
        const formatTransform = imageRequest.transformations?.find(t => t.type === 'format');
        if (formatTransform?.value === 'avif') {
          outputFormat = 'avif';
        }
      }
      imageRequest.response.contentType = 'image/' + outputFormat;


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

  private instantiateSharpImage(imageBuffer: Buffer, imageEdits: any, options?: any): Sharp {
    const limitInputPixels = parseInt(process.env.LIMIT_INPUT_PIXELS || '1000000000', 10);
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