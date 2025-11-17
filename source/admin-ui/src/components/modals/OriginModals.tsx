import React from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Alert
} from '@cloudscape-design/components';
import { Origin } from '@data-models';

interface OriginModalsProps {
  showDeleteModal: boolean;
  onCloseDeleteModal: () => void;
  onConfirmDelete: () => void;
  deletingOrigin: Origin | null;
}

export const OriginModals: React.FC<OriginModalsProps> = ({
  showDeleteModal,
  onCloseDeleteModal,
  onConfirmDelete,
  deletingOrigin
}) => {
  return (
    <Modal
      visible={showDeleteModal}
      onDismiss={onCloseDeleteModal}
      header="Delete origin server"
      closeAriaLabel="Close modal"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={onCloseDeleteModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirmDelete}>
            Delete
          </Button>
        </SpaceBetween>
      }
    >
      {deletingOrigin && (
        <>
          <Alert type="warning" statusIconAriaLabel="Warning">
            Permanently delete origin server? This action cannot be undone and may affect existing origin mappings.
          </Alert>
          <Box margin={{ top: "m" }}>
            <Box fontWeight="bold">Origin details:</Box>
            <Box margin={{ top: "xs" }}>
              <Box><Box as="span" fontWeight="bold">Name:</Box> {deletingOrigin.originName}</Box>
              <Box><Box as="span" fontWeight="bold">Domain:</Box> {deletingOrigin.originDomain}</Box>
              <Box><Box as="span" fontWeight="bold">Path:</Box> {deletingOrigin.originPath || '/'}</Box>
              <Box><Box as="span" fontWeight="bold">Custom Headers:</Box> {Object.keys(deletingOrigin.originHeaders || {}).length}</Box>
            </Box>
          </Box>
        </>
      )}
    </Modal>
  );
};
