// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const logger = require("./logger");
const sharp = require("sharp");

class ImageHandler {
  constructor(s3, rekognition) {
    this.s3 = s3;
    this.rekognition = rekognition;
  }

  /**
   * Main method for processing image requests and outputting modified images.
   * @param {ImageRequest} request - An ImageRequest object.
   */
  async process(request) {
    let returnImage;
    const originalImage = request.originalImage;
    const edits = request.edits;
    const cropping = request.cropping;

    const hasEdits = edits !== undefined && Object.keys(edits).length > 0;
    const hasCropping = cropping !== undefined;
    if (hasEdits || hasCropping) {
      let image;
      const keys = Object.keys(edits);

      if (keys.includes("rotate") && edits.rotate === null) {
        image = sharp(originalImage, {failOnError: false});
      } else {
        const metadata = await sharp(originalImage, {
          failOnError: false
        }).metadata();
        if (metadata.orientation) {
          image = sharp(originalImage, {failOnError: false}).withMetadata({
            orientation: metadata.orientation
          });
        } else {
          image = sharp(originalImage, {failOnError: false}).withMetadata();
        }
      }

      if (hasCropping) {
        const image_metadata = await image.metadata();
        const width = image_metadata.width;
        const height = await image_metadata.height;
        if (cropping.left + cropping.width > width || cropping.top + cropping.height > height) {
          throw {
            status: 400,
            code: "CropOutOfBounds",
            message:
              `The cropping ${cropping.left},${cropping.top}x${cropping.width}:${cropping.height} is outside the image boundary of ${width}x${height}`
          };
        }
        if (cropping.width === 0 || cropping.height === 0) {
          throw {
            status: 400,
            code: "CropHasZeroDimension",
            message: `The cropping with dimension ${cropping.width}x${cropping.height} is invalid`
          }
        }
        image = await this.applyCropping(image, cropping);
      }
      if (hasEdits) {
        image = await this.applyEdits(image, edits);
      }

      if (request.outputFormat !== undefined) {
        image.toFormat(request.outputFormat);
      }
      try {
        const bufferImage = await image.toBuffer();
        returnImage = bufferImage.toString("base64");
      } catch (e) {
        throw {
          status: 400,
          code: 'Cropping failed',
          message: `Cropping failed with "${e}"`
        }
      }

    } else {
      returnImage = originalImage.toString("base64");
    }

    // If the converted image is larger than Lambda's payload hard limit, throw an error.
    let lambdaPayloadLimit = 6 * 1024 * 1024;
    if (request.isAlb) {
      // lambda attached to ALB have a one MB hard limit
      lambdaPayloadLimit = 1024 * 1024;
    }
    if (returnImage.length > lambdaPayloadLimit) {
      throw {
        status: 413,
        code: "TooLargeImageException",
        message: `The converted image is too large to return. Actual = ${returnImage.length} - max ${lambdaPayloadLimit}`
      };
    }

    return returnImage;
  }

