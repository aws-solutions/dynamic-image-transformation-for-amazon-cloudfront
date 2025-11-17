import React, { useMemo } from 'react';
import { Table, Box, Button, TextFilter, Link } from '@cloudscape-design/components';
import { Mapping } from '@data-models';
import { useMappingContext } from '../../contexts/MappingContext';
import { useOriginContext } from '../../contexts/OriginContext';
import { useTransformationPolicyContext } from '../../contexts/TransformationPolicyContext';
import { useMappingFilters } from '../../hooks/useMappingFilters';
import { useTypedNavigate } from '../../hooks/useTypedNavigate';
import { MappingTableHeader } from './MappingTableHeader';
import { ROUTES } from '../../constants/routes';

interface MappingTableProps {
  onDeleteClick: (mapping: Mapping) => void;
}

const createMappingColumns = (
  handleView: (mapping: Mapping) => void,
  getOriginName: (originId: string) => string,
  getPolicyName: (policyId?: string) => string
) => [
  {
    id: 'name',
    header: 'Name',
    cell: (mapping: Mapping) => (
      <Link 
        href={ROUTES.MAPPING_DETAILS.replace(':id', mapping.mappingId)}
        onFollow={(event) => {
          event.preventDefault();
          handleView(mapping);
        }}
      >
        <span style={{ color: 'black' }}>{mapping.mappingName || mapping.name}</span>
      </Link>
    ),
    isRowHeader: true,
    width: 200
  },
  {
    id: 'hostHeaderPattern',
    header: 'Host Pattern',
    cell: (mapping: Mapping) => mapping.hostHeaderPattern || '-',
    width: 150
  },
  {
    id: 'pathPattern',
    header: 'Path Pattern',
    cell: (mapping: Mapping) => mapping.pathPattern || '-',
    width: 150
  },
  {
    id: 'originName',
    header: 'Origin Name',
    cell: (mapping: Mapping) => getOriginName(mapping.originId),
    width: 150
  },
  {
    id: 'policyName',
    header: 'Policy Name',
    cell: (mapping: Mapping) => getPolicyName(mapping.policyId),
    width: 150
  }
];

export const MappingTable: React.FC<MappingTableProps> = ({ onDeleteClick }) => {
  const { toMappingDetails, toMappingEdit, toMappingCreate } = useTypedNavigate();
  const { 
    allMappings, 
    selectedMappings, 
    setSelectedMappings, 
    loading, 
    hasNext, 
    loadMore 
  } = useMappingContext();
  
  const { allOrigins } = useOriginContext();
  const { allPolicies: transformationPolicies } = useTransformationPolicyContext();
  
  const { filteringText, setFilteringText, filteredMappings } = useMappingFilters(allMappings || []);

  const getOriginName = (originId: string) => {
    const origin = allOrigins?.find(o => o.originId === originId);
    return origin?.originName || originId;
  };

  const getPolicyName = (policyId?: string) => {
    if (!policyId) return '-';
    const policy = transformationPolicies?.find(p => p.policyId === policyId);
    return policy?.policyName || policy?.name || '-';
  };

  const handleView = (mapping: Mapping) => toMappingDetails(mapping.mappingId);
  const handleEdit = () => selectedMappings.length === 1 && toMappingEdit(selectedMappings[0].mappingId);
  const handleDelete = () => selectedMappings.length === 1 && onDeleteClick(selectedMappings[0]);

  const columnDefinitions = useMemo(() => createMappingColumns(handleView, getOriginName, getPolicyName), [allOrigins, transformationPolicies]);

  return (
    <>
    <Table
      columnDefinitions={columnDefinitions}
      items={filteredMappings}
      selectedItems={selectedMappings}
      onSelectionChange={({ detail }) => setSelectedMappings(detail.selectedItems)}
      selectionType="single"
      loading={loading}
      loadingText="Loading mappings..."
      ariaLabels={{
        selectionGroupLabel: "Mapping selection",
        allItemsSelectionLabel: ({ selectedItems }) => `${selectedItems.length} mapping selected`,
        itemSelectionLabel: ({ selectedItems }, item) => item.name
      }}
      header={
        <MappingTableHeader
          count={filteredMappings?.length || 0}
          selectedCount={selectedMappings?.length || 0}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onCreate={() => toMappingCreate()}
        />
      }
      filter={
        <TextFilter
          filteringPlaceholder="Find mappings"
          filteringText={filteringText}
          onChange={({ detail }) => setFilteringText(detail.filteringText)}
        />
      }
      empty={
        <Box textAlign="center" color="inherit">
          <Box fontWeight="bold">No mappings</Box>
          <Box padding={{ bottom: "s" }} variant="p" color="inherit">
            No mappings found. Total mappings available: {filteredMappings?.length || 0}
          </Box>
          <Button onClick={toMappingCreate}>Create mapping</Button>
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
          Load more mappings
        </Button>
      </Box>
    )}
  </>
  );
};