import React from 'react';
import { Modal, Box, SpaceBetween, Button } from '@cloudscape-design/components';
import { TransformationPolicy } from '@data-models';

interface TransformationPolicyModalsProps {
  showDeleteModal: boolean;
  onCloseDeleteModal: () => void;
  onConfirmDelete: () => void;
  deletingPolicy: TransformationPolicy | null;
}

export const TransformationPolicyModals: React.FC<TransformationPolicyModalsProps> = ({
  showDeleteModal,
  onCloseDeleteModal,
  onConfirmDelete,
  deletingPolicy
}) => (
  <Modal
    onDismiss={onCloseDeleteModal}
    visible={showDeleteModal}
    footer={
      <Box float="right">
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={onCloseDeleteModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirmDelete}>
            Delete
          </Button>
        </SpaceBetween>
      </Box>
    }
    header="Delete transformation policy"
  >
    <SpaceBetween size="m">
      <Box variant="span">
        Permanently delete transformation policy <b>{deletingPolicy?.policyName}</b>?
      </Box>
      <Box variant="span">
        You can't undo this action.
      </Box>
    </SpaceBetween>
  </Modal>
);