  /**
   * Applies image modifications to the original image based on edits
   * specified in the ImageRequest.
   * @param {Sharp} image - The original sharp image.
   * @param {object} edits - The edits to be made to the original image.
   */
  async applyEdits(image, edits) {
    if (edits.resize === undefined) {
      edits.resize = {};
      edits.resize.fit = "inside";
    } else {
      if (edits.resize.width) edits.resize.width = Math.round(Number(edits.resize.width));
      if (edits.resize.height) edits.resize.height = Math.round(Number(edits.resize.height));
    }

    // Apply the image edits
    for (const editKey in edits) {
      const value = edits[editKey];
      if (editKey === "overlayWith") {
        const metadata = await image.metadata();
        let imageMetadata = metadata;
        if (edits.resize) {
          let imageBuffer = await image.toBuffer();
          imageMetadata = await sharp(imageBuffer)
            .resize({edits: {resize: edits.resize}})
            .metadata();
        }

        const {bucket, key, wRatio, hRatio, alpha} = value;
        const overlay = await this.getOverlayImage(
          bucket,
          key,
          wRatio,
          hRatio,
          alpha,
          imageMetadata
        );
        const overlayMetadata = await sharp(overlay).metadata();

        let {options} = value;
        if (options) {
          if (options.left !== undefined) {
            let left = options.left;
            if (isNaN(left) && left.endsWith("p")) {
              left = parseInt(left.replace("p", ""));
              if (left < 0) {
                left = imageMetadata.width + (imageMetadata.width * left / 100) - overlayMetadata.width;
              } else {
                left = imageMetadata.width * left / 100;
              }
            } else {
              left = parseInt(left);
              if (left < 0) {
                left = imageMetadata.width + left - overlayMetadata.width;
              }
            }
            isNaN(left) ? delete options.left : options.left = left;
          }
          if (options.top !== undefined) {
            let top = options.top;
            if (isNaN(top) && top.endsWith("p")) {
              top = parseInt(top.replace("p", ""));
              if (top < 0) {
                top = imageMetadata.height + (imageMetadata.height * top / 100) - overlayMetadata.height;
              } else {
                top = imageMetadata.height * top / 100;
              }
            } else {
              top = parseInt(top);
              if (top < 0) {
                top = imageMetadata.height + top - overlayMetadata.height;
              }
            }
            isNaN(top) ? delete options.top : options.top = top;
          }
        }

        const params = [{...options, input: overlay}];
        image.composite(params);
      } else if (editKey === "smartCrop") {
        const options = value;
        const imageBuffer = await image.toBuffer({resolveWithObject: true});
        const boundingBox = await this.getBoundingBox(imageBuffer.data, options.faceIndex);
        const cropArea = this.getCropArea(boundingBox, options, imageBuffer.info);
        try {
          image.extract(cropArea);
        } catch (err) {
          throw {
            status: 400,
            code: "SmartCrop::PaddingOutOfBounds",
            message: "The padding value you provided exceeds the boundaries of the original image. Please try choosing a smaller value or applying padding via Sharp for greater specificity."
          };
        }
      } else if (editKey === 'roundCrop') {
        const options = value;
        const imageBuffer = await image.toBuffer({resolveWithObject: true});
        let width = imageBuffer.info.width;
        let height = imageBuffer.info.height;

        //check for parameters, if not provided, set to defaults
        const radiusX = options.rx && options.rx >= 0 ? options.rx : Math.min(width, height) / 2;
        const radiusY = options.ry && options.ry >= 0 ? options.ry : Math.min(width, height) / 2;
        const topOffset = options.top && options.top >= 0 ? options.top : height / 2;
        const leftOffset = options.left && options.left >= 0 ? options.left : width / 2;

        if (options) {
          const ellipse = Buffer.from(`<svg viewBox="0 0 ${width} ${height}"> <ellipse cx="${leftOffset}" cy="${topOffset}" rx="${radiusX}" ry="${radiusY}" /></svg>`);
          const params = [{input: ellipse, blend: 'dest-in'}];
          let data = await image.composite(params)
            .png() // transparent background instead of black background
            .toBuffer();
          image = sharp(data).withMetadata().trim();
        }

      } else {
        image[editKey](value);
      }
    }
    // Return the modified image
    return image;
  }

  /**
   * Gets an image to be used as an overlay to the primary image from an
   * Amazon S3 bucket.
   * @param {string} bucket - The name of the bucket containing the overlay.
   * @param {string} key - The object keyname corresponding to the overlay.
   * @param {number} wRatio - The width rate of the overlay image.
   * @param {number} hRatio - The height rate of the overlay image.
   * @param {number} alpha - The transparency alpha to the overlay.
   * @param {object} sourceImageMetadata - The metadata of the source image.
   */
  async getOverlayImage(bucket, key, wRatio, hRatio, alpha, sourceImageMetadata) {
    const params = {Bucket: bucket, Key: key};
    try {
      const {width, height} = sourceImageMetadata;
      const overlayImage = await this.s3.getObject(params).promise();
      let resize = {
        fit: 'inside'
      };

      // Set width and height of the watermark image based on the ratio
      const zeroToHundred = /^(100|[1-9]?[0-9])$/;
      if (zeroToHundred.test(wRatio)) {
        resize['width'] = parseInt(width * wRatio / 100);
      }
      if (zeroToHundred.test(hRatio)) {
        resize['height'] = parseInt(height * hRatio / 100);
      }

      // If alpha is not within 0-100, the default alpha is 0 (fully opaque).
      if (zeroToHundred.test(alpha)) {
        alpha = parseInt(alpha);
      } else {
        alpha = 0;
      }

      const convertedImage = await sharp(overlayImage.Body)
        .resize(resize)
        .composite([{
          input: Buffer.from([255, 255, 255, 255 * (1 - alpha / 100)]),
          raw: {
            width: 1,
            height: 1,
            channels: 4
          },
          tile: true,
          blend: 'dest-in'
        }]).toBuffer();
      return convertedImage;
    } catch (err) {
      throw {
        status: err.statusCode ? err.statusCode : 500,
        code: (err.code).toString(),
        message: err.message
      };
    }
  }

