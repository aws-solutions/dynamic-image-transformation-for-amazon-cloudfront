import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AppLayout,
  ContentLayout,
  Header,
  SpaceBetween,
  Button,
  Form,
  FormField,
  Input,
  Textarea,
  Select,
  Alert,
  Container,
  SideNavigation
} from '@cloudscape-design/components';
import { MappingProvider, useMappingContext } from '../contexts/MappingContext';
import { OriginProvider, useOriginContext } from '../contexts/OriginContext';
import { TransformationPolicyProvider, useTransformationPolicyContext } from '../contexts/TransformationPolicyContext';
import { PropagationDisclaimer } from '../components/common/PropagationDisclaimer';
import { useTypedNavigate } from '../hooks/useTypedNavigate';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { MappingService } from '../services/mappingService';
import { TransformationPolicyService } from '../services/transformationPolicyService';
import { ROUTES } from '../constants/routes';
import { NAVIGATION_ITEMS } from '../constants/navigation';
import { MappingCreate } from '@data-models';
import { TransformationPolicy } from '@data-models';
import { TopNavigation } from '../components/common/TopNavigation';
import { BreadcrumbBar } from '../components/common/BreadcrumbBar';
import { MappingHelpPanel } from '../components/help/MappingHelpPanel';
import { AuthService } from '../services/authService';
import { validateMappingCreateData, validateMappingUpdateData } from '../utils/validation';

const CreateMappingContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const { createMapping, updateMapping } = useMappingContext();
  const { allOrigins, fetchAllOrigins } = useOriginContext();
  const { allPolicies, fetchAllPolicies } = useTransformationPolicyContext();
  const { toMappings } = useTypedNavigate();
  const { clearMessages } = useFlashMessages();

  const [navigationOpen, setNavigationOpen] = useState(true);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string>(ROUTES.MAPPINGS);
  
  const [formData, setFormData] = useState<MappingCreate>({
    mappingName: '',
    description: '',
    hostHeaderPattern: '',
    pathPattern: '',
    originId: '',
    policyId: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingMapping, setLoadingMapping] = useState(isEditing);

  // Load all origins and policies for the dropdowns
  useEffect(() => {
    fetchAllOrigins();
    fetchAllPolicies();
  }, []);

  // Load existing mapping data when editing
  useEffect(() => {
    if (!isEditing || !id) return;
    
    const loadMapping = async () => {
      try {
        setLoadingMapping(true);
        const result = await MappingService.getMapping(id);
        if (result.data) {
          setFormData({
            mappingName: result.data.mappingName,
            description: result.data.description,
            hostHeaderPattern: result.data.hostHeaderPattern || '',
            pathPattern: result.data.pathPattern || '',
            originId: result.data.originId,
            policyId: result.data.policyId || ''
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load mapping');
      } finally {
        setLoadingMapping(false);
      }
    };

    loadMapping();
  }, [isEditing, id]);

  const originOptions = allOrigins.map(origin => ({
    label: `${origin.originName} (${origin.originDomain})`,
    value: origin.originId
  }));

  const policyOptions = [
    { label: 'None', value: '' },
    ...allPolicies.map(policy => ({
      label: policy.policyName,
      value: policy.policyId
    }))
  ];

  const handleSubmit = async () => {
    setShowValidation(true);
    setValidationErrors({});
    
    // Clean form data for validation (convert empty strings to undefined)
    const cleanedFormData = {
      ...formData,
      hostHeaderPattern: formData.hostHeaderPattern?.trim() || undefined,
      pathPattern: formData.pathPattern?.trim() || undefined,
      policyId: formData.policyId?.trim() || undefined
    };
    
    // Use data-models validation
    const validation = isEditing 
      ? validateMappingUpdateData(cleanedFormData)
      : validateMappingCreateData(cleanedFormData);
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Convert MappingFormData to MappingCreate/MappingUpdate
      const apiData = {
        mappingName: formData.mappingName.trim(),
        description: formData.description.trim(),
        hostHeaderPattern: formData.hostHeaderPattern?.trim() || undefined,
        pathPattern: formData.pathPattern?.trim() || undefined,
        originId: formData.originId,
        policyId: formData.policyId || undefined
      };

      const result = isEditing && id
        ? await updateMapping(id, apiData)
        : await createMapping(apiData);

      if (result.success) {
        navigate(ROUTES.MAPPINGS, {
          state: {
            message: `Successfully ${isEditing ? 'updated' : 'created'} mapping "${formData.mappingName}"`,
            type: 'success',
            timestamp: Date.now()
          }
        });
      } else {
        setError(result.error || `Failed to ${isEditing ? 'update' : 'create'} mapping`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} mapping`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    clearMessages();
    toMappings();
  };

  const handleSignOut = async () => {
    try {
      await AuthService.signOut();
      navigate('/auth/logout-complete');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const validateField = (field: keyof MappingCreate, value: string) => {
    // Don't validate empty pattern fields on blur - they're optional as long as the other is filled
    if ((field === 'hostHeaderPattern' || field === 'pathPattern') && !value.trim()) {
      // Clear any existing error for this field
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
      return;
    }
    
    const testData = { ...formData, [field]: value };
    const validation = isEditing 
      ? validateMappingUpdateData(testData)
      : validateMappingCreateData(testData);
    
    if (!validation.isValid && validation.errors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: validation.errors[field] }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const updateFormData = (field: keyof MappingCreate, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Handle mutual exclusion validation for pattern fields
    if (field === 'hostHeaderPattern' || field === 'pathPattern') {
      const otherField = field === 'hostHeaderPattern' ? 'pathPattern' : 'hostHeaderPattern';
      const otherValue = field === 'hostHeaderPattern' ? formData.pathPattern : formData.hostHeaderPattern;
      
      // If both fields will have values, show error
      if (value.trim() && otherValue?.trim()) {
        setError('Only one pattern is allowed. Please use either Host Header Pattern OR Path Pattern, not both.');
      } else {
        setError(null);
        // Clear error on the other field if this field now has a value
        if (value.trim()) {
          setValidationErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[otherField];
            return newErrors;
          });
        }
      }
    }
  };

  const breadcrumbs = [
    { text: 'Home', href: '/' },
    { text: 'Mappings', href: '/mappings' },
    { text: isEditing ? 'Edit mapping' : 'Create mapping' }
  ];

  return (
    <>
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
                navigate(ROUTES.ORIGINS);
              } else if (event.detail.href === ROUTES.MAPPINGS) {
                navigate(ROUTES.MAPPINGS);
              } else if (event.detail.href === ROUTES.TRANSFORMATION_POLICIES) {
                navigate(ROUTES.TRANSFORMATION_POLICIES);
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
      content={
        <ContentLayout
          header={
            <Header variant="h1">
              {isEditing ? 'Edit mapping' : 'Create mapping'}
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

            <Container>
              <SpaceBetween size="l">
                <PropagationDisclaimer />
                <Form
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button variant="link" type="button" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button 
                      variant="primary" 
                      onClick={handleSubmit}
                      loading={loading}
                      disabled={!formData.mappingName || !formData.originId || loadingMapping}
                    >
                      {isEditing ? 'Update mapping' : 'Create mapping'}
                    </Button>
                  </SpaceBetween>
                }
                >
                  <SpaceBetween size="l">
                    <FormField
                      label="Name"
                      description="A unique name for this mapping"
                      errorText={validationErrors.mappingName || (showValidation && !formData.mappingName ? "Name is required" : undefined)}
                      controlId="mapping-name"
                    >
                      <Input
                        value={formData.mappingName}
                        onChange={({ detail }) => updateFormData('mappingName', detail.value)}
                        onBlur={() => validateField('mappingName', formData.mappingName)}
                        placeholder="Enter mapping name"
                      />
                    </FormField>

                    <FormField
                      label="Description (optional)"
                      description="Optional description for this mapping"
                      errorText={validationErrors.description}
                      controlId="mapping-description"
                    >
                      <Textarea
                        value={formData.description}
                        onChange={({ detail }) => updateFormData('description', detail.value)}
                        onBlur={() => validateField('description', formData.description)}
                        placeholder="Enter mapping description"
                        rows={3}
                      />
                    </FormField>

                    <FormField
                      label="Origin"
                      description="Select the origin server for this mapping"
                      errorText={validationErrors.originId || (showValidation && !formData.originId ? "Origin is required" : undefined)}
                      controlId="mapping-origin"
                    >
                      <Select
                        selectedOption={originOptions.find(opt => opt.value === formData.originId) || null}
                        onChange={({ detail }) => updateFormData('originId', detail.selectedOption?.value || '')}
                        options={originOptions}
                        placeholder="Choose an origin"
                        empty="No origins available"
                        filteringType="auto"
                      />
                    </FormField>

                    <FormField
                      label="Host header pattern"
                      description="Pattern to match against the Host header"
                      controlId="mapping-host-pattern"
                      errorText={validationErrors.hostHeaderPattern}
                    >
                      <Input
                        value={formData.hostHeaderPattern}
                        onChange={({ detail }) => updateFormData('hostHeaderPattern', detail.value)}
                        onBlur={() => validateField('hostHeaderPattern', formData.hostHeaderPattern)}
                        placeholder="e.g., *.example.com"
                      />
                    </FormField>

                    <FormField
                      label="Path pattern"
                      description="Pattern to match against the request path"
                      controlId="mapping-path-pattern"
                      errorText={validationErrors.pathPattern}
                    >
                      <Input
                        value={formData.pathPattern}
                        onChange={({ detail }) => updateFormData('pathPattern', detail.value)}
                        onBlur={() => validateField('pathPattern', formData.pathPattern)}
                        placeholder="e.g., /api/*"
                      />
                    </FormField>

                    <FormField
                      label="Transformation Policy (optional)"
                      description="Optional transformation policy to apply to this mapping"
                      controlId="mapping-policy"
                    >
                      <Select
                        selectedOption={formData.policyId ? policyOptions.find(opt => opt.value === formData.policyId) || null : null}
                        onChange={({ detail }) => updateFormData('policyId', detail.selectedOption?.value || '')}
                        options={policyOptions}
                        placeholder="Choose a policy"
                        filteringType="auto"
                      />
                    </FormField>
                  </SpaceBetween>
                </Form>
              </SpaceBetween>
            </Container>
          </SpaceBetween>
        </ContentLayout>
      }
    />
    </>
  );
};

const CreateMapping: React.FC = () => {
  return (
    <OriginProvider>
      <TransformationPolicyProvider>
        <MappingProvider>
          <CreateMappingContent />
        </MappingProvider>
      </TransformationPolicyProvider>
    </OriginProvider>
  );
};

export default CreateMapping;