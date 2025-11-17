// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    reporters: [['default', { summary: false }]],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', ["lcov", { 'projectRoot': '../' }]],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        'src/__tests__/**',
        'src/mocks/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'build/',
        'public/',
        'plugins/',
        '**/*.js',
        'src/e2e-tests'
      ]
    },
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache']
  },
  resolve: {
    alias: {
      '@': '/src',
      '@data-models': new URL('../data-models/index.ts', import.meta.url).pathname
    }
  }
})
