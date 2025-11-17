import React from 'react';
import { Header, Button, SpaceBetween } from '@cloudscape-design/components';

interface MappingTableHeaderProps {
  count: number;
  selectedCount: number;
  onDelete: () => void;
  onEdit: () => void;
  onCreate: () => void;
}

export const MappingTableHeader: React.FC<MappingTableHeaderProps> = ({
  count,
  selectedCount,
  onDelete,
  onEdit,
  onCreate
}) => (
  <Header
    variant="h1"
    description="Create and manage origin mappings for request routing"
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
          Create mapping
        </Button>
      </SpaceBetween>
    }
  >
    Mappings ({count})
  </Header>
);
