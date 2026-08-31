import React, { useState } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Container,
  FormField,
  Input,
  Select,
  Checkbox,
  ColumnLayout,
  RadioGroup,
  Toggle,
  SegmentedControl
} from '@cloudscape-design/components';
import { TransformationOption } from '../../types/interfaces';
import { Transformation } from '@data-models';
import { validateTransformationValue, getValidationConstraints } from '../../utils/transformationValidation';
import { transformationSchemas } from '@data-models';

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

  const parsePosition = (value: string): string | number => {
    if (!value?.trim()) return value;
  
    if (value.endsWith('p')) {
      return value;
    }
    const num = parseInt(value, 10);
    return isNaN(num) ? value : num;
  };

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
        case 'watermark':
          const [url, [xOffset, yOffset, alpha, widthRatio, heightRatio]] = value;
          setConfig({
            watermarkUrl: url,
            xOffset: xOffset?.toString() || '',
            yOffset: yOffset?.toString() || '',
            alpha,
            widthRatio,
            heightRatio
          });
          break;
        case 'smartCrop':
          if (value === true) {
            setConfig({ smartCropSimple: true });
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'index' in value) {
            setConfig({
              faces: true,
              faceIndex: value.index,
              padding: value.padding?.toString() || '',
            });
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const presetGravities = ['top-left','top-center','top-right','center-left','center','center-right','bottom-left','bottom-center','bottom-right'];
            const isCustomGravity = value.gravity && !presetGravities.includes(value.gravity);
            setConfig({
              faces: value.faces || false,
              faceIndex: value.faceIndex,
              labelsInput: value.labels ? value.labels.join(', ') : '',
              customModelArn: value.customModelArn || '',
              retainText: value.retainText || false,
              retainLogo: value.retainLogo || false,
              aspectRatio: value.aspectRatio || '',
              padding: value.padding?.toString() || '',
              gravity: value.gravity || '',
              gravityType: isCustomGravity ? 'custom' : (value.gravity || ''),
              priorities: value.priorities || [],
              priorityChoice: value.priorities?.[0] === 'padding' ? 'padding' : 'aspectRatio',
              fallback: value.fallback || '',
              minConfidence: value.minConfidence,
            });
          }
          break;
        case 'contentModeration':
          if (value === true) {
            setConfig({ contentModerationSimple: true });
          } else if (typeof value === 'object' && value !== null) {
            setConfig({
              contentModerationSimple: false,
              minConfidence: value.minConfidence,
              blur: value.blur,
              moderationLabelsInput: value.moderationLabels ? value.moderationLabels.join(', ') : '',
            });
          }
          break;
        default:
          setConfig({});
      }
    } else if (!editingTransformation) {
      setConfig(transformation?.id === 'smartCrop' ? { smartCropSimple: true } : transformation?.id === 'contentModeration' ? { contentModerationSimple: true } : {});
      setCondition(null);
    }
    
    if (!visible) {
      setErrors({});
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

  const validateWatermarkConfig = () => {
    const watermarkValue = getConfigValue();
    const result = transformationSchemas.watermark.safeParse(watermarkValue);
    if (!result.success) {
      const pathToField = {
        '0': 'watermarkUrl',
        '1': 'watermarkTuple',
        '1.0': 'xOffset',
        '1.1': 'yOffset',
        '1.2': 'alpha',
        '1.3': 'widthRatio',
        '1.4': 'heightRatio'
      } as const;

      const errors: Record<string, string> = {};
      
      result.error.issues.forEach(issue => {
        const path = issue.path.join('.');
        const fieldName = pathToField[path as keyof typeof pathToField] || 'general';
        errors[fieldName] = issue.message;
      });
      
      setErrors(prev => ({ ...prev, ...errors }));
      return false;
    }
    
    return true;
  };

  const handleAdd = () => {
    // Watermark-specific validation
    if (transformation.id === 'watermark' && !validateWatermarkConfig()) {
      return;
    }

    // Content moderation advanced mode requires at least one field
    if (transformation.id === 'contentModeration' && !(config.contentModerationSimple ?? true)) {
      const hasLabels = config.moderationLabelsInput?.split(',').map((s: string) => s.trim()).filter(Boolean).length > 0;
      if (config.minConfidence === undefined && config.blur === undefined && !hasLabels) {
        setErrors({ general: 'At least one field (min confidence, blur, or labels) is required in advanced mode' });
        return;
      }
    }
    
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
      case 'watermark': {
        return [
          config.watermarkUrl || '',
          [
            parsePosition(config.xOffset || ''),
            parsePosition(config.yOffset || ''),
            config.alpha,
            config.widthRatio,
            config.heightRatio
          ]
        ];
      }
      case 'grayscale':
      case 'stripExif':
      case 'stripIcc':
      case 'flip':
      case 'flop':
      case 'normalize':
      case 'animated':
        return true;
      case 'smartCrop': {
        if (config.smartCropSimple) return true;
        const labels = config.labelsInput
          ? config.labelsInput.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined;
        const padding = config.padding
          ? ((/^\d+$/.test(config.padding)) ? parseInt(config.padding) : config.padding)
          : undefined;
        return {
          ...(config.faces && { faces: true }),
          ...(config.faceIndex !== undefined && { faceIndex: config.faceIndex }),
          ...(labels && labels.length > 0 && { labels }),
          ...(config.customModelArn && { customModelArn: config.customModelArn }),
          ...(config.retainText && { retainText: true }),
          ...(config.retainLogo && { retainLogo: true }),
          ...(config.aspectRatio && { aspectRatio: config.aspectRatio }),
          ...(padding !== undefined && { padding }),
          ...(config.gravity && { gravity: config.gravity }),
          ...(config.priorities && config.priorities.length > 0 && { priorities: config.priorities }),
          ...(config.fallback && { fallback: config.fallback }),
          ...(config.minConfidence !== undefined && { minConfidence: config.minConfidence }),
        };
      }
      case 'contentModeration': {
        if (config.contentModerationSimple ?? true) return true;
        const moderationLabels = config.moderationLabelsInput
          ? config.moderationLabelsInput.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined;
        const obj = {
          ...(config.minConfidence !== undefined && { minConfidence: config.minConfidence }),
          ...(config.blur !== undefined && { blur: config.blur }),
          ...(moderationLabels && moderationLabels.length > 0 && { moderationLabels }),
        };
        return Object.keys(obj).length > 0 ? obj : true;
      }
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
        if (config.smartCropSimple) {
          return (
            <SpaceBetween size="m">
              <RadioGroup
                value="simple"
                onChange={({ detail }) => setConfig({ ...config, smartCropSimple: detail.value === 'simple', smartCropStep: 1, priorities: config.priorities?.length ? config.priorities : ['aspectRatio', 'padding'], priorityChoice: config.priorityChoice || 'aspectRatio' })}
                items={[
                  { value: 'simple', label: 'Simple', description: 'Face detection with defaults' },
                  { value: 'advanced', label: 'Advanced', description: 'Custom detection and crop settings' },
                ]}
              />
              <Box variant="p" color="text-body-secondary">
                Detects the most prominent face and crops to it using default settings (center gravity, 3% padding, cover fallback, 80% confidence).
              </Box>
            </SpaceBetween>
          );
        }
        const step = config.smartCropStep || 1;
        return (
          <SpaceBetween size="m">
            <RadioGroup
              value="advanced"
              onChange={({ detail }) => setConfig({ ...config, smartCropSimple: detail.value === 'simple', smartCropStep: 1, priorities: config.priorities?.length ? config.priorities : ['aspectRatio', 'padding'], priorityChoice: config.priorityChoice || 'aspectRatio' })}
              items={[
                { value: 'simple', label: 'Simple', description: 'Face detection with defaults' },
                { value: 'advanced', label: 'Advanced', description: 'Custom detection and crop settings' },
              ]}
            />

            <hr style={{ border: 'none', borderTop: '1px solid #d1d5db', margin: '4px 0' }} />

            <SpaceBetween size="xs" direction="horizontal" alignItems="center">
              <Button variant={step === 1 ? 'primary' : 'normal'} onClick={() => setConfig({ ...config, smartCropStep: 1 })}>1. Detection</Button>
              <Box color="text-body-secondary">→</Box>
              <Button variant={step === 2 ? 'primary' : 'normal'} onClick={() => setConfig({ ...config, smartCropStep: 2 })}>2. Crop Settings</Button>
              <Box color="text-body-secondary">→</Box>
              <Button variant={step === 3 ? 'primary' : 'normal'} onClick={() => setConfig({ ...config, smartCropStep: 3 })}>3. Condition</Button>
            </SpaceBetween>

            {step === 1 && (
              <SpaceBetween size="s">
                <Box variant="p" color="text-body-secondary">
                  At least one detection method is required: enable a checkbox, provide labels, or a custom model ARN.
                </Box>
                <Checkbox
                  checked={config.retainText || false}
                  onChange={({ detail }) => setConfig({ ...config, retainText: detail.checked })}
                >
                  Retain text
                </Checkbox>
                <Checkbox
                  checked={config.retainLogo || false}
                  onChange={({ detail }) => setConfig({ ...config, retainLogo: detail.checked })}
                >
                  Retain logo
                </Checkbox>
                <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                  <Checkbox
                    checked={config.faces || false}
                    onChange={({ detail }) => setConfig({ ...config, faces: detail.checked, faceIndex: detail.checked ? config.faceIndex : undefined })}
                  >
                    Face detection
                  </Checkbox>
                  <Input
                    type="number"
                    value={config.faceIndex?.toString() || ''}
                    disabled={!config.faces}
                    invalid={!!errors.faceIndex}
                    onChange={({ detail }) => {
                      const value = detail.value === '' ? undefined : parseInt(detail.value);
                      setConfig({ ...config, faceIndex: value });
                      if (errors.faceIndex) setErrors(prev => { const e = { ...prev }; delete e.faceIndex; return e; });
                    }}
                    onBlur={() => {
                      if (config.faceIndex !== undefined && (config.faceIndex < 0 || config.faceIndex > 15)) {
                        setErrors(prev => ({ ...prev, faceIndex: 'Face index must be between 0 and 15' }));
                      }
                    }}
                    placeholder="Face index (0-15)"
                  />
                </SpaceBetween>
                {errors.faceIndex && <Box color="text-status-error" fontSize="body-s">{errors.faceIndex}</Box>}
                <FormField label="Labels" description="Comma-separated object labels to detect" errorText={errors.labels}>
                  <Input value={config.labelsInput || ''} onChange={({ detail }) => setConfig({ ...config, labelsInput: detail.value })} placeholder="Labels (e.g. car, dog, person)" />
                </FormField>
                <FormField label="Custom Model ARN" description="ARN of a custom Rekognition model" errorText={errors.customModelArn}>
                  <Input value={config.customModelArn || ''} onChange={({ detail }) => setConfig({ ...config, customModelArn: detail.value })} placeholder="Custom Model ARN" />
                </FormField>
              </SpaceBetween>
            )}

            {step === 2 && (
              <SpaceBetween size="s">
                <Box variant="p" color="text-body-secondary">
                  Configure how the crop is applied after detection. All fields are optional.
                </Box>
                <ColumnLayout columns={2}>
                  <FormField label="Aspect Ratio" errorText={errors.aspectRatio} stretch>
                    <Input value={config.aspectRatio || ''} invalid={!!errors.aspectRatio} onChange={({ detail }) => { setConfig({ ...config, aspectRatio: detail.value }); if (errors.aspectRatio) setErrors(prev => { const e = { ...prev }; delete e.aspectRatio; return e; }); }} onBlur={() => { if (config.aspectRatio) { const m = config.aspectRatio.match(/^(\d{1,3}):(\d{1,3})$/); if (!m) setErrors(prev => ({ ...prev, aspectRatio: 'Must be w:h format' })); else { const [w, h] = [Number(m[1]), Number(m[2])]; if (w < 1 || w > 100 || h < 1 || h > 100) setErrors(prev => ({ ...prev, aspectRatio: 'Dimensions must be 1-100' })); } } }} placeholder="16:9" />
                  </FormField>
                  <FormField label="Padding" errorText={errors.padding} stretch>
                    <Input value={config.padding?.toString() || ''} invalid={!!errors.padding} onChange={({ detail }) => { setConfig({ ...config, padding: detail.value }); if (errors.padding) setErrors(prev => { const e = { ...prev }; delete e.padding; return e; }); }} onBlur={() => { if (config.padding && !/^\d+$/.test(config.padding) && !/^\d{1,4}(%|px)$/.test(config.padding)) setErrors(prev => ({ ...prev, padding: 'Must be number, percentage, or pixels' })); }} placeholder="3%" />
                  </FormField>
                </ColumnLayout>
                <ColumnLayout columns={2}>
                  <FormField label="Gravity" stretch>
                    <SpaceBetween size="xs">
                      <Select
                        selectedOption={config.gravityType === 'custom' ? { label: 'Custom', value: 'custom' } : config.gravity ? { label: config.gravity, value: config.gravity } : null}
                        onChange={({ detail }) => { if (detail.selectedOption.value === 'none') { setConfig({ ...config, gravityType: '', gravity: '' }); } else if (detail.selectedOption.value === 'custom') { setConfig({ ...config, gravityType: 'custom', gravity: '' }); } else { setConfig({ ...config, gravityType: detail.selectedOption.value, gravity: detail.selectedOption.value }); } }}
                        placeholder="center"
                        options={[
                          { label: '— None (use default)', value: 'none' },
                          { label: 'top-left', value: 'top-left' }, { label: 'top-center', value: 'top-center' }, { label: 'top-right', value: 'top-right' },
                          { label: 'center-left', value: 'center-left' }, { label: 'center', value: 'center' }, { label: 'center-right', value: 'center-right' },
                          { label: 'bottom-left', value: 'bottom-left' }, { label: 'bottom-center', value: 'bottom-center' }, { label: 'bottom-right', value: 'bottom-right' },
                          { label: 'Custom', value: 'custom' },
                        ]}
                      />
                      {config.gravityType === 'custom' && <Input value={config.gravity || ''} onChange={({ detail }) => setConfig({ ...config, gravity: detail.value })} placeholder="Custom gravity value" />}
                    </SpaceBetween>
                  </FormField>
                  <FormField label="Fallback" stretch>
                    <Select
                      selectedOption={config.fallback ? { label: config.fallback, value: config.fallback } : null}
                      onChange={({ detail }) => setConfig({ ...config, fallback: detail.selectedOption.value === 'none' ? '' : detail.selectedOption.value })}
                      placeholder="cover"
                      options={[
                        { label: '— None (use default)', value: 'none' },
                        { label: 'cover', value: 'cover' }, { label: 'contain', value: 'contain' }, { label: 'fill', value: 'fill' },
                        { label: 'inside', value: 'inside' }, { label: 'outside', value: 'outside' }, { label: 'no-crop', value: 'no-crop' },
                      ]}
                    />
                  </FormField>
                </ColumnLayout>
                <ColumnLayout columns={2}>
                  <FormField label="Min Confidence" errorText={errors.minConfidence}>
                    <Input type="number" value={config.minConfidence?.toString() || ''} invalid={!!errors.minConfidence} onChange={({ detail }) => { const v = detail.value === '' ? undefined : parseFloat(detail.value); setConfig({ ...config, minConfidence: v }); if (errors.minConfidence) setErrors(prev => { const e = { ...prev }; delete e.minConfidence; return e; }); }} onBlur={() => { if (config.minConfidence !== undefined && (config.minConfidence < 0 || config.minConfidence > 100)) setErrors(prev => ({ ...prev, minConfidence: 'Must be between 0 and 100' })); }} placeholder="80" />
                  </FormField>
                  <FormField label="Priority">
                    <SegmentedControl
                      selectedId={config.priorityChoice || 'aspectRatio'}
                      onChange={({ detail }) => { const v = detail.selectedId; setConfig({ ...config, priorityChoice: v, priorities: v === 'aspectRatio' ? ['aspectRatio', 'padding'] : ['padding', 'aspectRatio'] }); }}
                      options={[{ id: 'aspectRatio', text: 'Aspect Ratio' }, { id: 'padding', text: 'Padding' }]}
                    />
                  </FormField>
                </ColumnLayout>
              </SpaceBetween>
            )}

            {step === 3 && (
              <SpaceBetween size="s">
                <Box variant="p" color="text-body-secondary">
                  Optionally specify request headers and values. The transformation will only be applied if the request contains these headers with matching values.
                </Box>
                <ColumnLayout columns={2}>
                  <FormField label="Field" description="Request parameter">
                    <Input value={condition?.field || ''} onChange={({ detail }) => setCondition(prev => ({ field: detail.value, value: prev?.value || '' }))} placeholder="" />
                  </FormField>
                  <FormField label="Value" description="Expected value">
                    <Input value={Array.isArray(condition?.value) ? condition.value.join(', ') : condition?.value?.toString() || ''} onChange={({ detail }) => { const value = detail.value; let parsed: string | number | (string | number)[]; if (value.includes(',')) { parsed = value.split(',').map(v => { const t = v.trim(); const n = Number(t); return !isNaN(n) && t !== '' ? n : t; }); } else { const n = Number(value); parsed = !isNaN(n) && value !== '' ? n : value; } setCondition(prev => ({ field: prev?.field || '', value: parsed })); }} placeholder="" />
                  </FormField>
                </ColumnLayout>
              </SpaceBetween>
            )}


          </SpaceBetween>
        );

      case 'contentModeration': {
        const contentModerationItems = [
          { value: 'simple', label: 'Simple', description: 'Blur all inappropriate content with defaults' },
          { value: 'advanced', label: 'Advanced', description: 'Custom confidence, blur amount, and label filtering' },
        ];
        if (config.contentModerationSimple ?? true) {
          return (
            <SpaceBetween size="m">
              <RadioGroup
                value="simple"
                onChange={({ detail }) => setConfig({ ...config, contentModerationSimple: detail.value === 'simple' })}
                items={contentModerationItems}
              />
              <Box variant="p" color="text-body-secondary">
                Detects inappropriate content using AWS Rekognition and applies a blur (sigma 50) to the entire image.
              </Box>
            </SpaceBetween>
          );
        }
        return (
          <SpaceBetween size="m">
            <RadioGroup
              value="advanced"
              onChange={({ detail }) => setConfig({ ...config, contentModerationSimple: detail.value === 'simple' })}
              items={contentModerationItems}
            />
            <FormField label="Min Confidence" description="Minimum detection confidence (0-100)" errorText={errors.minConfidence}>
              <Input type="number" value={config.minConfidence?.toString() || ''} invalid={!!errors.minConfidence} onChange={({ detail }) => {
                const v = detail.value === '' ? undefined : parseFloat(detail.value);
                setConfig({ ...config, minConfidence: v });
                if (errors.minConfidence) setErrors((prev) => { const e = { ...prev }; delete e.minConfidence; return e; });
              }} onBlur={() => {
                if (config.minConfidence !== undefined) {
                  const result = validateTransformationValue('contentModeration', { minConfidence: config.minConfidence });
                  if (!result.success) setErrors((prev) => ({ ...prev, minConfidence: result.error.issues[0]?.message || 'Invalid value' }));
                }
              }} placeholder="75" />
            </FormField>
            <FormField label="Blur Amount" description="Blur sigma when inappropriate content detected (0.3-1000)" errorText={errors.blur}>
              <Input type="number" value={config.blur?.toString() || ''} invalid={!!errors.blur} onChange={({ detail }) => {
                const v = detail.value === '' ? undefined : parseFloat(detail.value);
                setConfig({ ...config, blur: v });
                if (errors.blur) setErrors((prev) => { const e = { ...prev }; delete e.blur; return e; });
              }} onBlur={() => {
                if (config.blur !== undefined) {
                  const result = validateTransformationValue('contentModeration', { blur: config.blur });
                  if (!result.success) setErrors((prev) => ({ ...prev, blur: result.error.issues[0]?.message || 'Invalid value' }));
                }
              }} placeholder="50" />
            </FormField>
            <FormField label="Moderation Labels" description="Comma-separated labels to filter (e.g. label1,label2). Leave empty for all." errorText={errors.moderationLabels}>
              <Input value={config.moderationLabelsInput || ''} onChange={({ detail }) => setConfig({ ...config, moderationLabelsInput: detail.value })} placeholder="Label1, Label2" />
            </FormField>
          </SpaceBetween>
        );
      }

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

      case 'watermark':
        return (
          <SpaceBetween size="m">
            <FormField
              label="Watermark Source URL"
              description="HTTPS URL of the watermark image (must match a configured origin)"
              errorText={errors.watermarkUrl}
            >
              <Input
                data-testid="watermark-url-input"
                type="text"
                value={config.watermarkUrl || ''}
                onChange={({ detail }) => {
                  setConfig({ ...config, watermarkUrl: detail.value });
                  if (detail.value.trim()) {
                    setErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.watermarkUrl;
                      return newErrors;
                    });
                  }
                }}
                onBlur={() => {
                  if (config.watermarkUrl?.trim()) {
                    const urlSchema = transformationSchemas.watermark._def.items[0];
                    const result = urlSchema.safeParse(config.watermarkUrl);
                    if (!result.success) {
                      setErrors(prev => ({ ...prev, watermarkUrl: result.error.issues[0]?.message || 'Invalid URL' }));
                    }
                  }
                }}
                placeholder="https://example.com/logo.png"
                invalid={!!errors.watermarkUrl}
              />
            </FormField>

            <SpaceBetween size="s" direction="horizontal">
              <FormField 
                label="X Offset" 
                description="Integer or percentage (e.g., 10 or 50p)"
                errorText={errors.xOffset}
              >
                <Input
                  data-testid="watermark-x-offset-input"
                  type="text"
                  value={config.xOffset || ''}
                  onChange={({ detail }) => {
                    setConfig({ ...config, xOffset: detail.value });
                    if (errors.xOffset) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.xOffset;
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    if (config.xOffset?.trim()) {
                      const positionSchema = transformationSchemas.watermark._def.items[1]._def.items[0];
                      const parsedValue = parsePosition(config.xOffset);
                      const result = positionSchema.safeParse(parsedValue);
                      if (!result.success) {
                        setErrors(prev => ({ ...prev, xOffset: result.error.issues[0]?.message || 'Invalid position format' }));
                      }
                    }
                  }}
                  placeholder="10 or 50p"
                  invalid={!!errors.xOffset}
                />
              </FormField>
              <FormField 
                label="Y Offset" 
                description="Integer or percentage (e.g., 10 or 50p)"
                errorText={errors.yOffset}
              >
                <Input
                  data-testid="watermark-y-offset-input"
                  type="text"
                  value={config.yOffset || ''}
                  onChange={({ detail }) => {
                    setConfig({ ...config, yOffset: detail.value });
                    if (errors.yOffset) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.yOffset;
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    if (config.yOffset?.trim()) {
                      const positionSchema = transformationSchemas.watermark._def.items[1]._def.items[1];
                      const parsedValue = parsePosition(config.yOffset);
                      const result = positionSchema.safeParse(parsedValue);
                      if (!result.success) {
                        setErrors(prev => ({ ...prev, yOffset: result.error.issues[0]?.message || 'Invalid position format' }));
                      }
                    }
                  }}
                  placeholder="10 or 50p"
                  invalid={!!errors.yOffset}
                />
              </FormField>
            </SpaceBetween>

            <SpaceBetween size="s" direction="horizontal">
              <FormField 
                label="Width Ratio" 
                description="Width as ratio of base image (0-1)"
                errorText={errors.widthRatio}
              >
                <Input
                  data-testid="watermark-width-ratio-input"
                  type="number"
                  value={config.widthRatio?.toString() || ''}
                  onKeyDown={(e) => {
                    if (e.detail.key === 'e' || e.detail.key === 'E' || e.detail.key === '+') {
                      e.preventDefault();
                    }
                  }}
                  onChange={({ detail }) => {
                    const value = detail.value === '' ? undefined : parseFloat(detail.value);
                    setConfig({ ...config, widthRatio: value });
                    if (errors.widthRatio || errors.watermarkTuple) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.widthRatio;
                        delete newErrors.heightRatio;
                        delete newErrors.watermarkTuple;
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    if (config.widthRatio !== undefined) {
                      const ratioSchema = transformationSchemas.watermark._def.items[1]._def.items[3];
                      const result = ratioSchema.safeParse(config.widthRatio);
                      if (!result.success) {
                        setErrors(prev => ({ ...prev, widthRatio: result.error.issues[0]?.message || 'Invalid width ratio' }));
                      }
                    }
                  }}
                  placeholder="0.2"
                  step="0.1"
                  invalid={!!errors.widthRatio}
                />
              </FormField>
              <FormField 
                label="Height Ratio" 
                description="Height as ratio of base image (0-1)"
                errorText={errors.heightRatio}
              >
                <Input
                  data-testid="watermark-height-ratio-input"
                  type="number"
                  value={config.heightRatio?.toString() || ''}
                  onKeyDown={(e) => {
                    if (e.detail.key === 'e' || e.detail.key === 'E' || e.detail.key === '+') {
                      e.preventDefault();
                    }
                  }}
                  onChange={({ detail }) => {
                    const value = detail.value === '' ? undefined : parseFloat(detail.value);
                    setConfig({ ...config, heightRatio: value });
                    if (errors.heightRatio || errors.watermarkTuple) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.heightRatio;
                        delete newErrors.widthRatio;
                        delete newErrors.watermarkTuple;
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    if (config.heightRatio !== undefined) {
                      const ratioSchema = transformationSchemas.watermark._def.items[1]._def.items[4];
                      const result = ratioSchema.safeParse(config.heightRatio);
                      if (!result.success) {
                        setErrors(prev => ({ ...prev, heightRatio: result.error.issues[0]?.message || 'Invalid height ratio' }));
                      }
                    }
                  }}
                  placeholder="0.2"
                  step="0.1"
                  invalid={!!errors.heightRatio}
                />
              </FormField>
            </SpaceBetween>

            {errors.watermarkTuple && (
              <Box color="text-status-error" fontSize="body-s">
                {errors.watermarkTuple}
              </Box>
            )}

            <Box color="text-status-info" fontSize="body-s">
              Note: At least one of Width Ratio or Height Ratio must be provided
            </Box>

            <div style={{ maxWidth: '50%' }}>
              <FormField 
                label="Transparency (Optional)" 
                description="0 = fully visible, 1 = fully transparent"
                errorText={errors.alpha}
              >
                <Input
                  data-testid="watermark-opacity-input"
                  type="number"
                  value={config.alpha?.toString() || ''}
                  onKeyDown={(e) => {
                    if (e.detail.key === 'e' || e.detail.key === 'E' || e.detail.key === '+') {
                      e.preventDefault();
                    }
                  }}
                  onChange={({ detail }) => {
                    const value = detail.value === '' ? undefined : parseFloat(detail.value);
                    setConfig({ ...config, alpha: value });
                    if (errors.alpha) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.alpha;
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    if (config.alpha !== undefined) {
                      const alphaSchema = transformationSchemas.watermark._def.items[1]._def.items[2];
                      const result = alphaSchema.safeParse(config.alpha);
                      if (!result.success) {
                        setErrors(prev => ({ ...prev, alpha: result.error.issues[0]?.message }));
                      }
                    }
                  }}
                  placeholder="0.2"
                  step="0.1"
                  invalid={!!errors.alpha}
                />
              </FormField>
            </div>
          </SpaceBetween>
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
      header={`Configure ${transformation?.title || 'Transformation'}`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={onDismiss}>Cancel</Button>
            <Button data-testid="watermark-add-button" variant="primary" onClick={handleAdd}>
              Add to Policy
            </Button>
          </SpaceBetween>
        </Box>
      }
      size="medium"
    >
      <SpaceBetween size="l">
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

            {transformation.id !== 'smartCrop' && (
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
                  description="Request parameter"
                  stretch
                >
                  <Input
                    data-testid="watermark-condition-field-input"
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
                  description="Expected value"
                  stretch
                >
                  <Input
                    data-testid="watermark-condition-value-input"
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
            )}
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