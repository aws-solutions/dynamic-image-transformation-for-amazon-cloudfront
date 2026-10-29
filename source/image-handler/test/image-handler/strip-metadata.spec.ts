// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import sharp, { FormatEnum, Sharp } from "sharp";

import { ImageHandler } from "../../image-handler";
import { ContentTypes, ImageEdits, ImageRequestInfo, RequestTypes } from "../../lib";

const s3Client = new S3Client();
const rekognitionClient = new RekognitionClient();
const options = { failOn: "none" as const };
const XMP =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="Lightroom"/></rdf:RDF></x:xmpmeta>';
const DIT_SOFTWARE = "Dynamic Image Transformation for Amazon CloudFront";

// Sharp cannot write IPTC, so splice a Photoshop APP13 segment (8BIM 0x0404, dataset 2:120) in after SOI.
const withIptc = (jpeg: Buffer): Buffer => {
  const caption = Buffer.from("caption");
  const dataset = Buffer.concat([Buffer.from([0x1c, 0x02, 0x78, 0x00, caption.length]), caption]);
  const padded = dataset.length % 2 ? Buffer.concat([dataset, Buffer.from([0])]) : dataset;
  const size = Buffer.alloc(4);
  size.writeUInt32BE(dataset.length);
  const resource = Buffer.concat([Buffer.from("8BIM"), Buffer.from([0x04, 0x04, 0x00, 0x00]), size, padded]);
  const body = Buffer.concat([Buffer.from("Photoshop 3.0\0"), resource]);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(body.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xed]), length, body, jpeg.subarray(2)]);
};

// Sharp always writes an Orientation tag with EXIF, so splice in an APP1 EXIF segment holding only Make.
const withExifNoOrientation = (jpeg: Buffer): Buffer => {
  const make = Buffer.from("Canon\0");
  const tiff = Buffer.alloc(26);
  tiff.write("II", 0);
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x010f, 10);
  tiff.writeUInt16LE(2, 12);
  tiff.writeUInt32LE(make.length, 14);
  tiff.writeUInt32LE(26, 18);
  const body = Buffer.concat([Buffer.from("Exif\0\0"), tiff, make]);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(body.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), length, body, jpeg.subarray(2)]);
};

const blank = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } } });

// 8.0.3-8.1.2 strip chain, used to prove pixels, size and orientation do not move.
const previousStripChain = (input: Buffer, sharpOptions: object = options): Sharp =>
  sharp(input, sharpOptions)
    .keepIccProfile()
    .keepMetadata()
    .keepIccProfile()
    .withExif({ IFD0: { Software: DIT_SOFTWARE } });

const exifText = (exif?: Buffer) => (exif ? exif.toString("latin1") : "");

let oriented: Buffer;
let noExif: Buffer;
let unoriented: Buffer;
let animated: Buffer;

beforeAll(async () => {
  const base = await blank(200, 100)
    .composite([{ input: { create: { width: 40, height: 40, channels: 3, background: "blue" } }, left: 0, top: 0 }])
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Make: "Canon" } })
    .withXmp(XMP)
    .withIccProfile("p3")
    .toBuffer();
  oriented = withIptc(base);
  noExif = await blank(200, 100).jpeg().withXmp(XMP).withIccProfile("p3").toBuffer();
  unoriented = withExifNoOrientation(noExif);
  const frames = await Promise.all(
    ["red", "green", "blue"].map((background) =>
      sharp({ create: { width: 40, height: 20, channels: 3, background } })
        .raw()
        .toBuffer()
    )
  );
  animated = await sharp(Buffer.concat(frames), { raw: { width: 40, height: 60, channels: 3, pageHeight: 20 } })
    .webp({ delay: [100, 200, 300], loop: 2 })
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Make: "Canon" } })
    .withXmp(XMP)
    .toBuffer();
});

