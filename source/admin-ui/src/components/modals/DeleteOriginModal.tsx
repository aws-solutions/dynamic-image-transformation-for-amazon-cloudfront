import React from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button
} from '@cloudscape-design/components';
import { Origin } from '@data-models';

interface DeleteOriginModalProps {
  visible: boolean;
  origin: Origin | null;
  onDismiss: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export const DeleteOriginModal: React.FC<DeleteOriginModalProps> = ({
  visible,
  origin,
  onDismiss,
  onConfirm,
  loading = false
}) => {
  if (!origin) return null;

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      size="medium"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirm} loading={loading}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Delete Origin"
    >
      <SpaceBetween direction="vertical" size="m">
        <Box variant="span">
          Are you sure you want to delete the origin "{origin.originName}"?
          This action cannot be undone.
        </Box>
        <Box>
          <Box variant="h4">Origin details:</Box>
          <ul>
            <li><strong>Name:</strong> {origin.originName}</li>
            <li><strong>Domain:</strong> {origin.originDomain}</li>
            <li><strong>Path:</strong> {origin.originPath || 'None'}</li>
            <li><strong>Custom Headers:</strong> {Object.keys(origin.originHeaders || {}).length}</li>
          </ul>
        </Box>
      </SpaceBetween>
    </Modal>
  );
};
