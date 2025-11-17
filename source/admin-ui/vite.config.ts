// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { manifestPlugin } from './plugins/manifest-plugin'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    manifestPlugin({
      name: 'Admin UI - Dynamic Image Transformation for Amazon CloudFront',
      description: 'Admin UI for managing image transformation origins and mappings',
      solutionId: 'SO0023'
    })
  ],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'build',
    sourcemap: false,
    rollupOptions: {
      external: ['@cloudscape-design/collection-hooks'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom']
        }
      }
    },
    copyPublicDir: false
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@data-models': path.resolve(__dirname, '../data-models/index.ts')
    }
  },
  optimizeDeps: {
    include: ['@cloudscape-design/collection-hooks']
  }
})