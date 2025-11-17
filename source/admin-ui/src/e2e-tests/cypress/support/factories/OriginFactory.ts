// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface OriginTestData {
  name: string;
  domain: string;
  path?: string;
  headers?: Array<{ name: string; value: string }>;
}

export class OriginFactory {
  static createBasicOrigin(overrides: Partial<OriginTestData> = {}): OriginTestData {
    return {
      name: `Test Origin ${Date.now()}`,
      domain: 'example.com',
      ...overrides
    };
  }

  static createS3Origin(overrides: Partial<OriginTestData> = {}): OriginTestData {
    return {
      name: `S3 Origin ${Date.now()}`,
      domain: 'my-bucket.s3.amazonaws.com',
      path: '/images',
      headers: [
        { name: 'Cache-Control', value: 'max-age=3600' }
      ],
      ...overrides
    };
  }

  static createApiOrigin(overrides: Partial<OriginTestData> = {}): OriginTestData {
    return {
      name: `API Origin ${Date.now()}`,
      domain: 'api.myservice.com',
      path: '/v2',
      headers: [
        { name: 'Authorization', value: 'Bearer api-token' },
        { name: 'User-Agent', value: 'ImageHandler/1.0' },
        { name: 'Accept', value: 'application/json' }
      ],
      ...overrides
    };
  }
}
