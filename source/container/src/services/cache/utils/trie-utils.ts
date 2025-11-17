// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Trie node structure for hierarchical path-based caching
 */
export interface TrieNode<T> {
  /** Stored value at this node (null if no value) */
  value: T | null;
  
  /** Child nodes mapped by path segment */
  children: Map<string, TrieNode<T>>;
}

/**
 * Create a new empty trie node
 */
export function createTrieNode<T>(): TrieNode<T> {
  return {
    value: null,
    children: new Map()
  };
}

/**
 * Calculate the depth of a trie
 * Useful for performance monitoring
 */
export function getTrieDepth<T>(root: TrieNode<T>): number {
  if (root.children.size === 0) {
    return 0;
  }
  
  let maxDepth = 0;
  for (const child of root.children.values()) {
    const childDepth = getTrieDepth(child);
    maxDepth = Math.max(maxDepth, childDepth);
  }
  
  return maxDepth + 1;
}

/**
 * Collect all paths with values in the trie
 * Useful for debugging and cache inspection
 */
export function collectTriePaths<T>(
  root: TrieNode<T>, 
  separator: string = '/'
): Array<{ path: string; value: T }> {
  const paths: Array<{ path: string; value: T }> = [];
  
  function traverse(node: TrieNode<T>, currentPath: string[]) {
    if (node.value !== null) {
      paths.push({
        path: currentPath.join(separator),
        value: node.value
      });
    }
    
    for (const [segment, child] of node.children) {
      traverse(child, [...currentPath, segment]);
    }
  }
  
  traverse(root, []);
  return paths;
}
