import React, { useMemo } from 'react';
import { Table, Box, Button, TextFilter } from '@cloudscape-design/components';
import { TransformationPolicy } from '@data-models';
import { useTransformationPolicyContext } from '../../contexts/TransformationPolicyContext';
import { useTransformationPolicyFilters } from '../../hooks/useTransformationPolicyFilters';
import { useTypedNavigate } from '../../hooks/useTypedNavigate';
import { TransformationPolicyTableHeader } from './TransformationPolicyTableHeader';
import { createTransformationPolicyColumns } from './TransformationPolicyTableColumns';

interface TransformationPolicyTableProps {
  onDeleteClick: (policy: TransformationPolicy) => void;
}

export const TransformationPolicyTable: React.FC<TransformationPolicyTableProps> = ({ onDeleteClick }) => {
  const { toPolicyDetails, toPolicyEdit, toPolicyCreate } = useTypedNavigate();
  const { 
    allPolicies, 
    selectedPolicies, 
    setSelectedPolicies, 
    loading, 
    hasNext, 
    loadMore 
  } = useTransformationPolicyContext();
  
  const { filteringText, setFilteringText, filteredPolicies } = useTransformationPolicyFilters(allPolicies || []);

  const handleView = (policy: TransformationPolicy) => toPolicyDetails(policy.policyId);
  const handleEdit = () => selectedPolicies.length === 1 && toPolicyEdit(selectedPolicies[0].policyId);
  const handleDelete = () => selectedPolicies.length === 1 && onDeleteClick(selectedPolicies[0]);

  const columnDefinitions = useMemo(() => createTransformationPolicyColumns(handleView), []);

  return (
    <>
      <Table
        columnDefinitions={columnDefinitions}
        items={filteredPolicies}
        selectedItems={selectedPolicies}
        onSelectionChange={({ detail }) => setSelectedPolicies(detail.selectedItems)}
        selectionType="single"
        loading={loading}
        loadingText="Loading transformation policies..."
        ariaLabels={{
          selectionGroupLabel: "Policy selection",
          allItemsSelectionLabel: ({ selectedItems }) => `${selectedItems.length} policy selected`,
          itemSelectionLabel: ({ selectedItems }, item) => item.policyName
        }}
        header={
          <TransformationPolicyTableHeader
            count={filteredPolicies?.length || 0}
            selectedCount={selectedPolicies?.length || 0}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onCreate={toPolicyCreate}
          />
        }
        filter={
          <TextFilter
            filteringText={filteringText}
            onChange={({ detail }) => setFilteringText(detail.filteringText)}
            filteringPlaceholder="Search policies by name or description"
            filteringAriaLabel="Filter policies"
          />
        }
        empty={
          <Box textAlign="center" color="inherit">
            <Box fontWeight="bold">No transformation policies</Box>
            <Box padding={{ bottom: "s" }} variant="p" color="inherit">
              No transformation policies found. Total policies available: {filteredPolicies?.length || 0}
            </Box>
            <Button onClick={toPolicyCreate}>Create policy</Button>
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
            Load more policies
          </Button>
        </Box>
      )}
    </>
  );
};