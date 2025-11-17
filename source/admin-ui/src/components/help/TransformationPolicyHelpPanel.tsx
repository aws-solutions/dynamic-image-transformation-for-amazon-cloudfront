import React from 'react';
import { HelpPanel, Box, SpaceBetween } from '@cloudscape-design/components';

export const TransformationPolicyHelpPanel: React.FC = () => (
  <HelpPanel header="Transformation Policies">
    <SpaceBetween direction="vertical" size="m">
      <Box>
        <strong>What are Transformation Policies?</strong>
        <p>
          Transformation policies define how images should be processed and optimized.
          They contain rules for resizing, format conversion, quality adjustment,
          and other image transformations that can be applied automatically.
        </p>
      </Box>

      <Box>
        <strong>Key Features:</strong>
        <ul>
          <li><strong>Image Resizing:</strong> Automatic scaling based on device or viewport</li>
          <li><strong>Format Optimization:</strong> Convert to WebP, AVIF, or other modern formats</li>
          <li><strong>Quality Control:</strong> Adjust compression for optimal file size</li>
          <li><strong>Smart Cropping:</strong> Focus on important image areas</li>
        </ul>
      </Box>

      <Box>
        <strong>Getting Started:</strong>
        <ol>
          <li>Click "Create transformation policy" to define processing rules</li>
          <li>Set transformation parameters (resize, format, quality)</li>
          <li>Configure optimization settings</li>
          <li>Test with sample images</li>
          <li>Apply to mappings for automatic processing</li>
        </ol>
      </Box>

    </SpaceBetween>
  </HelpPanel>
);