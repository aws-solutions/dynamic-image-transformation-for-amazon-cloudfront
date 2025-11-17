import React, { useState } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Container,
  Badge,
  FormField,
  Input,
  Select,
  Checkbox
} from '@cloudscape-design/components';
import { TransformationOption } from '../../types/interfaces';
import { Transformation } from '@data-models';
import { validateTransformationValue, getValidationConstraints } from '../../utils/transformationValidation';

// CSS to hide number input spinners
const hideSpinnerStyles = `
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] {
    -moz-appearance: textfield;
  }
`;

interface TransformationConfigModalProps {
  visible: boolean;
  onDismiss: () => void;
  onBack: () => void;
  onAdd: (transformation: Transformation) => void;
  transformation: TransformationOption | null;
  editingTransformation?: Transformation;
}

export const TransformationConfigModal: React.FC<TransformationConfigModalProps> = ({
  visible,
  onDismiss,
  onBack,
  onAdd,
  transformation,
  editingTransformation
}) => {
  const [config, setConfig] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState<{field: string, value: string | number | (string | number)[]} | null>(null);

  // Pre-fill config when editing
  React.useEffect(() => {
    if (editingTransformation && visible) {
      const value = editingTransformation.value;
      
      if (editingTransformation.condition) {
        setCondition(editingTransformation.condition);
      } else {
        setCondition(null);
      }
      
      switch (editingTransformation.transformation) {
        case 'quality':
        case 'blur':
        case 'rotate':
          setConfig({ [editingTransformation.transformation]: value });
          break;
        case 'resize':
          setConfig({
            width: value.width,
            height: value.height,
            fit: value.fit
          });
          break;
        case 'tint':
        case 'flatten':
          setConfig({ [editingTransformation.transformation]: value });
          break;
        default:
          setConfig({});
      }
    } else if (!editingTransformation) {
      setConfig({});
      setCondition(null);
    }
  }, [editingTransformation, visible]);

  if (!transformation) return null;

  const validateColorField = (fieldName: string, value: string) => {
    if (value.trim()) {
      const result = validateTransformationValue(fieldName, value);
      if (!result.success) {
        setErrors(prev => ({ ...prev, [fieldName]: result.error.issues[0]?.message || 'Invalid color format' }));
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[fieldName];
          return newErrors;
        });
      }
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validateField = (field: string, value: any) => {
    if (!transformation) return;
    
    const result = validateTransformationValue(transformation.id, getConfigValue());
    if (!result.success) {
      setErrors(prev => ({ ...prev, [field]: result.error.issues[0]?.message || 'Invalid value' }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAdd = () => {
    const finalValue = getConfigValue();
    const result = validateTransformationValue(transformation.id, finalValue);
    
    if (!result.success) {
      const errorMessage = result.error.issues[0]?.message || 'Invalid configuration';
      setErrors({ general: errorMessage });
      return;
    }

    const transformationData: Transformation = {
      transformation: transformation.id,
      value: finalValue,
      ...(condition?.field && condition?.value && { condition })
    };
    onAdd(transformationData);
    setConfig({});
    setErrors({});
    setCondition(null);
  };

  const getConfigValue = () => {
    switch (transformation.id) {
      case 'quality':
        return config.quality ?? 80;
      case 'format':
        return config.format || 'webp';
      case 'resize':
        return {
          width: config.width || undefined,
          height: config.height || undefined,
          fit: config.fit || 'cover'
        };
      case 'blur':
        return config.blur ?? 1;
      case 'rotate':
        return config.rotate ?? 0;
      case 'convolve':
        return {
          width: 3,
          height: 3,
          kernel: config.kernel || [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Edge detection kernel
        };
      case 'extract':
        return [
          config.left || 0,
          config.top || 0,
          config.width || 100,
          config.height || 100
        ];
      case 'tint':
        return config.tint || '';
      case 'flatten':
        return config.flatten || '';
      case 'grayscale':
      case 'stripExif':
      case 'stripIcc':
      case 'flip':
      case 'flop':
      case 'normalize':
      case 'animated':
        return true;
      case 'smartCrop':
        return config.smartCrop || true;
      case 'sharpen':
        return config.sharpen || true;
      default:
        return true;
    }
  };

  const renderConfiguration = () => {
    switch (transformation.id) {
      case 'quality':
        const qualityConstraints = getValidationConstraints('quality');
        return (
          <FormField
            label="Quality Level"
            description={`Image quality from ${qualityConstraints.min} (lowest) to ${qualityConstraints.max} (highest)`}
            errorText={errors.quality}
          >
            <Input
              type="number"
              value={config.quality?.toString() || ''}
              onChange={({ detail }) => {
                const value = detail.value === '' ? undefined : parseInt(detail.value);
                setConfig({ ...config, quality: value });
                if (value !== undefined) {
                  validateField('quality', value);
                }
              }}
              placeholder=""
              invalid={!!errors.quality}
            />
          </FormField>
        );

      case 'format':
        return (
          <FormField
            label="Output Format"
            description="Target image format"
          >
            <Select
              selectedOption={{ label: config.format || 'webp', value: config.format || 'webp' }}
              onChange={({ detail }) => setConfig({ ...config, format: detail.selectedOption.value })}
              options={[
                { label: 'JPEG', value: 'jpeg' },
                { label: 'PNG', value: 'png' },
                { label: 'WebP', value: 'webp' },
                { label: 'AVIF', value: 'avif' },
                { label: 'TIFF', value: 'tiff' }
              ]}
            />
          </FormField>
        );

      case 'resize':
        const resizeConstraints = getValidationConstraints('resize');
        return (
          <SpaceBetween size="m">
            <SpaceBetween size="s" direction="horizontal">
              <FormField 
                label="Width" 
                description={`Target width (${resizeConstraints.width.min}-${resizeConstraints.width.max}px)`}
                errorText={errors.width}
              >
                <Input
                  type="number"
                  value={config.width || ''}
                  onChange={({ detail }) => {
                    const value = parseInt(detail.value) || undefined;
                    setConfig({ ...config, width: value });
                    validateField('width', value);
                  }}
                  placeholder=""
                  invalid={!!errors.width}
                />
              </FormField>
              <FormField 
                label="Height" 
                description={`Target height (${resizeConstraints.height.min}-${resizeConstraints.height.max}px)`}
                errorText={errors.height}
              >
                <Input
                  type="number"
                  value={config.height || ''}
                  onChange={({ detail }) => {
                    const value = parseInt(detail.value) || undefined;
                    setConfig({ ...config, height: value });
                    validateField('height', value);
                  }}
                  placeholder=""
                  invalid={!!errors.height}
                />
              </FormField>
            </SpaceBetween>
            <FormField label="Fit Mode" description="How to resize the image">
              <Select
                selectedOption={{ label: config.fit || 'cover', value: config.fit || 'cover' }}
                onChange={({ detail }) => setConfig({ ...config, fit: detail.selectedOption.value })}
                options={[
                  { label: 'Cover', value: 'cover' },
                  { label: 'Contain', value: 'contain' },
                  { label: 'Fill', value: 'fill' },
                  { label: 'Inside', value: 'inside' },
                  { label: 'Outside', value: 'outside' }
                ]}
              />
            </FormField>
            {errors.resize && (
              <Box color="text-status-error" fontSize="body-s">
                {errors.resize}
              </Box>
            )}
          </SpaceBetween>
        );

      case 'blur':
        const blurConstraints = getValidationConstraints('blur');
        return (
          <FormField
            label="Blur Amount"
            description={`Blur intensity (${blurConstraints.min} to ${blurConstraints.max})`}
            errorText={errors.blur}
          >
            <Input
              type="number"
              value={config.blur?.toString() || ''}
              onChange={({ detail }) => {
                const value = detail.value === '' ? undefined : parseFloat(detail.value);
                setConfig({ ...config, blur: value });
                if (value !== undefined) {
                  validateField('blur', value);
                }
              }}
              placeholder=""
              invalid={!!errors.blur}
            />
          </FormField>
        );

      case 'rotate':
        const rotateConstraints = getValidationConstraints('rotate');
        return (
          <FormField
            label="Rotation Angle"
            description={`Rotate image (${rotateConstraints.min}-${rotateConstraints.max} degrees, will be normalized to 0-360)`}
            errorText={errors.rotate}
          >
            <Input
              type="number"
              value={config.rotate?.toString() || ''}
              onChange={({ detail }) => {
                const value = detail.value === '' ? undefined : parseInt(detail.value);
                setConfig({ ...config, rotate: value });
                if (value !== undefined) {
                  validateField('rotate', value);
                }
              }}
              placeholder=""
              invalid={!!errors.rotate}
            />
          </FormField>
        );

      case 'convolve':
        return (
          <SpaceBetween size="m">
            <FormField
              label="Convolution Kernel"
              description="3x3 kernel for image processing (9 numbers)"
            >
              <Select
                selectedOption={{ 
                  label: config.kernelType || 'Edge Detection', 
                  value: config.kernelType || 'edge' 
                }}
                onChange={({ detail }) => {
                  const kernels = {
                    edge: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
                    sharpen: [0, -1, 0, -1, 5, -1, 0, -1, 0],
                    blur: [1, 1, 1, 1, 1, 1, 1, 1, 1],
                    emboss: [-2, -1, 0, -1, 1, 1, 0, 1, 2]
                  };
                  setConfig({ 
                    ...config, 
                    kernelType: detail.selectedOption.value,
                    kernel: kernels[detail.selectedOption.value as keyof typeof kernels]
                  });
                }}
                options={[
                  { label: 'Edge Detection', value: 'edge' },
                  { label: 'Sharpen', value: 'sharpen' },
                  { label: 'Blur', value: 'blur' },
                  { label: 'Emboss', value: 'emboss' }
                ]}
              />
            </FormField>
          </SpaceBetween>
        );

      case 'extract':
        return (
          <SpaceBetween size="m">
            <SpaceBetween size="s" direction="horizontal">
              <FormField label="Left" description="X position">
                <Input
                  type="number"
                  value={config.left?.toString() || '0'}
                  onChange={({ detail }) => setConfig({ ...config, left: parseInt(detail.value) || 0 })}
                />
              </FormField>
              <FormField label="Top" description="Y position">
                <Input
                  type="number"
                  value={config.top?.toString() || '0'}
                  onChange={({ detail }) => setConfig({ ...config, top: parseInt(detail.value) || 0 })}
                />
              </FormField>
            </SpaceBetween>
            <SpaceBetween size="s" direction="horizontal">
              <FormField label="Width" description="Extract width">
                <Input
                  type="number"
                  value={config.width?.toString() || '100'}
                  onChange={({ detail }) => setConfig({ ...config, width: parseInt(detail.value) || 100 })}
                />
              </FormField>
              <FormField label="Height" description="Extract height">
                <Input
                  type="number"
                  value={config.height?.toString() || '100'}
                  onChange={({ detail }) => setConfig({ ...config, height: parseInt(detail.value) || 100 })}
                />
              </FormField>
            </SpaceBetween>
          </SpaceBetween>
        );

      case 'tint':
        return (
          <FormField
            label="Tint Color"
            description="Color to tint the image (hex color or color name)"
            errorText={errors.tint}
          >
            <Input
              type="text"
              value={config.tint || ''}
              onChange={({ detail }) => {
                setConfig({ ...config, tint: detail.value });
                validateColorField('tint', detail.value);
              }}
              placeholder=""
              invalid={!!errors.tint}
            />
          </FormField>
        );

      case 'flatten':
        return (
          <FormField
            label="Background Color"
            description="Background color for flattening alpha channel (hex color)"
            errorText={errors.flatten}
          >
            <Input
              type="text"
              value={config.flatten || ''}
              onChange={({ detail }) => {
                setConfig({ ...config, flatten: detail.value });
                validateColorField('flatten', detail.value);
              }}
              placeholder=""
              invalid={!!errors.flatten}
            />
          </FormField>
        );

      case 'smartCrop':
        return (
          <Box>
            <Box variant="strong">{transformation.title}</Box>
            <Box variant="p" color="text-body-secondary">
              AI-powered face detection cropping is enabled
            </Box>
          </Box>
        );

      case 'flip':
        return (
          <FormField>
            <Box>
              This transformation will be added to the policy.
            </Box>
          </FormField>
        );

      case 'flop':
        return (
          <FormField>
            <Box>
              This transformation will be added to the policy.
            </Box>
          </FormField>
        );

      case 'grayscale':
        return (
          <FormField>
            <Box>
              This transformation will be added to the policy.
            </Box>
          </FormField>
        );

      case 'stripExif':
        return (
          <FormField>
            <Box>
              This transformation will be added to the policy.
            </Box>
          </FormField>
        );

      case 'stripIcc':
        return (
          <FormField>
            <Box>
              This transformation will be added to the policy.
            </Box>
          </FormField>
        );

      case 'normalize':
        return (
          <FormField>
            <Box>
              This transformation will be added to the policy.
            </Box>
          </FormField>
        );

      case 'animated':
        return (
          <FormField>
            <Box>
              This transformation will be added to the policy.
            </Box>
          </FormField>
        );

      case 'sharpen':
        return (
          <Box>
            <Box variant="strong">{transformation.title}</Box>
            <Box variant="p" color="text-body-secondary">
              Image sharpening is enabled
            </Box>
          </Box>
        );

      default:
        return (
          <FormField
            label={`${transformation.title} Settings`}
            description={transformation.description}
          >
            <Checkbox checked>
              Enable {transformation.title.toLowerCase()} (no additional configuration needed)
            </Checkbox>
          </FormField>
        );
    }
  };

  return (
    <>
      <style>{hideSpinnerStyles}</style>
      <Modal
      visible={visible}
      onDismiss={onDismiss}
      header="Add Transformation - Step 2 of 2"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={onDismiss}>Cancel</Button>
            <Button onClick={onBack}>Back</Button>
            <Button variant="primary" onClick={handleAdd}>
              Add to Policy
            </Button>
          </SpaceBetween>
        </Box>
      }
      size="medium"
    >
      <SpaceBetween size="l">
        <Box>
          <SpaceBetween size="xs" direction="horizontal" alignItems="center">
            <Badge>1</Badge>
            <Box color="text-body-secondary">Select Transformation</Box>
            <Box color="text-body-secondary">→</Box>
            <Badge>2</Badge>
            <Box variant="strong">Configure & Add</Box>
          </SpaceBetween>
        </Box>

        <Container>
          <SpaceBetween size="l">
            <div>
              <Box variant="strong" fontSize="heading-m" display="inline">
                {transformation.title}
              </Box>
              <Box variant="p" color="text-body-secondary" display="inline" margin={{ left: "s" }}>
                ({transformation.description})
              </Box>
            </div>

            {renderConfiguration()}

            <SpaceBetween size="s">
              <SpaceBetween size="xs">
                <Box variant="strong" fontSize="body-m">Condition (Optional)</Box>
                <Box variant="p" color="text-body-secondary">
                  Optionally specify request headers and values. The transformation will only be applied if the request contains these headers with matching values.
                </Box>
              </SpaceBetween>
              <SpaceBetween size="s" direction="horizontal">
                <FormField 
                  label="Field" 
                  description="Request parameter to check"
                  stretch
                >
                  <Input
                    value={condition?.field || ''}
                    onChange={({ detail }) => setCondition(prev => ({ 
                      field: detail.value,
                      value: prev?.value || ''
                    }))}
                    placeholder=""
                  />
                </FormField>
                <FormField 
                  label="Value" 
                  description="Expected value (comma-separated for multiple)"
                  stretch
                >
                  <Input
                    value={Array.isArray(condition?.value) ? condition.value.join(', ') : condition?.value?.toString() || ''}
                    onChange={({ detail }) => {
                      const value = detail.value;
                      let parsedValue: string | number | (string | number)[];
                      
                      if (value.includes(',')) {
                        parsedValue = value.split(',').map(v => {
                          const trimmed = v.trim();
                          const num = Number(trimmed);
                          return !isNaN(num) && trimmed !== '' ? num : trimmed;
                        });
                      } else {
                        const num = Number(value);
                        parsedValue = !isNaN(num) && value !== '' ? num : value;
                      }
                      
                      setCondition(prev => ({ 
                        field: prev?.field || '',
                        value: parsedValue
                      }));
                    }}
                    placeholder=""
                  />
                </FormField>
              </SpaceBetween>
            </SpaceBetween>
          </SpaceBetween>
        </Container>

        {errors.general && (
          <Box color="text-status-error" fontSize="body-s">
            {errors.general}
          </Box>
        )}
      </SpaceBetween>
    </Modal>
    </>
  );
};