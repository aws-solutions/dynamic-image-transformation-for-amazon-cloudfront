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
} from '@cloudscape-design/components';
import { OutputOption, Output } from '../../types/interfaces';
import { outputSchemas } from '@data-models';
import { z } from 'zod';

interface OutputConfigModalProps {
  visible: boolean;
  onDismiss: () => void;
  onBack: () => void;
  onAdd: (output: Output) => void;
  output: OutputOption | null;
  editingOutput?: Output;
}

export const OutputConfigModal: React.FC<OutputConfigModalProps> = ({
  visible,
  onDismiss,
  onBack,
  onAdd,
  output,
  editingOutput
}) => {
  const [config, setConfig] = useState<any>({});
  const [validationTouched, setValidationTouched] = useState<{ [key: string]: boolean }>({});

  // Pre-populate config when editing
  React.useEffect(() => {
    if (editingOutput && visible) {
      const value = editingOutput.value;
      
      switch (editingOutput.type) {
        case 'quality':
          const qualityArray = Array.isArray(value) ? value : [value];
          const defaultQuality = qualityArray[0];
          const dprRules = qualityArray.slice(1).map((rule: [number, number, number]) => {
            const [minDpr, maxDpr, qualityRatio] = rule;
            const dprRange = maxDpr === 999 ? `${minDpr}+` : 
                           minDpr === maxDpr ? `${minDpr}` : 
                           `${minDpr}-${maxDpr}`;
            return {
              dprRange,
              quality: Math.round(qualityRatio * 100)
            };
          });
          setConfig({ defaultQuality, dprRules });
          break;
        case 'format':
          setConfig({ format: value });
          break;
        case 'autosize':
          setConfig({ enabled: value });
          break;
        default:
          setConfig({});
      }
    } else if (!editingOutput) {
      setConfig({});
    }
  }, [editingOutput, visible]);

  if (!output) return null;

  const handleAdd = () => {
    const outputData: Output = {
      type: output.id,
      value: getConfigValue()
    };
    onAdd(outputData);
    setConfig({});
  };

  const getConfigValue = () => {
    switch (output.id) {
      case 'quality':
        const qualityConfig: (number | number[])[] = [parseInt(config.defaultQuality) || 80];
        if (config.dprRules && config.dprRules.length > 0) {
          config.dprRules.forEach((rule: any) => {
            const [minDpr, maxDpr] = parseDprRange(rule.dprRange);
            const qualityValue = parseInt(rule.quality) || 80;
            qualityConfig.push([minDpr, maxDpr, qualityValue / 100]); // Convert to 0-1 ratio
          });
        }
        return qualityConfig;
      case 'format':
        return config.format || 'auto';
      case 'autosize':
        return [320, 480, 720, 1080, 1440, 1920, 2048, 3840]; // Default responsive widths
      default:
        return true;
    }
  };

  const parseDprRange = (range: string): [number, number] => {
    if (range === '2+') return [2, 999];
    if (range === '3+') return [3, 999];
    if (range === '1') return [1, 1];
    if (range === '2') return [2, 2];
    if (range.includes('-')) {
      const [min, max] = range.split('-').map(parseFloat);
      return [min, max];
    }
    const num = parseFloat(range);
    return [num, num];
  };

  const validateDprRanges = (rules: any[]): { rangeErrors: string[], qualityErrors: string[] } => {
    const rangeErrors: string[] = [];
    const qualityErrors: string[] = [];
    const ranges: Array<[number, number, number]> = [];
    
    rules.forEach((rule, index) => {
      const rangeTouched = validationTouched[`dprRange_${index}`];
      const qualityTouched = validationTouched[`dprQuality_${index}`];
      
      if (rangeTouched && rule.dprRange) {
        try {
          const [min, max] = parseDprRange(rule.dprRange);
          if (isNaN(min) || isNaN(max) || min > max) {
            rangeErrors[index] = 'Invalid range format';
          } else {
            // Check for overlaps with existing ranges
            for (const [existingMin, existingMax, existingIndex] of ranges) {
              if ((min < existingMax && max > existingMin)) {
                rangeErrors[index] = `Overlaps with rule ${existingIndex + 1}`;
                break;
              }
            }
            ranges.push([min, max, index]);
          }
        } catch {
          rangeErrors[index] = 'Invalid range format';
        }
      }
      
      if (qualityTouched && rule.quality) {
        const qualityValue = parseInt(rule.quality);
        if (!isNaN(qualityValue)) {
          try {
            z.number().min(0).max(1).parse(qualityValue / 100);
          } catch (err) {
            if (err instanceof z.ZodError) {
              qualityErrors[index] = 'Quality must be between 0 and 100';
            }
          }
        } else {
          qualityErrors[index] = 'Quality must be a number between 0 and 100';
        }
      }
    });
    
    return { rangeErrors, qualityErrors };
  };

  const getValidationErrors = () => {
    const errors: { [key: string]: string } = {};
    
    switch (output?.id) {
      case 'quality':
        if (validationTouched.defaultQuality && config.defaultQuality !== undefined && config.defaultQuality !== '') {
          const qualityValue = parseInt(config.defaultQuality);
          try {
            outputSchemas.quality.parse([qualityValue]);
          } catch (err) {
            if (err instanceof z.ZodError) {
              const message = err.issues[0]?.message || 'Invalid quality value';
              if (message.includes('received NaN')) {
                errors.defaultQuality = 'Quality must be a number between 1 and 100';
              } else {
                errors.defaultQuality = message;
              }
            }
          }
        }
        break;
      case 'format':
        if (validationTouched.format && config.format) {
          try {
            outputSchemas.format.parse(config.format);
          } catch (err) {
            if (err instanceof z.ZodError) {
              errors.format = err.issues[0]?.message || 'Invalid format';
            }
          }
        }
        break;
      case 'autosize':
        break;
    }
    
    return errors;
  };

  const isValidConfiguration = () => {
    switch (output?.id) {
      case 'quality':
        const qualityValue = parseInt(config.defaultQuality);
        if (!config.defaultQuality || isNaN(qualityValue)) return false;
        try {
          outputSchemas.quality.parse([qualityValue]);
          return true;
        } catch {
          return false;
        }
      case 'format':
        const formatValue = config.format || 'auto';
        try {
          outputSchemas.format.parse(formatValue);
          return true;
        } catch {
          return false;
        }
      case 'autosize':
        return true;
      default:
        return true;
    }
  };

  const renderConfiguration = () => {
    const validationErrors = getValidationErrors();
    
    switch (output.id) {
      case 'quality':
        return (
          <SpaceBetween size="m">
            <FormField
              label="Default Quality"
              description="Quality level when no device pixel ratio hints are available (1-100)"
              errorText={validationErrors.defaultQuality}
            >
              <Input
                value={config.defaultQuality?.toString() || ''}
                onChange={({ detail }) => {
                  setConfig({ ...config, defaultQuality: detail.value });
                }}
                onBlur={() => setValidationTouched({ ...validationTouched, defaultQuality: true })}
                invalid={!!validationErrors.defaultQuality}
              />
            </FormField>
            
            <FormField
              label="DPR Rules (Optional)"
              description="Configure quality based on device pixel ratio for adaptive delivery"
            >
              <SpaceBetween size="s">
                {(config.dprRules || []).map((rule: any, index: number) => {
                  const { rangeErrors, qualityErrors } = validateDprRanges(config.dprRules || []);
                  const hasRangeError = rangeErrors[index];
                  const hasQualityError = qualityErrors[index];
                  
                  return (
                    <Container key={index}>
                      <SpaceBetween direction="horizontal" size="s" alignItems="end">
                        <FormField 
                          label="DPR Range" 
                          stretch
                          description="Examples: 1-1.5, 2+, 1.4-2.3, 0.8-1.2"
                          errorText={hasRangeError}
                        >
                          <Input
                            value={rule.dprRange || ''}
                            onChange={({ detail }) => {
                              const newRules = [...(config.dprRules || [])];
                              newRules[index] = { ...rule, dprRange: detail.value };
                              setConfig({ ...config, dprRules: newRules });
                            }}
                            onBlur={() => setValidationTouched({ ...validationTouched, [`dprRange_${index}`]: true })}
                            invalid={!!hasRangeError}
                          />
                        </FormField>
                      <FormField label="Quality" stretch errorText={hasQualityError}>
                        <Input
                          value={rule.quality?.toString() || ''}
                          onChange={({ detail }) => {
                            const newRules = [...(config.dprRules || [])];
                            newRules[index] = { ...rule, quality: detail.value };
                            setConfig({ ...config, dprRules: newRules });
                          }}
                          onBlur={() => setValidationTouched({ ...validationTouched, [`dprQuality_${index}`]: true })}
                          invalid={!!hasQualityError}
                        />
                      </FormField>
                      <Button
                        variant="icon"
                        iconName="remove"
                        onClick={() => {
                          const newRules = (config.dprRules || []).filter((_: any, i: number) => i !== index);
                          setConfig({ ...config, dprRules: newRules });
                        }}
                        ariaLabel="Remove DPR rule"
                      />
                    </SpaceBetween>
                  </Container>
                  );
                })}
                
                <Button
                  variant="normal"
                  iconName="add-plus"
                  onClick={() => {
                    const newRules = [...(config.dprRules || []), { dprRange: '', quality: undefined }];
                    setConfig({ ...config, dprRules: newRules });
                  }}
                >
                  Add DPR Rule
                </Button>
              </SpaceBetween>
            </FormField>
          </SpaceBetween>
        );

      case 'format':
        return (
          <FormField
            label="Format Selection"
            description="Choose format optimization strategy"
            errorText={validationErrors.format}
          >
            <Select
              selectedOption={{ label: config.format || 'auto', value: config.format || 'auto' }}
              onChange={({ detail }) => {
                setConfig({ ...config, format: detail.selectedOption.value });
                setValidationTouched({ ...validationTouched, format: true });
              }}
              options={[
                { label: 'Auto (recommended)', value: 'auto' },
                { label: 'JPEG', value: 'jpeg' },
                { label: 'PNG', value: 'png' },
                { label: 'WebP', value: 'webp' },
                { label: 'AVIF', value: 'avif' }
              ]}
              invalid={!!validationErrors.format}
            />
          </FormField>
        );

      case 'autosize':
        return (
          <Box>
            <Box variant="strong">{output.title}</Box>
            <Box variant="p" color="text-body-secondary">
              Auto sizing is enabled for responsive images
            </Box>
          </Box>
        );

      default:
        return (
          <Box>
            <Box variant="strong">{output.title}</Box>
            <Box variant="p" color="text-body-secondary">
              {output.description}
            </Box>
          </Box>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header="Add Output - Step 2 of 2"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={onDismiss}>Cancel</Button>
            <Button onClick={onBack}>Back</Button>
            <Button variant="primary" onClick={handleAdd} disabled={!isValidConfiguration()}>
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
            <Box color="text-body-secondary">Select Output</Box>
            <Box color="text-body-secondary">→</Box>
            <Badge>2</Badge>
            <Box variant="strong">Configure & Add</Box>
          </SpaceBetween>
        </Box>

        <Container>
          <SpaceBetween size="l">
            <div>
              <Box variant="strong" fontSize="heading-m" display="inline">
                {output.title}
              </Box>
              <Box variant="p" color="text-body-secondary" display="inline" margin={{ left: "s" }}>
                ({output.description})
              </Box>
            </div>

            {renderConfiguration()}
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </Modal>
  );
};