import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AppLayout,
  ContentLayout,
  Header,
  Button,
  FormField,
  Input,
  Textarea,
  Checkbox,
  SpaceBetween,
  Container,
  Box,
  Form,
  Alert,
  SideNavigation,
  ExpandableSection
} from '@cloudscape-design/components';
import { TransformationPolicyCreate, Transformation, validateTransformationPolicyCreate } from '@data-models';
import { PropagationDisclaimer } from '../components/common/PropagationDisclaimer';
import { useTransformationPolicyContext } from '../contexts/TransformationPolicyContext';
import { Output, OutputOption, TransformationOption } from '../types/interfaces';
import { availableOutputs } from '../constants/ouputTransformations'
import { validateTransformationPolicyCreateData } from '../utils/validation';
import { TransformationSelectionModal } from '../components/transformationPolicy/TransformationSelectionModal';
import { TransformationConfigModal } from '../components/transformationPolicy/TransformationConfigModal';
import { AddedTransformationsList } from '../components/transformationPolicy/AddedTransformationsList';
import { OutputSelectionModal } from '../components/outputTransformations/OutputSelectionModal';
import { OutputConfigModal } from '../components/outputTransformations/OutputConfigModal';
import { AddedOutputsList } from '../components/outputTransformations/AddedOutputsList';
import { ROUTES } from '../constants/routes';
import { TransformationPolicyService } from '../services/transformationPolicyService';
import { NAVIGATION_ITEMS } from '../constants/navigation';
import { TopNavigation } from '../components/common/TopNavigation';
import { BreadcrumbBar } from '../components/common/BreadcrumbBar';
import { TransformationPolicyHelpPanel } from '../components/help/TransformationPolicyHelpPanel';
import { AuthService } from '../services/authService';

