// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp, { Sharp, Metadata, OutputInfo } from 'sharp';
import { ImageEdits } from '../interfaces';
import { SharpUtils } from '../utils/sharp-utils';
import { ImageFitTypes } from '../enums';
import { ImageProcessingError } from '../types';
import { ErrorMapper } from '../utils/error-mapping';
import { CacheRegistry } from '../../cache/cache-registry';
import { OriginFetcher } from '../origin-fetcher';
import { SmartCropService } from '../../smart-crop/smart-crop.service';
import { ContentModerationService } from '../../content-moderation/content-moderation.service';

export class EditApplicator {
  private static originFetcher: OriginFetcher;

  static async applyEdits(image: Sharp, edits: ImageEdits, originFetcher: OriginFetcher): Promise<void> {
    this.originFetcher = originFetcher;
    try {
      const metadata = await image.metadata();
      const isAnimation = metadata.pages > 1;
      console.debug('Attempting to apply the following edits: ', edits);

      if (edits.smartCrop) {
        await SmartCropService.getInstance().execute(image, edits.smartCrop);
      }

      if (edits.contentModeration && !isAnimation) {
        await ContentModerationService.getInstance().execute(image, edits.contentModeration);
      }

      // For efficiency we attempt resizing prior to other image transformations. Certain transforms will defer resizing (watermark, crop, etc)
      await this.applyResize(image, edits);

      for (const [operation, value] of Object.entries(edits)) {
        if (SharpUtils.shouldSkipForAnimation(operation, isAnimation)) continue;
          switch (operation) {
            case 'smartCrop':
              break;
            case 'contentModeration':
              break;
            case 'composite':
              await this.applyWatermark(image, value);
              break;
            case 'sharpen':
              this.applySharpen(image, value)
              break;
            case 'rotate':
              image.rotate(value === 'null' ? null : value);
              break;
            case 'toFormat':
            case 'quality':
            case 'resize':
              break;
            default:
              if (SharpUtils.isAllowedTransformation(operation)) {
                console.log("Apply Edit Base case for: ", operation, " with value: ", value);
                image[operation](value);
              }
              break;
          }
      }
      
      if (this.shouldDeferResizing(edits)) {
          image.resize(edits.resize);
      }
      
      await this.applyFormat(image, edits);
    } catch (error) {
      if (error instanceof ImageProcessingError) throw error;
      console.error('Sharp applyEdits failed:', { edits, error: error.message, stack: error.stack });
      // Route through ErrorMapper so recognized Sharp errors (e.g. the pixel-limit rejection) keep
      // their correct client status code instead of being flattened to a blanket 500.
      throw ErrorMapper.mapError(error);
    }
  }


  private static async applyResize(image: Sharp, edits: ImageEdits){
    try {
      if (edits.resize === undefined) {
        edits.resize = {};
        edits.resize.fit = ImageFitTypes.INSIDE;
        return;
      }
      const resize = edits.resize;

      if (resize.ratio) {
        const ratio = resize.ratio;
        const { width, height } = resize.width && resize.height ? resize : await image.metadata();
        resize.width = Math.round(width * ratio);
        resize.height = Math.round(height * ratio);
        delete resize.ratio;
        if (!resize.fit) resize.fit = ImageFitTypes.INSIDE;
      }

      if (!this.shouldDeferResizing(edits)) {
        console.debug('Applying resize:', resize);
        image.resize(resize);
      }
    } catch (error) {
      console.error('Resize operation failed:', { resize: edits.resize, error: error.message, stack: error.stack });
      throw error;
    }
  }

  private static shouldDeferResizing(edits: ImageEdits): boolean {
    /* 
      We typically want to execute resizing first; however, in scenarios with cropping, the intent is likely to crop then resize the cropped image.
      Ex: Image is 300x300, crop 0,0,200,200, resize 100x100. If you resize first, the crop becomes invalid.
      In these scenarios resizing is deffered
    */
    const operationsResultingInDeferment = ['composite', 'extract'];
    return operationsResultingInDeferment.some(op => edits[op] !== undefined);
  }

  private static applySharpen(image: Sharp, editValue: any){
    // Sharpen is allowed to be used as a boolean, such as sharpen: true, in this case the Sharp library performs a fast, mild sharpen of the image.
    // Sharpen may also be used with explicit sigma, m1, m2, etc values. In which case a slower more accurate shapren is performed.
    image.sharpen(editValue === true ? undefined : editValue);
  }

