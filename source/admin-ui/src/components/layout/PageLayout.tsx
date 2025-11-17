import React, { useState } from 'react';
import { Box, AppLayout, SideNavigation } from '@cloudscape-design/components';
import { TopNavigation } from '../common/TopNavigation';
import { AuthService } from '../../services/authService';
import { NAVIGATION_ITEMS } from '../../constants/navigation';
import { ROUTES } from '../../constants/routes';

interface PageLayoutProps {
  children: React.ReactNode;
  onNavigate?: (href: string) => void;
  activeHref?: string;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ 
  children, 
  onNavigate, 
  activeHref = ROUTES.ORIGINS
}) => {
  const [navigationOpen, setNavigationOpen] = useState(true);

  const handleSignOut = async () => {
    await AuthService.signOut();
    window.location.href = '/';
  };

  return (
    <Box>
      <TopNavigation onSignOut={handleSignOut} />
      
      <AppLayout
        navigation={
          <SideNavigation
            activeHref={activeHref}
            items={NAVIGATION_ITEMS}
            onFollow={(event) => {
              if (!event.detail.external) {
                event.preventDefault();
                onNavigate?.(event.detail.href);
              }
            }}
          />
        }
        content={children}
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        toolsHide={true}
      />
    </Box>
  );
};