const CreateTransformationPolicy: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { createPolicy, updatePolicy } = useTransformationPolicyContext();
  const isEditMode = !!id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Form state
  const [policyName, setPolicyName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  
  // Modal state
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showOutputSelectionModal, setShowOutputSelectionModal] = useState(false);
  const [showOutputConfigModal, setShowOutputConfigModal] = useState(false);
  const [selectedTransformation, setSelectedTransformation] = useState<TransformationOption | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<OutputOption | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingOutputIndex, setEditingOutputIndex] = useState<number | null>(null);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(true);

  // Load existing data for edit mode
  useEffect(() => {
    if (isEditMode && id) {
      const loadPolicy = async () => {
        try {
          setLoading(true);
          const result = await TransformationPolicyService.get(id);
          if (result.success && result.data) {
            const policy = result.data;
            setPolicyName(policy.policyName || policy.name || '');
            setDescription(policy.description || '');
            setIsDefault(policy.isDefault || false);
            setTransformations(policy.policyJSON?.transformations || []);
            setOutputs(policy.policyJSON?.outputs || []);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load policy');
        } finally {
          setLoading(false);
        }
      };
      loadPolicy();
    }
  }, [isEditMode, id]);

  const handleSignOut = async () => {
    try {
      await AuthService.signOut();
      navigate('/auth/logout-complete');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const validateField = (field: string, value: string) => {
    const testData = {
      policyName: field === 'policyName' ? value : policyName,
      description: field === 'description' ? value : description,
      isDefault,
      policyJSON: { 
        ...(transformations.length > 0 && { transformations }),
        ...(outputs.length > 0 && { outputs })
      }
    };
    
    const validation = validateTransformationPolicyCreate(testData);
    
    if (!validation.success && validation.error) {
      const fieldError = validation.error.issues.find(issue => 
        issue.path.includes(field)
      );
      if (fieldError) {
        setValidationErrors(prev => ({ ...prev, [field]: fieldError.message }));
      }
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCancel = () => {
    navigate('/transformation-policies');
  };

  const handleCreate = async () => {
    setValidationErrors({});
    
    const policyData: TransformationPolicyCreate = {
      policyName: policyName.trim(),
      description: description.trim() || undefined,
      isDefault,
      policyJSON: { 
        ...(transformations.length > 0 && { transformations }),
        ...(outputs.length > 0 && { outputs })
      }
    };

    // Use data-models validation
    const validation = validateTransformationPolicyCreateData(policyData);
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    try {
      setLoading(true);
      
      let result;
      if (isEditMode && id) {
        result = await updatePolicy(id, policyData);
      } else {
        result = await createPolicy(policyData);
      }
      
      if (result.success) {
        navigate('/transformation-policies', {
          state: { 
            message: `Policy "${policyName}" ${isEditMode ? 'updated' : 'created'} successfully!`,
            type: 'success',
            timestamp: Date.now()
          }
        });
      } else {
        throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} policy`);
      }
    } catch (error: any) {
      
      // Extract error message from backend response
      let errorMessage = `Failed to ${isEditMode ? 'update' : 'create'} policy. Please try again.`;
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransformation = () => {
    setEditingIndex(null);
    setShowSelectionModal(true);
  };

  const handleEditTransformation = (index: number) => {
    const transformation = transformations[index];
    // Find the transformation option
    const transformationOption = {
      id: transformation.transformation,
      title: getTransformationTitle(transformation.transformation),
      description: getTransformationDescription(transformation.transformation),
      category: 'basic' as const // We'll determine this properly
    };
    
    setSelectedTransformation(transformationOption);
    setEditingIndex(index);
    setShowConfigModal(true);
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

  const getTransformationDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      quality: 'Adjust image quality (1-100)',
      format: 'Convert image format',
      resize: 'Change image dimensions',
      blur: 'Apply blur effect',
      rotate: 'Rotate image by degrees',
      grayscale: 'Convert to grayscale',
      // Add more as needed
    };
    return descriptions[type] || `Configure ${type} transformation`;
  };

  const handleTransformationSelected = (transformation: TransformationOption) => {
    setSelectedTransformation(transformation);
    setShowSelectionModal(false);
    setShowConfigModal(true);
  };

  const handleTransformationConfigured = (transformation: Transformation) => {
    if (editingIndex !== null) {
      // Update existing transformation
      setTransformations(prev => 
        prev.map((t, i) => i === editingIndex ? transformation : t)
      );
    } else {
      // Add new transformation
      setTransformations(prev => [...prev, transformation]);
    }
    setShowConfigModal(false);
    setSelectedTransformation(null);
    setEditingIndex(null);
  };

  const handleRemoveTransformation = (index: number) => {
    setTransformations(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveTransformation = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= transformations.length) return;
    
    setTransformations(prev => {
      const newTransformations = [...prev];
      const [moved] = newTransformations.splice(fromIndex, 1);
      newTransformations.splice(toIndex, 0, moved);
      return newTransformations;
    });
  };

  // Output handlers
  const handleAddOutput = () => {
    setShowOutputSelectionModal(true);
  };

  const handleOutputSelected = (output: OutputOption) => {
    setSelectedOutput(output);
    setShowOutputSelectionModal(false);
    setShowOutputConfigModal(true);
  };

  const handleOutputConfigured = (output: Output) => {
    if (editingOutputIndex !== null) {
      // Update existing output
      setOutputs(prev => 
        prev.map((o, i) => i === editingOutputIndex ? output : o)
      );
      setEditingOutputIndex(null);
    } else {
      // Add new output
      setOutputs(prev => [...prev, output]);
    }
    setShowOutputConfigModal(false);
    setSelectedOutput(null);
  };

  const handleRemoveOutput = (index: number) => {
    setOutputs(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveOutput = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= outputs.length) return;
    
    setOutputs(prev => {
      const newOutputs = [...prev];
      const [moved] = newOutputs.splice(fromIndex, 1);
      newOutputs.splice(toIndex, 0, moved);
      return newOutputs;
    });
  };

  const handleEditOutput = (index: number) => {
    const outputToEdit = outputs[index];
    const outputOption = availableOutputs.find(o => o.id === outputToEdit.type);
    
    if (outputOption) {
      setSelectedOutput(outputOption);
      setEditingOutputIndex(index);
      setShowOutputConfigModal(true);
    }
  };

  const breadcrumbs = [
    { text: 'Home', href: '/' },
    { text: 'Transformation Policies', href: '/transformation-policies' },
    { text: 'Create transformation policy' }
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
            activeHref={ROUTES.TRANSFORMATION_POLICIES}
            items={NAVIGATION_ITEMS}
            onFollow={(event) => {
              if (!event.detail.external) {
                event.preventDefault();
                navigate(event.detail.href);
              }
            }}
          />
        }
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        tools={helpPanelOpen ? <TransformationPolicyHelpPanel /> : undefined}
        toolsOpen={helpPanelOpen}
        onToolsChange={({ detail }) => setHelpPanelOpen(detail.open)}
        toolsHide={!helpPanelOpen}
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              actions={null}
            >
              {isEditMode ? 'Update Transformation Policy' : 'Create Transformation Policy'}
            </Header>
          }
        >
          <SpaceBetween size="l">
            {error && (
              <Alert 
                type="error" 
                statusIconAriaLabel="Error"
                dismissible
                onDismiss={() => setError(null)}
              >
                {error}
              </Alert>
            )}
            <Form
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" onClick={handleCancel}>Cancel</Button>
                  <Button 
                    variant="primary" 
                    onClick={handleCreate}
                    loading={loading}
                    disabled={(transformations.length === 0 && outputs.length === 0) || !policyName.trim()}
                  >
                    {isEditMode ? 'Update Policy' : 'Create Policy'}
                  </Button>
                </SpaceBetween>
              }
            >
              <SpaceBetween size="l">
              <PropagationDisclaimer />
              <Container>
                <SpaceBetween size="l">
                  <Box variant="h2">Policy Information</Box>
                  <FormField 
                    label="Policy Name" 
                    errorText={validationErrors.policyName}
                  >
                    <Input
                      value={policyName}
                      onChange={({ detail }) => {
                        setPolicyName(detail.value);
                        if (validationErrors.policyName) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.policyName;
                            return newErrors;
                          });
                        }
                      }}
                      onBlur={() => validateField('policyName', policyName)}
                      placeholder="e.g., Mobile Optimization Policy"
                    />
                  </FormField>
                  <FormField 
                    label="Description (Optional)"
                    errorText={validationErrors.description}
                  >
                    <Textarea
                      value={description}
                      onChange={({ detail }) => {
                        setDescription(detail.value);
                        if (validationErrors.description) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.description;
                            return newErrors;
                          });
                        }
                      }}
                      onBlur={() => validateField('description', description)}
                      placeholder="Describe the purpose and use case for this transformation policy..."
                      rows={3}
                    />
                  </FormField>
                  <Checkbox
                    checked={isDefault}
                    onChange={({ detail }) => setIsDefault(detail.checked)}
                  >
                    Set as default policy
                  </Checkbox>
                </SpaceBetween>
              </Container>

              <ExpandableSection
                headerText="Transformations"
                headerDescription="Configure image transformations that will be applied when this policy is used"
                defaultExpanded={true}
                headerActions={
                  transformations.length > 0 ? (
                    <Button 
                      variant="normal" 
                      iconName="add-plus" 
                      onClick={handleAddTransformation}
                    >
                      Add Transformation
                    </Button>
                  ) : undefined
                }
              >
                <Container>
                  {transformations.length === 0 ? (
                    <Box textAlign="center" padding="l" color="text-body-secondary">
                      <SpaceBetween size="m">
                        <Box>No transformations added yet. Click "Add Transformation" to get started.</Box>
                        <Button 
                          variant="normal" 
                          iconName="add-plus" 
                          onClick={handleAddTransformation}
                        >
                          Add Transformation
                        </Button>
                      </SpaceBetween>
                    </Box>
                  ) : (
                    <AddedTransformationsList
                      transformations={transformations}
                      onRemove={handleRemoveTransformation}
                      onMove={handleMoveTransformation}
                      onEdit={handleEditTransformation}
                    />
                  )}
                </Container>
              </ExpandableSection>

              <ExpandableSection
                headerText="Output Optimizations"
                headerDescription="Configure output optimizations for adaptive delivery based on client capabilities"
                defaultExpanded={true}
                headerActions={
                  outputs.length > 0 && outputs.length < availableOutputs.length ? (
                    <Button 
                      variant="normal" 
                      iconName="add-plus" 
                      onClick={handleAddOutput}
                    >
                      Add Output Optimization
                    </Button>
                  ) : undefined
                }
              >
                <Container>
                  {outputs.length === 0 ? (
                    <Box textAlign="center" padding="l" color="text-body-secondary">
                      <SpaceBetween size="m">
                        <Box>No output optimizations added yet. Click "Add Output Optimization" to configure adaptive delivery options.</Box>
                        <Button 
                          variant="normal" 
                          iconName="add-plus" 
                          onClick={handleAddOutput}
                        >
                          Add Output Optimization
                        </Button>
                      </SpaceBetween>
                    </Box>
                  ) : (
                    <AddedOutputsList
                      outputs={outputs}
                      onRemove={handleRemoveOutput}
                      onMove={handleMoveOutput}
                      onEdit={handleEditOutput}
                    />
                  )}
                </Container>
              </ExpandableSection>
            </SpaceBetween>
            </Form>
          </SpaceBetween>

          {/* 2-Step Modal Flow */}
          <TransformationSelectionModal
            visible={showSelectionModal}
            onDismiss={() => setShowSelectionModal(false)}
            onSelect={handleTransformationSelected}
            excludeTransformations={[]}
          />

          <TransformationConfigModal
            visible={showConfigModal}
            onDismiss={() => setShowConfigModal(false)}
            onBack={() => {
              setShowConfigModal(false);
              if (editingIndex === null) {
                setShowSelectionModal(true);
              }
            }}
            transformation={selectedTransformation}
            editingTransformation={editingIndex !== null ? transformations[editingIndex] : undefined}
            onAdd={handleTransformationConfigured}
          />

          {/* Output Modal Flow */}
          <OutputSelectionModal
            visible={showOutputSelectionModal}
            onDismiss={() => setShowOutputSelectionModal(false)}
            onSelect={handleOutputSelected}
            excludeOutputs={outputs.map(o => o.type)}
          />

          <OutputConfigModal
            visible={showOutputConfigModal}
            onDismiss={() => setShowOutputConfigModal(false)}
            onBack={() => {
              setShowOutputConfigModal(false);
              setShowOutputSelectionModal(true);
            }}
            output={selectedOutput}
            editingOutput={editingOutputIndex !== null ? outputs[editingOutputIndex] : undefined}
            onAdd={handleOutputConfigured}
          />
        </ContentLayout>
      }
    />
    </Box>
  );
};

export default CreateTransformationPolicy;