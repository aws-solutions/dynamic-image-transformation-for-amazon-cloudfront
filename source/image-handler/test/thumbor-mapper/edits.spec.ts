// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ThumborMapper } from "../../thumbor-mapper";

describe("edits", () => {
  it("Should pass if filters are chained", () => {
    const path = "/filters:rotate(90):grayscale()/thumbor-image.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        rotate: 90,
        grayscale: true,
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if filters are not chained", () => {
    const path = "/filters:rotate(90)/filters:grayscale()/thumbor-image.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        rotate: 90,
        grayscale: true,
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass if filters are both chained and individual", () => {
    const path = "/filters:rotate(90):grayscale()/filters:blur(20)/thumbor-image.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        rotate: 90,
        grayscale: true,
        blur: 10,
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });

  it("Should pass even if there are slashes in the filter", () => {
    const path = "/filters:watermark(bucket,folder/key.png,0,0)/image.jpg";

    // Act
    const thumborMapper = new ThumborMapper();
    const edits = thumborMapper.mapPathToEdits(path);

    // Assert
    const expectedResult = {
      edits: {
        overlayWith: {
          alpha: undefined,
          bucket: "bucket",
          hRatio: undefined,
          key: "folder/key.png",
          options: {
            left: "0",
            top: "0",
          },
          wRatio: undefined,
        },
      },
    };
    expect(edits).toEqual(expectedResult.edits);
  });
});
