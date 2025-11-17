// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Plugin } from 'vite';
import { execSync } from 'child_process';
import { writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

interface ManifestPluginOptions {
  name: string;
  description: string;
  solutionId: string;
}

export function manifestPlugin(options: ManifestPluginOptions): Plugin {
  return {
    name: 'manifest-generator',
    closeBundle() {
      const getGitInfo = (command: string, fallback: string = 'unknown') => {
        try {
          return execSync(command, { encoding: 'utf8' }).trim();
        } catch {
          return fallback;
        }
      };

      // Get all files in the build directory
      const buildDir = 'build';
      const getAllFiles = (dir: string, baseDir: string = dir): string[] => {
        const files: string[] = [];
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          const relativePath = relative(baseDir, fullPath);
          
          if (statSync(fullPath).isDirectory()) {
            files.push(...getAllFiles(fullPath, baseDir));
          } else {
            files.push(relativePath.replace(/\\/g, '/'));
          }
        }
        return files;
      };

      const files = getAllFiles(buildDir).filter(f => f !== 'manifest.json').sort();

      const manifest = {
        name: options.name,
        version: options.version,
        description: options.description,
        solution_id: options.solutionId,
        build_timestamp: new Date().toISOString(),
        files
      };

      writeFileSync(
        join(buildDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );
    }
  };
}