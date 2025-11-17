import React from 'react';
import { HelpPanel, Box, SpaceBetween } from '@cloudscape-design/components';

export const OriginHelpPanel: React.FC = () => (
  <HelpPanel header="Origins">
    <SpaceBetween direction="vertical" size="m">
      <Box>
        <strong>What are Origins?</strong>
        <p>
          Origins are the source servers where your original images are stored. 
          The Dynamic Image Transformation solution fetches images from these origins 
          and applies transformations before serving them through CloudFront.
        </p>
      </Box>

      <Box>
        <strong>Key Features:</strong>
        <ul>
          <li><strong>S3 Origins:</strong> Use Amazon S3 buckets as image sources</li>
          <li><strong>HTTP Origins:</strong> Connect to external web servers or CDNs</li>
          <li><strong>Path Mapping:</strong> Define how URLs map to your origin structure</li>
        </ul>
      </Box>

      <Box>
        <strong>Getting Started:</strong>
        <ol>
          <li>Click "Create origin" to add a new image source</li>
          <li>Choose between S3 bucket or HTTP origin type</li>
          <li>Configure access permissions and security settings</li>
          <li>Test your origin configuration</li>
        </ol>
      </Box>

    </SpaceBetween>
  </HelpPanel>
);
