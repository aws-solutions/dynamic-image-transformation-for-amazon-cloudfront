import React from 'react';
import { Alert, Button, Box } from '@cloudscape-design/components';

interface Props {
  title: string;
  message?: string;
  onRetry?: () => void;
  error?: Error;
}

export const FeatureErrorFallback: React.FC<Props> = ({ 
  title, 
  message = "This feature encountered an error and couldn't load properly.", 
  onRetry,
  error 
}) => {
  return (
    <Alert
      statusIconAriaLabel="Error"
      type="error"
      header={title}
      action={
        onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try Again
          </Button>
        )
      }
    >
      <Box variant="p">{message}</Box>
      {error && process.env.NODE_ENV === 'development' && (
        <Box variant="small" color="text-status-error" margin={{ top: 's' }}>
          {error.message}
        </Box>
      )}
    </Alert>
  );
};

// Specific fallbacks for common features
export const PolicyListError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <FeatureErrorFallback
    title="Policy List Error"
    message="Unable to load the policy list. Please try again."
    onRetry={onRetry}
  />
);

export const OriginListError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <FeatureErrorFallback
    title="Origin List Error"
    message="Unable to load the origin list. Please try again."
    onRetry={onRetry}
  />
);

export const DashboardError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <FeatureErrorFallback
    title="Dashboard Error"
    message="Unable to load the dashboard. Please try again."
    onRetry={onRetry}
  />
);

export const MappingListError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <FeatureErrorFallback
    title="Mapping List Error"
    message="Unable to load the mapping list. Please try again."
    onRetry={onRetry}
  />
);

export const OriginMappingError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <FeatureErrorFallback
    title="Origin Mapping Error"
    message="Unable to load origin mappings. Please try again."
    onRetry={onRetry}
  />
);
