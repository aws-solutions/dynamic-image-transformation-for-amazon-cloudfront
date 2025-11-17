import React from 'react';
import { TopNavigation as CloudscapeTopNavigation } from '@cloudscape-design/components';
import { signOut } from 'aws-amplify/auth';
import { useNavigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { useUser } from '../../contexts/UserContext';

interface TopNavigationProps {
  onSignOut?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ 
  onSignOut
}) => {
  const { email, user } = useUser();
  const navigate = useNavigate();

  const userEmail = email || user?.username || 'User';
  
  const handleSignOut = async () => {
    try {
      await signOut({ global: true });
      sessionStorage.clear();
      const config = Amplify.getConfig();
      const cognitoDomain = config.Auth?.Cognito?.loginWith?.oauth?.domain;
      const clientId = config.Auth?.Cognito?.userPoolClientId;
      
      if (cognitoDomain && clientId) {
        const returnTo = `${window.location.origin}/auth/logout-complete`;
        const u = new URL(`https://${cognitoDomain}/logout`);
        u.searchParams.set("client_id", clientId);
        u.searchParams.set("logout_uri", returnTo); // Use logout_uri, not redirect_uri
        u.searchParams.set("state", crypto.randomUUID()); // Optional CSRF protection
        
        // Full redirect (bypass SPA router)
        window.location.assign(u.toString());
      } else {
        navigate('/auth/logout-complete', { replace: true });
      }
      
    } catch (error) {
      sessionStorage.clear();
      navigate('/auth/logout-complete', { replace: true });
    }
  };

  return (
    <CloudscapeTopNavigation
      identity={{
        href: '/',
        title: 'Dynamic Image Transformation for Amazon CloudFront'
      }}
      utilities={[
        {
          type: 'menu-dropdown',
          text: userEmail,
          iconName: 'user-profile',
          items: [
            {
              id: 'signout',
              text: 'Sign out'
            }
          ],
          onItemClick: ({ detail }) => {
            if (detail.id === 'signout') {
              handleSignOut();
            }
          }
        }
      ]}
    />
  );
};