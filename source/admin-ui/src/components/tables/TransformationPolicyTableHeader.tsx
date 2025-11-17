import React from 'react';
import { Header, Button, SpaceBetween } from '@cloudscape-design/components';

interface TransformationPolicyTableHeaderProps {
  count: number;
  selectedCount: number;
  onDelete: () => void;
  onEdit: () => void;
  onCreate: () => void;
}

export const TransformationPolicyTableHeader: React.FC<TransformationPolicyTableHeaderProps> = ({
  count,
  selectedCount,
  onDelete,
  onEdit,
  onCreate
}) => (
  <Header
    variant="h1"
    description="Create and manage transformation policies for image processing"
    actions={
      <SpaceBetween direction="horizontal" size="xs">
        <Button 
          disabled={selectedCount !== 1}
          onClick={onDelete}
          iconName="remove"
        >
          Delete
        </Button>
        <Button 
          disabled={selectedCount !== 1}
          onClick={onEdit}
          iconName="edit"
        >
          Edit
        </Button>
        <Button variant="primary" onClick={onCreate} iconName="add-plus">
          Create policy
        </Button>
      </SpaceBetween>
    }
  >
    Transformation Policies ({count})
  </Header>
);