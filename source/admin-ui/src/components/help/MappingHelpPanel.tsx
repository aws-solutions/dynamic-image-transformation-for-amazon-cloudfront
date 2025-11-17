import React from 'react';
import { HelpPanel, Box, SpaceBetween } from '@cloudscape-design/components';

export const MappingHelpPanel: React.FC = () => (
  <HelpPanel header="Mappings">
    <SpaceBetween direction="vertical" size="m">
      <Box>
        <strong>What are Mappings?</strong>
        <p>
          Mappings define how incoming image requests are routed to specific origins
          and what transformations should be applied. They act as rules that connect
          path patterns to origins and transformation policies.
        </p>
      </Box>

      <Box>
        <strong>Key Features:</strong>
        <ul>
          <li><strong>Path Patterns:</strong> Match incoming requests using wildcards and regex</li>
          <li><strong>Origin Routing:</strong> Direct requests to specific image sources</li>
          <li><strong>Transformation Rules:</strong> Apply specific image processing policies</li>
        </ul>
      </Box>

      <Box>
        <strong>Important:</strong>
        <p>
          Each mapping can specify either a Host header pattern or a Path pattern, but not both.
        </p>
      </Box>

      <Box>
        <strong>Getting Started:</strong>
        <ol>
          <li>Click "Create mapping" to define a new routing rule</li>
          <li>Set path pattern to match incoming requests</li>
          <li>Select the target origin for image sources</li>
          <li>Choose transformation policies to apply</li>
        </ol>
      </Box>

    </SpaceBetween>
  </HelpPanel>
);
