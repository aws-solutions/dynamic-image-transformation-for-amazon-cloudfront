import React, { useState } from 'react';
import { AppLayout, BreadcrumbGroup, SideNavigation } from '@cloudscape-design/components';
import { useNavigate } from 'react-router';
import { TopNavigation } from '../common/TopNavigation';
import { NAVIGATION_ITEMS } from '../../constants/navigation';

interface BreadcrumbItem {
  text: string;
  href?: string;
}

interface PageLayoutProps {
  activeHref: string;
  breadcrumbs: BreadcrumbItem[];
  helpPanel?: React.ReactNode;
  children: React.ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  activeHref,
  breadcrumbs,
  helpPanel,
  children,
}) => {
  const navigate = useNavigate();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);

  return (
    <>
      <TopNavigation />
      <AppLayout
        navigation={
          <SideNavigation
            activeHref={activeHref}
            items={NAVIGATION_ITEMS}
            onFollow={(event) => {
              if (!event.detail.external) {
                event.preventDefault();
                navigate(event.detail.href);
              }
            }}
          />
        }
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        breadcrumbs={
          <BreadcrumbGroup
            items={breadcrumbs.map((b) => ({ text: b.text, href: b.href ?? '#' }))}
            onFollow={(event) => {
              event.preventDefault();
              if (event.detail.href && event.detail.href !== '#') {
                navigate(event.detail.href);
              }
            }}
          />
        }
        tools={helpPanel}
        toolsOpen={helpPanelOpen}
        onToolsChange={({ detail }) => setHelpPanelOpen(detail.open)}
        toolsHide={!helpPanel}
        content={children}
      />
    </>
  );
};
