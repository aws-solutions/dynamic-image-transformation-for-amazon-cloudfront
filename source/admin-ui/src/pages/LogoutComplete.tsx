import React, { useEffect } from 'react';
import { Button, Container, Header, SpaceBetween, Box } from '@cloudscape-design/components';
import { signInWithRedirect } from 'aws-amplify/auth';

const LogoutComplete: React.FC = () => {
  // Replace history entry to prevent back button confusion
  useEffect(() => {
    window.history.replaceState(null, "", "/auth/logout-complete");
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithRedirect();
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Container>
        <SpaceBetween direction="vertical" size="l">
          <Box textAlign="center">
            <Header variant="h1">Signed Out</Header>
          </Box>
          
          <Box textAlign="center">
            <SpaceBetween direction="vertical" size="m">
              <Box variant="p">
                You have been successfully signed out of Dynamic Image Transformation for Amazon CloudFront.
              </Box>
              <Button 
                variant="primary" 
                size="large"
                onClick={handleSignIn}
              >
                Sign In Again
              </Button>
            </SpaceBetween>
          </Box>
        </SpaceBetween>
      </Container>
    </div>
  );
};

export default LogoutComplete;
