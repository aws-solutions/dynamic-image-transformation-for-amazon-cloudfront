import React, { useState, useEffect } from 'react';
import {
  AppLayout,
  Box,
  SpaceBetween,
  Flashbar,
  SideNavigation,
} from '@cloudscape-design/components';
import { useLocation, useNavigate } from 'react-router-dom';
import { TopNavigation } from '../components/common/TopNavigation';
import { BreadcrumbBar } from '../components/common/BreadcrumbBar';
import { OriginTable } from '../components/tables/OriginTable';
import { OriginModals } from '../components/modals/OriginModals';
import { OriginHelpPanel } from '../components/help/OriginHelpPanel';
import { OriginProvider, useOriginContext } from '../contexts/OriginContext';
import { useApp } from '../contexts/AppContext';
import { useOriginModals } from '../hooks/useOriginModals';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { AuthService } from '../services/authService';
import { ErrorBoundary } from '../components/error/ErrorBoundary';
import { useTypedNavigate } from '../hooks/useTypedNavigate';
import { OriginListError } from '../components/error/FeatureErrorFallback';
import { NAVIGATION_ITEMS } from '../constants/navigation';
import { ROUTES } from '../constants/routes';

const OriginContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { allOrigins, deleteOrigin } = useOriginContext();
  const { messages, addMessage, dismissMessage } = useFlashMessages();
  const { showDeleteModal, deletingOrigin, openDeleteModal, closeDeleteModal } = useOriginModals();

  const [processedTimestamp, setProcessedTimestamp] = useState<number | null>(null);

  // Handle success message from navigation state
  useEffect(() => {
    const messageTimestamp = location.state?.timestamp;
    if (
      location.state?.message && 
      location.state?.type === 'success' && 
      messageTimestamp &&
      messageTimestamp !== processedTimestamp
    ) {
      setProcessedTimestamp(messageTimestamp);
      addMessage({
        type: 'success',
        content: location.state.message,
        dismissible: true
      });
      // Clear the navigation state immediately to prevent duplicates
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state?.message, location.state?.timestamp, addMessage, navigate, processedTimestamp]);

  const handleConfirmDelete = async () => {
    if (!deletingOrigin) return;

    const result = await deleteOrigin(deletingOrigin.originId);
    
    addMessage({
      type: result.success ? 'success' : 'error',
      content: result.success 
        ? `Successfully deleted origin "${deletingOrigin.originName}"`
        : result.error || 'Failed to delete origin. Please try again.',
      dismissible: true
    });
    
    closeDeleteModal();
  };

  return (
    <>
      <Flashbar 
        items={messages.map(msg => ({
          ...msg,
          onDismiss: () => {
            if (msg.id) {
              dismissMessage(msg.id);
            }
          }
        }))}
      />
      <SpaceBetween direction="vertical" size="l">
        <OriginTable onDeleteClick={openDeleteModal} />
      </SpaceBetween>

      <OriginModals
        showDeleteModal={showDeleteModal}
        onCloseDeleteModal={closeDeleteModal}
        onConfirmDelete={handleConfirmDelete}
        deletingOrigin={deletingOrigin}
      />
    </>
  );
};

export const Origins: React.FC = () => {
  const { toOrigins, toMappings } = useTypedNavigate();
  const { user } = useApp();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const breadcrumbs = [
    { text: 'Home', href: '/' },
    { text: 'Origins' }
  ];

  const handleSignOut = async () => {
    await AuthService.signOut();
    window.location.href = '/';
  };

  return (
    <OriginProvider>
      <Box>
        <TopNavigation onSignOut={handleSignOut} />
        <BreadcrumbBar 
          breadcrumbs={breadcrumbs} 
          onHelpClick={() => setHelpPanelOpen(!helpPanelOpen)} 
        />
        
        <AppLayout
          navigation={
            <SideNavigation
              activeHref={ROUTES.ORIGINS}
              items={NAVIGATION_ITEMS}
              onFollow={(event) => {
                if (!event.detail.external) {
                  event.preventDefault();
                  if (event.detail.href === ROUTES.ORIGINS) {
                    toOrigins();
                  } else if (event.detail.href === ROUTES.MAPPINGS) {
                    toMappings();
                  } else if (event.detail.href === ROUTES.TRANSFORMATION_POLICIES) {
                    navigate(ROUTES.TRANSFORMATION_POLICIES);
                  }
                }
              }}
            />
          }
          content={
            <ErrorBoundary fallback={<OriginListError />}>
              <OriginContent />
            </ErrorBoundary>
          }
          tools={helpPanelOpen ? <OriginHelpPanel /> : undefined}
          toolsOpen={helpPanelOpen}
          onToolsChange={({ detail }) => setHelpPanelOpen(detail.open)}
          toolsHide={!helpPanelOpen}
          navigationOpen={navigationOpen}
          onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        />
      </Box>
    </OriginProvider>
  );
};

export default Origins;