// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class S3UrlHelper {
  private static readonly S3_URL_REGEX = /(^https?:\/\/s3[.-]|\.s3[.-])([a-z0-9-]+\.)?amazonaws\.com/;

  static isS3Url(url: string): boolean {
    return this.S3_URL_REGEX.test(url);
  }

  // Extracts bucket and key from S3 URLs in path-style and virtual-hosted-style formats
  static parseS3Url(url: string): { bucket: string; key: string } {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname.substring(1);
    
    if (hostname.startsWith('s3.') || hostname.startsWith('s3-')) {
      const pathParts = pathname.split('/');
      const bucket = pathParts[0];
      const key = pathParts.slice(1).join('/');
      return { bucket, key };
    } else if (hostname.includes('.s3.') || hostname.includes('.s3-')) {
      const bucket = hostname.split('.')[0];
      const key = pathname;
      return { bucket, key };
    }

    throw new Error('Invalid S3 URL format');
  }

  // Maps HTTP headers to S3 SDK property names for conditional requests, encryption, and metadata
  static mapHeaderToS3Property(headerName: string): string {
    const headerMap: Record<string, string> = {
      'if-match': 'IfMatch',
      'if-none-match': 'IfNoneMatch',
      'if-modified-since': 'IfModifiedSince',
      'if-unmodified-since': 'IfUnmodifiedSince',
      'x-amz-server-side-encryption-customer-algorithm': 'SSECustomerAlgorithm',
      'x-amz-server-side-encryption-customer-key': 'SSECustomerKey',
      'x-amz-server-side-encryption-customer-key-md5': 'SSECustomerKeyMD5',
      'x-amz-request-payer': 'RequestPayer',
      'x-amz-expected-bucket-owner': 'ExpectedBucketOwner',
      'x-amz-checksum-mode': 'ChecksumMode'
    };
    return headerMap[headerName] || headerName;
  }
}
