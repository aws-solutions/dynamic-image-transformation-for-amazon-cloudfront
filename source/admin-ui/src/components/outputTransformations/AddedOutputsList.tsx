import React from 'react';
import {
  Box,
  SpaceBetween,
  Button,
  Container,
  ExpandableSection
} from '@cloudscape-design/components';
import { Output } from '../../types/interfaces'
import { availableOutputs } from '../../constants/ouputTransformations';

interface AddedOutputsListProps {
  outputs: Output[];
  onRemove: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onEdit: (index: number) => void;
  onAdd?: () => void;
}

export const AddedOutputsList: React.FC<AddedOutputsListProps> = ({
  outputs,
  onRemove,
  onMove,
  onEdit,
  onAdd
}) => {
  const getOutputTitle = (type: string) => {
    const output = availableOutputs.find(o => o.id === type);
    return output?.title || type;
  };

  const getOutputSummary = (output: Output) => {
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
          const qualityPercent = Math.round(quality * 100);
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

  const renderConfigDetails = (output: Output) => {
    const details = {
      type: output.type,
      value: output.value
    };
    
    return (
      <Box padding="s" color="text-body-secondary" fontSize="body-s">
        <pre>
          {JSON.stringify(details, null, 2)}
        </pre>
      </Box>
    );
  };

  if (outputs.length === 0) {
    return (
      <Box textAlign="center" padding="l" color="text-body-secondary">
        <SpaceBetween size="m">
          <Box>No output optimizations added yet. Click "Add Output Optimization" to configure adaptive delivery options.</Box>
          {onAdd && (
            <Button 
              variant="normal" 
              iconName="add-plus" 
              onClick={onAdd}
            >
              Add Output Optimization
            </Button>
          )}
        </SpaceBetween>
      </Box>
    );
  }

  return (
    <SpaceBetween size="s">
      {outputs.map((output, index) => (
        <Container key={index}>
          <SpaceBetween size="s">
            <Box>
              <SpaceBetween direction="horizontal" size="s" alignItems="center">
                <Box variant="strong">{getOutputTitle(output.type)}</Box>
                <Box flex={1} />
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="icon"
                    iconName="angle-up"
                    disabled={index === 0}
                    onClick={() => onMove(index, index - 1)}
                    ariaLabel={`Move ${getOutputTitle(output.type)} up`}
                  />
                  <Button
                    variant="icon"
                    iconName="angle-down"
                    disabled={index === outputs.length - 1}
                    onClick={() => onMove(index, index + 1)}
                    ariaLabel={`Move ${getOutputTitle(output.type)} down`}
                  />
                  <Button
                    variant="icon"
                    iconName="edit"
                    onClick={() => onEdit(index)}
                    ariaLabel={`Edit ${getOutputTitle(output.type)}`}
                  />
                  <Button
                    variant="icon"
                    iconName="remove"
                    onClick={() => onRemove(index)}
                    ariaLabel={`Remove ${getOutputTitle(output.type)}`}
                  />
                </SpaceBetween>
              </SpaceBetween>
            </Box>

            <ExpandableSection 
              headerText={<Box fontSize="body-xs">Configuration Details</Box>} 
              variant="footer"
            >
              {renderConfigDetails(output)}
            </ExpandableSection>
          </SpaceBetween>
        </Container>
      ))}
    </SpaceBetween>
  );
};