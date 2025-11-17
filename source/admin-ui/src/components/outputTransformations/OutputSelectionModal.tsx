import React from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Cards,
  Badge
} from '@cloudscape-design/components';
import { OutputOption } from '../../types/interfaces'
import { availableOutputs } from '../../constants/ouputTransformations'

interface OutputSelectionModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (output: OutputOption) => void;
  excludeOutputs: string[];
}

export const OutputSelectionModal: React.FC<OutputSelectionModalProps> = ({
  visible,
  onDismiss,
  onSelect,
  excludeOutputs
}) => {
  const availableOptions = availableOutputs.filter(
    output => !excludeOutputs.includes(output.id)
  );

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header="Add Output - Step 1 of 2"
      footer={
        <Box float="right">
          <Button onClick={onDismiss}>Cancel</Button>
        </Box>
      }
      size="large"
    >
      <SpaceBetween size="l">
        <Box>
          <SpaceBetween size="xs" direction="horizontal" alignItems="center">
            <Badge>1</Badge>
            <Box variant="strong">Select Output</Box>
            <Box color="text-body-secondary">→</Box>
            <Badge>2</Badge>
            <Box color="text-body-secondary">Configure & Add</Box>
          </SpaceBetween>
        </Box>

        <Cards
          cardDefinition={{
            header: (item: OutputOption) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Box variant="strong">{item.title}</Box>
                <Badge color="blue">{item.category}</Badge>
              </SpaceBetween>
            ),
            sections: [
              {
                content: (item: OutputOption) => item.description
              }
            ]
          }}
          cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }]}
          items={availableOptions}
          onSelectionChange={({ detail }) => {
            if (detail.selectedItems.length > 0) {
              onSelect(detail.selectedItems[0]);
            }
          }}
          selectionType="single"
          trackBy="id"
          empty={
            <Box textAlign="center" color="inherit">
              <Box variant="strong" textAlign="center" color="inherit">
                No outputs available
              </Box>
              <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                All output types have been added to this policy.
              </Box>
            </Box>
          }
        />
      </SpaceBetween>
    </Modal>
  );
};