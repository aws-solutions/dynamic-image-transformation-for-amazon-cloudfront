import React, { useMemo } from 'react';
import { Table, Box, Button, TextFilter } from '@cloudscape-design/components';
import { Origin } from '@data-models';
import { useOriginContext } from '../../contexts/OriginContext';
import { useOriginFilters } from '../../hooks/useOriginFilters';
import { useTypedNavigate } from '../../hooks/useTypedNavigate';
import { OriginTableHeader } from './OriginTableHeader';
import { createOriginColumns } from './OriginTableColumns';

interface OriginTableProps {
  onDeleteClick: (origin: Origin) => void;
}

export const OriginTable: React.FC<OriginTableProps> = ({ onDeleteClick }) => {
  const { toOriginDetails, toOriginEdit, toOriginCreate } = useTypedNavigate();
  const { 
    allOrigins, 
    selectedOrigins, 
    setSelectedOrigins, 
    loading, 
    hasNext, 
    loadMore 
  } = useOriginContext();
  
  const { filteringText, setFilteringText, filteredOrigins } = useOriginFilters(allOrigins || []);

  const handleView = (origin: Origin) => toOriginDetails(origin.originId);
  const handleEdit = () => selectedOrigins.length === 1 && toOriginEdit(selectedOrigins[0].originId);
  const handleDelete = () => selectedOrigins.length === 1 && onDeleteClick(selectedOrigins[0]);

  const columnDefinitions = useMemo(() => createOriginColumns(handleView), []);

  return (
    <>
      <Table
        columnDefinitions={columnDefinitions}
        items={filteredOrigins}
        selectedItems={selectedOrigins}
        onSelectionChange={({ detail }) => setSelectedOrigins(detail.selectedItems)}
        selectionType="single"
        loading={loading}
        loadingText="Loading origins..."
        ariaLabels={{
          selectionGroupLabel: "Origin selection",
          allItemsSelectionLabel: ({ selectedItems }) => `${selectedItems.length} origin selected`,
          itemSelectionLabel: ({ selectedItems }, item) => item.originName
        }}
        header={
          <OriginTableHeader
            count={filteredOrigins?.length || 0}
            selectedCount={selectedOrigins?.length || 0}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onCreate={toOriginCreate}
          />
        }
        filter={
          <TextFilter
            filteringText={filteringText}
            onChange={({ detail }) => setFilteringText(detail.filteringText)}
            filteringPlaceholder="Search origins by name, domain, or path"
            filteringAriaLabel="Filter origins"
          />
        }
        empty={
          <Box textAlign="center" color="inherit">
            <Box fontWeight="bold">No origins</Box>
            <Box padding={{ bottom: "s" }} variant="p" color="inherit">
              No origin servers found. Total origins available: {filteredOrigins?.length || 0}
            </Box>
            <Button onClick={toOriginCreate}>Create origin</Button>
          </Box>
        }
      />
      {hasNext && (
        <Box textAlign="center" padding="m">
          <Button 
            onClick={loadMore} 
            loading={loading}
            iconName="refresh"
            variant="normal"
          >
            Load more origins
          </Button>
        </Box>
      )}
    </>
  );
};
