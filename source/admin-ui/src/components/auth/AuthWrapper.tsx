import React from 'react';
import { Spinner } from '@cloudscape-design/components';
import { useUser } from '../../contexts/UserContext';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spinner size="large" />
        <div style={{ marginTop: '16px' }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    // If on logout completion page, don't auto-redirect
    if (window.location.pathname === '/auth/logout-complete') {
      return <>{children}</>;
    }
    
    // For first-time visitors or expired sessions, show spinner and auto-redirect
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spinner size="large" />
        <div style={{ marginTop: '16px' }}>Redirecting to login...</div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthWrapper;