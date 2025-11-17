// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CacheManager } from '../interfaces/cache-manager';
import { TrieCacheConfig } from '../config/cache-defaults';
import { TrieNode, createTrieNode } from '../utils/trie-utils';

/**
 * In-memory trie cache implementation optimized for path-based mapping & host header mapping.
 * Provides efficient prefix matching.
 */
export class TrieCache<T> implements CacheManager<T> {
  private root: TrieNode<T>;
  private readonly config: TrieCacheConfig;
  private itemCount = 0;

  constructor(config: TrieCacheConfig) {
    this.config = config;
    this.root = createTrieNode<T>();
  }

  async get(key: string): Promise<T | null> {
    const segments = this.splitPath(key);
    let current = this.root;

    for (const segment of segments) {
      if (!current.children.has(segment)) {
        return null;
      }
      current = current.children.get(segment)!;
    }

    if (!current.value) {
      return null;
    }

    return current.value;
  }

  async set(key: string, value: T): Promise<void> {
    const segments = this.splitPath(key);
    let current = this.root;

    // Navigate/create path to target node
    for (const segment of segments) {
      if (!current.children.has(segment)) {
        current.children.set(segment, createTrieNode<T>());
      }
      current = current.children.get(segment)!;
    }

    const isNewItem = !current.value;
    current.value = value;

    if (isNewItem) {
      this.itemCount++;
    }
  }

  async delete(key: string): Promise<boolean> {
    const segments = this.splitPath(key);
    const path: TrieNode<T>[] = [this.root];
    let current = this.root;

    // Build path to target node
    for (const segment of segments) {
      if (!current.children.has(segment)) {
        return false; // Key doesn't exist
      }
      current = current.children.get(segment)!;
      path.push(current);
    }

    if (!current.value) {
      return false; // No value at this path
    }

    // Remove value
    current.value = null;
    this.itemCount--;

    // Clean up empty nodes from leaf to root
    this.cleanupEmptyNodes(segments, path);
    return true;
  }

  async clear(): Promise<void> {
    this.root = createTrieNode<T>();
    this.itemCount = 0;
  }

  async has(key: string): Promise<boolean> {
    const segments = this.splitPath(key);
    let current = this.root;

    for (const segment of segments) {
      if (!current.children.has(segment)) {
        return false;
      }
      current = current.children.get(segment)!;
    }

    return !!current.value;
  }

  async size(): Promise<number> {
    return this.itemCount;
  }

  async getAll(): Promise<T[]> {
    const results: T[] = [];
    this.collectAllValues(this.root, results);
    return results;
  }

  private collectAllValues(node: TrieNode<T>, results: T[]): void {
    if (node.value) {
      results.push(node.value);
    }
    for (const child of node.children.values()) {
      this.collectAllValues(child, results);
    }
  }

  /**
   * Recursively explores all possible paths (exact and wildcard) until both match types fail,
   * recording every node with a value(Mapping Object) as a potential match. Returns the longest match found,
   * with exact matches prioritized over wildcards at the same depth.
   */
  async findLongestPrefix(path: string): Promise<T | null> {
    const segments = this.splitPath(path);
    const matches: Array<{ value: T; depth: number; isWildcard: boolean }> = [];

    // Recursive function to explore all possible paths
    const explorePaths = (node: TrieNode<T>, segmentIndex: number, depth: number, hasWildcard: boolean) => {
      // Record match if this node has a value
      if (node.value) {
        // Only record prefix matches if allowed, or if we've consumed all segments (exact/wildcard match)
        if (this.config.allowPrefixMatching || segmentIndex >= segments.length) {
          matches.push({ value: node.value, depth, isWildcard: hasWildcard });
        }
      }

      // If we've processed all segments, stop
      if (segmentIndex >= segments.length) {
        return;
      }

      const currentSegment = segments[segmentIndex];

      // Try exact match first
      if (node.children.has(currentSegment)) {
        explorePaths(node.children.get(currentSegment)!, segmentIndex + 1, depth + 1, hasWildcard);
      }

      // Try wildcard match
      if (node.children.has('*')) {
        explorePaths(node.children.get('*')!, segmentIndex + 1, depth + 1, true);
      }
    };

    // Start exploration from root
    explorePaths(this.root, 0, 0, false);

    if (matches.length === 0) {
      return null;
    }

    // Sort matches: prioritize by depth (longest), then exact matches over wildcards
    matches.sort((a, b) => {
      if (a.depth !== b.depth) {
        return b.depth - a.depth; // Longer matches first
      }
      // Same depth: exact matches beat wildcard matches
      if (a.isWildcard !== b.isWildcard) {
        return a.isWildcard ? 1 : -1;
      }
      return 0;
    });

    return matches[0].value;
  }

  private splitPath(path: string): string[] {
    // Handle root path specially
    if (path === '/' || path === '') {
      return [];
    }
    return path
      .split(this.config.pathSeparator)
      .filter(segment => segment.length > 0)
      .slice(0, this.config.maxDepth);
  }



  private cleanupEmptyNodes(segments: string[], path: TrieNode<T>[]): void {
    // Start from the leaf and work backwards
    for (let i = segments.length - 1; i >= 0; i--) {
      const node = path[i + 1];
      const parent = path[i];
      const segment = segments[i];

      // If node has no value and no children, remove it
      if (!node.value && node.children.size === 0) {
        parent.children.delete(segment);
      } else {
        // Stop cleanup if node still has content
        break;
      }
    }
  }


}
