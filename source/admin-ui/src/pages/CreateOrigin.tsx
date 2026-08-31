import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  Form,
  FormField,
  Input,
  Button,
  SpaceBetween,
  Container,
  ColumnLayout,
  Alert
} from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router';
import { PageLayout } from '../components/layout/PageLayout';
import { OriginHelpPanel } from '../components/help/OriginHelpPanel';
import { PropagationDisclaimer } from '../components/common/PropagationDisclaimer';
import { useFlashMessages } from '../hooks/useFlashMessages';
import { OriginService } from '../services/originService';
import { ROUTES } from '../constants/routes';
import { validateOriginCreateData, validateOriginUpdateData } from '../utils/validation';
import { OriginCreate } from '@data-models';

export const CreateOrigin: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const { clearMessages } = useFlashMessages();

  const [formData, setFormData] = useState<OriginCreate>({
    originName: '',
    originDomain: '',
    originPath: '',
    originHeaders: {}
  });
  
  const [headerEntries, setHeaderEntries] = useState<Array<{id: string, key: string, value: string}>>([]);

  // Header values are write-only: the API returns REDACTED_HEADER_VALUE placeholders, never the real
  // credentials. Submitting those placeholders back would overwrite the stored credential, so when
  // editing we only send originHeaders if the operator actually changed them. Omitting the field
  // leaves the stored value untouched (the API applies a merge patch).
  const [headersDirty, setHeadersDirty] = useState(false);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [loadingOrigin, setLoadingOrigin] = useState(isEditing);

  useEffect(() => {
    if (!isEditing || !id) {
      return;
    }
    
    const loadOrigin = async () => {
      try {
        setLoadingOrigin(true);
        const result = await OriginService.getOrigin(id);
        
        if (result.data) {
          const loadedData = {
            originName: result.data.originName,
            originDomain: result.data.originDomain,
            originPath: result.data.originPath || '',
            originHeaders: result.data.originHeaders || {}
          };
          setFormData(loadedData);

          // The API returns header names with redacted values, so hydrate the names and leave the
          // value inputs blank rather than pre-filling a placeholder that would fail validation and,
          // if submitted, overwrite the real credential. Blank means "unchanged" — see headersField()
          // in handleSubmit.
          const entries = Object.keys(loadedData.originHeaders || {}).map((key, index) => ({
            id: `header-${Date.now()}-${index}`,
            key,
            value: ''
          }));
          setHeaderEntries(entries);
          // Hydration is not an operator edit.
          setHeadersDirty(false);

          setTimeout(() => {
            validateField('originName', loadedData.originName);
            validateField('originDomain', loadedData.originDomain);
            if (loadedData.originPath) {
              validateField('originPath', loadedData.originPath);
            }
          }, 100);
        } else {
          setError('No origin data found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load origin');
      } finally {
        setLoadingOrigin(false);
      }
    };

    loadOrigin();
  }, [isEditing, id]);

  const handleSubmit = async () => {
    setShowValidation(true);
    setValidationErrors({});
    
    // When editing, blank header values mean "keep the stored credential" — the real values are never
    // sent to the browser, so there is nothing to pre-fill or re-validate unless the operator typed
    // something. Skip header validation entirely in that case.
    const headersNeedValidation = !isEditing || headersDirty;

    if (headersNeedValidation) {
      headerEntries.forEach((entry, index) => {
        validateHeaderName(entry.key, index);
        validateHeaderValue(entry.value, index);
      });

      const hasEmptyHeaders = headerEntries.some(entry =>
        !entry.key.trim() || !entry.value.trim()
      );

      if (hasEmptyHeaders) {
        return;
      }
    }

    // Helper: null (delete) in edit mode, undefined (omit) in create mode
    const optionalField = (value: string | undefined) =>
      isEditing ? (value?.trim() || null) : (value?.trim() || undefined);

    // Header values are write-only. When editing, the form was hydrated with redacted placeholders,
    // so submitting them would overwrite the real stored credentials. Send originHeaders only when
    // the operator actually changed them:
    //   untouched while editing -> omit (undefined), and the API preserves the stored value
    //   cleared to empty        -> null, an explicit delete
    //   edited                  -> the new map, which wholly replaces the stored one
    const headersField = () => {
      const hasHeaders = Object.keys(formData.originHeaders).length > 0;
      if (!isEditing) return hasHeaders ? formData.originHeaders : undefined;
      if (!headersDirty) return undefined;
      return hasHeaders ? formData.originHeaders : null;
    };

    const cleanedData = {
      originName: formData.originName.trim(),
      originDomain: formData.originDomain.trim(),
      originPath: optionalField(formData.originPath),
      originHeaders: headersField()
    };
    
    const validation = isEditing 
      ? validateOriginUpdateData(cleanedData)
      : validateOriginCreateData(cleanedData);
    
    if (!validation.isValid) {
      setValidationErrors(prev => ({ ...prev, ...validation.errors }));
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const result = isEditing && id
        ? await OriginService.updateOrigin(id, cleanedData)
        : await OriginService.createOrigin(cleanedData);

      if (result.success) {
        navigate(ROUTES.ORIGINS, {
          state: {
            message: `Successfully ${isEditing ? 'updated' : 'created'} origin "${formData.originName}"`,
            type: 'success',
            timestamp: Date.now()
          }
        });
      } else {
        setError(result.error || `Failed to ${isEditing ? 'update' : 'create'} origin`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} origin`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    clearMessages();
    navigate(ROUTES.ORIGINS);
  };

  const validateField = (field: keyof OriginCreate, value: string) => {
    const testData = { ...formData, [field]: value };
    
    const validation = validateOriginCreateData(testData);
    
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

  const validateHeaders = () => {
    const testData = { ...formData };
    const validation = isEditing 
      ? validateOriginUpdateData(testData)
      : validateOriginCreateData(testData);
    
    if (!validation.isValid && validation.errors.originHeaders) {
      setValidationErrors(prev => ({ ...prev, originHeaders: validation.errors.originHeaders }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.originHeaders;
        return newErrors;
      });
    }
  };

  const validateHeaderName = (headerName: string, index: number) => {
    const headerNameRegex = /^[a-zA-Z0-9-]+$/;
    const fieldKey = `headerName_${index}`;
    
    if (!headerName.trim()) {
      setValidationErrors(prev => ({ ...prev, [fieldKey]: 'Header name is required' }));
    } else if (headerName.length > 100) {
      setValidationErrors(prev => ({ ...prev, [fieldKey]: 'Header name must be 100 characters or less' }));
    } else if (!headerNameRegex.test(headerName)) {
      setValidationErrors(prev => ({ ...prev, [fieldKey]: 'Invalid header name' }));
    } else {
      const duplicateCount = headerEntries.filter(entry => entry.key.toLowerCase() === headerName.toLowerCase()).length;
      if (duplicateCount > 1) {
        setValidationErrors(prev => ({ ...prev, [fieldKey]: 'Duplicate header name' }));
      } else {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[fieldKey];
          return newErrors;
        });
      }
    }
  };

  const validateHeaderValue = (headerValue: string, index: number) => {
    const headerValueRegex = /^[a-zA-Z0-9 ._:;,/=+-]+$/;
    const fieldKey = `headerValue_${index}`;
    
    if (!headerValue.trim()) {
      setValidationErrors(prev => ({ ...prev, [fieldKey]: 'Header value is required' }));
    } else if (headerValue.length > 1000) {
      setValidationErrors(prev => ({ ...prev, [fieldKey]: 'Header value must be 1000 characters or less' }));
    } else if (!headerValueRegex.test(headerValue)) {
      setValidationErrors(prev => ({ ...prev, [fieldKey]: 'Invalid header value' }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  const updateFormData = (field: keyof OriginCreate, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const addCustomHeader = () => {
    const newEntry = {
      id: `header-${Date.now()}`,
      key: '',
      value: ''
    };
    setHeaderEntries(prev => [...prev, newEntry]);
    syncHeadersToFormData([...headerEntries, newEntry]);
  };

  const removeCustomHeader = (id: string) => {
    const headerIndex = headerEntries.findIndex(entry => entry.id === id);
    const newEntries = headerEntries.filter(entry => entry.id !== id);
    setHeaderEntries(newEntries);
    syncHeadersToFormData(newEntries);
    
    if (headerIndex !== -1) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`headerName_${headerIndex}`];
        delete newErrors[`headerValue_${headerIndex}`];
        
        const hasIndividualErrors = Object.keys(newErrors).some(key => 
          key.startsWith('headerName_') || key.startsWith('headerValue_')
        );
        if (!hasIndividualErrors) {
          delete newErrors.originHeaders;
        }
        
        return newErrors;
      });
    }
  };

  const updateCustomHeader = (id: string, field: 'key' | 'value', newValue: string) => {
    const newEntries = headerEntries.map(entry => 
      entry.id === id ? { ...entry, [field]: newValue } : entry
    );
    setHeaderEntries(newEntries);
    syncHeadersToFormData(newEntries);
    
    const headerIndex = headerEntries.findIndex(entry => entry.id === id);
    if (headerIndex !== -1) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        
        if (field === 'key') {
          delete newErrors[`headerName_${headerIndex}`];
        } else {
          delete newErrors[`headerValue_${headerIndex}`];
        }
        
        const hasIndividualErrors = Object.keys(newErrors).some(key => 
          key.startsWith('headerName_') || key.startsWith('headerValue_')
        );
        if (!hasIndividualErrors) {
          delete newErrors.originHeaders;
        }
        
        return newErrors;
      });
    }
  };

  // Single choke point for every header mutation (add / remove / update), so marking the headers
  // dirty here covers all of them.
  const syncHeadersToFormData = (entries: Array<{id: string, key: string, value: string}>) => {
    const headers: Record<string, string> = {};
    entries.forEach(entry => {
      if (entry.key.trim()) {
        headers[entry.key] = entry.value;
      }
    });
    setHeadersDirty(true);
    setFormData(prev => ({ ...prev, originHeaders: headers }));
  };

  const breadcrumbs = [
    { text: 'Home', href: '/' },
    { text: 'Origins', href: '/origins' },
    { text: isEditing ? 'Edit origin' : 'Create origin' }
  ];

  return (
    <PageLayout
      activeHref={ROUTES.ORIGINS}
      breadcrumbs={breadcrumbs}
      helpPanel={<OriginHelpPanel />}
    >
      <ContentLayout
        header={
          <Header variant="h1">
            {isEditing ? 'Edit origin' : 'Create origin'}
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
                    disabled={!formData.originName || !formData.originDomain || loadingOrigin || Object.keys(validationErrors).length > 0}
                  >
                    {isEditing ? 'Update origin' : 'Create origin'}
                  </Button>
                </SpaceBetween>
              }
            >
              <SpaceBetween size="l">
                <FormField
                  label="Name"
                  description="A unique name for this origin"
                  errorText={validationErrors.originName || (showValidation && !formData.originName ? "Name is required" : undefined)}
                  controlId="origin-name"
                >
                  <Input
                    value={formData.originName}
                    onChange={({ detail }) => updateFormData('originName', detail.value)}
                    onBlur={() => validateField('originName', formData.originName)}
                    placeholder="Enter origin name"
                  />
                </FormField>

                <FormField
                  label="Origin domain"
                  description="Enter a valid DNS domain name, such as an S3 bucket, HTTP server"
                  errorText={validationErrors.originDomain || (showValidation && !formData.originDomain ? "Domain is required" : undefined)}
                  controlId="origin-domain"
                >
                  <Input
                    value={formData.originDomain}
                    onChange={({ detail }) => updateFormData('originDomain', detail.value)}
                    onBlur={() => validateField('originDomain', formData.originDomain)}
                    placeholder="Enter the origin domain"
                  />
                </FormField>

                <FormField
                  label="Origin path - optional"
                  description="Enter a URL path to append to the origin domain name for origin requests."
                  errorText={validationErrors.originPath}
                  controlId="origin-path"
                >
                  <Input
                    value={formData.originPath}
                    onChange={({ detail }) => updateFormData('originPath', detail.value)}
                    onBlur={() => formData.originPath && validateField('originPath', formData.originPath)}
                    placeholder="Enter path to be appended to origin"
                  />
                </FormField>

                <Container
                  header={
                    <Header
                      variant="h4"
                      description="The header will be added to all requests made to the origin."
                    >
                      Add custom header - optional
                    </Header>
                  }
                >
                  <SpaceBetween direction="vertical" size="m">
                    {headerEntries.map((entry, index) => {
                      return (
                        <ColumnLayout columns={3} key={entry.id}>
                          <FormField
                            label="Header name"
                            errorText={validationErrors[`headerName_${index}`]}
                            controlId={`header-name-${entry.id}`}
                          >
                            <Input
                              value={entry.key}
                              onChange={({ detail }) => {
                                updateCustomHeader(entry.id, 'key', detail.value);
                              }}
                              onBlur={() => entry.key && validateHeaderName(entry.key, index)}
                              placeholder="Enter header name"
                            />
                          </FormField>
                          <FormField
                            label="Header Value"
                            errorText={validationErrors[`headerValue_${index}`]}
                            controlId={`header-value-${entry.id}`}
                            description={
                              isEditing && !headersDirty
                                ? 'Stored value is hidden. Leave blank to keep it, or enter a new value to replace it.'
                                : undefined
                            }
                          >
                            <Input
                              value={entry.value}
                              onChange={({ detail }) => {
                                updateCustomHeader(entry.id, 'value', detail.value);
                              }}
                              onBlur={() => entry.value && validateHeaderValue(entry.value, index)}
                              placeholder={isEditing && !headersDirty ? 'Unchanged' : 'Enter header value'}
                            />
                          </FormField>
                          <div style={{ paddingTop: '24px' }}>
                            <Button
                              type="button"
                              variant="normal"
                              onClick={() => removeCustomHeader(entry.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </ColumnLayout>
                      );
                    })}
                    
                    <Button
                      type="button"
                      variant="normal"
                      iconName="add-plus"
                      onClick={addCustomHeader}
                    >
                      Add header
                    </Button>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            </Form>
            </SpaceBetween>
          </Container>
        </SpaceBetween>
      </ContentLayout>
    </PageLayout>
  );
};

export default CreateOrigin;
