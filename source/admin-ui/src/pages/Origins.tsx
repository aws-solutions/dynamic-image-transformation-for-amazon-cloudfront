import React, { useState, useEffect, useRef } from 'react';
import { SpaceBetween } from '@cloudscape-design/components';
import { useLocation, useNavigate } from 'react-router';
import { OriginTable } from '../components/tables/OriginTable';
import { OriginModals } from '../components/modals/OriginModals';
import { OriginHelpPanel } from '../components/help/OriginHelpPanel';
import { OriginProvider, useOriginContext } from '../contexts/OriginContext';
import { useOriginModals } from '../hooks/useOriginModals';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { ErrorBoundary } from '../components/error/ErrorBoundary';
import { OriginListError } from '../components/error/FeatureErrorFallback';
import { FlashMessages } from '../components/common/FlashMessages';
import { PageLayout } from '../components/layout/PageLayout';
import { ROUTES } from '../constants/routes';

const OriginContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { allOrigins, deleteOrigin } = useOriginContext();
  const { messages, addMessage, dismissMessage } = useFlashMessages();
  const { showDeleteModal, deletingOrigin, openDeleteModal, closeDeleteModal } = useOriginModals();

  const processedTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    const messageTimestamp = location.state?.timestamp;
    if (
      location.state?.message && 
      location.state?.type === 'success' && 
      messageTimestamp &&
      messageTimestamp !== processedTimestampRef.current
    ) {
      processedTimestampRef.current = messageTimestamp;
      addMessage({
        type: 'success',
        content: location.state.message,
        dismissible: true
      });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state?.message, location.state?.timestamp, addMessage, navigate]);

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
      <FlashMessages messages={messages} onDismiss={dismissMessage} />
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
  return (
    <OriginProvider>
      <PageLayout
        activeHref={ROUTES.ORIGINS}
        breadcrumbs={[{ text: 'Home', href: '/' }, { text: 'Origins' }]}
        helpPanel={<OriginHelpPanel />}
      >
        <ErrorBoundary fallback={<OriginListError />}>
          <OriginContent />
        </ErrorBoundary>
      </PageLayout>
    </OriginProvider>
  );
};

export default Origins;