  private static async applyFormat(image: Sharp, edits: ImageEdits){
    try {
      const format = edits.toFormat || (await image.metadata()).format;
      const options = edits.quality ? { quality: edits.quality } : {};
      // Sharp requires an explicit compression choice when emitting the heif format.
      // TODO: Look into supporting hevc over av1. Requires specific libvips compilation option.
      // https://sharp.pixelplumbing.com/api-output/#heif 
      if (format == 'heif') {
        options['compression'] = 'av1'
      }
      console.debug('Applying format:', { format, options });
      image.toFormat(format, options);
    } catch (error) {
      console.error('Format conversion failed:', { format: edits.toFormat, quality: edits.quality, error: error.message, stack: error.stack });
      throw error;
    }
  }


  private static async applyWatermark(image: Sharp, edit: Record<string, any>) {
    try {
      const { source, offSetArray } = edit;
      const [top, left, alpha, wRatio, hRatio] = offSetArray;
      const metadata = await image.metadata();
      
      console.debug('Watermark params:', { source, offSetArray, baseImageSize: { width: metadata.width, height: metadata.height } });
      
      const overlayBuffer = await this.getOverlayImage(source, wRatio, hRatio, alpha, metadata);
      const leftPos = this.calcOverlaySizeOption(left || 0, metadata.width, overlayBuffer.info.width);
      const topPos = this.calcOverlaySizeOption(top || 0, metadata.height, overlayBuffer.info.height);
      
      console.debug('Watermark position:', { left: leftPos, top: topPos, overlaySize: { width: overlayBuffer.info.width, height: overlayBuffer.info.height } });
      image.composite([{ input: overlayBuffer.data, left: leftPos, top: topPos }]);
    } catch (error) {
      console.error('Watermark failed:', { edit, error: error.message, stack: error.stack });
      throw error;
    }
  }

  private static async getOverlayImage(source: string, wRatio: number, hRatio: number, alpha: number, baseMetadata: Metadata): Promise<{ data: Buffer; info: OutputInfo }> {
    const normalizedSource = this.normalizeSource(source);
    const url = new URL(normalizedSource);
    const targetOrigin = url.host;
    
    const originCache = CacheRegistry.getInstance().getOriginCache();
    const origins = await originCache.getContents();
    const origin = origins.find(o => o.originDomain === targetOrigin);
    if (!origin) {
      throw new ImageProcessingError(403, "Access Denied", `Origin ${targetOrigin} not registered`);
    }
    
    let buffer: Buffer;
    try {
      ({ buffer } = await this.originFetcher.fetchImage(url.href))
    } catch (error) {
      if (error instanceof ImageProcessingError) {
        const errorType = error.statusCode === 404 ? 'OverlayImageNotFound' : 'OverlayFetchError';
        throw new ImageProcessingError(error.statusCode, errorType, `Failed to fetch overlay image: ${error.message}`);
      }
      throw error;
    }
    let overlayImage = sharp(buffer);
    
    if (wRatio || hRatio) {
      const width = wRatio ? Math.round((baseMetadata.width * wRatio)) : undefined;
      const height = hRatio ? Math.round((baseMetadata.height * hRatio)) : undefined;
      overlayImage = overlayImage.resize(width, height, { fit: 'fill' });
    }
    
    const alphaValue = alpha ?? 0;
    return await overlayImage
      .composite([
        {
          input: Buffer.from([255, 255, 255, 255 * (1 - alphaValue)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in',
        },
      ])
      .toBuffer({ resolveWithObject: true });
  }

  public static calcOverlaySizeOption(optionStr: string | number, imageDimension: number, overlayDimension: number): number {
    const isPercentage = typeof optionStr === 'string' && optionStr.endsWith('p');
    const value = isPercentage ? parseInt(optionStr.slice(0, -1)) : Number(optionStr);
        
    let result;
    if (isPercentage) {
      result = value < 0 
        ? Math.floor(imageDimension + (imageDimension * value) / 100) - overlayDimension
        : Math.floor((imageDimension * value) / 100);
    } else {
      result = value < 0 
        ? imageDimension + value - overlayDimension
        : value;
    }
    return result;
  }


  private static normalizeSource(source: string): string {
    // HTTPS is the only supported protocol by DIT. Strip any protocol and replace with https://
    const withoutProtocol = source.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    return `https://${withoutProtocol}`;
  }
}