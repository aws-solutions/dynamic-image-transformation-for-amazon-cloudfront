// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TrieNode, createTrieNode, getTrieDepth, collectTriePaths } from '../../../services/cache/utils/trie-utils';

/**
 * Calculate the total number of nodes in a trie
 * Useful for memory usage monitoring in tests
 */
function countTrieNodes<T>(root: TrieNode<T>): number {
  let count = 1; // Count the root
  
  for (const child of root.children.values()) {
    count += countTrieNodes(child);
  }
  
  return count;
}

describe('TrieUtils', () => {
  let root: TrieNode<string>;

  beforeEach(() => {
    root = createTrieNode<string>();
  });

  describe('createTrieNode', () => {
    it('should create empty trie node', () => {
      const node = createTrieNode<string>();
      
      expect(node.children).toEqual(new Map());
      expect(node.value).toBeNull();
    });
  });

  describe('countTrieNodes', () => {
    it('should count single node', () => {
      expect(countTrieNodes(root)).toBe(1);
    });
  });

  describe('getTrieDepth', () => {
    it('should return 0 for empty trie', () => {
      expect(getTrieDepth(root)).toBe(0);
    });
  });

  describe('collectTriePaths', () => {
    it('should return empty array for empty trie', () => {
      const paths = collectTriePaths(root);
      expect(paths).toEqual([]);
    });

    it('should collect paths with values', () => {
      root.value = 'root-value';
      const child = createTrieNode<string>();
      child.value = 'child-value';
      root.children.set('test', child);
      
      const paths = collectTriePaths(root);
      expect(paths).toHaveLength(2);
      expect(paths).toContainEqual({ path: '', value: 'root-value' });
      expect(paths).toContainEqual({ path: 'test', value: 'child-value' });
    });
  });
});
