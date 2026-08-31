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
  ExpandableSection,
  Modal
} from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router';
import { useTransformationPolicy } from '../hooks/useTransformationPolicy';
import { useTransformationPolicyContext } from '../contexts/TransformationPolicyContext';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { useTypedNavigate } from '../hooks/useTypedNavigate';
import { ROUTES } from '../constants/routes';
import { TransformationPolicyHelpPanel } from '../components/help/TransformationPolicyHelpPanel';
import { FlashMessages } from '../components/common/FlashMessages';
import { PageLayout } from '../components/layout/PageLayout';

const TransformationPolicyDetails: React.FC = () => {
  const navigate = useNavigate();
  const { toPolicies } = useTypedNavigate();
  const { id } = useParams();
  const { policy, loading, error } = useTransformationPolicy(id);
  const { deletePolicy } = useTransformationPolicyContext();
  const { messages, addMessage, dismissMessage } = useFlashMessages();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleEdit = () => navigate(`${ROUTES.TRANSFORMATION_POLICIES}/${id}/edit`);

  const handleDelete = async () => {
    if (!policy) return;
    
    setDeleting(true);
    
    const result = await deletePolicy(policy.policyId);
    
    if (result.success) {
      navigate(ROUTES.TRANSFORMATION_POLICIES, { 
        state: { 
          message: `Successfully deleted transformation policy "${policy.policyName}"`,
          type: 'success',
          timestamp: Date.now()
        }
      });
    } else {
      addMessage({ 
        type: 'error', 
        content: result.error || 'Failed to delete transformation policy',
        dismissible: true 
      });
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const getOutputTitle = (type: string) => {
    const titles: Record<string, string> = {
      quality: 'Quality Optimization',
      format: 'Format Optimization', 
      autosize: 'Auto-sizing'
    };
    return titles[type] || type;
  };

  const renderOutputValue = (output: any) => {
    switch (output.type) {
      case 'quality':
        const qualityArray = output.value;
        const defaultQuality = qualityArray[0];
        const dprRules = qualityArray.slice(1);
        
        if (dprRules.length === 0) {
          return `Default: ${defaultQuality}`;
        }
        
        const rulesText = dprRules.map((rule: [number, number, number]) => {
          const [minDpr, maxDpr, quality] = rule;
          const qualityPercent = Math.round(quality);
          if (maxDpr === 999) {
            return `${minDpr}+: ${qualityPercent}%`;
          } else if (minDpr === maxDpr) {
            return `${minDpr}: ${qualityPercent}%`;
          } else {
            return `${minDpr}-${maxDpr}: ${qualityPercent}%`;
          }
        }).join(', ');
        
        return `Default: ${defaultQuality}, DPR: ${rulesText}`;
      case 'format':
        return `Format: ${output.value}`;
      case 'autosize':
        return `Widths: ${output.value.join(', ')}`;
      default:
        return 'Enabled';
    }
  };

  const getTransformationTitle = (type: string) => {
    const titles: Record<string, string> = {
      quality: 'Quality', format: 'Format', resize: 'Resize', blur: 'Blur',
      rotate: 'Rotate', grayscale: 'Grayscale', sharpen: 'Sharpen',
      smartCrop: 'Smart Crop', stripExif: 'Strip EXIF', stripIcc: 'Strip ICC',
      flip: 'Flip', flop: 'Flop', normalize: 'Normalize', animated: 'Animated',
      tint: 'Tint', flatten: 'Flatten', convolve: 'Convolve', extract: 'Extract'
    };
    return titles[type] || type;
  };

  const renderTransformationValue = (transformation: any) => {
    let baseValue;
    switch (transformation.transformation) {
      case 'quality':
      case 'blur':
      case 'rotate':
        baseValue = transformation.value.toString();
        break;
      case 'format':
        baseValue = transformation.value.toUpperCase();
        break;
      case 'resize':
        const { width, height, fit } = transformation.value;
        baseValue = `${width || 'auto'} × ${height || 'auto'} (${fit})`;
        break;
      case 'extract':
        const [left, top, w, h] = transformation.value;
        baseValue = `Position: ${left},${top} Size: ${w}×${h}`;
        break;
      case 'convolve':
        baseValue = `${transformation.value.width}×${transformation.value.height} kernel`;
        break;
      case 'tint':
      case 'flatten':
        baseValue = transformation.value;
        break;
      case 'smartCrop':
        if (typeof transformation.value === 'object' && transformation.value !== null) {
          const methods = [];
          if (transformation.value.faces) methods.push('Faces');
          if (transformation.value.retainText) methods.push('Text');
          if (transformation.value.retainLogo) methods.push('Logo');
          if (transformation.value.labels?.length) methods.push(`Labels: ${transformation.value.labels.join(', ')}`);
          if (transformation.value.customModelArn) methods.push('Custom model');
          baseValue = methods.length > 0 ? methods.join(', ') : 'Configured';
        } else {
          baseValue = 'Enabled';
        }
        break;
      case 'contentModeration':
        if (typeof transformation.value === 'object' && transformation.value !== null) {
          const parts = [];
          if (transformation.value.minConfidence !== undefined) parts.push(`Confidence: ${transformation.value.minConfidence}%`);
          if (transformation.value.blur !== undefined) parts.push(`Blur: ${transformation.value.blur}`);
          if (transformation.value.moderationLabels?.length) parts.push(`Labels: ${transformation.value.moderationLabels.join(', ')}`);
          baseValue = parts.length > 0 ? parts.join(', ') : 'Configured';
        } else {
          baseValue = 'Enabled';
        }
        break;
      default:
        baseValue = 'Enabled';
    }
    
    if (transformation.condition) {
      const conditionValue = Array.isArray(transformation.condition.value) 
        ? transformation.condition.value.join(', ')
        : transformation.condition.value;
      return `${baseValue} • Condition: ${transformation.condition.field} = ${conditionValue}`;
    }
    
    return baseValue;
  };

  const getBreadcrumbText = () => {
    if (loading) return 'Loading...';
    if (error || !policy) return 'Not Found';
    return policy.policyName;
  };

  const renderContent = () => {
    if (loading) {
      return <Box padding="l">Loading transformation policy details...</Box>;
    }

    if (error || !policy) {
      return (
        <Box padding="l">
          <Alert type="error">{error || 'Transformation policy not found'}</Alert>
        </Box>
      );
    }

    return (
      <div>
        <FlashMessages messages={messages} onDismiss={dismissMessage} />
        <SpaceBetween direction="vertical" size="l">
          <Header
            variant="h1"
            description="View and manage transformation policy configuration"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => toPolicies()}>Back to policies</Button>
                <Button onClick={handleEdit} iconName="edit">Edit</Button>
                <Button onClick={() => setShowDeleteModal(true)} iconName="remove">Delete</Button>
              </SpaceBetween>
            }
          >
            {policy.policyName}
          </Header>

          <Container header={<Header variant="h2">Policy Configuration</Header>}>
            <ColumnLayout columns={2} variant="text-grid">
              <KeyValuePairs
                columns={1}
                items={[
                  { label: 'Policy Name', value: policy.policyName },
                  { label: 'Description', value: policy.description || 'None' },
                  { label: 'Default Policy', value: policy.isDefault ? 'Yes' : 'No' }
                ]}
              />
              <KeyValuePairs
                columns={1}
                items={[
                  { label: 'Created', value: new Date(policy.createdAt).toLocaleString() },
                  { label: 'Last Updated', value: policy.updatedAt ? new Date(policy.updatedAt).toLocaleString() : '-' }
                ]}
              />
            </ColumnLayout>
          </Container>

          <Container header={<Header variant="h2">Transformations ({policy.policyJSON?.transformations?.length || 0})</Header>}>
            <SpaceBetween size="s">
              {policy.policyJSON?.transformations?.map((transformation, index) => (
                <ExpandableSection
                  key={index}
                  headerText={`${index + 1}. ${getTransformationTitle(transformation.transformation)}`}
                  headerDescription={renderTransformationValue(transformation)}
                  variant="container"
                >
                  <SpaceBetween size="s">
                    <Box>
                      <strong>Transformation Value:</strong>
                      <Box padding="s">
                        <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(transformation.value, null, 2)}
                        </pre>
                      </Box>
                    </Box>
                    {transformation.condition && (
                      <Box>
                        <strong>Condition:</strong>
                        <Box padding="s">
                          <KeyValuePairs
                            columns={1}
                            items={[
                              { label: 'Field', value: transformation.condition.field },
                              { 
                                label: 'Value', 
                                value: Array.isArray(transformation.condition.value) 
                                  ? transformation.condition.value.join(', ')
                                  : transformation.condition.value.toString()
                              }
                            ]}
                          />
                        </Box>
                      </Box>
                    )}
                  </SpaceBetween>
                </ExpandableSection>
              )) || []}
            </SpaceBetween>
          </Container>

          <Container header={<Header variant="h2">Output Optimizations ({policy.policyJSON?.outputs?.length || 0})</Header>}>
            <SpaceBetween size="s">
              {policy.policyJSON?.outputs?.map((output, index) => (
                <ExpandableSection
                  key={index}
                  headerText={`${index + 1}. ${getOutputTitle(output.type)}`}
                  headerDescription={renderOutputValue(output)}
                  variant="container"
                >
                  <Box padding="s">
                    <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(
                        output.fallback
                          ? { value: output.value, fallback: output.fallback }
                          : output.value,
                        null,
                        2
                      )}
                    </pre>
                  </Box>
                </ExpandableSection>
              )) || []}
            </SpaceBetween>
          </Container>

          <Container header={<Header variant="h2">Metadata</Header>}>
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'Policy ID', value: policy.policyId }
              ]}
            />
          </Container>
        </SpaceBetween>

        <Modal
          visible={showDeleteModal}
          onDismiss={() => setShowDeleteModal(false)}
          header="Delete transformation policy"
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
            <Box>Are you sure you want to delete the transformation policy "{policy?.policyName}"?</Box>
            <Alert type="warning">This action cannot be undone. Any mappings using this policy will need to be updated.</Alert>
          </SpaceBetween>
        </Modal>
      </div>
    );
  };

  return (
    <PageLayout
      activeHref={ROUTES.TRANSFORMATION_POLICIES}
      breadcrumbs={[
        { text: 'Home', href: '/' },
        { text: 'Transformation Policies', href: ROUTES.TRANSFORMATION_POLICIES },
        { text: getBreadcrumbText() }
      ]}
      helpPanel={<TransformationPolicyHelpPanel />}
    >
      {renderContent()}
    </PageLayout>
  );
};

export default TransformationPolicyDetails;
