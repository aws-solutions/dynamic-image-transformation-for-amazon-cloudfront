import React, { useState } from 'react';
import {
  Header,
  SpaceBetween,
  Box,
  Alert,
  Container,
  ColumnLayout,
  Button,
  KeyValuePairs,
} from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router';
import { DeleteOriginModal } from '../components/modals/DeleteOriginModal';
import { useOrigin } from '../hooks/useOrigin';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { useTypedNavigate } from '../hooks/useTypedNavigate';
import { ROUTES } from '../constants/routes';
import { OriginHelpPanel } from '../components/help/OriginHelpPanel';
import { FlashMessages } from '../components/common/FlashMessages';
import { PageLayout } from '../components/layout/PageLayout';

export const OriginDetails: React.FC = () => {
  const navigate = useNavigate();
  const { toOrigins } = useTypedNavigate();
  const { id } = useParams();
  const { origin, loading, error, deleteOrigin } = useOrigin(id);
  const { messages, addMessage, dismissMessage } = useFlashMessages();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleEdit = () => navigate(`${ROUTES.ORIGINS}/${id}/edit`);

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteOrigin();
    
    if (result.success) {
      navigate(ROUTES.ORIGINS, { 
        state: { 
          message: 'Origin deleted successfully',
          type: 'success',
          timestamp: Date.now()
        } 
      });
    } else {
      addMessage({ 
        type: 'error', 
        content: result.error || 'Failed to delete origin',
        dismissible: true 
      });
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const getBreadcrumbText = () => {
    if (loading) return 'Loading...';
    if (error || !origin) return 'Not Found';
    return origin.originName;
  };

  const renderContent = () => {
    if (loading) {
      return <Box padding="l">Loading origin details...</Box>;
    }

    if (error || !origin) {
      return (
        <Box padding="l">
          <Alert type="error">{error || 'Origin not found'}</Alert>
        </Box>
      );
    }

    return (
      <div>
        <FlashMessages messages={messages} onDismiss={dismissMessage} />
        <SpaceBetween direction="vertical" size="l">
          <Header
            variant="h1"
            description="View and manage origin server configuration"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => toOrigins()}>Back to origins</Button>
                <Button onClick={handleEdit} iconName="edit">Edit</Button>
                <Button onClick={() => setShowDeleteModal(true)} iconName="remove">Delete</Button>
              </SpaceBetween>
            }
          >
            {origin.originName}
          </Header>

          <Container header={<Header variant="h2">Origin Configuration</Header>}>
            <ColumnLayout columns={2} variant="text-grid">
              <KeyValuePairs
                columns={1}
                items={[
                  { label: 'Origin Name', value: origin.originName },
                  { label: 'Domain', value: origin.originDomain },
                  { label: 'Path', value: origin.originPath || 'None' }
                ]}
              />
              <KeyValuePairs
                columns={1}
                items={[
                  { label: 'Created', value: new Date(origin.createdAt).toLocaleString() },
                  { label: 'Last Updated', value: origin.updatedAt ? new Date(origin.updatedAt).toLocaleString() : '-' }
                ]}
              />
            </ColumnLayout>
          </Container>

          {origin.originHeaders && Object.keys(origin.originHeaders).length > 0 && (
            <Container
              header={
                <Header variant="h2" description="Header values are hidden because they may contain credentials.">
                  Custom Headers
                </Header>
              }
            >
              {/* Values are write-only — the API returns redacted placeholders, never the real
                  credentials — so render a fixed mask rather than the returned value. */}
              <KeyValuePairs
                columns={1}
                items={Object.keys(origin.originHeaders).map((name) => ({
                  label: name,
                  value: '••••••••'
                }))}
              />
            </Container>
          )}

          <Container header={<Header variant="h2">Metadata</Header>}>
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'Origin ID', value: origin.originId },
                { label: 'Custom Headers Count', value: Object.keys(origin.originHeaders || {}).length }
              ]}
            />
          </Container>
        </SpaceBetween>

        <DeleteOriginModal
          visible={showDeleteModal}
          origin={origin}
          onDismiss={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      </div>
    );
  };

  return (
    <PageLayout
      activeHref={ROUTES.ORIGINS}
      breadcrumbs={[
        { text: 'Home', href: '/' },
        { text: 'Origins', href: ROUTES.ORIGINS },
        { text: getBreadcrumbText() }
      ]}
      helpPanel={<OriginHelpPanel />}
    >
      {renderContent()}
    </PageLayout>
  );
};

export default OriginDetails;
