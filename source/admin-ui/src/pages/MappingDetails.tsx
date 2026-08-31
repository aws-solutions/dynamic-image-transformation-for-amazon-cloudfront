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
  Modal
} from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router';
import { useMapping } from '../hooks/useMapping';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { useTypedNavigate } from '../hooks/useTypedNavigate';
import { MappingService } from '../services/mappingService';
import { useOriginContext } from '../contexts/OriginContext';
import { useTransformationPolicyContext } from '../contexts/TransformationPolicyContext';
import { ROUTES } from '../constants/routes';
import { MappingHelpPanel } from '../components/help/MappingHelpPanel';
import { FlashMessages } from '../components/common/FlashMessages';
import { PageLayout } from '../components/layout/PageLayout';

const MappingDetails: React.FC = () => {
  const navigate = useNavigate();
  const { toMappings } = useTypedNavigate();
  const { id } = useParams();
  const { mapping, loading, error } = useMapping(id);
  const { messages, addMessage, dismissMessage } = useFlashMessages();
  const { allOrigins } = useOriginContext();
  const { allPolicies: transformationPolicies } = useTransformationPolicyContext();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getOriginName = (originId: string) => {
    const origin = allOrigins?.find(o => o.originId === originId);
    return origin?.originName || originId;
  };

  const getPolicyName = (policyId?: string) => {
    if (!policyId) return 'None';
    const policy = transformationPolicies?.find(p => p.policyId === policyId);
    return policy?.policyName || policy?.name || policyId;
  };

  const handleEdit = () => navigate(`${ROUTES.MAPPINGS}/${id}/edit`);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await MappingService.deleteMapping(id!);
      navigate(ROUTES.MAPPINGS, { 
        state: { 
          message: 'Mapping deleted successfully',
          type: 'success',
          timestamp: Date.now()
        }
      });
    } catch (error) {
      addMessage({ 
        type: 'error', 
        content: 'Failed to delete mapping',
        dismissible: true 
      });
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const getBreadcrumbText = () => {
    if (loading) return 'Loading...';
    if (error || !mapping) return 'Not Found';
    return mapping.mappingName;
  };

  const renderContent = () => {
    if (loading) {
      return <Box padding="l">Loading mapping details...</Box>;
    }

    if (error || !mapping) {
      return (
        <Box padding="l">
          <Alert type="error">{error || 'Mapping not found'}</Alert>
        </Box>
      );
    }

    return (
      <div>
        <FlashMessages messages={messages} onDismiss={dismissMessage} />
        <SpaceBetween direction="vertical" size="l">
          <Header
            variant="h1"
            description="View and manage mapping configuration"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => toMappings()}>Back to mappings</Button>
                <Button onClick={handleEdit} iconName="edit">Edit</Button>
                <Button onClick={() => setShowDeleteModal(true)} iconName="remove">Delete</Button>
              </SpaceBetween>
            }
          >
            {mapping.mappingName}
          </Header>

          <Container header={<Header variant="h2">Mapping Configuration</Header>}>
            <ColumnLayout columns={2} variant="text-grid">
              <KeyValuePairs
                columns={1}
                items={[
                  { label: 'Mapping Name', value: mapping.mappingName },
                  { label: 'Description', value: mapping.description || 'None' },
                  { label: 'Origin Name', value: getOriginName(mapping.originId) },
                  { label: 'Policy Name', value: getPolicyName(mapping.policyId) }
                ]}
              />
              <KeyValuePairs
                columns={1}
                items={[
                  { label: 'Created', value: new Date(mapping.createdAt).toLocaleString() },
                  { label: 'Last Updated', value: mapping.updatedAt ? new Date(mapping.updatedAt).toLocaleString() : '-' }
                ]}
              />
            </ColumnLayout>
          </Container>

          <Container header={<Header variant="h2">Routing Rules</Header>}>
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'Host Header Pattern', value: mapping.hostHeaderPattern || 'None' },
                { label: 'Path Pattern', value: mapping.pathPattern || 'None' }
              ]}
            />
          </Container>

          <Container header={<Header variant="h2">Metadata</Header>}>
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'Mapping ID', value: mapping.mappingId },
                { label: 'Origin ID', value: mapping.originId },
                { label: 'Policy ID', value: mapping.policyId || 'None' }
              ]}
            />
          </Container>
        </SpaceBetween>

        <Modal
          visible={showDeleteModal}
          onDismiss={() => setShowDeleteModal(false)}
          header="Delete mapping"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleDelete} loading={deleting}>Delete</Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            <Box>Are you sure you want to delete the mapping "{mapping?.mappingName}"?</Box>
            <Alert type="warning">This action cannot be undone. This mapping will no longer route requests.</Alert>
          </SpaceBetween>
        </Modal>
      </div>
    );
  };

  return (
    <PageLayout
      activeHref={ROUTES.MAPPINGS}
      breadcrumbs={[
        { text: 'Home', href: '/' },
        { text: 'Mappings', href: ROUTES.MAPPINGS },
        { text: getBreadcrumbText() }
      ]}
      helpPanel={<MappingHelpPanel />}
    >
      {renderContent()}
    </PageLayout>
  );
};

export default MappingDetails;
