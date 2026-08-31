// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client as AWSS3Client, PutObjectCommand, CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomBytes } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export class S3Client {
  private s3Client: AWSS3Client;
  private bucketName: string;

  constructor(private region: string, bucketName?: string) {
    this.s3Client = new AWSS3Client({ region });
    this.bucketName = bucketName || `dit-e2e-test-${randomBytes(8).toString('hex')}`;
  }

  async createBucket(): Promise<void> {
    const resolvedRegion = await this.s3Client.config.region();
    console.log(`Creating S3 bucket: ${this.bucketName} (region: ${resolvedRegion})`);
    const result = await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
    console.log(`✓ Bucket created: ${this.bucketName} (location: ${result.Location}, status: ${result.$metadata.httpStatusCode})`);
  }

  getBucketName(): string {
    return this.bucketName;
  }

  // Liveness check for skip-setup mode: confirms a bootstrapped bucket still exists
  // before running tests against stale state (e.g. after the stack was redeployed/destroyed).
  async bucketExists(): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      return true;
    } catch (error) {
      return false;
    }
  }

  async uploadTestImages(): Promise<void> {
    console.log('Uploading test images...');
    const testImages = [
      { key: 'test.jpg', buffer: await this.createTestJpeg(), contentType: 'image/jpeg' },
      { key: 'test.png', buffer: await this.createTestPng(), contentType: 'image/png' },
      { key: 'test.gif', buffer: await this.createTestGif(), contentType: 'image/gif' },
      { key: 'test.svg', buffer: this.createTestSvg(), contentType: 'image/svg+xml' },
      { key: 'test-animated.gif', buffer: await this.createAnimatedGif(), contentType: 'image/gif' },
      { key: 'test-solid.jpg', buffer: await this.createSolidJpeg(), contentType: 'image/jpeg' },
      ...this.loadStockPhotos(),
    ];

    for (const image of testImages) {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: image.key,
        Body: image.buffer,
        ContentType: image.contentType
      }));
      console.log(`  ✓ Uploaded: ${image.key} (${image.contentType})`);
    }
    console.log(`✓ All test images uploaded to ${this.bucketName}`);
  }

  private async createTestJpeg(): Promise<Buffer> {
    return sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).jpeg().toBuffer();
  }

  private async createTestPng(): Promise<Buffer> {
    return sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 }
      }
    }).png().toBuffer();
  }

  private async createTestGif(): Promise<Buffer> {
    return sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 0, g: 0, b: 255 }
      }
    }).gif().toBuffer();
  }

  private createTestSvg(): Buffer {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#ff6600"/>
  <circle cx="200" cy="150" r="80" fill="#0066ff"/>
  <text x="200" y="155" text-anchor="middle" font-size="24" fill="white">SVG Test</text>
</svg>`;
    return Buffer.from(svg, 'utf-8');
  }

  private async createAnimatedGif(): Promise<Buffer> {
    const frames = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
    ];
    const rawFrames = await Promise.all(
      frames.map(bg => sharp({ create: { width: 200, height: 200, channels: 3, background: bg } }).raw().toBuffer())
    );
    const combined = Buffer.concat(rawFrames);
    return sharp(combined, { raw: { width: 200, height: 600, channels: 3, pageHeight: 200 } } as any)
      .gif({ delay: [500, 500, 500], loop: 0 })
      .toBuffer();
  }

  private async createSolidJpeg(): Promise<Buffer> {
    return sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 128, g: 128, b: 128 }
      }
    }).jpeg().toBuffer();
  }

  private loadStockPhotos(): { key: string; buffer: Buffer; contentType: string }[] {
    const imagesDir = join(__dirname, '../test-images');
    const stockPhotos: { key: string; buffer: Buffer; contentType: string }[] = [];

    const facePhoto = join(imagesDir, 'face.jpg');
    if (existsSync(facePhoto)) {
      stockPhotos.push({ key: 'face.jpg', buffer: readFileSync(facePhoto), contentType: 'image/jpeg' });
    } else {
      console.warn('  ⚠ face.jpg not found in test-images/ — smart-crop tests will fail');
    }

    const moderationPhoto = join(imagesDir, 'moderation.png');
    if (existsSync(moderationPhoto)) {
      stockPhotos.push({ key: 'moderation.png', buffer: readFileSync(moderationPhoto), contentType: 'image/png' });
    } else {
      console.warn('  ⚠ moderation.png not found in test-images/ — content-moderation tests will fail');
    }

    return stockPhotos;
  }

  async deleteBucket(): Promise<void> {
    console.log(`Cleaning up bucket: ${this.bucketName}`);
    const objects = await this.s3Client.send(new ListObjectsV2Command({ Bucket: this.bucketName }));
    
    if (objects.Contents) {
      console.log(`  Deleting ${objects.Contents.length} object(s)...`);
      for (const obj of objects.Contents) {
        await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: obj.Key }));
      }
    }
    
    await this.s3Client.send(new DeleteBucketCommand({ Bucket: this.bucketName }));
    console.log(`✓ Bucket deleted: ${this.bucketName}`);
  }
}