describe("stripExif", () => {
  const instantiate = (input: Buffer, edits: ImageEdits, sharpOptions: object = options): Promise<Sharp> =>
    new ImageHandler(s3Client, rekognitionClient)["instantiateSharpImage"](input, edits, sharpOptions);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("removes EXIF tags, XMP and IPTC but keeps ICC and the orientation tag", async () => {
    const sourceMetadata = await sharp(oriented).metadata();
    expect(sourceMetadata.iptc).toBeDefined();

    const output = await (await instantiate(oriented, { stripExif: true })).toBuffer();
    const metadata = await sharp(output).metadata();

    expect(metadata.xmp).toBeUndefined();
    expect(metadata.iptc).toBeUndefined();
    expect(metadata.icc).toBeDefined();
    expect(metadata.orientation).toBe(6);
    expect(exifText(metadata.exif)).not.toContain("Canon");
    expect(exifText(metadata.exif)).not.toContain(DIT_SOFTWARE);
  });

  it("does not change pixels, size or orientation compared with the previous strip chain", async () => {
    const output = await (await instantiate(oriented, { stripExif: true })).resize(100, 50).toBuffer();
    const previous = await previousStripChain(oriented).resize(100, 50).toBuffer();
    const [metadata, previousMetadata] = await Promise.all([sharp(output).metadata(), sharp(previous).metadata()]);

    expect([metadata.width, metadata.height, metadata.orientation]).toEqual([100, 50, 6]);
    expect([previousMetadata.width, previousMetadata.height, previousMetadata.orientation]).toEqual([100, 50, 6]);
    expect((await sharp(output).raw().toBuffer()).equals(await sharp(previous).raw().toBuffer())).toBe(true);
  });

  it.each(["webp", "png", "avif", "tiff"] as (keyof FormatEnum)[])(
    "matches the previous strip chain's format, size and orientation for %s output",
    async (format) => {
      const output = await (await instantiate(oriented, { stripExif: true })).toFormat(format).toBuffer();
      const previous = await previousStripChain(oriented).toFormat(format).toBuffer();
      const [metadata, previousMetadata] = await Promise.all([sharp(output).metadata(), sharp(previous).metadata()]);

      expect([metadata.format, metadata.width, metadata.height, metadata.orientation]).toEqual([
        previousMetadata.format,
        previousMetadata.width,
        previousMetadata.height,
        previousMetadata.orientation,
      ]);
      expect(metadata.xmp).toBeUndefined();
    }
  );

  it("writes no EXIF when the source has none", async () => {
    const sourceMetadata = await sharp(noExif).metadata();
    expect(sourceMetadata.exif).toBeUndefined();
    expect(sourceMetadata.orientation).toBeUndefined();

    const metadata = await sharp(await (await instantiate(noExif, { stripExif: true })).toBuffer()).metadata();

    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeDefined();
  });

  it("combines with stripIcc without bringing the original EXIF back", async () => {
    const output = await (await instantiate(oriented, { stripExif: true, stripIcc: true })).toBuffer();
    const metadata = await sharp(output).metadata();

    expect(metadata.xmp).toBeUndefined();
    expect(metadata.iptc).toBeUndefined();
    expect(metadata.icc).toBeDefined();
    expect(metadata.space).toBe("srgb");
    expect(metadata.orientation).toBe(6);
    expect(exifText(metadata.exif)).not.toContain("Canon");
  });

  it("combines with stripIcc without bringing the original EXIF back when the source has no orientation tag", async () => {
    const sourceMetadata = await sharp(unoriented).metadata();
    expect(exifText(sourceMetadata.exif)).toContain("Canon");
    expect(sourceMetadata.orientation).toBeUndefined();

    const output = await (await instantiate(unoriented, { stripExif: true, stripIcc: true })).toBuffer();
    const metadata = await sharp(output).metadata();

    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.space).toBe("srgb");
  });

  it("keeps the source EXIF when only stripIcc is set", async () => {
    const metadata = await sharp(await (await instantiate(oriented, { stripIcc: true })).toBuffer()).metadata();

    expect(exifText(metadata.exif)).toContain("Canon");
    expect(metadata.orientation).toBe(6);
  });

  it("leaves output byte-identical when stripExif is not set", async () => {
    const output = await (await instantiate(oriented, {})).toBuffer();
    const expected = await sharp(oriented, options).keepIccProfile().keepMetadata().toBuffer();

    expect(output.equals(expected)).toBe(true);
  });

  it("auto-orients once with rotate: null", async () => {
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      bucket: "sample-bucket",
      key: "oriented.jpg",
      edits: { stripExif: true, rotate: null },
      originalImage: oriented,
    };

    const metadata = await sharp(await new ImageHandler(s3Client, rekognitionClient).process(request)).metadata();

    expect([metadata.width, metadata.height, metadata.orientation]).toEqual([100, 200, 1]);
    expect(metadata.xmp).toBeUndefined();
  });

  it("keeps frames, timing and the orientation tag on animated input", async () => {
    const output = await (await instantiate(animated, { stripExif: true }, { ...options, animated: true })).toBuffer();
    const metadata = await sharp(output, { animated: true }).metadata();

    expect(metadata.pages).toBe(3);
    expect(metadata.delay).toEqual([100, 200, 300]);
    expect(metadata.loop).toBe(2);
    expect(metadata.orientation).toBe(6);
    expect(metadata.xmp).toBeUndefined();
    expect(exifText(metadata.exif)).not.toContain("Canon");
  });

  it("still strips when a single-page GIF request is re-instantiated", async () => {
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.GIF,
      bucket: "sample-bucket",
      key: "single-page.gif",
      edits: { stripExif: true },
      originalImage: oriented,
    };

    const metadata = await sharp(await new ImageHandler(s3Client, rekognitionClient).process(request)).metadata();

    expect(metadata.xmp).toBeUndefined();
    expect(exifText(metadata.exif)).not.toContain("Canon");
    expect(metadata.orientation).toBe(6);
  });

  // Known gap, out of scope for #636: stripIcc is dropped on the single-page GIF re-instantiation, so the source profile survives.
  it("leaves stripIcc output unchanged for a single-page GIF request (known gap)", async () => {
    const request: ImageRequestInfo = {
      requestType: RequestTypes.DEFAULT,
      contentType: ContentTypes.GIF,
      bucket: "sample-bucket",
      key: "single-page.gif",
      edits: { stripIcc: true },
      originalImage: oriented,
    };

    const output = await new ImageHandler(s3Client, rekognitionClient).process(request);

    const sourceIcc = (await sharp(oriented).metadata()).icc;
    expect((await sharp(output).metadata()).icc?.equals(sourceIcc)).toBe(true);
  });
});
