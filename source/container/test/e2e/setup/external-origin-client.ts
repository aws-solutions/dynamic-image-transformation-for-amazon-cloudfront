// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client, CreateBucketCommand, PutObjectCommand, DeleteObjectCommand, DeleteBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

export class ExternalOriginClient {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private region: string) {
    this.s3Client = new S3Client({ region });
    this.bucketName = `dit-e2e-${randomUUID().substring(0, 8)}`;
  }

  async createBucket(): Promise<void> {
    await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
  }

  async uploadTestImages(): Promise<void> {
    const testImagesDir = join(__dirname, '../test-images');
    const files = readdirSync(testImagesDir).filter(f => f.match(/\.(jpg|png|gif)$/i));

    for (const file of files) {
      const buffer = readFileSync(join(testImagesDir, file));
      const contentType = `image/${file.split('.').pop()}`;

      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: file,
        Body: buffer,
        ContentType: contentType
      }));
    }
  }

  async deleteBucket(): Promise<void> {
    const objects = await this.s3Client.send(new ListObjectsV2Command({ Bucket: this.bucketName }));
    
    if (objects.Contents) {
      for (const obj of objects.Contents) {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: obj.Key!
        }));
      }
    }

    await this.s3Client.send(new DeleteBucketCommand({ Bucket: this.bucketName }));
  }

  getOriginUrl(): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;
  }

  getBucketName(): string {
    return this.bucketName;
  }
}
