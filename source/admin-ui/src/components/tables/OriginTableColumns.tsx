import React from 'react';
import { Box, Link } from '@cloudscape-design/components';
import { Origin } from '@data-models';
import { ROUTES } from '../../constants/routes';

export const createOriginColumns = (onView: (origin: Origin) => void) => [
  {
    id: 'name',
    header: 'Origin Name',
    cell: (item: Origin) => (
      <Link 
        href={ROUTES.ORIGIN_DETAILS.replace(':id', item.originId)}
        onFollow={(event) => {
          event.preventDefault();
          onView(item);
        }}
      >
        <span style={{ color: 'black' }}>{item.originName}</span>
      </Link>
    ),
    sortingField: 'originName',
    isRowHeader: true,
    width: 300
  },
  {
    id: 'domain',
    header: 'Domain',
    cell: (item: Origin) => item.originDomain,
    sortingField: 'originDomain',
    width: 200
  },
  {
    id: 'path',
    header: 'Path',
    cell: (item: Origin) => item.originPath || '/',
    sortingField: 'originPath',
    width: 150
  },
  {
    id: 'headers',
    header: 'Custom Headers',
    cell: (item: Origin) => Object.keys(item.originHeaders || {}).length,
    width: 120
  }
];