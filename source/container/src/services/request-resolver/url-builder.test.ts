// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UrlBuilder } from './url-builder';
import { OriginConfiguration } from '../cache/domain/origin-cache';

describe('UrlBuilder.resolvePath', () => {
  const DOMAIN = 'https://example.com';
  const mockReq = (path: string) => ({ path } as any);

  describe('without originPath', () => {
    const origin: OriginConfiguration = {
      originDomain: DOMAIN,
      originPath: ''
    } as OriginConfiguration;

    it('should handle /path/image.png', () => {
      const result = UrlBuilder.buildOriginUrl(mockReq('/path/image.png'), origin);
      expect(result).toBe(`${DOMAIN}/path/image.png`);
    });

    it('should handle /image.png', () => {
      const result = UrlBuilder.buildOriginUrl(mockReq('/image.png'), origin);
      expect(result).toBe(`${DOMAIN}/image.png`);
    });
  });

  describe('with originPath having leading slash', () => {
    const origin: OriginConfiguration = {
      originDomain: DOMAIN,
      originPath: '/origin'
    } as OriginConfiguration;

    it('should handle /path/image.png with /origin', () => {
      const result = UrlBuilder.buildOriginUrl(mockReq('/path/image.png'), origin);
      expect(result).toBe(`${DOMAIN}/path/origin/image.png`);
    });

    it('should handle /image.png with /origin', () => {
      const result = UrlBuilder.buildOriginUrl(mockReq('/image.png'), origin);
      expect(result).toBe(`${DOMAIN}/origin/image.png`);
    });
  });

  describe('with originPath having trailing slash', () => {
    const origin: OriginConfiguration = {
      originDomain: DOMAIN,
      originPath: 'origin/'
    } as OriginConfiguration;

    it('should handle /path/image.png with origin/', () => {
      const result = UrlBuilder.buildOriginUrl(mockReq('/path/image.png'), origin);
      expect(result).toBe(`${DOMAIN}/path/origin/image.png`);
    });

    it('should handle /image.png with origin/', () => {
      const result = UrlBuilder.buildOriginUrl(mockReq('/image.png'), origin);
      expect(result).toBe(`${DOMAIN}/origin/image.png`);
    });
  });

  describe('with originPath having both leading and trailing slash', () => {
    const origin: OriginConfiguration = {
      originDomain: DOMAIN,
      originPath: '/origin/'
    } as OriginConfiguration;

    it('should handle /path/image.png with /origin/', () => {
      const result = UrlBuilder.buildOriginUrl(mockReq('/path/image.png'), origin);
      expect(result).toBe(`${DOMAIN}/path/origin/image.png`);
    });

    it('should handle /image.png with /origin/', () => {
      const result = UrlBuilder.buildOriginUrl(mockReq('/image.png'), origin);
      expect(result).toBe(`${DOMAIN}/origin/image.png`);
    });
  });

  describe('with originPath having no slashes', () => {
    const origin: OriginConfiguration = {
      originDomain: DOMAIN,
      originPath: 'origin'
    } as OriginConfiguration;

    it('should handle /path/image.png with origin', () => {
      const result = UrlBuilder.buildOriginUrl(mockReq('/path/image.png'), origin);
      expect(result).toBe(`${DOMAIN}/path/origin/image.png`);
    });

    it('should handle /image.png with origin', () => {
      const result = UrlBuilder.buildOriginUrl(mockReq('/image.png'), origin);
      expect(result).toBe(`${DOMAIN}/origin/image.png`);
    });
  });

  describe('edge cases', () => {
    it('should handle root path with no originPath', () => {
      const origin: OriginConfiguration = {
        originDomain: DOMAIN,
        originPath: ''
      } as OriginConfiguration;
      const result = UrlBuilder.buildOriginUrl(mockReq('/'), origin);
      expect(result).toBe(`${DOMAIN}/`);
    });

    it('should handle root path with originPath', () => {
      const origin: OriginConfiguration = {
        originDomain: DOMAIN,
        originPath: '/origin'
      } as OriginConfiguration;
      const result = UrlBuilder.buildOriginUrl(mockReq('/'), origin);
      expect(result).toBe(`${DOMAIN}/origin`);
    });
  });
});
