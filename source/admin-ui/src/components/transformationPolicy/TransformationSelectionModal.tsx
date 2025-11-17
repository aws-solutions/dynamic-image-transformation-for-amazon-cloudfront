import React from 'react';
import { Modal, Box, SpaceBetween, Button } from '@cloudscape-design/components';
import { TransformationOption } from '../../types/ui';
import { TransformationType } from '@data-models';
import { AVAILABLE_TRANSFORMATIONS } from '../../constants/transformations';

interface TransformationSelectionModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (transformation: TransformationOption) => void;
  excludeTransformations: TransformationType[];
}

export const TransformationSelectionModal: React.FC<TransformationSelectionModalProps> = ({
  visible,
  onDismiss,
  onSelect,
  excludeTransformations
}) => {
  const filteredTransformations = AVAILABLE_TRANSFORMATIONS.filter(
    t => !(excludeTransformations || []).includes(t.id)
  );

  const groupedTransformations = {
    basic: filteredTransformations.filter(t => t.category === 'basic'),
    effects: filteredTransformations.filter(t => t.category === 'effects'),
    advanced: filteredTransformations.filter(t => t.category === 'advanced')
  };

  const renderTransformationList = (transformations: TransformationOption[], title: string) => {
    if (transformations.length === 0) return null;
    
    return (
      <Box>
        <Box variant="h3" padding={{ bottom: 's' }}>{title}</Box>
        {transformations.map((transformation) => (
          <Box key={transformation.id} padding="xs">
            <button
              onClick={() => onSelect(transformation)}
              style={{ 
                width: '100%',
                background: '#f2f3f3', 
                border: '1px solid #d5dbdb', 
                padding: '12px 16px', 
                borderRadius: '4px', 
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#e9ebed'}
              onMouseOut={(e) => e.currentTarget.style.background = '#f2f3f3'}
            >
              <SpaceBetween direction="vertical" size="xs">
                <strong>{transformation.title}</strong>
                <span style={{ color: '#5f6b7a', fontSize: '13px' }}>
                  {transformation.description}
                </span>
              </SpaceBetween>
            </button>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Modal
      onDismiss={onDismiss}
      visible={visible}
      size="medium"
      header="Add Transformation"
      footer={
        <Box float="right">
          <Button variant="link" onClick={onDismiss}>
            Cancel
          </Button>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <Box variant="p">Select a transformation to add to your policy:</Box>
        
        {filteredTransformations.length === 0 ? (
          <Box textAlign="center" color="inherit">
            <Box variant="strong">All transformations added</Box>
            <Box variant="p" color="inherit">
              You have already added all available transformations to this policy.
            </Box>
          </Box>
        ) : (
          <SpaceBetween size="l">
            {renderTransformationList(groupedTransformations.basic, 'Basic Transformations')}
            {renderTransformationList(groupedTransformations.effects, 'Effects')}
            {renderTransformationList(groupedTransformations.advanced, 'Advanced')}
          </SpaceBetween>
        )}
      </SpaceBetween>
    </Modal>
  );
};