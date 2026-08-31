// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { HelpPanel, Box, SpaceBetween } from '@cloudscape-design/components';

export const PlaygroundHelpPanel: React.FC = () => (
  <HelpPanel header="Playground">
    <SpaceBetween direction="vertical" size="m">
      <Box>
        <strong>What is the Playground?</strong>
        <p>
          The Playground lets you test image transformations and output optimizations
          against your deployed image processing pipeline. See how different device
          types, browser capabilities, and transformation parameters affect the output.
        </p>
      </Box>

      <Box>
        <strong>How to use:</strong>
        <ol>
          <li><strong>Enter an image path</strong> — This must match a configured URL mapping
            (e.g., <code>/images/photo.jpg</code>). If no mapping matches, the request will fail.</li>
          <li><strong>Configure transformations</strong> — Set resize, format, quality,
            or other image operations. These override policy transformations of the same type.</li>
          <li><strong>Select output optimization presets</strong> — Choose a device
            and/or browser preset to simulate real-world client behavior. These send client hint
            headers that the policy uses for adaptive optimization.</li>
          <li><strong>Click "Send Request"</strong> — The image is fetched with your configuration
            and results are displayed with performance metrics.</li>
        </ol>
      </Box>

      <Box>
        <strong>Important:</strong>
        <ul>
          <li>The image path must match a configured <strong>URL Mapping</strong>. Check the
            Mappings page to see available paths.</li>
          <li>Output Optimizations (device/browser presets) only work if the resolved
            <strong> Transformation Policy</strong> has Output Optimizations configured
            (format auto, quality DPR ranges, or autosize breakpoints).</li>
          <li>Transformations set explicitly (e.g., format = WebP) will override the
            policy's auto-optimization for that type.</li>
          <li>When format or quality is left as "Not set", the policy's output optimizations
            control the value. Set an explicit value only to override the policy.</li>
        </ul>
      </Box>

      <Box>
        <strong>Understanding the results:</strong>
        <ul>
          <li><strong>Client Response Time</strong> — Total round-trip from browser to CloudFront
            to container and back. Includes network latency.</li>
          <li><strong>Origin Fetch</strong> — Time the container spent retrieving the original
            image from the origin (e.g., S3).</li>
          <li><strong>Transformation</strong> — Time spent applying image operations
            (resize, format conversion, etc.).</li>
          <li><strong>Total Server Time</strong> — Total processing time inside the container
            (origin fetch + transformation + routing overhead).</li>
          <li><strong>Optimization Impact</strong> — Shows original vs output size, dimensions,
            format, and compression ratio. This panel requires an authenticated session.
            If you only see Performance Metrics, ensure you are logged in.</li>
        </ul>
      </Box>
    </SpaceBetween>
  </HelpPanel>
);
