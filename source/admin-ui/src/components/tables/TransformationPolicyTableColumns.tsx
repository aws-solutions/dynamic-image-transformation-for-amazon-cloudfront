import React from 'react';
import { Link, Badge, SpaceBetween } from '@cloudscape-design/components';
import { TransformationPolicy } from '@data-models';
import { ROUTES } from '../../constants/routes';

export const createTransformationPolicyColumns = (handleView: (policy: TransformationPolicy) => void) => [
  {
    id: 'policyName',
    header: 'Policy Name',
    cell: (policy: TransformationPolicy) => (
      <Link 
        href={ROUTES.TRANSFORMATION_POLICY_DETAILS.replace(':id', policy.policyId)}
        onFollow={(event) => {
          event.preventDefault();
          handleView(policy);
        }}
      >
        <SpaceBetween direction="horizontal" size="xs">
          <span key="name" style={{ color: 'black' }}>{policy.policyName}</span>
          {policy.isDefault && <Badge key="badge" color="green">Default</Badge>}
        </SpaceBetween>
      </Link>
    ),
    isRowHeader: true,
    width: 300
  },
  {
    id: 'description',
    header: 'Description',
    cell: (policy: TransformationPolicy) => policy.description || '-',
    width: 250
  },
  {
    id: 'transformations',
    header: 'Transformations',
    cell: (policy: TransformationPolicy) => policy.policyJSON.transformations?.length || 0,
    width: 150
  }
];