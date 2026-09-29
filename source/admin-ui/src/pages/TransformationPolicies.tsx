import React, { useEffect, useRef } from 'react';
import { SpaceBetween } from '@cloudscape-design/components';
import { useLocation, useNavigate } from 'react-router';
import { TransformationPolicyHelpPanel } from '../components/help/TransformationPolicyHelpPanel';
import { TransformationPolicyTable } from '../components/tables/TransformationPolicyTable';
import { TransformationPolicyModals } from '../components/modals/TransformationPolicyModals';
import { TransformationPolicyProvider, useTransformationPolicyContext } from '../contexts/TransformationPolicyContext';
import { useTransformationPolicyModals } from '../hooks/useTransformationPolicyModals';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { ErrorBoundary } from '../components/error/ErrorBoundary';
import { FlashMessages } from '../components/common/FlashMessages';
import { PageLayout } from '../components/layout/PageLayout';
import { ROUTES } from '../constants/routes';

const TransformationPolicyContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { allPolicies, deletePolicy } = useTransformationPolicyContext();
  const { messages, addMessage, dismissMessage } = useFlashMessages();
  const { showDeleteModal, deletingPolicy, openDeleteModal, closeDeleteModal } = useTransformationPolicyModals();

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
      <FlashMessages messages={messages} onDismiss={dismissMessage} />
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
  return (
    <TransformationPolicyProvider>
      <PageLayout
        activeHref={ROUTES.TRANSFORMATION_POLICIES}
        breadcrumbs={[{ text: 'Home', href: '/' }, { text: 'Transformation Policies' }]}
        helpPanel={<TransformationPolicyHelpPanel />}
      >
        <ErrorBoundary fallback={<div>Error loading transformation policies</div>}>
          <TransformationPolicyContent />
        </ErrorBoundary>
      </PageLayout>
    </TransformationPolicyProvider>
  );
};

export default TransformationPolicies;
