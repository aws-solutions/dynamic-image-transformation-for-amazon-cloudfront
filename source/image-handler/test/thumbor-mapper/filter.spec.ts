// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageEdits, ImageFormatTypes } from "../../lib";
import { ThumborMapper } from "../../thumbor-mapper";

describe("filter", () => {
  it("Should pass if the filter is successfully converted from Thumbor:autojpg()", () => {
    // Arrange
    const edit = "filters:autojpg()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { toFormat: "jpeg" };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:background_color()", () => {
    // Arrange
    const edit = "filters:background_color(ffff)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = {
      flatten: { background: { r: 255, g: 255, b: 255 } },
    };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:blur()", () => {
    // Arrange
    const edit = "filters:blur(60)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { blur: 30 };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:blur()", () => {
    // Arrange
    const edit = "filters:blur(60, 2)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { blur: 2 };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:convolution()", () => {
    // Arrange
    const edit = "filters:convolution(1;2;1;2;4;2;1;2;1,3,true)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = {
      convolve: {
        width: 3,
        height: 3,
        kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1],
      },
    };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:equalize()", () => {
    // Arrange
    const edit = "filters:equalize()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { normalize: true };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:fill()", () => {
    // Arrange
    const edit = "filters:fill(fff)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = {
      resize: { background: { r: 255, g: 255, b: 255 }, fit: "contain" },
    };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:fill()", () => {
    // Arrange
    const edit = "filters:fill(fff)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    let edits: ImageEdits = { resize: {} };
    edits = thumborMapper.mapFilter(edit, filetype, edits);

    // Assert
    const expectedResult = {
      resize: { background: { r: 255, g: 255, b: 255 }, fit: "contain" },
    };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:format()", () => {
    // Arrange
    const edit = "filters:format(png)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { toFormat: "png" };
    expect(edits).toEqual(expectedResult);
  });

  it("Should return undefined if an accepted file format is not specified", () => {
    // Arrange
    const edit = "filters:format(test)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = {};
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:no_upscale()", () => {
    // Arrange
    const edit = "filters:no_upscale()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { resize: { withoutEnlargement: true } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:no_upscale()", () => {
    // Arrange
    const edit = "filters:no_upscale()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    let edits: ImageEdits = { resize: { height: 400, width: 300 } };
    edits = thumborMapper.mapFilter(edit, filetype, edits);

    // Assert
    const expectedResult = {
      resize: { height: 400, width: 300, withoutEnlargement: true },
    };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:proportion()", () => {
    // Arrange
    const edit = "filters:proportion(0.3)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    let edits: ImageEdits = { resize: { height: 200, width: 200 } };
    edits = thumborMapper.mapFilter(edit, filetype, edits);

    // Assert
    const expectedResult = { resize: { height: 60, width: 60 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:resize()", () => {
    // Arrange
    const edit = "filters:proportion(0.3)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    expect(edits.resize).not.toBeUndefined();
    expect(edits.resize.ratio).toEqual(0.3);
  });

  it("Should pass if the filter is successfully translated from Thumbor:quality()", () => {
    // Arrange
    const edit = "filters:quality(50)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { jpeg: { quality: 50 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:quality()", () => {
    // Arrange
    const edit = "filters:quality(50)";
    const filetype = ImageFormatTypes.PNG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { png: { quality: 50 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:quality()", () => {
    // Arrange
    const edit = "filters:quality(50)";
    const filetype = ImageFormatTypes.WEBP;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { webp: { quality: 50 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:quality()", () => {
    // Arrange
    const edit = "filters:quality(50)";
    const filetype = ImageFormatTypes.TIFF;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { tiff: { quality: 50 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:quality()", () => {
    // Arrange
    const edit = "filters:quality(50)";
    const filetype = ImageFormatTypes.HEIF;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { heif: { quality: 50 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:quality()", () => {
    // Arrange
    const edit = "filters:quality(50)";
    const filetype = ImageFormatTypes.AVIF;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { avif: { quality: 50 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should return undefined if an unsupported file type is provided", () => {
    // Arrange
    const edit = "filters:quality(50)";
    const filetype = "xml" as ImageFormatTypes;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = {};
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:rgb()", () => {
    // Arrange
    const edit = "filters:rgb(10, 10, 10)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { tint: { r: 25.5, g: 25.5, b: 25.5 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:rotate()", () => {
    // Arrange
    const edit = "filters:rotate(75)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { rotate: 75 };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:sharpen()", () => {
    // Arrange
    const edit = "filters:sharpen(75, 5)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { sharpen: 3.5 };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:stretch()", () => {
    // Arrange
    const edit = "filters:stretch()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { resize: { fit: "fill" } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:stretch()", () => {
    // Arrange
    const edit = "filters:stretch()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    let edits: ImageEdits = { resize: { width: 300, height: 400 } };
    edits = thumborMapper.mapFilter(edit, filetype, edits);
    // Assert
    const expectedResult = { resize: { width: 300, height: 400, fit: "fill" } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:stretch()", () => {
    // Arrange
    const edit = "filters:stretch()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    let edits: ImageEdits = { resize: { fit: "inside" } };
    edits = thumborMapper.mapFilter(edit, filetype, edits);

    // Assert
    const expectedResult = { resize: { fit: "inside" } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:stretch()", () => {
    // Arrange
    const edit = "filters:stretch()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    let edits: ImageEdits = {
      resize: { width: 400, height: 300, fit: "inside" },
    };
    edits = thumborMapper.mapFilter(edit, filetype, edits);

    // Assert
    const expectedResult = {
      resize: { width: 400, height: 300, fit: "inside" },
    };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:strip_exif()", () => {
    // Arrange
    const edit = "filters:strip_exif()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { rotate: null };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:strip_icc()", () => {
    // Arrange
    const edit = "filters:strip_icc()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { rotate: null };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:upscale()", () => {
    // Arrange
    const edit = "filters:upscale()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = { resize: { fit: "inside" } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:upscale()", () => {
    // Arrange
    const edit = "filters:upscale()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    let edits: ImageEdits = { resize: {} };
    edits = thumborMapper.mapFilter(edit, filetype, edits);

    // Assert
    const expectedResult = { resize: { fit: "inside" } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:watermark()", () => {
    // Arrange
    const edit = "filters:watermark(bucket,key,100,100,0)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = {
      overlayWith: {
        bucket: "bucket",
        key: "key",
        alpha: "0",
        wRatio: undefined,
        hRatio: undefined,
        options: {
          left: "100",
          top: "100",
        },
      },
    };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:watermark()", () => {
    // Arrange
    const edit = "filters:watermark(bucket,key,50p,30p,0)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = {
      overlayWith: {
        bucket: "bucket",
        key: "key",
        alpha: "0",
        wRatio: undefined,
        hRatio: undefined,
        options: {
          left: "50p",
          top: "30p",
        },
      },
    };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:watermark()", () => {
    // Arrange
    const edit = "filters:watermark(bucket,key,x,x,0)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = {
      overlayWith: {
        bucket: "bucket",
        key: "key",
        alpha: "0",
        wRatio: undefined,
        hRatio: undefined,
        options: {},
      },
    };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the filter is successfully translated from Thumbor:watermark()", () => {
    // Arrange
    const edit = "filters:watermark(bucket,key,100,100,0,10,10)";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = {
      overlayWith: {
        bucket: "bucket",
        key: "key",
        alpha: "0",
        wRatio: "10",
        hRatio: "10",
        options: {
          left: "100",
          top: "100",
        },
      },
    };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if undefined is returned for an unsupported filter", () => {
    // Arrange
    const edit = "filters:notSupportedFilter()";
    const filetype = ImageFormatTypes.JPG;

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapFilter(edit, filetype);

    // Assert
    const expectedResult = {};
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass when format and quality filters are passed and file does not have extension", () => {
    // Arrange
    const path = "/filters:format(jpeg)/filters:quality(50)/image_without_extension";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = { toFormat: "jpeg", jpeg: { quality: 50 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass when quality and format filters are passed and file does not have extension", () => {
    // Arrange
    const path = "/filters:quality(50)/filters:format(jpeg)/image_without_extension";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = { toFormat: "jpeg", jpeg: { quality: 50 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass when quality and format filters are passed and file has extension", () => {
    // Arrange
    const path = "/filters:quality(50)/filters:format(jpeg)/image_without_extension.png";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = { toFormat: "jpeg", png: { quality: 50 } };
    expect(edits).toEqual(expectedResult);
  });

  it("Should pass if the proper edit translations are applied and in the correct order", () => {
    // Arrange
    const path = "/fit-in/200x300/filters:grayscale()/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        resize: {
          width: 200,
          height: 300,
          fit: "inside",
        },
        grayscale: true,
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass for fit-in combined with watermark in folder", () => {
    // watermark params: bucket, key, xPos, yPos, alpha, wRatio, hRatio
    const path = "/fit-in/400x400/filters:watermark(bucket,folder/key.png,0,0)/image.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        resize: {
          width: 400,
          height: 400,
          fit: "inside",
        },
        overlayWith: {
          bucket: "bucket",
          key: "folder/key.png",
          alpha: undefined,
          wRatio: undefined,
          hRatio: undefined,
          options: {
            left: "0",
            top: "0",
          },
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass for fit-in combined with watermark not in folder", () => {
    // watermark params: bucket, key, xPos, yPos, alpha, wRatio, hRatio
    const path = "/fit-in/400x400/filters:watermark(bucket,key.png,0,0)/image.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        resize: {
          width: 400,
          height: 400,
          fit: "inside",
        },
        overlayWith: {
          bucket: "bucket",
          key: "key.png",
          alpha: undefined,
          wRatio: undefined,
          hRatio: undefined,
          options: {
            left: "0",
            top: "0",
          },
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if false is interpreted as non-animated", () => {
    // Arrange
    const path = "/filters:animated(fAlSe)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        animated: false,
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if empty value is interpreted as animated", () => {
    // Arrange
    const path = "/filters:animated()/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        animated: true,
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if non-false value is interpreted as animated", () => {
    // Arrange
    const path = "/filters:animated(ABCDEF)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        animated: true,
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if smart crop filter is provided with no values", () => {
    // Arrange
    const path = "filters:smart_crop()/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        smartCrop: {
          faceIndex: undefined,
          padding: undefined,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if smart crop filter is provided with valid numbers", () => {
    // Arrange
    const path = "filters:smart_crop(1,40)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        smartCrop: {
          faceIndex: 1,
          padding: 40,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if smart crop filter is provided with valid numbers with a space", () => {
    // Arrange
    const path = "filters:smart_crop(1, 40)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        smartCrop: {
          faceIndex: 1,
          padding: 40,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if smart crop filter is provided with only padding", () => {
    // Arrange
    const path = "filters:smart_crop(,40)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        smartCrop: {
          faceIndex: undefined,
          padding: 40,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if smart crop filter is provided with only faceIndex", () => {
    // Arrange
    const path = "filters:smart_crop(1)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        smartCrop: {
          faceIndex: 1,
          padding: undefined,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if smart crop filter is provided with only faceIndex and comma", () => {
    // Arrange
    const path = "filters:smart_crop(1,)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        smartCrop: {
          faceIndex: 1,
          padding: undefined,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if smart crop filter is provided with too many parameters", () => {
    // Arrange
    const path = "filters:smart_crop(1,40,50)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        smartCrop: {
          faceIndex: 1,
          padding: 40,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass using smart crop with thumbor filter chaining", () => {
    // Arrange
    const path = "/fit-in/200x300/filters:grayscale():smart_crop(1,40)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        resize: {
          width: 200,
          height: 300,
          fit: "inside",
        },
        grayscale: true,
        smartCrop: {
          faceIndex: 1,
          padding: 40,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass using smart crop with regular thumbor filters", () => {
    // Arrange
    const path = "/fit-in/200x300/filters:grayscale()/filters:smart_crop(1,40)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        resize: {
          width: 200,
          height: 300,
          fit: "inside",
        },
        grayscale: true,
        smartCrop: {
          faceIndex: 1,
          padding: 40,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should return NaN if non numeric values are provided to smart crop", () => {
    // Arrange
    const path = "/filters:smart_crop(some,value)/test-image-001.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        smartCrop: {
          faceIndex: NaN,
          padding: NaN,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });
});
