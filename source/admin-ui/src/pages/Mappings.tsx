import React, { useState, useEffect, useRef } from 'react';
import {
  AppLayout,
  Box,
  SpaceBetween,
  Flashbar,
  SideNavigation
} from '@cloudscape-design/components';
import { useLocation, useNavigate } from 'react-router-dom';
import { TopNavigation } from '../components/common/TopNavigation';
import { BreadcrumbBar } from '../components/common/BreadcrumbBar';
import { MappingHelpPanel } from '../components/help/MappingHelpPanel';
import { MappingTable } from '../components/tables/MappingTable';
import { MappingModals } from '../components/modals/MappingModals';
import { MappingProvider, useMappingContext } from '../contexts/MappingContext';
import { OriginProvider } from '../contexts/OriginContext';
import { TransformationPolicyProvider } from '../contexts/TransformationPolicyContext';
import { useApp } from '../contexts/AppContext';
import { useMappingModals } from '../hooks/useMappingModals';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { AuthService } from '../services/authService';
import { ROUTES } from '../constants/routes';
import { ErrorBoundary } from '../components/error/ErrorBoundary';
import { useTypedNavigate } from '../hooks/useTypedNavigate';
import { OriginMappingError } from '../components/error/FeatureErrorFallback';
import { NAVIGATION_ITEMS } from '../constants/navigation';

const MappingContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { allMappings, deleteMapping } = useMappingContext();
  const { messages, addMessage, dismissMessage, clearMessages } = useFlashMessages();
  const { showDeleteModal, deletingMapping, openDeleteModal, closeDeleteModal } = useMappingModals();

  const [processedTimestamp, setProcessedTimestamp] = useState<number | null>(null);
  const messageProcessedRef = useRef<number | null>(null);

  // Handle success message from navigation state
  useEffect(() => {
    const messageTimestamp = location.state?.timestamp;
    if (
      location.state?.message && 
      location.state?.type === 'success' && 
      messageTimestamp &&
      messageTimestamp !== processedTimestamp &&
      messageTimestamp !== messageProcessedRef.current
    ) {
      setProcessedTimestamp(messageTimestamp);
      messageProcessedRef.current = messageTimestamp;
      addMessage({
        type: 'success',
        content: location.state.message,
        dismissible: true
      });
      // Clear the navigation state to prevent showing the message again
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, processedTimestamp]); // Removed addMessage and navigate from deps

  const handleConfirmDelete = async () => {
    if (!deletingMapping) return;

    const result = await deleteMapping(deletingMapping.mappingId);
    
    addMessage({
      type: result.success ? 'success' : 'error',
      content: result.success 
        ? `Successfully deleted mapping "${deletingMapping.mappingName}"`
        : result.error || 'Failed to delete mapping'
    });

    if (result.success) {
      closeDeleteModal();
    }
  };

  return (
    <Box>
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
      <SpaceBetween size="l">
        <MappingTable onDeleteClick={openDeleteModal} />
      </SpaceBetween>

      <MappingModals
        showDeleteModal={showDeleteModal}
        onCloseDeleteModal={closeDeleteModal}
        onConfirmDelete={handleConfirmDelete}
        deletingMapping={deletingMapping}
      />
    </Box>
  );
};

const MappingsContent: React.FC = () => {
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string>(ROUTES.MAPPINGS);
  const { user } = useApp();
  const { toOrigins, toPolicies } = useTypedNavigate();

  const breadcrumbs = [
    { text: 'Home', href: '/' },
    { text: 'Mappings' }
  ];

  // Ensure correct navigation highlight
  useEffect(() => {
    setActiveHref(ROUTES.MAPPINGS);
  }, []);

  const handleSignOut = async () => {
    try {
      await AuthService.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <ErrorBoundary fallback={<OriginMappingError />} context="Mappings">
      <Box>
        <TopNavigation onSignOut={handleSignOut} />
        <BreadcrumbBar 
          breadcrumbs={breadcrumbs} 
          onHelpClick={() => setHelpPanelOpen(!helpPanelOpen)} 
        />
        
        <AppLayout
          navigation={
            <SideNavigation
              activeHref={activeHref}
              items={NAVIGATION_ITEMS}
              onFollow={(event) => {
                if (!event.detail.external) {
                  event.preventDefault();
                  setActiveHref(event.detail.href);
                  if (event.detail.href === ROUTES.ORIGINS) {
                    toOrigins();
                  } else if (event.detail.href === ROUTES.MAPPINGS) {
                    // Already on mappings page, no navigation needed
                  } else if (event.detail.href === ROUTES.TRANSFORMATION_POLICIES) {
                    toPolicies();
                  }
                }
              }}
            />
          }
          navigationOpen={navigationOpen}
          onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
          tools={helpPanelOpen ? <MappingHelpPanel /> : undefined}
          toolsOpen={helpPanelOpen}
          onToolsChange={({ detail }) => setHelpPanelOpen(detail.open)}
          toolsHide={!helpPanelOpen}
          content={<MappingContent />}
        />
      </Box>
    </ErrorBoundary>
  );
};

const Mappings: React.FC = () => {
  return (
    <OriginProvider>
      <TransformationPolicyProvider>
        <MappingProvider>
          <MappingsContent />
        </MappingProvider>
      </TransformationPolicyProvider>
    </OriginProvider>
  );
};

export default Mappings;