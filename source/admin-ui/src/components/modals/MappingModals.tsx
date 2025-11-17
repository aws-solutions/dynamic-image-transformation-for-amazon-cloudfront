import React from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Alert
} from '@cloudscape-design/components';
import { Mapping } from '@data-models';

interface MappingModalsProps {
  showDeleteModal: boolean;
  onCloseDeleteModal: () => void;
  onConfirmDelete: () => void;
  deletingMapping: Mapping | null;
}

export const MappingModals: React.FC<MappingModalsProps> = ({
  showDeleteModal,
  onCloseDeleteModal,
  onConfirmDelete,
  deletingMapping
}) => {
  return (
    <Modal
      visible={showDeleteModal}
      onDismiss={onCloseDeleteModal}
      header="Delete mapping"
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
      {deletingMapping && (
        <>
          <Alert type="warning" statusIconAriaLabel="Warning">
            Permanently delete mapping? This action cannot be undone and may affect existing configurations.
          </Alert>
          <Box margin={{ top: "m" }}>
            <Box fontWeight="bold">Mapping details:</Box>
            <Box margin={{ top: "xs" }}>
              <Box><Box as="span" fontWeight="bold">Name:</Box> {deletingMapping.name}</Box>
              <Box><Box as="span" fontWeight="bold">Description:</Box> {deletingMapping.description}</Box>
              <Box><Box as="span" fontWeight="bold">Host Pattern:</Box> {deletingMapping.hostHeaderPattern || 'None'}</Box>
              <Box><Box as="span" fontWeight="bold">Path Pattern:</Box> {deletingMapping.pathPattern || 'None'}</Box>
            </Box>
          </Box>
        </>
      )}
    </Modal>
  );
};