  /**
   * Calculates the crop area for a smart-cropped image based on the bounding
   * box data returned by Amazon Rekognition, as well as padding options and
   * the image metadata.
   * @param {Object} boundingBox - The boudning box of the detected face.
   * @param {Object} options - Set of options for smart cropping.
   * @param {Object} metadata - Sharp image metadata.
   */
  getCropArea(boundingBox, options, metadata) {
    const padding = (options.padding !== undefined) ? parseFloat(options.padding) : 0;
    // Calculate the smart crop area
    const cropArea = {
      left: parseInt((boundingBox.Left * metadata.width) - padding),
      top: parseInt((boundingBox.Top * metadata.height) - padding),
      width: parseInt((boundingBox.Width * metadata.width) + (padding * 2)),
      height: parseInt((boundingBox.Height * metadata.height) + (padding * 2))
    };
    // Return the crop area
    return cropArea;
  }

  /**
   * Gets the bounding box of the specified face index within an image, if specified.
   * @param {Sharp} imageBuffer - The original image.
   * @param {Integer} faceIndex - The zero-based face index value, moving from 0 and up as
   * confidence decreases for detected faces within the image.
   */
  async getBoundingBox(imageBuffer, faceIndex) {
    const params = {Image: {Bytes: imageBuffer}};
    const faceIdx = (faceIndex !== undefined) ? faceIndex : 0;
    try {
      const response = await this.rekognition.detectFaces(params).promise();
      if (response.FaceDetails.length <= 0) {
        return {Height: 1, Left: 0, Top: 0, Width: 1};
      }
      let boundingBox = {};

      if (!response.FaceDetails || response.FaceDetails.length < faceIdx)
        throw new Error("Cannot read property 'BoundingBox' of undefined");

      //handle bounds > 1 and < 0
      for (let bound in response.FaceDetails[faceIdx].BoundingBox) {
        if (response.FaceDetails[faceIdx].BoundingBox[bound] < 0) boundingBox[bound] = 0;
        else if (response.FaceDetails[faceIdx].BoundingBox[bound] > 1) boundingBox[bound] = 1;
        else boundingBox[bound] = response.FaceDetails[faceIdx].BoundingBox[bound];
      }

      //handle bounds greater than the size of the image
      if (boundingBox.Left + boundingBox.Width > 1) {
        boundingBox.Width = 1 - boundingBox.Left;
      }
      if (boundingBox.Top + boundingBox.Height > 1) {
        boundingBox.Height = 1 - boundingBox.Top;
      }

      return boundingBox;
    } catch (err) {
      logger.error(err);
      if (err.message === "Cannot read property 'BoundingBox' of undefined") {
        throw {
          status: 400,
          code: "SmartCrop::FaceIndexOutOfRange",
          message: "You have provided a FaceIndex value that exceeds the length of the zero-based detectedFaces array. Please specify a value that is in-range."
        };
      } else {
        throw {
          status: err.statusCode ? err.statusCode : 500,
          code: (err.code).toString(),
          message: err.message
        };
      }
    }
  }

  async applyCropping(image, cropping) {
    return image.extract(cropping);
  }
}

// Exports
module.exports = ImageHandler;
