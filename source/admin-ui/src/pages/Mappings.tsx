import React, { useEffect, useRef } from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';
import { useLocation, useNavigate } from 'react-router';
import { MappingHelpPanel } from '../components/help/MappingHelpPanel';
import { MappingTable } from '../components/tables/MappingTable';
import { MappingModals } from '../components/modals/MappingModals';
import { MappingProvider, useMappingContext } from '../contexts/MappingContext';
import { OriginProvider } from '../contexts/OriginContext';
import { TransformationPolicyProvider } from '../contexts/TransformationPolicyContext';
import { useMappingModals } from '../hooks/useMappingModals';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { ROUTES } from '../constants/routes';
import { ErrorBoundary } from '../components/error/ErrorBoundary';
import { OriginMappingError } from '../components/error/FeatureErrorFallback';
import { FlashMessages } from '../components/common/FlashMessages';
import { PageLayout } from '../components/layout/PageLayout';

const MappingContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { allMappings, deleteMapping } = useMappingContext();
  const { messages, addMessage, dismissMessage } = useFlashMessages();
  const { showDeleteModal, deletingMapping, openDeleteModal, closeDeleteModal } = useMappingModals();

  const messageProcessedRef = useRef<number | null>(null);

  useEffect(() => {
    const messageTimestamp = location.state?.timestamp;
    if (
      location.state?.message && 
      location.state?.type === 'success' && 
      messageTimestamp &&
      messageTimestamp !== messageProcessedRef.current
    ) {
      messageProcessedRef.current = messageTimestamp;
      addMessage({
        type: 'success',
        content: location.state.message,
        dismissible: true
      });
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, addMessage, navigate]);

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
      <FlashMessages messages={messages} onDismiss={dismissMessage} />
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

const Mappings: React.FC = () => {
  return (
    <OriginProvider>
      <TransformationPolicyProvider>
        <MappingProvider>
          <ErrorBoundary fallback={<OriginMappingError />} context="Mappings">
            <PageLayout
              activeHref={ROUTES.MAPPINGS}
              breadcrumbs={[{ text: 'Home', href: '/' }, { text: 'Mappings' }]}
              helpPanel={<MappingHelpPanel />}
            >
              <MappingContent />
            </PageLayout>
          </ErrorBoundary>
        </MappingProvider>
      </TransformationPolicyProvider>
    </OriginProvider>
  );
};

export default Mappings;
