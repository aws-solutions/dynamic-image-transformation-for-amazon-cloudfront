// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client as AWSS3Client, PutObjectCommand, CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomBytes } from 'crypto';

export class S3Client {
  private s3Client: AWSS3Client;
  private bucketName: string;

  constructor(private region: string, bucketName?: string) {
    this.s3Client = new AWSS3Client({ region });
    this.bucketName = bucketName || `dit-e2e-test-${randomBytes(8).toString('hex')}`;
  }

  async createBucket(): Promise<void> {
    console.log(`Creating S3 bucket: ${this.bucketName}`);
    await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
    console.log(`✓ Bucket created: ${this.bucketName}`);
  }

  getBucketName(): string {
    return this.bucketName;
  }

  async uploadTestImages(): Promise<void> {
    console.log('Uploading test images...');
    const testImages = [
      { key: 'test.jpg', buffer: await this.createTestJpeg(), contentType: 'image/jpeg' },
      { key: 'test.png', buffer: await this.createTestPng(), contentType: 'image/png' },
      { key: 'test.gif', buffer: await this.createTestGif(), contentType: 'image/gif' },
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
