import React from 'react';
import { Container, Button, Box, Alert } from '@cloudscape-design/components';

interface Props {
  error?: Error;
  onRetry?: () => void;
}

export const GlobalErrorFallback: React.FC<Props> = ({ error, onRetry }) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <Container>
      <Box padding="xxl" textAlign="center">
        <Alert
          statusIconAriaLabel="Error"
          type="error"
          header="Application Error"
          action={
            <Button variant="primary" onClick={handleRetry}>
              Reload Application
            </Button>
          }
        >
          <Box variant="p">
            Something went wrong and the application crashed. Please try reloading the page.
          </Box>
          {error && (
            <Box variant="small" color="text-status-error" margin={{ top: 's' }}>
              {error.message}
            </Box>
          )}
        </Alert>
      </Box>
    </Container>
  );
};
