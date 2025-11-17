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
import { TransformationPolicyHelpPanel } from '../components/help/TransformationPolicyHelpPanel';
import { TransformationPolicyTable } from '../components/tables/TransformationPolicyTable';
import { TransformationPolicyModals } from '../components/modals/TransformationPolicyModals';
import { TransformationPolicyProvider, useTransformationPolicyContext } from '../contexts/TransformationPolicyContext';
import { useApp } from '../contexts/AppContext';
import { useTransformationPolicyModals } from '../hooks/useTransformationPolicyModals';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { AuthService } from '../services/authService';
import { ErrorBoundary } from '../components/error/ErrorBoundary';
import { useTypedNavigate } from '../hooks/useTypedNavigate';
import { NAVIGATION_ITEMS } from '../constants/navigation';
import { ROUTES } from '../constants/routes';

const TransformationPolicyContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { allPolicies, deletePolicy } = useTransformationPolicyContext();
  const { messages, addMessage, dismissMessage } = useFlashMessages();
  const { showDeleteModal, deletingPolicy, openDeleteModal, closeDeleteModal } = useTransformationPolicyModals();

  const [processedTimestamp, setProcessedTimestamp] = useState<number | null>(null);
  const messageProcessedRef = useRef(false);

  // Handle success message from navigation state
  useEffect(() => {
    const messageTimestamp = location.state?.timestamp;
    if (
      location.state?.message && 
      location.state?.type === 'success' && 
      messageTimestamp &&
      messageTimestamp !== processedTimestamp &&
      !messageProcessedRef.current
    ) {
      messageProcessedRef.current = true;
      setProcessedTimestamp(messageTimestamp);
      addMessage({
        type: 'success',
        content: location.state.message,
        dismissible: true
      });
      // Clear the navigation state to prevent showing the message again
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, addMessage, navigate, processedTimestamp]);

  const handleConfirmDelete = async () => {
    if (!deletingPolicy) return;

    const result = await deletePolicy(deletingPolicy.policyId);
    
    addMessage({
      type: result.success ? 'success' : 'error',
      content: result.success 
        ? `Successfully deleted transformation policy "${deletingPolicy.policyName}"`
        : result.error || 'Failed to delete transformation policy. Please try again.',
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
        <TransformationPolicyTable onDeleteClick={openDeleteModal} />
      </SpaceBetween>

      <TransformationPolicyModals
        showDeleteModal={showDeleteModal}
        onCloseDeleteModal={closeDeleteModal}
        onConfirmDelete={handleConfirmDelete}
        deletingPolicy={deletingPolicy}
      />
    </>
  );
};

export const TransformationPolicies: React.FC = () => {
  const { toPolicies, toOrigins, toMappings } = useTypedNavigate();
  const { user } = useApp();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const breadcrumbs = [
    { text: 'Home', href: '/' },
    { text: 'Transformation Policies' }
  ];

  const handleSignOut = async () => {
    await AuthService.signOut();
    window.location.href = '/';
  };

  return (
    <TransformationPolicyProvider>
      <Box>
        <TopNavigation onSignOut={handleSignOut} />
        <BreadcrumbBar 
          breadcrumbs={breadcrumbs} 
          onHelpClick={() => setHelpPanelOpen(!helpPanelOpen)} 
        />
        
        <AppLayout
          navigation={
            <SideNavigation
              activeHref={ROUTES.TRANSFORMATION_POLICIES}
              items={NAVIGATION_ITEMS}
              onFollow={(event) => {
                if (!event.detail.external) {
                  event.preventDefault();
                  if (event.detail.href === ROUTES.ORIGINS) {
                    toOrigins();
                  } else if (event.detail.href === ROUTES.MAPPINGS) {
                    toMappings();
                  } else if (event.detail.href === ROUTES.TRANSFORMATION_POLICIES) {
                    toPolicies();
                  }
                }
              }}
            />
          }
          content={
            <ErrorBoundary fallback={<div>Error loading transformation policies</div>}>
              <TransformationPolicyContent />
            </ErrorBoundary>
          }
          navigationOpen={navigationOpen}
          onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
          tools={helpPanelOpen ? <TransformationPolicyHelpPanel /> : undefined}
          toolsOpen={helpPanelOpen}
          onToolsChange={({ detail }) => setHelpPanelOpen(detail.open)}
          toolsHide={!helpPanelOpen}
        />
      </Box>
    </TransformationPolicyProvider>
  );
};

export default TransformationPolicies;