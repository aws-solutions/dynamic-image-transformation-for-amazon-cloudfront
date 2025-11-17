import React from 'react';
import { Header, Button, SpaceBetween } from '@cloudscape-design/components';

interface OriginTableHeaderProps {
  count: number;
  selectedCount: number;
  onDelete: () => void;
  onEdit: () => void;
  onCreate: () => void;
}

export const OriginTableHeader: React.FC<OriginTableHeaderProps> = ({
  count,
  selectedCount,
  onDelete,
  onEdit,
  onCreate
}) => (
  <Header
    variant="h1"
    description="Create and manage origin servers for image transformation"
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
          Create origin
        </Button>
      </SpaceBetween>
    }
  >
    Origins ({count})
  </Header>
);
