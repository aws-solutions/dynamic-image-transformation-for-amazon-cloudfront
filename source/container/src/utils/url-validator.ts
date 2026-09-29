// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { isIP } from 'net';

export class UrlValidator {
  private static readonly ALLOW_LOCALHOST_HTTP = process.env.NODE_ENV === 'test';

  static validate(url: string): void {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname) {
        throw new Error(`Invalid URL: ${url}`);
      }
      if (parsed.protocol === 'http:') {
        const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
        if (isLocalhost && !this.ALLOW_LOCALHOST_HTTP) {
          throw new Error(`HTTP localhost not allowed in production. URL: ${url}`);
        }
        if (!isLocalhost) {
          throw new Error(`HTTP protocol not allowed. Only HTTPS is supported for security. URL: ${url}`);
        }
      } else if (parsed.protocol !== 'https:') {
        throw new Error(`Unsupported protocol '${parsed.protocol}'. Only HTTPS is supported. URL: ${url}`);
      }
      // SSRF: reject origins pointing at private/link-local literals so an attacker-influenced
      // origin can't reach internal VPC services. Runs on every origin path, not just the override.
      this.assertNotPrivateAddress(parsed.hostname, url);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('protocol') || error.message.includes('private'))) {
        throw error;
      }
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  /**
   * Throws if `hostname` is a non-routable IP literal. Non-literal hostnames are left to DNS
   * resolve-and-verify (deferred). Node canonicalizes hex/octal/integer IPv4 forms before this
   * runs, so they need no special handling.
   */
  private static assertNotPrivateAddress(hostname: string, url: string): void {
    const host = hostname.replace(/^\[|\]$/g, '');
    const family = isIP(host);
    if (family === 0) {
      return; // not an IP literal
    }

    const isPrivate = family === 4 ? this.isPrivateIPv4(host) : this.isPrivateIPv6(host);
    if (!isPrivate) {
      return;
    }

    // Loopback allowed only under the test-mode carve-out (local fixtures); all else blocked.
    if (this.ALLOW_LOCALHOST_HTTP && this.isLoopback(host, family)) {
      return;
    }

    throw new Error(`Origin resolves to a private or non-routable address, which is not allowed. URL: ${url}`);
  }

  private static ipv4ToInt(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return null;
    }
    let value = 0;
    for (const part of parts) {
      const octet = Number(part);
      if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
        return null;
      }
      value = value * 256 + octet;
    }
    return value >>> 0;
  }

  private static isPrivateIPv4(ip: string): boolean {
    const n = this.ipv4ToInt(ip);
    if (n === null) {
      return false;
    }
    const inRange = (start: number, end: number): boolean => n >= start && n <= end;
    return (
      inRange(0x0a000000, 0x0affffff) || // 10.0.0.0/8
      inRange(0xac100000, 0xac1fffff) || // 172.16.0.0/12
      inRange(0xc0a80000, 0xc0a8ffff) || // 192.168.0.0/16
      inRange(0x7f000000, 0x7fffffff) || // 127.0.0.0/8 (loopback)
      inRange(0xa9fe0000, 0xa9feffff) || // 169.254.0.0/16 (link-local, incl. IMDS/ECS creds)
      inRange(0x64400000, 0x647fffff) || // 100.64.0.0/10 (CGNAT / shared address space)
      inRange(0x00000000, 0x00ffffff) //   0.0.0.0/8 ("this network", incl. 0.0.0.0)
    );
  }

  /** Expands an IPv6 literal (including `::` compression and embedded IPv4) to 16 bytes. */
  private static ipv6ToBytes(input: string): number[] | null {
    let host = input.split('%')[0]; // drop any zone id
    let embeddedV4Bytes: number[] | null = null;
    if (host.includes('.')) {
      const idx = host.lastIndexOf(':');
      const v4 = host.slice(idx + 1);
      const v4Int = this.ipv4ToInt(v4);
      if (v4Int === null) {
        return null;
      }
      embeddedV4Bytes = [(v4Int >>> 24) & 0xff, (v4Int >>> 16) & 0xff, (v4Int >>> 8) & 0xff, v4Int & 0xff];
      host = host.slice(0, idx + 1) + '0:0';
    }

    const halves = host.split('::');
    if (halves.length > 2) {
      return null;
    }
    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
    const missing = 8 - head.length - tail.length;
    if (halves.length === 1 && head.length !== 8) {
      return null;
    }
    if (halves.length === 2 && missing < 1) {
      return null;
    }
    const groups = [...head, ...Array(Math.max(0, missing)).fill('0'), ...tail].map((g) => parseInt(g || '0', 16));
    if (groups.length !== 8 || groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) {
      return null;
    }
    const bytes: number[] = [];
    for (const group of groups) {
      bytes.push((group >> 8) & 0xff, group & 0xff);
    }
    if (embeddedV4Bytes) {
      bytes.splice(12, 4, ...embeddedV4Bytes);
    }
    return bytes;
  }

  private static isPrivateIPv6(ip: string): boolean {
    const bytes = this.ipv6ToBytes(ip);
    if (!bytes || bytes.length !== 16) {
      return false;
    }
    if (bytes.every((b) => b === 0)) {
      return true; // :: (unspecified)
    }
    if (bytes.slice(0, 15).every((b) => b === 0) && bytes[15] === 1) {
      return true; // ::1 (loopback)
    }
    if ((bytes[0] & 0xfe) === 0xfc) {
      return true; // fc00::/7 (unique local address)
    }
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) {
      return true; // fe80::/10 (link-local)
    }
    // IPv4-mapped (::ffff:0:0/96) — validate the embedded IPv4 against the v4 rules.
    const isMapped = bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
    if (isMapped) {
      return this.isPrivateIPv4(`${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`);
    }
    return false;
  }

  private static isLoopback(host: string, family: number): boolean {
    if (family === 4) {
      const n = this.ipv4ToInt(host);
      return n !== null && n >= 0x7f000000 && n <= 0x7fffffff;
    }
    const bytes = this.ipv6ToBytes(host);
    return !!bytes && bytes.slice(0, 15).every((b) => b === 0) && bytes[15] === 1;
  }
}
