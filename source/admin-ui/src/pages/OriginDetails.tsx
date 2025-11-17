import React, { useState } from 'react';
import {
  AppLayout,
  Header,
  SpaceBetween,
  Box,
  Alert,
  Container,
  ColumnLayout,
  Button,
  KeyValuePairs,
  SideNavigation,
  Flashbar
} from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router-dom';
import { TopNavigation } from '../components/common/TopNavigation';
import { BreadcrumbBar } from '../components/common/BreadcrumbBar';
import { DeleteOriginModal } from '../components/modals/DeleteOriginModal';
import { useOrigin } from '../hooks/useOrigin';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { useTypedNavigate } from '../hooks/useTypedNavigate';
import { AuthService } from '../services/authService';
import { ROUTES } from '../constants/routes';
import { OriginHelpPanel } from '../components/help/OriginHelpPanel';
import { NAVIGATION_ITEMS } from '../constants/navigation';

export const OriginDetails: React.FC = () => {
  const navigate = useNavigate();
  const { toOrigins, toMappings } = useTypedNavigate();
  const { id } = useParams();
  const { origin, loading, error, deleteOrigin } = useOrigin(id);
  const { messages, addMessage, dismissMessage } = useFlashMessages();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);

  const handleSignOut = async () => {
    await AuthService.signOut();
    window.location.href = '/';
  };

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

  if (loading) {
    return (
      <Box>
        <TopNavigation onSignOut={handleSignOut} />
        <BreadcrumbBar 
          breadcrumbs={[
            { text: 'Home', href: '/' },
            { text: 'Origins', href: ROUTES.ORIGINS },
            { text: 'Loading...' }
          ]} 
          onHelpClick={() => setHelpPanelOpen(!helpPanelOpen)}
        />
        <Box padding="l">Loading origin details...</Box>
      </Box>
    );
  }

  if (error || !origin) {
    return (
      <Box>
        <TopNavigation onSignOut={handleSignOut} />
        <BreadcrumbBar 
          breadcrumbs={[
            { text: 'Home', href: '/' },
            { text: 'Origins', href: ROUTES.ORIGINS },
            { text: 'Not Found' }
          ]} 
          onHelpClick={() => setHelpPanelOpen(true)} 
        />
        <Box padding="l">
          <Alert type="error">{error || 'Origin not found'}</Alert>
        </Box>
      </Box>
    );
  }

  const breadcrumbs = [
    { text: 'Home', href: '/' },
    { text: 'Origins', href: ROUTES.ORIGINS },
    { text: origin.originName }
  ];

  return (
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
          <div>
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
              <Header
                variant="h1"
                description="View and manage origin server configuration"
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button onClick={() => toOrigins()}>
                      Back to origins
                    </Button>
                    <Button onClick={handleEdit} iconName="edit">
                      Edit
                    </Button>
                    <Button onClick={() => setShowDeleteModal(true)} iconName="remove">
                      Delete
                    </Button>
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
                <Container header={<Header variant="h2">Custom Headers</Header>}>
                  <KeyValuePairs
                    columns={1}
                    items={Object.entries(origin.originHeaders).map(([name, value]) => ({
                      label: name,
                      value: value
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
          </div>
        }
        tools={helpPanelOpen ? <OriginHelpPanel /> : undefined}
        toolsOpen={helpPanelOpen}
        onToolsChange={({ detail }) => setHelpPanelOpen(detail.open)}
        toolsHide={!helpPanelOpen}
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
      />

      <DeleteOriginModal
        visible={showDeleteModal}
        origin={origin}
        onDismiss={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </Box>
  );
};

export default OriginDetails;