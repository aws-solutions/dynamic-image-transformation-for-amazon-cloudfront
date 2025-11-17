import React from 'react';
import { Box, Spinner } from '@cloudscape-design/components';

export const LoadingFallback: React.FC = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
    <Spinner size="large" />
  </Box>
);
