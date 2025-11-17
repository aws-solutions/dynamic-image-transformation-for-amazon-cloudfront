import React from 'react';
import {
  SpaceBetween,
  Container,
  Button,
  Box,
  ExpandableSection
} from '@cloudscape-design/components';
import { Transformation } from '@data-models';

interface AddedTransformationsListProps {
  transformations: Transformation[];
  onRemove: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onEdit: (index: number) => void;
  onAdd?: () => void;
}

export const AddedTransformationsList: React.FC<AddedTransformationsListProps> = ({
  transformations,
  onRemove,
  onMove,
  onEdit,
  onAdd
}) => {
  const getTransformationTitle = (transformation: Transformation) => {
    const titles: Record<string, string> = {
      quality: 'Quality', format: 'Format', resize: 'Resize', blur: 'Blur',
      rotate: 'Rotate', grayscale: 'Grayscale', sharpen: 'Sharpen',
      smartCrop: 'Smart Crop', stripExif: 'Strip EXIF', stripIcc: 'Strip ICC',
      flip: 'Flip', flop: 'Flop', normalize: 'Normalize', animated: 'Animated',
      tint: 'Tint', flatten: 'Flatten', convolve: 'Convolve', extract: 'Extract'
    };
    return titles[transformation.transformation] || transformation.transformation;
  };

  const getTransformationSummary = (transformation: Transformation) => {
    switch (transformation.transformation) {
      case 'quality':
        return `Quality: ${transformation.value}`;
      case 'format':
        return `Format: ${transformation.value.toUpperCase()}`;
      case 'resize':
        const { width, height, fit } = transformation.value;
        return `${width || 'auto'} × ${height || 'auto'} (${fit})`;
      case 'blur':
        return `Blur: ${transformation.value}`;
      case 'rotate':
        return `Rotate: ${transformation.value}°`;
      default:
        return 'Configured';
    }
  };

  const renderConfigDetails = (transformation: Transformation) => {
    const details = {
      value: transformation.value,
      ...(transformation.condition && { condition: transformation.condition })
    };
    
    return (
      <Box padding="s" color="text-body-secondary" fontSize="body-s">
        <pre>
          {JSON.stringify(details, null, 2)}
        </pre>
      </Box>
    );
  };

  if (transformations.length === 0) {
    return (
      <Box textAlign="center" padding="l" color="text-body-secondary">
        <SpaceBetween size="m">
          <Box>No transformations added yet. Click "Add Transformation" to get started.</Box>
          {onAdd && (
            <Button 
              variant="normal" 
              iconName="add-plus" 
              onClick={onAdd}
            >
              Add Transformation
            </Button>
          )}
        </SpaceBetween>
      </Box>
    );
  }

  return (
    <SpaceBetween size="s">
      {transformations.map((transformation, index) => (
        <Container key={index}>
          <SpaceBetween size="s">
            <Box>
              <SpaceBetween direction="horizontal" size="s" alignItems="center">
                <Box variant="strong">{getTransformationTitle(transformation)}</Box>
                <Box flex={1} />
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    iconName="angle-up"
                    variant="icon"
                    disabled={index === 0}
                    onClick={() => onMove(index, index - 1)}
                    ariaLabel="Move up"
                  />
                  <Button
                    iconName="angle-down"
                    variant="icon"
                    disabled={index === transformations.length - 1}
                    onClick={() => onMove(index, index + 1)}
                    ariaLabel="Move down"
                  />
                  <Button
                    iconName="edit"
                    variant="icon"
                    onClick={() => onEdit(index)}
                    ariaLabel="Edit transformation"
                  />
                  <Button
                    iconName="remove"
                    variant="icon"
                    onClick={() => onRemove(index)}
                    ariaLabel="Remove transformation"
                  />
                </SpaceBetween>
              </SpaceBetween>
            </Box>

            <ExpandableSection 
              headerText={<Box fontSize="body-xs">Configuration Details</Box>} 
              variant="footer"
            >
              {renderConfigDetails(transformation)}
            </ExpandableSection>
          </SpaceBetween>
        </Container>
      ))}
    </SpaceBetween>
  );
};