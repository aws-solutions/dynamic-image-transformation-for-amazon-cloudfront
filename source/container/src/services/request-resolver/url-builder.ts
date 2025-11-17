// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { OriginConfiguration } from '../cache/domain/origin-cache';

export class UrlBuilder {
  static buildOriginUrl(req: Request, originResult: OriginConfiguration): string {
    const path = this.buildFullPath(req.path, originResult);
    return originResult.originDomain + path;
  }

  private static buildFullPath(requestPath: string, originResult: OriginConfiguration): string {
    const { directory, filename } = this.splitPath(requestPath);
    const startsWithSlash = requestPath.startsWith('/');
    const segments = [];
    
    if (directory) {
      segments.push(directory);
    }
    
    if (originResult.originPath) {
      segments.push(originResult.originPath);
    }
    
    if (filename) {
      segments.push(filename);
    }
    
    const result = this.joinPathSegments(...segments);
    return startsWithSlash && !result.startsWith('/') ? '/' + result : result;
  }

  private static joinPathSegments(...segments: string[]): string {
    const filtered = segments.filter(s => s.length > 0);
    if (filtered.length === 0) return '';
    
    const normalized = filtered.map((segment, index) => {
      let result = segment;
      if (index > 0 && result.startsWith('/')) {
        result = result.substring(1);
      }
      if (index < filtered.length - 1 && result.endsWith('/')) {
        result = result.slice(0, -1);
      }
      return result;
    });
    
    return normalized.join('/');
  }

  private static splitPath(fullPath: string): { directory: string; filename: string } {
    const lastSlashIndex = fullPath.lastIndexOf('/');
    
    if (lastSlashIndex === -1) {
      return { directory: '', filename: fullPath };
    }
    
    if (lastSlashIndex === fullPath.length - 1) {
      return { directory: fullPath.slice(0, -1), filename: '' };
    }
    
    return {
      directory: fullPath.substring(0, lastSlashIndex),
      filename: fullPath.substring(lastSlashIndex + 1)
    };
  }
}
